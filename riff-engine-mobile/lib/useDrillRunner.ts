/**
 * Runs a practice drill: walks the steps, counts reps off the audio engine,
 * and accumulates what was observed into a RiffResult.
 *
 * The hook takes ownership of the engine's callbacks for as long as it is
 * mounted (see AudioEngine.pushConfig), so the drill sheet can drive playback
 * without the screen underneath having to thread callbacks down into it.
 *
 * Nothing here measures how well anything was played. The app cannot hear the
 * player; a rep is "a pass finished at this tempo" and nothing more, and the
 * UI built on top of it must not imply otherwise.
 */
import { useCallback, useMemo, useRef, useState } from "react";

import { AudioEngine, useAudioEngine } from "../audio/AudioEngine";
import {
  bpmForPct,
  buildDrill,
  Drill,
  DrillStep,
  planRun,
  repsForStep,
  rungForRep,
} from "../engine/riff/drill";
import { RiffSpec } from "../engine/riff/spec";
import { riffSpecToEvents } from "../engine/riff/toEvents";
import { TabEvent } from "../engine/types";
import { useNewRiffStore } from "../store/useNewRiffStore";
import { RiffResult } from "../store/usePracticeStore";
import { hapticSelect, hapticSuccess, hapticTap } from "./haptics";

const STEPS_PER_BAR = 16;

export type DrillPhase =
  /** Between runs — nothing playing, waiting on the player. */
  | "idle"
  /** Audio is running and reps are being counted. */
  | "running"
  /** This step's reps are met; the next one waits behind a tap. */
  | "stepDone"
  /** Every step is behind us. */
  | "finished";

/** What the drill saw. Never an accuracy judgement — only that reps happened. */
export interface Observed {
  reps: number;
  topTempoPct: number;
  barsLooped: number[];
  seconds: number;
}

interface RunnerState {
  stepIndex: number;
  phase: DrillPhase;
  repsInStep: number;
  observed: Observed;
}

export interface DrillRunner {
  drill: Drill;
  step: DrillStep;
  stepIndex: number;
  phase: DrillPhase;
  /** Reps observed in the current step, and how many it asks for. */
  repsInStep: number;
  stepReps: number;
  tempoPct: number;
  bpm: number;
  /** The bar this step loops, or null for the whole riff. */
  barIndex: number | null;
  /** Absolute step (0-63) under the playhead; null when nothing is sounding. */
  activeStep: number | null;
  observed: Observed;
  start: () => void;
  pause: () => void;
  skipStep: () => void;
  nextStep: () => void;
  /**
   * The result to persist. Null when an abandoned drill observed nothing — an
   * empty record would tell a later skill model the player struggled, when in
   * fact they never played a note.
   */
  buildResult: (completed: boolean) => RiffResult | null;
}

/** Distinct techniques present in a riff, for the stored result. */
function techniquesIn(riff: RiffSpec): string[] {
  const seen = new Set<string>();
  for (const bar of riff.bars) {
    for (const note of bar.notes) seen.add(note.technique);
  }
  return [...seen].sort();
}

