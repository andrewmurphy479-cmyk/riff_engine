import { useEffect, useCallback, useRef } from 'react';
import { Audio } from 'expo-av';
import { TabEvent, GuitarString, Technique } from '../engine/types';
import { SamplePlayer } from './SamplePlayer';
import { SampleLoader } from './SampleLoader';
import { fretToMidiNote } from './noteMapping';

interface ScheduledNote {
  timeoutId: ReturnType<typeof setTimeout>;
}

interface AudioEngineConfig {
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
  onStepPlay?: (step: number) => void;
}

interface LoopContext {
  events: TabEvent[];
  msPerStep: number;
  totalDurationMs: number;
}

class AudioEngineImpl {
  private scheduledNotes: ScheduledNote[] = [];
  private isPlaying = false;
  private isLooping = false;
  private loopContext: LoopContext | null = null;
  private isInitialized = false;
  private endTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private config: AudioEngineConfig = {};

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      await SampleLoader.initialize();
      await SamplePlayer.initialize();

      this.isInitialized = true;
      console.log('AudioEngine initialized');
    } catch (error) {
      console.error('Failed to initialize audio engine:', error);
      this.isInitialized = true;
    }
  }

  setConfig(config: AudioEngineConfig): void {
    this.config = config;
  }

  async play(events: TabEvent[], bpm: number, loop: boolean = false): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.stop();

    if (events.length === 0) return;

    this.isPlaying = true;
    this.isLooping = loop;
    this.config.onPlaybackStart?.();

    const stepsPerBeat = 4;
    const msPerStep = (60 / bpm / stepsPerBeat) * 1000;
    const maxStep = Math.max(...events.map(e => e.step + e.duration));
    const totalDurationMs = maxStep * msPerStep;

    // Pre-generate all tones ONCE — tones are cached across loop iterations
    const noteSpecs = events.map(event => ({
      midiNote: fretToMidiNote(event.string, event.fret),
      durationMs: event.duration * msPerStep,
      velocity: event.velocity ?? 0.7,
      technique: event.technique ?? undefined,
      guitarString: event.string,
    }));
    await SamplePlayer.preGenerateTones(noteSpecs);

    // If stopped while pre-generating, bail out
    if (!this.isPlaying) return;

    this.loopContext = { events, msPerStep, totalDurationMs };
    this.scheduleIteration();
  }

  private scheduleIteration(): void {
    if (!this.loopContext || !this.isPlaying) return;
    const { events, msPerStep, totalDurationMs } = this.loopContext;

    // Fresh grouped jitter per iteration so loops don't sound mechanical
    const stepJitter = new Map<number, number>();
    for (const event of events) {
      if (!stepJitter.has(event.step)) {
        const stepInBar = event.step % 16;
        const isDownbeat = stepInBar % 4 === 0;
        const jitterRange = isDownbeat ? 3 : 8;
        stepJitter.set(event.step, (Math.random() - 0.5) * 2 * jitterRange);
      }
    }

    // Schedule step callbacks (one per unique step, at the same humanized time)
    if (this.config.onStepPlay) {
      const scheduledSteps = new Set<number>();
      for (const event of events) {
        if (scheduledSteps.has(event.step)) continue;
        scheduledSteps.add(event.step);
        const delayMs = event.step * msPerStep;
        const jitterMs = stepJitter.get(event.step) ?? 0;
        const humanizedDelay = Math.max(0, delayMs + jitterMs);
        const step = event.step;
        const timeoutId = setTimeout(() => {
          this.config.onStepPlay?.(step);
        }, humanizedDelay);
        this.scheduledNotes.push({ timeoutId });
      }
    }

    // Count simultaneous notes per step for polyphony mixing
    const stepNoteCounts = new Map<number, number>();
    for (const event of events) {
      stepNoteCounts.set(event.step, (stepNoteCounts.get(event.step) ?? 0) + 1);
    }

    // Track strum ordering within each step for micro-stagger
    const stepStrumIndex = new Map<number, number>();
    const STRUM_INTERVAL_MS = 12;

    // Schedule each note with grouped jitter + polyphony mixing
    for (const event of events) {
      const delayMs = event.step * msPerStep;
      const noteDurationMs = event.duration * msPerStep;
      const jitterMs = stepJitter.get(event.step) ?? 0;

      const velocity = event.velocity ?? 0.7;
      const technique = event.technique ?? undefined;

      const count = stepNoteCounts.get(event.step) ?? 1;
      const polyScale = count > 1 ? 1 / Math.sqrt(count) : 1;
      const playbackVolume = velocity * polyScale;

      const strumIdx = stepStrumIndex.get(event.step) ?? 0;
      stepStrumIndex.set(event.step, strumIdx + 1);
      const strumDelay = count > 1 ? strumIdx * STRUM_INTERVAL_MS : 0;

      const humanizedDelay = Math.max(0, delayMs + jitterMs + strumDelay);

      const timeoutId = setTimeout(() => {
        this.playNote(event.string, event.fret, noteDurationMs, velocity, technique, playbackVolume);
      }, humanizedDelay);

      this.scheduledNotes.push({ timeoutId });
    }

    // Loop mode: re-enter right at the downbeat of the next iteration (seamless).
    // Non-loop: add 200ms tail so final notes can decay before cleanup.
    const endDelay = this.isLooping ? totalDurationMs : totalDurationMs + 200;
    this.endTimeoutId = setTimeout(() => {
      this.handlePlaybackEnd();
    }, endDelay);
  }

  private async playNote(
    string: GuitarString,
    fret: number,
    durationMs: number,
    velocity: number = 0.7,
    technique?: Technique,
    playbackVolume?: number
  ): Promise<void> {
    if (!this.isPlaying) return;

    try {
      await SamplePlayer.playNote(string, fret, velocity, durationMs, technique, playbackVolume);
    } catch (error) {
      console.error('Error playing note:', error);
    }
  }

  private handlePlaybackEnd(): void {
    // Loop mode: re-enter scheduleIteration without cleaning up. Ringing tails
    // from the previous iteration are allowed to bleed into the next downbeat.
    if (this.isLooping && this.isPlaying && this.loopContext) {
      this.scheduledNotes = [];
      this.endTimeoutId = null;
      this.scheduleIteration();
      return;
    }

    this.isPlaying = false;
    this.isLooping = false;
    this.loopContext = null;
    this.scheduledNotes = [];
    this.endTimeoutId = null;
    SamplePlayer.stopAll();
    this.config.onStepPlay?.(-1);
    this.config.onPlaybackEnd?.();
  }

  stop(): void {
    // Reset loop intent first so any in-flight end timeout won't re-enter
    this.isLooping = false;
    this.loopContext = null;

    for (const note of this.scheduledNotes) {
      clearTimeout(note.timeoutId);
    }
    this.scheduledNotes = [];

    if (this.endTimeoutId) {
      clearTimeout(this.endTimeoutId);
      this.endTimeoutId = null;
    }

    SamplePlayer.stopAll();

    if (this.isPlaying) {
      this.isPlaying = false;
      this.config.onStepPlay?.(-1);
      this.config.onPlaybackEnd?.();
    }
  }

  setLoop(loop: boolean): void {
    this.isLooping = loop;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  isSynthesisMode(): boolean {
    return SampleLoader.isSynthesisMode();
  }
}

export const AudioEngine = new AudioEngineImpl();

export interface UseAudioEngineOptions {
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
  onStepPlay?: (step: number) => void;
}

export interface AudioEngineRef {
  play: (events: TabEvent[], bpm: number, loop?: boolean) => Promise<void>;
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

    AudioEngine.initialize().catch(console.error);

    return () => {
      AudioEngine.stop();
    };
  }, []);

  const play = useCallback(async (events: TabEvent[], bpm: number, loop?: boolean) => {
    await AudioEngine.play(events, bpm, loop);
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

  return { play, stop, setLoop, initialize };
}
