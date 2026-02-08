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

    // Schedule each note with grouped jitter
    for (const event of events) {
      const delayMs = event.step * msPerStep;
      const noteDurationMs = event.duration * msPerStep;
      const jitterMs = stepJitter.get(event.step) ?? 0;
      const humanizedDelay = Math.max(0, delayMs + jitterMs);

      const velocity = event.velocity ?? 0.7;
      const technique = event.technique ?? undefined;
      const timeoutId = setTimeout(() => {
        this.playNote(event.string, event.fret, noteDurationMs, velocity, technique);
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
    technique?: Technique
  ): Promise<void> {
    if (!this.isPlaying) return;

    try {
      await SamplePlayer.playNote(string, fret, velocity, durationMs, technique);
    } catch (error) {
      console.error('Error playing note:', error);
    }
  }

  private handlePlaybackEnd(): void {
    this.isPlaying = false;
    this.scheduledNotes = [];
    this.endTimeoutId = null;
    SamplePlayer.stopAll();
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