export function useDrillRunner(riff: RiffSpec): DrillRunner {
  const drill = useMemo(() => buildDrill(riff), [riff]);
  const metronomeEnabled = useNewRiffStore((s) => s.metronomeEnabled);

  const [state, setState] = useState<RunnerState>(() => ({
    stepIndex: 0,
    phase: "idle",
    repsInStep: 0,
    observed: { reps: 0, topTempoPct: 0, barsLooped: [], seconds: 0 },
  }));
  const [activeStep, setActiveStep] = useState<number | null>(null);

  // The engine calls back from timers, so the state machine reads a ref rather
  // than a render-captured value; `commit` keeps the two in step.
  const stateRef = useRef(state);
  const commit = useCallback((next: RunnerState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  /** Wall-clock start of the current run, for the seconds tally. */
  const runStartRef = useRef<number | null>(null);
  /** Reps this run was scheduled to deliver; a shorter one is a fault. */
  const runTargetRef = useRef(0);
  /**
   * play() stops first, which fires onPlaybackEnd for the run being replaced.
   * That end is ours, not the engine's, and must not drive the machine.
   */
  const selfEndRef = useRef(false);
  /** Set once `run` exists; handlePlaybackEnd needs it and is defined first. */
  const runRef = useRef<(stepIndex: number, repsDone: number) => void>(() => {});

  const metronomeRef = useRef(metronomeEnabled);
  metronomeRef.current = metronomeEnabled;

  const wholeEvents = useMemo(() => riffSpecToEvents(riff), [riff]);

  /** Events for a step: the whole riff, or one bar re-based to step 0. */
  const eventsForStep = useCallback(
    (step: DrillStep): { events: TabEvent[]; bars: number } => {
      const whole = { events: wholeEvents, bars: riff.bars.length };
      if (step.barIndex === null) return whole;
      const start = step.barIndex * STEPS_PER_BAR;
      const bar = wholeEvents
        .filter((e) => e.step >= start && e.step < start + STEPS_PER_BAR)
        .map((e) => ({ ...e, step: e.step - start }));
      // A bar of pure rests can't be looped; fall back to the whole riff so the
      // step still does something rather than silently playing nothing.
      return bar.length === 0 ? whole : { events: bar, bars: 1 };
    },
    [wholeEvents, riff.bars.length],
  );

  const flushSeconds = useCallback((observed: Observed): Observed => {
    if (runStartRef.current == null) return observed;
    const elapsed = (Date.now() - runStartRef.current) / 1000;
    runStartRef.current = null;
    return { ...observed, seconds: observed.seconds + elapsed };
  }, []);

  const handleIteration = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== "running") return;
    const step = drill.steps[s.stepIndex];
    const playedAtPct = rungForRep(step, s.repsInStep).tempoPct;
    const repsInStep = s.repsInStep + 1;

    const barsLooped =
      step.barIndex !== null && !s.observed.barsLooped.includes(step.barIndex)
        ? [...s.observed.barsLooped, step.barIndex].sort((a, b) => a - b)
        : s.observed.barsLooped;

    commit({
      ...s,
      repsInStep,
      observed: {
        ...s.observed,
        reps: s.observed.reps + 1,
        topTempoPct: Math.max(s.observed.topTempoPct, playedAtPct),
        barsLooped,
      },
    });
    hapticSelect();

    // The seam after the pass now in flight was decided a lookahead before this
    // callback fired, so the loop has to be switched off a whole pass before
    // the run is due to end — otherwise stopping it would chop a pass that has
    // already begun sounding.
    if (repsInStep === runTargetRef.current - 1) AudioEngine.setLoop(false);
  }, [drill, commit]);

  const handlePlaybackEnd = useCallback(() => {
    setActiveStep(null);
    if (selfEndRef.current) return;
    const s = stateRef.current;
    if (s.phase !== "running") return;

    const observed = flushSeconds(s.observed);
    const step = drill.steps[s.stepIndex];

    if (s.repsInStep >= repsForStep(step)) {
      const last = s.stepIndex === drill.steps.length - 1;
      commit({ ...s, observed, phase: last ? "finished" : "stepDone" });
      if (last) hapticSuccess();
      return;
    }

    if (s.repsInStep >= runTargetRef.current) {
      // The rung is done but the step isn't — step the tempo up, keep going.
      commit({ ...s, observed });
      runRef.current(s.stepIndex, s.repsInStep);
      return;
    }

    // Ended short (failed init, an interruption): hold where we are rather than
    // restart, so a fault can't spin the drill round in a loop.
    commit({ ...s, observed, phase: "idle" });
  }, [drill, commit, flushSeconds]);

  useAudioEngine({
    onPlaybackStart: () => {
      runStartRef.current = Date.now();
    },
    onPlaybackEnd: handlePlaybackEnd,
    onStepPlay: (step) => {
      if (step < 0) {
        setActiveStep(null);
        return;
      }
      // The engine reports steps within whatever it was handed, and a looped
      // bar was re-based to zero — put it back where the tab draws it.
      const bar = drill.steps[stateRef.current.stepIndex]?.barIndex ?? null;
      setActiveStep(bar === null ? step : bar * STEPS_PER_BAR + step);
    },
    onIteration: handleIteration,
  });

  /**
   * Play the block of passes sitting at one tempo rung.
   *
   * Always counted in, whatever the player's count-in preference: a guided
   * drill has to tell you when to start playing along, and at a tempo change
   * those four clicks double as the gap covering the engine's restart.
   */
  const run = useCallback(
    (stepIndex: number, repsDone: number) => {
      const step = drill.steps[stepIndex];
      const plan = planRun(step, repsDone);
      runTargetRef.current = plan.endsAtRep;

      const { events, bars } = eventsForStep(step);
      selfEndRef.current = true;
      void AudioEngine.play(
        events,
        bpmForPct(riff.tempo_bpm, plan.tempoPct),
        plan.loop,
        { bars, countIn: true, metronome: metronomeRef.current },
      );
      selfEndRef.current = false;
    },
    [drill, eventsForStep, riff.tempo_bpm],
  );
  runRef.current = run;

  const stopAudio = useCallback(() => {
    selfEndRef.current = true;
    AudioEngine.stop();
    selfEndRef.current = false;
  }, []);

  const start = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== "idle") return;
    hapticTap();
    commit({ ...s, phase: "running" });
    run(s.stepIndex, s.repsInStep);
  }, [commit, run]);

  const pause = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== "running") return;
    hapticTap();
    commit({ ...s, phase: "idle", observed: flushSeconds(s.observed) });
    stopAudio();
  }, [commit, flushSeconds, stopAudio]);

  /** Leave a step behind, met or not. Every step is skippable by design. */
  const skipStep = useCallback(() => {
    const s = stateRef.current;
    if (s.phase === "finished") return;
    hapticTap();
    const observed = flushSeconds(s.observed);
    stopAudio();
    const last = s.stepIndex === drill.steps.length - 1;
    commit({
      stepIndex: last ? s.stepIndex : s.stepIndex + 1,
      repsInStep: 0,
      phase: last ? "finished" : "idle",
      observed,
    });
  }, [commit, flushSeconds, stopAudio, drill]);

  /** Move on from a met step. Deliberately a tap, so its brief gets read. */
  const nextStep = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== "stepDone") return;
    hapticTap();
    commit({
      stepIndex: Math.min(s.stepIndex + 1, drill.steps.length - 1),
      repsInStep: 0,
      phase: "idle",
      observed: s.observed,
    });
  }, [commit, drill]);

  const buildResult = useCallback(
    (completed: boolean): RiffResult | null => {
      const observed = flushSeconds(stateRef.current.observed);
      if (!completed && observed.reps === 0) return null;
      return {
        seed: riff.seed,
        rhythm: riff.rhythm_name,
        techniques: techniquesIn(riff),
        topTempoPct: observed.topTempoPct,
        reps: observed.reps,
        barsLooped: observed.barsLooped,
        seconds: Math.round(observed.seconds),
        completed,
      };
    },
    [flushSeconds, riff],
  );

  const step = drill.steps[state.stepIndex];
  const { tempoPct } = rungForRep(step, state.repsInStep);

  return {
    drill,
    step,
    stepIndex: state.stepIndex,
    phase: state.phase,
    repsInStep: state.repsInStep,
    stepReps: repsForStep(step),
    tempoPct,
    bpm: bpmForPct(riff.tempo_bpm, tempoPct),
    barIndex: step.barIndex,
    activeStep: state.phase === "running" ? activeStep : null,
    observed: state.observed,
    start,
    pause,
    skipStep,
    nextStep,
    buildResult,
  };
}
