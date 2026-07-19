// Riff playback engine on react-native-audio-api (Web Audio).
//
// Notes are scheduled as AudioBufferSourceNodes on the audio clock — no
// setTimeout-fired note onsets, no per-note WAV files, no bridge-latency
// volume stepping. Tones come from ToneBank at natural ring length and are
// choked with sample-accurate gain ramps when their string is struck again.
// JS timers remain only for control flow (playhead callbacks, loop re-entry,
// end-of-playback), where a few ms of drift is invisible.

import { useEffect, useCallback, useMemo, useRef } from 'react';
import type { AudioBufferSourceNode, GainNode } from 'react-native-audio-api';
import { TabEvent, GuitarString, Technique } from '../engine/types';
import { PlaybackGraph } from './playbackGraph';
import {
  ToneBank,
  ToneSpec,
  ACCENT_TICK_VOLUME,
  SUB_TICK_VOLUME,
} from './toneBank';
import { fretToMidiNote } from './noteMapping';

const STRING_TO_INDEX: Record<GuitarString, number> = {
  E: 0,
  A: 1,
  D: 2,
  G: 3,
  B: 4,
  e: 5,
};

// Same-string choke: fade the old note out over 25ms starting at the new
// note's onset (a fretting hand damping the string).
const CHOKE_FADE_S = 0.025;
// Lead time between scheduling and the first sound — enough to enqueue every
// source; short enough that the play button still feels instant.
const START_LATENCY_S = 0.08;
// Schedule the next loop iteration this far before the current one ends. The
// downbeat itself stays sample-accurate (anchored to the audio clock); this
// only controls when the JS scheduling work happens.
const LOOP_LOOKAHEAD_MS = 250;
const STRUM_INTERVAL_S = 0.012;
const STEPS_PER_BEAT = 4;

interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  /** Gain value the note was scheduled with, for choke-ramp anchoring. */
  volume: number;
  /** -1 for metronome ticks (no choke tracking). */
  stringIndex: number;
  endTime: number;
}

interface AudioEngineConfig {
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
  onStepPlay?: (step: number) => void;
}

export interface PlayOptions {
  /** One bar (4 beats) of clicks before the riff starts. */
  countIn?: boolean;
  /** Click on every beat during playback, accented on bar downbeats. */
  metronome?: boolean;
}

interface LoopContext {
  events: TabEvent[];
  secPerStep: number;
  totalDurationS: number;
  metronome: boolean;
  /** Count-in length for the FIRST iteration only; consumed by scheduleIteration. */
  pendingCountInS: number;
}

function eventToneSpec(event: TabEvent): ToneSpec {
  return {
    midiNote: fretToMidiNote(event.string, event.fret),
    velocity: event.velocity ?? 0.7,
    guitarString: event.string,
    technique: event.technique ?? undefined,
  };
}

