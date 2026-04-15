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

class AudioEngineImpl {
  private scheduledNotes: ScheduledNote[] = [];
  private isPlaying = false;
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

  async play(events: TabEvent[], bpm: number): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.stop();

    if (events.length === 0) return;

    this.isPlaying = true;
    this.config.onPlaybackStart?.();

    const stepsPerBeat = 4;
    const msPerStep = (60 / bpm / stepsPerBeat) * 1000;

    const maxStep = Math.max(...events.map(e => e.step + e.duration));
    const totalDurationMs = maxStep * msPerStep;

    // Pre-compute grouped jitter: one jitter value per unique step
    const stepJitter = new Map<number, number>();
    for (const event of events) {
      if (!stepJitter.has(event.step)) {
        const stepInBar = event.step % 16;
        const isDownbeat = stepInBar % 4 === 0;
        const jitterRange = isDownbeat ? 3 : 8;
        stepJitter.set(event.step, (Math.random() - 0.5) * 2 * jitterRange);
      }
    }

    // Pre-generate all tones before scheduling (includes technique + string)
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
    const STRUM_INTERVAL_MS = 12; // ms between notes in same-step group

    // Schedule each note with grouped jitter + polyphony mixing
    for (const event of events) {
      const delayMs = event.step * msPerStep;
      const noteDurationMs = event.duration * msPerStep;
      const jitterMs = stepJitter.get(event.step) ?? 0;

      const velocity = event.velocity ?? 0.7;
      const technique = event.technique ?? undefined;

      // Polyphony-aware volume: reduce per-note volume when multiple notes are simultaneous
      const count = stepNoteCounts.get(event.step) ?? 1;
      const polyScale = count > 1 ? 1 / Math.sqrt(count) : 1;
      const playbackVolume = velocity * polyScale;

      // Micro-stagger: spread simultaneous notes like a natural strum
      const strumIdx = stepStrumIndex.get(event.step) ?? 0;
      stepStrumIndex.set(event.step, strumIdx + 1);
      const strumDelay = count > 1 ? strumIdx * STRUM_INTERVAL_MS : 0;

      const humanizedDelay = Math.max(0, delayMs + jitterMs + strumDelay);

      const timeoutId = setTimeout(() => {
        this.playNote(event.string, event.fret, noteDurationMs, velocity, technique, playbackVolume);
      }, humanizedDelay);

      this.scheduledNotes.push({ timeoutId });
    }

    this.endTimeoutId = setTimeout(() => {
      this.handlePlaybackEnd();
    }, totalDurationMs + 200);
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
    this.isPlaying = false;
    this.scheduledNotes = [];
    this.endTimeoutId = null;
    SamplePlayer.stopAll();
    this.config.onStepPlay?.(-1);
    this.config.onPlaybackEnd?.();
  }

  stop(): void {
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
  play: (events: TabEvent[], bpm: number) => Promise<void>;
  stop: () => void;
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

  const play = useCallback(async (events: TabEvent[], bpm: number) => {
    await AudioEngine.play(events, bpm);
  }, []);

  const stop = useCallback(() => {
    AudioEngine.stop();
  }, []);

  const initialize = useCallback(async () => {
    await AudioEngine.initialize();
  }, []);

  return { play, stop, initialize };
}
