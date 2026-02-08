import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { SampleLoader, VelocityLayer } from './SampleLoader';
import { GuitarString, Technique } from '../engine/types';
import { fretToMidiNote } from './noteMapping';
import { synthesizeTone, createWavBuffer, arrayBufferToBase64 } from './KarplusStrong';

// Sound pool configuration - one per guitar string for polyphony
const POOL_SIZE = 6;

interface PooledSound {
  sound: Audio.Sound | null;
  isPlaying: boolean;
  midiNote: number;
  stringIndex: number;
}

// Guitar string to pool index mapping
const STRING_TO_INDEX: Record<GuitarString, number> = {
  'E': 0,
  'A': 1,
  'D': 2,
  'G': 3,
  'B': 4,
  'e': 5,
};

// Cache for generated tone files
const toneCache: Map<string, string> = new Map();

/** Quantize velocity to layer for cache bucketing */
function velocityToLayer(velocity: number): VelocityLayer {
  if (velocity < 0.33) return 'soft';
  if (velocity < 0.66) return 'medium';
  return 'hard';
}

/** Representative velocity value per layer */
function layerToVelocity(layer: VelocityLayer): number {
  switch (layer) {
    case 'soft': return 0.2;
    case 'medium': return 0.5;
    case 'hard': return 0.85;
  }
}

/** Normalize technique for cache key (null/undefined both map to 'normal') */
function techniqueCacheKey(technique: Technique | undefined): string {
  return technique ?? 'normal';
}

class SamplePlayerImpl {
  private soundPool: (PooledSound | null)[] = new Array(POOL_SIZE).fill(null);
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Clear tone cache to regenerate with current algorithm
    toneCache.clear();

    await SampleLoader.initialize();

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
    } catch (error) {
      console.error('Failed to set audio mode:', error);
    }

    this.isInitialized = true;
  }

  async playNote(
    guitarString: GuitarString,
    fret: number,
    velocity: number = 0.7,
    durationMs: number = 500,
    technique?: Technique
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const midiNote = fretToMidiNote(guitarString, fret);
    const stringIndex = STRING_TO_INDEX[guitarString];

    // Stop any currently playing sound on this string
    await this.stopString(stringIndex);

    // Generate and play synthesized tone
    await this.playSynthNote(midiNote, stringIndex, velocity, durationMs, technique, guitarString);
  }

  private async playSynthNote(
    midiNote: number,
    stringIndex: number,
    volume: number,
    durationMs: number,
    technique: Technique | undefined,
    guitarString: GuitarString
  ): Promise<void> {
    try {
      const toneUri = await this.getOrCreateTone(midiNote, durationMs, volume, technique, guitarString);

      const { sound } = await Audio.Sound.createAsync(
        { uri: toneUri },
        {
          shouldPlay: true,
          volume: Math.min(1, volume),
          isLooping: false,
        }
      );

      this.soundPool[stringIndex] = {
        sound,
        isPlaying: true,
        midiNote,
        stringIndex,
      };

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          this.cleanupSound(stringIndex, midiNote);
        }
      });

    } catch (error) {
      console.error(`Failed to play synth note ${midiNote}:`, error);
    }
  }

  private async getOrCreateTone(
    midiNote: number,
    durationMs: number,
    velocity: number,
    technique: Technique | undefined,
    guitarString: GuitarString
  ): Promise<string> {
    const cacheDuration = Math.round(durationMs / 100) * 100;
    const layer = velocityToLayer(velocity);
    const techKey = techniqueCacheKey(technique);
    const cacheKey = `${midiNote}_${cacheDuration}_${layer}_${techKey}`;

    const cached = toneCache.get(cacheKey);
    if (cached) {
      const info = await FileSystem.getInfoAsync(cached);
      if (info.exists) {
        return cached;
      }
    }

    const uri = await this.generateToneFile(midiNote, cacheDuration, layer, technique, guitarString);
    toneCache.set(cacheKey, uri);
    return uri;
  }

  private async generateToneFile(
    midiNote: number,
    durationMs: number,
    layer: VelocityLayer,
    technique: Technique | undefined,
    guitarString: GuitarString
  ): Promise<string> {
    const velocity = layerToVelocity(layer);
    // synthesizeTone returns stereo, but for cached playback files we sum to mono
    // (expo-av doesn't give us per-note pan control, stereo is handled at export level)
    const { left, right } = synthesizeTone({ midiNote, durationMs, velocity, technique, guitarString });

    // Downmix to mono for the cache file
    const mono = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) {
      mono[i] = (left[i] + right[i]) * 0.5;
    }

    const wavBuffer = createWavBuffer(mono);

    const techKey = techniqueCacheKey(technique);
    const fileName = `tone_${midiNote}_${durationMs}_${layer}_${techKey}.wav`;
    const filePath = `${FileSystem.cacheDirectory}${fileName}`;

    const base64Data = arrayBufferToBase64(wavBuffer);
    await FileSystem.writeAsStringAsync(filePath, base64Data, {
      encoding: 'base64',
    });

    return filePath;
  }

  /**
   * Pre-generate tone files for a set of notes to avoid async I/O during playback.
   */
  async preGenerateTones(
    notes: Array<{
      midiNote: number;
      durationMs: number;
      velocity: number;
      technique?: Technique;
      guitarString: GuitarString;
    }>
  ): Promise<void> {
    const promises = notes.map(({ midiNote, durationMs, velocity, technique, guitarString }) =>
      this.getOrCreateTone(midiNote, durationMs, velocity, technique, guitarString)
    );
    await Promise.all(promises);
  }

  private async cleanupSound(stringIndex: number, expectedMidi: number): Promise<void> {
    const pooled = this.soundPool[stringIndex];
    if (pooled && pooled.midiNote === expectedMidi) {
      pooled.isPlaying = false;
      if (pooled.sound) {
        try {
          await pooled.sound.unloadAsync();
        } catch (e) {
          // Ignore
        }
      }
      this.soundPool[stringIndex] = null;
    }
  }

  private async stopString(stringIndex: number): Promise<void> {
    const pooled = this.soundPool[stringIndex];
    if (!pooled) return;

    pooled.isPlaying = false;

    if (pooled.sound) {
      try {
        await pooled.sound.stopAsync();
        await pooled.sound.unloadAsync();
      } catch (e) {
        // Ignore stop/unload errors
      }
    }

    this.soundPool[stringIndex] = null;
  }

  async stopAll(): Promise<void> {
    const stopPromises: Promise<void>[] = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      stopPromises.push(this.stopString(i));
    }
    await Promise.all(stopPromises);
  }

  isStringPlaying(guitarString: GuitarString): boolean {
    const index = STRING_TO_INDEX[guitarString];
    const pooled = this.soundPool[index];
    return pooled?.isPlaying ?? false;
  }
}

export const SamplePlayer = new SamplePlayerImpl();