class AudioEngineImpl {
  private timers: ReturnType<typeof setTimeout>[] = [];
  private activeVoices = new Set<Voice>();
  private lastVoiceOnString: (Voice | null)[] = new Array(6).fill(null);
  private isPlaying = false;
  private isLooping = false;
  private loopContext: LoopContext | null = null;
  private config: AudioEngineConfig = {};
  /** Bumped by every play()/stop(); stale async work checks it and bails. */
  private playToken = 0;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        await PlaybackGraph.initialize();
        ToneBank.init(PlaybackGraph.context);
        this.isInitialized = true;
      } catch (error) {
        // Stay uninitialized so the next play() retries, and rethrow so a
        // failure can never masquerade as working audio.
        this.initPromise = null;
        throw error;
      }
    })();
    return this.initPromise;
  }

  setConfig(config: AudioEngineConfig): void {
    this.config = config;
  }

  async play(
    events: TabEvent[],
    bpm: number,
    loop: boolean = false,
    options: PlayOptions = {}
  ): Promise<void> {
    this.stop();
    const token = ++this.playToken;

    if (events.length === 0) return;

    try {
      await this.initialize();
    } catch (error) {
      console.error('AudioEngine: init failed, cannot play:', error);
      return;
    }
    if (token !== this.playToken) return;

    this.isPlaying = true;
    this.isLooping = loop;
    this.config.onPlaybackStart?.();

    const secPerStep = 60 / bpm / STEPS_PER_BEAT;
    const maxStep = Math.max(
      ...events.map((e) => e.step + (e.swingOffset ?? 0) + e.duration)
    );
    const totalDurationS = maxStep * secPerStep;
    const secPerBeat = secPerStep * STEPS_PER_BEAT;

    // Synthesize any missing tone buffers first (cached across riffs, loops,
    // and tempo changes — the cache key has no duration in it).
    await ToneBank.ensure(
      PlaybackGraph.context,
      events.map(eventToneSpec),
      () => token !== this.playToken
    );
    if (token !== this.playToken || !this.isPlaying) return;

    this.loopContext = {
      events,
      secPerStep,
      totalDurationS,
      metronome: options.metronome ?? false,
      pendingCountInS: options.countIn ? 4 * secPerBeat : 0,
    };
    this.scheduleIteration(
      PlaybackGraph.context.currentTime + START_LATENCY_S,
      token
    );
  }

  private scheduleIteration(iterStart: number, token: number): void {
    if (!this.loopContext || !this.isPlaying || token !== this.playToken) {
      return;
    }
    const ctx = PlaybackGraph.context;
    const { events, secPerStep, totalDurationS, metronome } = this.loopContext;

    // Count-in applies to the first iteration only; loops re-enter at the downbeat.
    const countInS = this.loopContext.pendingCountInS;
    this.loopContext.pendingCountInS = 0;

    const secPerBeat = secPerStep * STEPS_PER_BEAT;
    const notesStart = iterStart + countInS;

    if (countInS > 0) {
      for (let b = 0; b < 4; b++) {
        this.startTick(iterStart + b * secPerBeat, b === 0);
      }
    }

    if (metronome) {
      const totalBeats = Math.max(1, Math.round(totalDurationS / secPerBeat));
      for (let b = 0; b < totalBeats; b++) {
        this.startTick(notesStart + b * secPerBeat, b % 4 === 0);
      }
    }

    // Fresh grouped jitter per iteration so loops don't sound mechanical.
    const stepJitter = new Map<number, number>();
    for (const event of events) {
      if (!stepJitter.has(event.step)) {
        const isDownbeat = (event.step % 16) % 4 === 0;
        const jitterRange = isDownbeat ? 0.003 : 0.008;
        stepJitter.set(event.step, (Math.random() - 0.5) * 2 * jitterRange);
      }
    }

    // Playhead callbacks ride JS timers aimed at the audio-clock times.
    if (this.config.onStepPlay) {
      const scheduledSteps = new Set<number>();
      for (const event of events) {
        if (scheduledSteps.has(event.step)) continue;
        scheduledSteps.add(event.step);
        const step = event.step;
        const t =
          notesStart +
          (event.step + (event.swingOffset ?? 0)) * secPerStep +
          (stepJitter.get(event.step) ?? 0);
        this.addTimerAt(t, () => {
          if (token === this.playToken) this.config.onStepPlay?.(step);
        });
      }
    }

    // Count simultaneous notes per step for polyphony mixing.
    const stepNoteCounts = new Map<number, number>();
    for (const event of events) {
      stepNoteCounts.set(event.step, (stepNoteCounts.get(event.step) ?? 0) + 1);
    }

    // Chokes are scheduled ahead of time, so notes MUST be processed in
    // chronological order per string — lastVoiceOnString tracks the
    // temporally-previous note. Stable sort keeps within-step strum order.
    const ordered = [...events].sort(
      (a, b) =>
        a.step + (a.swingOffset ?? 0) - (b.step + (b.swingOffset ?? 0))
    );
    const stepStrumIndex = new Map<number, number>();

    for (const event of ordered) {
      const buffer = ToneBank.get(eventToneSpec(event));
      if (!buffer) continue;

      const velocity = event.velocity ?? 0.7;
      const count = stepNoteCounts.get(event.step) ?? 1;
      const polyScale = count > 1 ? 1 / Math.sqrt(count) : 1;

      const strumIdx = stepStrumIndex.get(event.step) ?? 0;
      stepStrumIndex.set(event.step, strumIdx + 1);
      const strumDelay = count > 1 ? strumIdx * STRUM_INTERVAL_S : 0;

      const t = Math.max(
        ctx.currentTime + 0.005,
        notesStart +
          (event.step + (event.swingOffset ?? 0)) * secPerStep +
          (stepJitter.get(event.step) ?? 0) +
          strumDelay
      );
      this.startVoice(
        buffer,
        STRING_TO_INDEX[event.string],
        velocity * polyScale,
        t
      );
    }

    // Loop is re-checked at the seam (not latched at schedule time) so
    // toggling it mid-iteration behaves like the old engine. Looping
    // iterations are scheduled early on a JS timer, but the downbeat itself
    // is `iterEnd` on the audio clock, so the seam is sample-accurate
    // regardless of timer slop.
    const iterEnd = notesStart + totalDurationS;
    const fireInMs = Math.max(
      0,
      (iterEnd - ctx.currentTime) * 1000 - LOOP_LOOKAHEAD_MS
    );
    this.timers.push(
      setTimeout(() => {
        if (token !== this.playToken || !this.isPlaying) return;
        if (this.isLooping && this.loopContext) {
          this.scheduleIteration(iterEnd, token);
        } else {
          // Not looping (or toggled off): finish at the musical end. The
          // final notes keep ringing out through the bus — the old engine's
          // hard stopAll here was the chop. A loop toggled on inside the
          // last LOOP_LOOKAHEAD_MS still re-enters, just without lookahead.
          this.addTimerAt(iterEnd, () => {
            if (token !== this.playToken) return;
            if (this.isLooping && this.loopContext) {
              this.scheduleIteration(iterEnd, token);
            } else {
              this.finishPlayback();
            }
          });
        }
      }, fireInMs)
    );
  }

  /** Schedule `cb` at an audio-clock time via setTimeout (control flow only). */
  private addTimerAt(audioTime: number, cb: () => void): void {
    const delayMs = Math.max(
      0,
      (audioTime - PlaybackGraph.context.currentTime) * 1000
    );
    this.timers.push(setTimeout(cb, delayMs));
  }

  private startTick(t: number, accent: boolean): void {
    const buffer = ToneBank.getTick(accent);
    if (!buffer) return;
    const ctx = PlaybackGraph.context;
    const gain = ctx.createGain();
    gain.gain.value = accent ? ACCENT_TICK_VOLUME : SUB_TICK_VOLUME;
    PlaybackGraph.connectDry(gain);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);

    const voice: Voice = {
      source,
      gain,
      volume: gain.gain.value,
      stringIndex: -1,
      endTime: t + buffer.duration,
    };
    source.onEnded = () => this.activeVoices.delete(voice);
    source.start(t);
    this.activeVoices.add(voice);
  }

  private startVoice(
    buffer: NonNullable<ReturnType<typeof ToneBank.get>>,
    stringIndex: number,
    volume: number,
    t: number
  ): Voice {
    const ctx = PlaybackGraph.context;
    const clampedVolume = Math.min(1, volume);

    const gain = ctx.createGain();
    gain.gain.value = clampedVolume;
    PlaybackGraph.connectNote(gain);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);

    // A new note on a string chokes whatever is still ringing there.
    this.chokeString(stringIndex, t);

    const voice: Voice = {
      source,
      gain,
      volume: clampedVolume,
      stringIndex,
      endTime: t + buffer.duration,
    };
    source.onEnded = () => {
      this.activeVoices.delete(voice);
      if (
        stringIndex >= 0 &&
        this.lastVoiceOnString[stringIndex] === voice
      ) {
        this.lastVoiceOnString[stringIndex] = null;
      }
    };
    source.start(t);
    this.activeVoices.add(voice);
    if (stringIndex >= 0) {
      this.lastVoiceOnString[stringIndex] = voice;
    }
    return voice;
  }

  /** Sample-accurate 25ms fade on the previous note of a string, at time t. */
  private chokeString(stringIndex: number, t: number): void {
    if (stringIndex < 0) return;
    const prev = this.lastVoiceOnString[stringIndex];
    if (!prev || prev.endTime <= t) return;
    try {
      prev.gain.gain.setValueAtTime(prev.volume, t);
      prev.gain.gain.linearRampToValueAtTime(0, t + CHOKE_FADE_S);
      prev.source.stop(t + CHOKE_FADE_S + 0.005);
      prev.endTime = t + CHOKE_FADE_S + 0.005;
    } catch {
      // The source may already have ended naturally.
    }
  }

  private finishPlayback(): void {
    this.isPlaying = false;
    this.isLooping = false;
    this.loopContext = null;
    this.clearTimers();
    this.config.onStepPlay?.(-1);
    this.config.onPlaybackEnd?.();
  }

  stop(): void {
    this.playToken++;
    const wasPlaying = this.isPlaying;
    this.isPlaying = false;
    this.isLooping = false;
    this.loopContext = null;
    this.clearTimers();
    this.stopAllNotes();
    if (wasPlaying) {
      this.config.onStepPlay?.(-1);
      this.config.onPlaybackEnd?.();
    }
  }

  /**
   * Fade every sounding (and cancel every pending) voice. Also the stop path
   * for direct note playback (Chord Armory).
   */
  stopAllNotes(): void {
    if (!this.isInitialized) return;
    const now = PlaybackGraph.context.currentTime;
    for (const voice of this.activeVoices) {
      try {
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
        voice.gain.gain.linearRampToValueAtTime(0, now + 0.06);
        // Also cancels sources scheduled to start in the future.
        voice.source.stop(now + 0.08);
      } catch {
        // Already ended.
      }
    }
    this.activeVoices.clear();
    this.lastVoiceOnString.fill(null);
  }

  /**
   * Immediate one-off note (Chord Armory previews/progressions). durationMs is
   * accepted for compatibility but the note rings naturally until its string
   * is struck again or stopAllNotes() is called.
   */
  async playNote(
    guitarString: GuitarString,
    fret: number,
    velocity: number = 0.7,
    _durationMs?: number,
    technique?: Technique,
    playbackVolume?: number
  ): Promise<void> {
    try {
      await this.initialize();
    } catch (error) {
      console.error('AudioEngine: init failed, cannot play note:', error);
      return;
    }
    const spec: ToneSpec = {
      midiNote: fretToMidiNote(guitarString, fret),
      velocity,
      guitarString,
      technique,
    };
    await ToneBank.ensure(PlaybackGraph.context, [spec]);
    const buffer = ToneBank.get(spec);
    if (!buffer) return;
    this.startVoice(
      buffer,
      STRING_TO_INDEX[guitarString],
      playbackVolume ?? velocity,
      PlaybackGraph.context.currentTime + 0.005
    );
  }

  /** Pre-synthesize tone buffers so a later playNote()/play() is instant. */
  async prepareTones(specs: ToneSpec[]): Promise<void> {
    try {
      await this.initialize();
    } catch (error) {
      console.error('AudioEngine: init failed, cannot prepare tones:', error);
      return;
    }
    await ToneBank.ensure(PlaybackGraph.context, specs);
  }

  setLoop(loop: boolean): void {
    this.isLooping = loop;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  private clearTimers(): void {
    for (const id of this.timers) {
      clearTimeout(id);
    }
    this.timers = [];
  }
}

