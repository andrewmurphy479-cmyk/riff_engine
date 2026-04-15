import { Audio } from 'expo-av';
import { Asset } from 'expo-asset';

export type VelocityLayer = 'pp' | 'p' | 'mf' | 'f' | 'ff';

interface SampleEntry {
  midi: number;
  sound: Audio.Sound | null;
  isLoading: boolean;
}

// MIDI note range for guitar samples (E2-E5)
const MIN_MIDI = 40;
const MAX_MIDI = 76;

// Sample asset mapping - maps MIDI note to require() asset
// For now, we use a synthesized approach since actual samples need to be bundled
// When real samples are added, replace this with actual require() statements
const SAMPLE_ASSETS: Record<number, Record<VelocityLayer, any>> = {};

// Initialize sample assets from manifest
// In production, these would be actual require() calls like:
// SAMPLE_ASSETS[40] = {
//   soft: require('../assets/samples/guitar/E2_soft.wav'),
//   medium: require('../assets/samples/guitar/E2_medium.wav'),
//   hard: require('../assets/samples/guitar/E2_hard.wav'),
// };

class SampleLoaderImpl {
  private samples: Map<string, SampleEntry> = new Map();
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private useSynthesis = true; // Fallback to synthesis when samples aren't available

  private getSampleKey(midi: number, velocity: VelocityLayer): string {
    return `${midi}_${velocity}`;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      // Check if we have actual sample assets
      const hasSamples = Object.keys(SAMPLE_ASSETS).length > 0;
      this.useSynthesis = !hasSamples;

      if (hasSamples) {
        // Preload commonly used samples (middle range)
        const prioritySamples = [40, 45, 50, 55, 59, 64]; // Open string notes
        const velocities: VelocityLayer[] = ['mf'];

        for (const midi of prioritySamples) {
          for (const velocity of velocities) {
            await this.loadSample(midi, velocity);
          }
        }
      }

      this.isInitialized = true;
      console.log(`SampleLoader initialized (synthesis mode: ${this.useSynthesis})`);
    } catch (error) {
      console.error('Failed to initialize SampleLoader:', error);
      this.useSynthesis = true;
      this.isInitialized = true;
    }
  }

  private async loadSample(midi: number, velocity: VelocityLayer): Promise<Audio.Sound | null> {
    const key = this.getSampleKey(midi, velocity);
    const existing = this.samples.get(key);

    if (existing?.sound) {
      return existing.sound;
    }

    if (existing?.isLoading) {
      // Wait for loading to complete
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          const entry = this.samples.get(key);
          if (entry && !entry.isLoading) {
            clearInterval(checkInterval);
            resolve(entry.sound);
          }
        }, 50);
      });
    }

    // Mark as loading
    this.samples.set(key, { midi, sound: null, isLoading: true });

    try {
      const asset = SAMPLE_ASSETS[midi]?.[velocity];
      if (!asset) {
        this.samples.set(key, { midi, sound: null, isLoading: false });
        return null;
      }

      const { sound } = await Audio.Sound.createAsync(asset, {
        shouldPlay: false,
        volume: 1.0,
      });

      this.samples.set(key, { midi, sound, isLoading: false });
      return sound;
    } catch (error) {
      console.error(`Failed to load sample ${key}:`, error);
      this.samples.set(key, { midi, sound: null, isLoading: false });
      return null;
    }
  }

  async getSample(midi: number, velocity: VelocityLayer = 'mf'): Promise<Audio.Sound | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Clamp to valid range
    const clampedMidi = Math.max(MIN_MIDI, Math.min(MAX_MIDI, midi));

    // Try exact match first
    let sound = await this.loadSample(clampedMidi, velocity);
    if (sound) return sound;

    // Fallback to nearest available sample
    for (let offset = 1; offset <= 12; offset++) {
      // Try higher
      if (clampedMidi + offset <= MAX_MIDI) {
        sound = await this.loadSample(clampedMidi + offset, velocity);
        if (sound) return sound;
      }
      // Try lower
      if (clampedMidi - offset >= MIN_MIDI) {
        sound = await this.loadSample(clampedMidi - offset, velocity);
        if (sound) return sound;
      }
    }

    return null;
  }

  isSynthesisMode(): boolean {
    return this.useSynthesis;
  }

  getMidiRange(): { min: number; max: number } {
    return { min: MIN_MIDI, max: MAX_MIDI };
  }

  async unloadAll(): Promise<void> {
    for (const [key, entry] of this.samples) {
      if (entry.sound) {
        try {
          await entry.sound.unloadAsync();
        } catch (e) {
          // Ignore unload errors
        }
      }
    }
    this.samples.clear();
    this.isInitialized = false;
    this.initPromise = null;
  }

  // Get velocity layer based on normalized velocity (0-1)
  getVelocityLayer(normalizedVelocity: number): VelocityLayer {
    if (normalizedVelocity < 0.2) return 'pp';
    if (normalizedVelocity < 0.4) return 'p';
    if (normalizedVelocity < 0.6) return 'mf';
    if (normalizedVelocity < 0.8) return 'f';
    return 'ff';
  }
}

export const SampleLoader = new SampleLoaderImpl();
