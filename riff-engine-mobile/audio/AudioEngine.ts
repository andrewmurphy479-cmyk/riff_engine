import { useEffect, useCallback, useRef } from 'react';
import { Audio } from 'expo-av';
import { TabEvent, GuitarString } from '../engine/types';
import { SamplePlayer } from './SamplePlayer';
import { SampleLoader } from './SampleLoader';

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
      // Configure audio mode for iOS (allows playback in silent mode)
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      // Initialize sample loader and player
      await SampleLoader.initialize();
      await SamplePlayer.initialize();

      this.isInitialized = true;
      console.log('AudioEngine initialized');
    } catch (error) {
      console.error('Failed to initialize audio engine:', error);
      // Don't throw - allow app to continue without audio
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

    // Stop any current playback
    this.stop();

    if (events.length === 0) return;

    this.isPlaying = true;
    this.config.onPlaybackStart?.();

    // Calculate timing
    const stepsPerBeat = 4;
    const msPerStep = (60 / bpm / stepsPerBeat) * 1000;

    // Find total duration
    const maxStep = Math.max(...events.map(e => e.step + e.duration));
    const totalDurationMs = maxStep * msPerStep;

    // Schedule each note with humanized timing
    for (const event of events) {
      const delayMs = event.step * msPerStep;
      const noteDurationMs = event.duration * msPerStep;

      // Add micro-timing jitter for humanization
      const stepInBar = event.step % 16;
      const isDownbeat = stepInBar % 4 === 0;
      const jitterRange = isDownbeat ? 3 : 8; // Tighter on downbeats, looser on off-beats
      const jitterMs = (Math.random() - 0.5) * 2 * jitterRange;
      const humanizedDelay = Math.max(0, delayMs + jitterMs);

      const velocity = event.velocity ?? 0.7;
      const timeoutId = setTimeout(() => {
        this.playNote(event.string, event.fret, noteDurationMs, velocity);
      }, humanizedDelay);

      this.scheduledNotes.push({ timeoutId });
    }

    // Schedule end callback
    this.endTimeoutId = setTimeout(() => {
      this.handlePlaybackEnd();
    }, totalDurationMs + 200);
  }

  private async playNote(
    string: GuitarString,
    fret: number,
    durationMs: number,
    velocity: number = 0.7
  ): Promise<void> {
    if (!this.isPlaying) return;

    try {
      // Use the SamplePlayer for actual audio playback
      await SamplePlayer.playNote(string, fret, velocity, durationMs);
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
    // Clear all scheduled notes
    for (const note of this.scheduledNotes) {
      clearTimeout(note.timeoutId);
    }
    this.scheduledNotes = [];

    // Clear end timeout
    if (this.endTimeoutId) {
      clearTimeout(this.endTimeoutId);
      this.endTimeoutId = null;
    }

    // Stop all playing sounds
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

// Singleton instance
export const AudioEngine = new AudioEngineImpl();

// React hook for using the audio engine
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

    // Initialize on mount
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
