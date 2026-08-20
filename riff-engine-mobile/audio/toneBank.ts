// Ring-length tone buffers, synthesized once per (string, midi, layer,
// technique) and cached for the whole session. Duration is deliberately NOT
// part of the cache key: notes render at their natural ring length and the
// scheduler chokes them when the same string is struck again — real-guitar
// behavior — so one buffer serves every grid duration and tempo. (The old
// expo-av cache keyed on duration, which meant every tempo change
// re-synthesized the entire riff.)
//
// Buffers are MONO; AudioEngine pans each voice with a StereoPannerNode. The
// synth's per-string pan was only a static constant-power gain pair, so this
// is identical output at half the memory — and memory is the constraint here:
// a 3.5s stereo float32 ring buffer was 1.18 MB, and a browsing session that
// touched 400 riffs measured 327 MB resident (audit A4, see
// F1_AUDIO_AUDIT_MEASUREMENTS.md). Mono halves that.

import type { AudioBuffer, AudioContext } from 'react-native-audio-api';
import { GuitarString, Technique } from '../engine/types';
import { SAMPLE_RATE, synthesizeMono } from './KarplusStrong';

export type VelocityLayer = 'pp' | 'p' | 'mf' | 'f' | 'ff';

// Natural ring per string register — the values the reverted ring-length fix
// (34661aa) validated offline: bass 3.5s / mid 2.8s / treble 2.2s.
const RING_MS: Record<GuitarString, number> = {
  E: 3500,
  A: 3500,
  D: 2800,
  G: 2800,
  B: 2200,
  e: 2200,
};
// Palm mutes die under the hand; rendering past the mute envelope is waste.
const MUTE_RING_MS = 700;

// Metronome tick synthesis (carried over from the old Metronome module).
const TICK_MS = 60;
const ACCENT_FREQ = 1568; // G6
const SUB_FREQ = 1046; // C6
export const ACCENT_TICK_VOLUME = 0.85;
export const SUB_TICK_VOLUME = 0.5;

export interface ToneSpec {
  midiNote: number;
  velocity: number;
  guitarString: GuitarString;
  technique?: Technique;
  /** Accepted for call-site compatibility; ring length comes from the string. */
  durationMs?: number;
}

/**
 * Natural ring length for a note, in ms — the duration its buffer is
 * synthesized at, independent of the notated grid duration.
 *
 * Exported because the offline renderer has to ring notes for exactly as long
 * as live playback does (audit A9). It used to render each note at its notated
 * duration, so exports had none of the natural ring the F1 work introduced.
 */
export function ringMsFor(
  guitarString: GuitarString,
  technique?: Technique,
): number {
  return technique === 'mute' ? MUTE_RING_MS : RING_MS[guitarString];
}

/**
 * The velocity a tone is actually *synthesized* at: quantized to its layer, so
 * one cached buffer serves a range of velocities. The remaining loudness
 * difference is applied downstream as gain — live by the voice's GainNode,
 * offline by scaling the samples.
 */
export function layerVelocity(velocity: number): number {
  return layerToVelocity(velocityToLayer(velocity));
}

/** Quantize velocity to a synth layer so timbre buckets stay cacheable. */
export function velocityToLayer(velocity: number): VelocityLayer {
  if (velocity < 0.2) return 'pp';
  if (velocity < 0.4) return 'p';
  if (velocity < 0.6) return 'mf';
  if (velocity < 0.8) return 'f';
  return 'ff';
}

/** Representative velocity value per layer. */
function layerToVelocity(layer: VelocityLayer): number {
  switch (layer) {
    case 'pp':
      return 0.1;
    case 'p':
      return 0.3;
    case 'mf':
      return 0.5;
    case 'f':
      return 0.7;
    case 'ff':
      return 0.9;
  }
}

function synthTick(freq: number): Float32Array<ArrayBuffer> {
  const n = Math.floor((SAMPLE_RATE * TICK_MS) / 1000);
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const attack = Math.min(1, i / (SAMPLE_RATE * 0.001));
    const env = Math.exp(-t * 90);
    buf[i] = Math.sin(2 * Math.PI * freq * t) * attack * env * 0.9;
  }
  return buf;
}

class ToneBankImpl {
  private cache = new Map<string, AudioBuffer>();
  private accentTick: AudioBuffer | null = null;
  private subTick: AudioBuffer | null = null;

  /** Synthesize the metronome tick buffers. Cheap; called once from init. */
  init(ctx: AudioContext): void {
    if (this.accentTick) return;
    this.accentTick = this.monoToBuffer(ctx, synthTick(ACCENT_FREQ));
    this.subTick = this.monoToBuffer(ctx, synthTick(SUB_FREQ));
  }

  getTick(accent: boolean): AudioBuffer | null {
    return accent ? this.accentTick : this.subTick;
  }

  private key(spec: ToneSpec): string {
    const layer = velocityToLayer(spec.velocity);
    const tech = spec.technique ?? 'normal';
    // The string is part of the key (unlike the old cache): the same MIDI note
    // on different strings has different pan, register character, and ring.
    return `${spec.midiNote}_${layer}_${tech}_${spec.guitarString}`;
  }

  get(spec: ToneSpec): AudioBuffer | undefined {
    return this.cache.get(this.key(spec));
  }

  /**
   * Synthesize any missing buffers for `specs`, yielding to the event loop
   * between clips so a play-button tap stays responsive. `isCancelled` lets a
   * newer play()/stop() abandon the remainder of a stale batch.
   */
  async ensure(
    ctx: AudioContext,
    specs: ToneSpec[],
    isCancelled?: () => boolean,
  ): Promise<void> {
    const missing = new Map<string, ToneSpec>();
    for (const spec of specs) {
      const k = this.key(spec);
      if (!this.cache.has(k) && !missing.has(k)) {
        missing.set(k, spec);
      }
    }

    for (const [k, spec] of missing) {
      if (isCancelled?.()) return;
      const layer = velocityToLayer(spec.velocity);
      const ringMs =
        spec.technique === 'mute' ? MUTE_RING_MS : RING_MS[spec.guitarString];
      const mono = synthesizeMono({
        midiNote: spec.midiNote,
        durationMs: ringMs,
        velocity: layerToVelocity(layer),
        technique: spec.technique,
        guitarString: spec.guitarString,
        sustainTailMs: 0,
      });
      const buffer = ctx.createBuffer(1, mono.length, SAMPLE_RATE);
      buffer.copyToChannel(mono, 0);
      this.cache.set(k, buffer);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  private monoToBuffer(
    ctx: AudioContext,
    mono: Float32Array<ArrayBuffer>,
  ): AudioBuffer {
    const buffer = ctx.createBuffer(1, mono.length, SAMPLE_RATE);
    buffer.copyToChannel(mono, 0);
    return buffer;
  }
}

export const ToneBank = new ToneBankImpl();
