import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { SampleLoader, VelocityLayer } from './SampleLoader';
import { GuitarString, Technique } from '../engine/types';
import { fretToMidiNote } from './noteMapping';
import {
  synthesizeTone,
  createStereoWavBuffer,
  arrayBufferToBase64,
  applyReverb,
  SAMPLE_RATE,
} from './KarplusStrong';

// Room-tail length baked into each cached clip so reverb has space to bloom.
const REVERB_PAD_MS = 300;
// Wet mix for the per-clip reverb — lighter than export's 0.15 to avoid
// obvious tails on rapid playback (each clip carries its own reverb).
const REALTIME_REVERB_MIX = 0.08;
// Final fade-out to keep end-of-clip transitions click-free.
const TAIL_FADE_MS = 50;

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

/** Quantize velocity to layer for cache bucketing (5 layers for finer tonal variation) */
function velocityToLayer(velocity: number): VelocityLayer {
  if (velocity < 0.2) return 'pp';
  if (velocity < 0.4) return 'p';
  if (velocity < 0.6) return 'mf';
  if (velocity < 0.8) return 'f';
  return 'ff';
}

/** Representative velocity value per layer */
function layerToVelocity(layer: VelocityLayer): number {
  switch (layer) {
    case 'pp': return 0.1;
    case 'p': return 0.3;
    case 'mf': return 0.5;
    case 'f': return 0.7;
    case 'ff': return 0.9;
  }
}

/** Normalize technique for cache key (null/undefined both map to 'normal') */
function techniqueCacheKey(technique: Technique | undefined): string {
  return technique ?? 'normal';
}

class SamplePlayerImpl {
  private soundPool: (PooledSound | null)[] = new Array(POOL_SIZE).fill(null);
  private fadingSounds: Set<Audio.Sound> = new Set();
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
    technique?: Technique,
    playbackVolume?: number
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const midiNote = fretToMidiNote(guitarString, fret);
    const stringIndex = STRING_TO_INDEX[guitarString];

    // Fade out any currently playing sound on this string in the background —
    // do NOT await, or rapid same-string notes get 20-40ms of serial async
    // overhead injected between them (audible as glitching/lateness).
    this.stopString(stringIndex);

    // Generate and play synthesized tone
    await this.playSynthNote(midiNote, stringIndex, velocity, durationMs, technique, guitarString, playbackVolume);
  }

  private async playSynthNote(
    midiNote: number,
    stringIndex: number,
    volume: number,
    durationMs: number,
    technique: Technique | undefined,
    guitarString: GuitarString,
    playbackVolume?: number
  ): Promise<void> {
    try {
      // volume controls tone generation (timbre); playbackVolume controls loudness
      const toneUri = await this.getOrCreateTone(midiNote, durationMs, volume, technique, guitarString);
      const effectiveVolume = playbackVolume ?? volume;

      const { sound } = await Audio.Sound.createAsync(
        { uri: toneUri },
        {
          shouldPlay: true,
          volume: Math.min(1, effectiveVolume),
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
    const { left, right } = synthesizeTone({ midiNote, durationMs, velocity, technique, guitarString });

    // Pad with silence so per-clip reverb has room to tail out.
    const padSamples = Math.floor((SAMPLE_RATE * REVERB_PAD_MS) / 1000);
    const paddedL = new Float32Array(left.length + padSamples);
    const paddedR = new Float32Array(right.length + padSamples);
    paddedL.set(left);
    paddedR.set(right);

    applyReverb(paddedL, paddedR, REALTIME_REVERB_MIX);

    const fadeSamples = Math.min(
      paddedL.length,
      Math.floor((SAMPLE_RATE * TAIL_FADE_MS) / 1000),
    );
    const fadeStart = paddedL.length - fadeSamples;
    for (let i = fadeStart; i < paddedL.length; i++) {
      const phase = (i - fadeStart) / fadeSamples;
      const gain = Math.cos(phase * Math.PI * 0.5);
      paddedL[i] *= gain;
      paddedR[i] *= gain;
    }

    const wavBuffer = createStereoWavBuffer(paddedL, paddedR);

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

  /**
   * Fade + unload the sound on `stringIndex` in the background. Returns
   * immediately so the caller can start the next note without waiting on
   * async I/O. The old sound is tracked in `fadingSounds` so `stopAll` can
   * still flush it on playback stop.
   */
  private stopString(stringIndex: number): void {
    const pooled = this.soundPool[stringIndex];
    if (!pooled) return;

    pooled.isPlaying = false;
    this.soundPool[stringIndex] = null;

    const sound = pooled.sound;
    if (!sound) return;

    // Detach the didJustFinish handler so the old sound's natural end can't
    // clobber a new sound that has since been installed in the pool slot.
    try {
      sound.setOnPlaybackStatusUpdate(null);
    } catch {}

    this.fadingSounds.add(sound);
    void (async () => {
      try {
        await sound.setVolumeAsync(0);
        await new Promise(resolve => setTimeout(resolve, 25));
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch {
        // Ignore stop/unload errors
      }
      this.fadingSounds.delete(sound);
    })();
  }

  async stopAll(): Promise<void> {
    for (let i = 0; i < POOL_SIZE; i++) {
      this.stopString(i);
    }
    const fading = Array.from(this.fadingSounds);
    this.fadingSounds.clear();
    await Promise.all(
      fading.map(async (sound) => {
        try {
          await sound.stopAsync();
          await sound.unloadAsync();
        } catch {
          // Ignore
        }
      })
    );
  }

  isStringPlaying(guitarString: GuitarString): boolean {
    const index = STRING_TO_INDEX[guitarString];
    const pooled = this.soundPool[index];
    return pooled?.isPlaying ?? false;
  }
}

export const SamplePlayer = new SamplePlayerImpl();