export const AudioEngine = new AudioEngineImpl();

export interface UseAudioEngineOptions {
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
  onStepPlay?: (step: number) => void;
}

export interface AudioEngineRef {
  play: (events: TabEvent[], bpm: number, loop?: boolean, options?: PlayOptions) => Promise<void>;
  stop: () => void;
  setLoop: (loop: boolean) => void;
  initialize: () => Promise<void>;
}

export function useAudioEngine(options: UseAudioEngineOptions = {}): AudioEngineRef {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    AudioEngine.setConfig({
      onPlaybackStart: () => optionsRef.current.onPlaybackStart?.(),
      onPlaybackEnd: () => optionsRef.current.onPlaybackEnd?.(),
      onStepPlay: (step: number) => optionsRef.current.onStepPlay?.(step),
    });

    AudioEngine.initialize().catch((error) => {
      console.error('AudioEngine: initialization failed:', error);
    });

    return () => {
      AudioEngine.stop();
    };
  }, []);

  const play = useCallback(async (events: TabEvent[], bpm: number, loop?: boolean, options?: PlayOptions) => {
    await AudioEngine.play(events, bpm, loop, options);
  }, []);

  const stop = useCallback(() => {
    AudioEngine.stop();
  }, []);

  const setLoop = useCallback((loop: boolean) => {
    AudioEngine.setLoop(loop);
  }, []);

  const initialize = useCallback(async () => {
    await AudioEngine.initialize();
  }, []);

  // Stable object identity: screens put this in effect deps (Today's focus
  // effect stops audio in its cleanup) — a fresh object every render would
  // re-fire those effects per render and kill playback as soon as it starts.
  return useMemo(
    () => ({ play, stop, setLoop, initialize }),
    [play, stop, setLoop, initialize],
  );
}
