/**
 * The practice drill: how to work a riff up, as data.
 *
 * "Mark done" asked the player to self-report a single bit, which taught
 * nothing and measured nothing. A drill instead walks the method a teacher
 * would: learn the hard bar slowly on a loop, build the tempo back up over the
 * whole riff, then play it through once at speed.
 *
 * Every step is skippable. The app cannot hear the player, so it can never
 * judge whether a rep was *good* — only that it happened. Everything here is
 * therefore phrased and recorded as "reps observed at a tempo", never as
 * accuracy, and the UI should not imply otherwise.
 */
import { analyzeRiff, coachingFor } from "./coaching";
import { RiffSpec } from "./spec";

export type DrillStepId = "learn" | "build" | "play";

/** Never drop below this, however slow the riff's own tempo is. */
const MIN_BPM = 45;

/** Tempo rungs, as a percentage of the riff's own tempo. */
const LEARN_PCT = 55;
const BUILD_PCTS = [70, 85] as const;
const FULL_PCT = 100;

const LEARN_REPS = 4;
const BUILD_REPS_PER_RUNG = 2;

export interface DrillStep {
  id: DrillStepId;
  /** Step name for the stepper, e.g. "Learn". */
  label: string;
  /** What this step is, concretely: "Bar 2 at 55%". */
  title: string;
  /** Why, in one sentence. */
  instruction: string;
  /** Bar to loop, or null for the whole riff. */
  barIndex: number | null;
  /** Tempo rungs walked in order; each needs `repsPerRung` reps. */
  tempoPcts: number[];
  repsPerRung: number;
  loop: boolean;
}

export interface Drill {
  steps: DrillStep[];
  /** Reps needed to finish every step, if nothing is skipped. */
  totalReps: number;
}

/** Actual bpm for a tempo rung, floored so slow riffs stay countable. */
export function bpmForPct(riffTempo: number, pct: number): number {
  return Math.max(MIN_BPM, Math.round((riffTempo * pct) / 100));
}

/** Reps a step needs across all its rungs. */
export function repsForStep(step: DrillStep): number {
  return step.tempoPcts.length * step.repsPerRung;
}

/**
 * Build the drill for a riff.
 *
 * The "learn" step targets the bar the coaching analysis rates hardest, and
 * borrows the riff's top coaching tip as its instruction — so the thing you're
 * told to concentrate on is the same thing the coaching card led with, rather
 * than generic practice advice.
 */
export function buildDrill(riff: RiffSpec): Drill {
  const analysis = analyzeRiff(riff);
  const topTip = coachingFor(riff).tips[0];
  const hardBar = analysis.hardestBarIndex;

  const steps: DrillStep[] = [
    {
      id: "learn",
      label: "Learn",
      title: `Bar ${hardBar + 1} at ${LEARN_PCT}%`,
      instruction:
        topTip?.body ??
        `Loop the busiest bar slowly until the shape is under your fingers.`,
      barIndex: hardBar,
      tempoPcts: [LEARN_PCT],
      repsPerRung: LEARN_REPS,
      loop: true,
    },
    {
      id: "build",
      label: "Build",
      title: `Whole riff, ${BUILD_PCTS[0]}% → ${BUILD_PCTS[BUILD_PCTS.length - 1]}%`,
      instruction:
        `Now the whole thing, getting quicker. If a bar falls apart, drop back ` +
        `a rung — speed you can't hold isn't speed yet.`,
      barIndex: null,
      tempoPcts: [...BUILD_PCTS],
      repsPerRung: BUILD_REPS_PER_RUNG,
      loop: true,
    },
    {
      id: "play",
      label: "Play",
      title: `Full tempo, once`,
      instruction:
        `One clean pass at full speed. Play it like you mean it rather than ` +
        `like you're checking it.`,
      barIndex: null,
      tempoPcts: [FULL_PCT],
      repsPerRung: 1,
      loop: false,
    },
  ];

  return { steps, totalReps: steps.reduce((n, s) => n + repsForStep(s), 0) };
}

/**
 * Position within a step: which rung a rep count lands on, and how far through.
 * Reps past the end clamp to the last rung so an over-achieving player doesn't
 * fall off the array.
 */
export function rungForRep(
  step: DrillStep,
  repsDone: number,
): { rungIndex: number; tempoPct: number; repsIntoRung: number } {
  const perRung = Math.max(1, step.repsPerRung);
  const rungIndex = Math.min(
    Math.floor(repsDone / perRung),
    step.tempoPcts.length - 1,
  );
  return {
    rungIndex,
    tempoPct: step.tempoPcts[rungIndex],
    repsIntoRung: repsDone - rungIndex * perRung,
  };
}
