/**
 * The master bus, as data rather than as nodes.
 *
 * Audit A9: exports and live playback used to be two different renderers.
 * Live ran through playbackGraph (ConvolverNode on a generated noise IR, plus a
 * soft-knee WaveShaper limiter); export ran through offlineRender's Schroeder
 * comb/allpass reverb and a peak-normalize + compressor. Users heard one thing
 * in the app and shared another — which also makes an export-based listening
 * test measure the wrong renderer.
 *
 * This module owns the impulse response and the limiter curve so both paths
 * consume the same numbers. It is deliberately free of react-native imports:
 * playbackGraph loads the IR into a ConvolverNode, offlineRender convolves with
 * it directly, and the Node CLIs (tools/batch.ts) can use it too.
 */
import { Rng } from "../engine/riff/rng";

/** Wet level for the shared room, applied as a send gain on both paths. */
export const REVERB_SEND_LEVEL = 0.12;

export const IR_SECONDS = 1.3;
export const IR_PREDELAY_S = 0.015;

/**
 * Seed for the IR's noise. Fixed rather than Math.random() so the live graph
 * and an offline render convolve against a byte-identical room — the whole
 * point of the shared chain.
 */
const IR_SEED = 0x21ff01;

// Soft-knee limiter curve: unity below the knee, tanh compression above it,
// C1-continuous at the join.
export const KNEE_START = 0.6;
export const KNEE_RANGE = 0.35; // asymptote at KNEE_START + KNEE_RANGE = 0.95

/** The waveshaper transfer function, as a scalar. */
export function softKnee(x: number): number {
  const ax = Math.abs(x);
  const shaped =
    ax <= KNEE_START
      ? ax
      : KNEE_START + KNEE_RANGE * Math.tanh((ax - KNEE_START) / KNEE_RANGE);
  return Math.sign(x) * shaped;
}

/** The curve as a WaveShaperNode lookup table over the [-1, 1] input domain. */
export function makeSoftKneeCurve(): Float32Array<ArrayBuffer> {
  const N = 2048;
  const curve = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    curve[i] = softKnee((i / (N - 1)) * 2 - 1);
  }
  return curve;
}

/**
 * Apply the limiter to a stereo pair in place.
 *
 * The offline equivalent of the WaveShaperNode. A WaveShaper interpolates its
 * 2048-point curve; calling {@link softKnee} directly is the same function at
 * full precision, so the offline result is if anything slightly cleaner.
 */
export function applySoftKneeLimiter(
  left: Float32Array,
  right: Float32Array,
): void {
  for (let i = 0; i < left.length; i++) {
    left[i] = softKnee(left[i]);
    right[i] = softKnee(right[i]);
  }
}

export interface ImpulseResponse {
  // Explicitly ArrayBuffer-backed: AudioBuffer.copyToChannel rejects the
  // ArrayBufferLike default.
  left: Float32Array<ArrayBuffer>;
  right: Float32Array<ArrayBuffer>;
}

/**
 * Exponentially decaying stereo noise, progressively low-passed so the tail
 * darkens as it dies — a small room. Channels use independent noise for width.
 *
 * Pre-normalized (see {@link normalizationScale}), which is why playbackGraph
 * sets `convolver.normalize = false`: the node's own normalization would be
 * applied to only one of the two paths.
 */
export function makeImpulseResponse(sampleRate: number): ImpulseResponse {
  const length = Math.floor(sampleRate * IR_SECONDS);
  const preSamples = Math.floor(sampleRate * IR_PREDELAY_S);
  const rng = new Rng(IR_SEED);

  const channels: Float32Array<ArrayBuffer>[] = [];
  for (let ch = 0; ch < 2; ch++) {
    const data = new Float32Array(length);
    let lp = 0;
    for (let i = preSamples; i < length; i++) {
      const t = i / sampleRate;
      const decayPhase = (t - IR_PREDELAY_S) / (IR_SECONDS - IR_PREDELAY_S);
      const env = Math.exp(-3.2 * decayPhase);
      const coeff = 0.55 - 0.35 * decayPhase;
      lp += coeff * (rng.random() * 2 - 1 - lp);
      data[i] = lp * env;
    }
    channels.push(data);
  }

  const scale = normalizationScale(channels, sampleRate);
  for (const data of channels) {
    for (let i = 0; i < data.length; i++) data[i] *= scale;
  }

  return { left: channels[0], right: channels[1] };
}

/**
 * The Web Audio ConvolverNode normalization scale, per the spec's reference
 * implementation.
 *
 * Applying it here and switching the node to `normalize = false` keeps the
 * live level where the F1 listening gate left it while letting the offline
 * path convolve against exactly the same IR. Without this the two paths would
 * differ by whatever gain the native convolver applies internally.
 */
function normalizationScale(
  channels: readonly Float32Array[],
  sampleRate: number,
): number {
  const GAIN_CALIBRATION = 0.00125;
  const GAIN_CALIBRATION_SAMPLE_RATE = 44100;
  const MIN_POWER = 0.000125;

  let sumOfSquares = 0;
  let count = 0;
  for (const data of channels) {
    for (let i = 0; i < data.length; i++) sumOfSquares += data[i] * data[i];
    count += data.length;
  }

  let power = Math.sqrt(sumOfSquares / count);
  if (!Number.isFinite(power) || Number.isNaN(power) || power < MIN_POWER) {
    power = MIN_POWER;
  }

  return (
    (1 / power) * GAIN_CALIBRATION * (GAIN_CALIBRATION_SAMPLE_RATE / sampleRate)
  );
}
