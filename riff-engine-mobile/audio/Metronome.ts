// Metronome click synthesis + playback.
// Two pitched ticks (accented downbeat, softer subdivision) synthesized once,
// cached as WAV files, and played through a small alternating sound pool so
// rapid beats never cut each other off.

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import {
  SAMPLE_RATE,
  createWavBuffer,
  arrayBufferToBase64,
} from './KarplusStrong';

const TICK_MS = 60;
// Woodblock-ish pitches: high enough to cut through the guitar mix.
const ACCENT_FREQ = 1568; // G6
const SUB_FREQ = 1046;    // C6
const ACCENT_VOLUME = 0.85;
const SUB_VOLUME = 0.5;
// Two sounds per tick type, alternated, so back-to-back beats overlap cleanly.
const POOL_PER_TICK = 2;

function synthTick(freq: number): Float32Array {
  const n = Math.floor((SAMPLE_RATE * TICK_MS) / 1000);
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    // 1ms attack ramp avoids a start click; fast exponential decay reads as a tick.
    const attack = Math.min(1, i / (SAMPLE_RATE * 0.001));
    const env = Math.exp(-t * 90);
    buf[i] = Math.sin(2 * Math.PI * freq * t) * attack * env * 0.9;
  }
  return buf;
}

class MetronomeImpl {
  private accentPool: Audio.Sound[] = [];
  private subPool: Audio.Sound[] = [];
  private accentIdx = 0;
  private subIdx = 0;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const load = async (freq: number, name: string, volume: number): Promise<Audio.Sound[]> => {
      const wav = createWavBuffer(synthTick(freq));
      const filePath = `${FileSystem.cacheDirectory}${name}`;
      await FileSystem.writeAsStringAsync(filePath, arrayBufferToBase64(wav), {
        encoding: 'base64',
      });
      const pool: Audio.Sound[] = [];
      for (let i = 0; i < POOL_PER_TICK; i++) {
        const { sound } = await Audio.Sound.createAsync(
          { uri: filePath },
          { shouldPlay: false, volume },
        );
        pool.push(sound);
      }
      return pool;
    };

    try {
      [this.accentPool, this.subPool] = await Promise.all([
        load(ACCENT_FREQ, 'metronome_accent.wav', ACCENT_VOLUME),
        load(SUB_FREQ, 'metronome_sub.wav', SUB_VOLUME),
      ]);
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize metronome:', error);
    }
  }

  /** Fire-and-forget click. Accent = bar downbeat. */
  playTick(accent: boolean): void {
    if (!this.isInitialized) return;
    const pool = accent ? this.accentPool : this.subPool;
    if (pool.length === 0) return;
    const idx = accent
      ? (this.accentIdx = (this.accentIdx + 1) % pool.length)
      : (this.subIdx = (this.subIdx + 1) % pool.length);
    void pool[idx].replayAsync().catch(() => {
      // Ignore — a missed click is better than a crash mid-playback
    });
  }
}

export const Metronome = new MetronomeImpl();
