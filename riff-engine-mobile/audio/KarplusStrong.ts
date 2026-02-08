// Shared Karplus-Strong synthesis module
// Used by both SamplePlayer (real-time playback) and AudioExporter (offline render)

import { Technique, GuitarString } from '../engine/types';

export const SAMPLE_RATE = 44100;
export const BIT_DEPTH = 16;

// --- Stereo panning per string (guitar player perspective) ---
// Low strings slightly left, high strings slightly right
// Pan values: -1 = full left, 0 = center, +1 = full right
const STRING_PAN: Record<GuitarString, number> = {
  'E': -0.35,
  'A': -0.20,
  'D': -0.05,
  'G':  0.10,
  'B':  0.25,
  'e':  0.40,
};

/** Convert pan (-1..+1) to left/right gain using constant-power law */
function panToGains(pan: number): { left: number; right: number } {
  const angle = ((pan + 1) / 2) * (Math.PI / 2); // 0 to pi/2
  return {
    left: Math.cos(angle),
    right: Math.sin(angle),
  };
}

// --- Guitar body impulse response (simplified 6-mode resonator) ---
// More realistic than 3 sine waves — models top plate, back plate, and air cavity
const BODY_MODES = [
  { freq: 98,   amp: 0.012, decay: 6,  phase: 0 },      // Air cavity (Helmholtz)
  { freq: 185,  amp: 0.008, decay: 8,  phase: 0.3 },     // Top plate fundamental
  { freq: 245,  amp: 0.005, decay: 10, phase: 0.7 },     // Back plate
  { freq: 370,  amp: 0.003, decay: 14, phase: 1.2 },     // Top plate 2nd mode
  { freq: 510,  amp: 0.002, decay: 18, phase: 0.5 },     // Coupling mode
  { freq: 710,  amp: 0.001, decay: 22, phase: 1.8 },     // High body mode
];

/**
 * Velocity-dependent synthesis parameters.
 * Softer hits sound warmer/mellower, harder hits brighter/clickier.
 */
function velocityParams(velocity: number) {
  const v = Math.max(0, Math.min(1, velocity));

  return {
    pluckPosition: 0.08 + v * 0.12,
    toneOffset: (v - 0.5) * 0.4,
    noiseAmount: 0.2 + v * 0.4,
    amplitude: 0.4 + v * 0.6,
    transientLevel: v * 0.8,
  };
}

/**
 * Technique-dependent synthesis modifiers.
 */
function techniqueParams(technique: Technique | undefined) {
  switch (technique) {
    case 'hammer':
    case 'pull':
      return {
        dampingMod: 0,          // Normal sustain
        transientScale: 0.15,   // Much softer attack — no pick
        noiseScale: 0.3,        // Less noise in excitation
        toneOffset: -0.08,      // Slightly warmer
      };
    case 'bend':
      return {
        dampingMod: -0.001,     // Slightly less sustain (finger friction)
        transientScale: 0.6,
        noiseScale: 0.7,
        toneOffset: 0.05,       // Slightly brighter from tension
      };
    case 'slide':
      return {
        dampingMod: -0.002,     // More damping from finger drag
        transientScale: 0.3,    // Reduced attack
        noiseScale: 1.5,        // Extra fret noise
        toneOffset: -0.05,
      };
    default:
      return {
        dampingMod: 0,
        transientScale: 1.0,
        noiseScale: 1.0,
        toneOffset: 0,
      };
  }
}

export interface SynthOptions {
  midiNote: number;
  durationMs: number;
  velocity?: number;
  technique?: Technique;
  guitarString?: GuitarString;
}

export interface StereoSamples {
  left: Float32Array;
  right: Float32Array;
}

/**
 * Synthesize a guitar tone using extended Karplus-Strong algorithm.
 * Returns stereo Float32Arrays of PCM samples in [-1, 1] range.
 */
export function synthesizeTone(opts: SynthOptions): StereoSamples {
  const {
    midiNote,
    durationMs,
    velocity = 0.7,
    technique,
    guitarString,
  } = opts;

  const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
  const numSamples = Math.floor((durationMs / 1000) * SAMPLE_RATE);
  const vp = velocityParams(velocity);
  const tp = techniqueParams(technique);

  // --- Karplus-Strong delay line ---
  const periodLength = Math.round(SAMPLE_RATE / frequency);
  const wavetable = new Float32Array(periodLength);

  const pluckWidth = Math.max(2, Math.floor(periodLength * vp.pluckPosition));

  // Initialize wavetable with excitation
  for (let i = 0; i < periodLength; i++) {
    let excitation = 0;
    const noise = Math.random() * 2 - 1;

    if (i < pluckWidth) {
      const pluckEnv = Math.sin((i / pluckWidth) * Math.PI);
      excitation = pluckEnv * 0.8;
    }

    excitation += noise * vp.noiseAmount * tp.noiseScale;

    const attackShape = i < periodLength * 0.1
      ? Math.sin((i / (periodLength * 0.1)) * Math.PI * 0.5)
      : 1;
    excitation *= attackShape;

    wavetable[i] = excitation;
  }

  // Pre-filter the excitation for warmth
  for (let pass = 0; pass < 2; pass++) {
    let prev = wavetable[0];
    for (let i = 1; i < periodLength; i++) {
      wavetable[i] = prev * 0.3 + wavetable[i] * 0.7;
      prev = wavetable[i];
    }
  }

  // --- Generate mono PCM using extended Karplus-Strong ---
  const mono = new Float32Array(numSamples);

  const isBassString = midiNote < 52;
  const isTrebleString = midiNote > 59;

  const baseDamping = isBassString ? 0.998 : (isTrebleString ? 0.994 : 0.996);
  const freqFactor = Math.min(1, 150 / frequency);
  const damping = Math.max(0.98, baseDamping - (1 - freqFactor) * 0.002 + tp.dampingMod);

  const stiffness = isTrebleString ? 0.0003 : (isBassString ? 0.00005 : 0.0001);

  const baseTone = isBassString ? 0.45 : (isTrebleString ? 0.65 : 0.55);
  const toneFilter = Math.max(0.2, Math.min(0.85, baseTone + vp.toneOffset + tp.toneOffset));

  let lpState = 0;
  let apState = 0;

  // --- Pick transient (scaled by technique) ---
  const effectiveTransient = vp.transientLevel * tp.transientScale;
  const transientDurationMs = 1.5 + velocity * 1.5;
  const transientSamples = Math.floor((transientDurationMs / 1000) * SAMPLE_RATE);
  const transientBuffer = new Float32Array(transientSamples);

  if (effectiveTransient > 0.05) {
    let hpPrev = 0;
    for (let i = 0; i < transientSamples; i++) {
      const noise = (Math.random() * 2 - 1);
      const lpFiltered = hpPrev * 0.7 + noise * 0.3;
      hpPrev = lpFiltered;
      const hpFiltered = noise - lpFiltered;
      const env = Math.sin((i / transientSamples) * Math.PI);
      transientBuffer[i] = hpFiltered * env * effectiveTransient * 0.3;
    }
  }

  // --- Slide noise buffer (fret friction) ---
  let slideNoise: Float32Array | null = null;
  if (technique === 'slide') {
    slideNoise = new Float32Array(numSamples);
    let snPrev = 0;
    for (let i = 0; i < numSamples; i++) {
      const raw = (Math.random() * 2 - 1) * 0.02;
      // Band-pass: high-pass then low-pass
      const hp = raw - snPrev * 0.95;
      snPrev = raw;
      const t = i / SAMPLE_RATE;
      slideNoise[i] = hp * Math.exp(-2 * t); // Decays over time
    }
  }

  for (let i = 0; i < numSamples; i++) {
    const tableIndex = i % periodLength;
    const nextIndex = (i + 1) % periodLength;
    const prevIndex = (tableIndex - 1 + periodLength) % periodLength;

    const s0 = wavetable[prevIndex];
    const s1 = wavetable[tableIndex];
    const s2 = wavetable[nextIndex];

    let filtered = (s0 * 0.2 + s1 * 0.6 + s2 * 0.2) * damping;

    lpState = lpState * (1 - toneFilter) + filtered * toneFilter;
    filtered = lpState;

    const apCoeff = 0.5 - stiffness * (i / numSamples);
    const apOut = apCoeff * (filtered - apState) + wavetable[tableIndex];
    apState = apOut;
    filtered = filtered * 0.7 + apOut * 0.3;

    wavetable[tableIndex] = filtered;

    // Body resonance (6-mode)
    const t = i / SAMPLE_RATE;
    let bodyRes = 0;
    for (let b = 0; b < BODY_MODES.length; b++) {
      const mode = BODY_MODES[b];
      bodyRes += Math.sin(2 * Math.PI * mode.freq * t + mode.phase) *
                 mode.amp * Math.exp(-mode.decay * t);
    }

    let sample = filtered * 0.85 + bodyRes;

    // Pick transient
    if (i < transientSamples) {
      sample += transientBuffer[i];
    }

    // Slide fret noise
    if (slideNoise && i < slideNoise.length) {
      sample += slideNoise[i];
    }

    // Very gentle saturation — just catches peaks, keeps clean acoustic tone
    sample = Math.abs(sample) > 0.8 ? Math.tanh(sample) : sample * 0.95;

    // Quick attack envelope
    const envelope = Math.min(1, 1 - Math.exp(-i / (SAMPLE_RATE * 0.002)));
    sample *= envelope;

    mono[i] = sample * vp.amplitude;
  }

  // High-frequency roll-off
  let hpPrev = 0;
  for (let i = 0; i < numSamples; i++) {
    const current = mono[i];
    const filtered = hpPrev * 0.15 + current * 0.85;
    hpPrev = filtered;
    mono[i] = filtered;
  }

  // --- Stereo panning ---
  const pan = guitarString ? STRING_PAN[guitarString] : 0;
  const gains = panToGains(pan);

  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    left[i] = mono[i] * gains.left;
    right[i] = mono[i] * gains.right;
  }

  return { left, right };
}

// ---- Mix-level post-processing ----

/**
 * Schroeder reverb applied to stereo buffers (in-place).
 * Adds room ambience without muddying the source.
 */
export function applyReverb(
  left: Float32Array,
  right: Float32Array,
  mix: number = 0.15
): void {
  const len = left.length;

  // Comb filter delays (in samples) — tuned to avoid metallic resonances
  const combDelays = [1557, 1617, 1491, 1422, 1277, 1356];
  const combFeedback = 0.78; // Controls reverb tail length (~0.8s RT60, intimate room)

  // Allpass delays
  const apDelays = [225, 556, 441];
  const apFeedback = 0.5;

  // Process left and right with slightly different delays for width
  const wetL = processReverbChannel(left, combDelays, combFeedback, apDelays, apFeedback);
  const wetR = processReverbChannel(right,
    combDelays.map(d => d + 23), // Offset for stereo decorrelation
    combFeedback, apDelays.map(d => d + 13), apFeedback);

  // Mix wet into dry
  for (let i = 0; i < len; i++) {
    left[i] = left[i] * (1 - mix) + wetL[i] * mix;
    right[i] = right[i] * (1 - mix) + wetR[i] * mix;
  }
}

function processReverbChannel(
  input: Float32Array,
  combDelays: number[],
  combFb: number,
  apDelays: number[],
  apFb: number
): Float32Array {
  const len = input.length;
  const damp = 0.4; // High-frequency damping in comb feedback (higher = more HF absorbed)

  // Parallel low-pass feedback comb filters (LBCF)
  const combOut = new Float32Array(len);
  for (const delay of combDelays) {
    const buf = new Float32Array(delay);
    let lpState = 0;
    let writeIdx = 0;
    for (let i = 0; i < len; i++) {
      const delayed = buf[writeIdx];
      // One-pole low-pass in the feedback path (absorbs highs like a real room)
      lpState = delayed * (1 - damp) + lpState * damp;
      buf[writeIdx] = input[i] + lpState * combFb;
      combOut[i] += delayed;
      writeIdx = (writeIdx + 1) % delay;
    }
  }
  // Normalize by number of combs
  const combScale = 1 / combDelays.length;
  for (let i = 0; i < len; i++) {
    combOut[i] *= combScale;
  }

  // Series allpass filters (diffuse the echo pattern)
  let current = combOut;
  for (const delay of apDelays) {
    const output = new Float32Array(len);
    const buf = new Float32Array(delay);
    let writeIdx = 0;
    for (let i = 0; i < len; i++) {
      const delayed = buf[writeIdx];
      const input_s = current[i];
      output[i] = delayed - apFb * input_s;
      buf[writeIdx] = input_s + apFb * delayed;
      writeIdx = (writeIdx + 1) % delay;
    }
    current = output;
  }

  return current;
}

/**
 * Simple compressor/limiter applied to stereo buffers (in-place).
 * Evens out volume spikes from dense chords.
 */
export function applyDynamics(
  left: Float32Array,
  right: Float32Array
): void {
  const len = left.length;
  const threshold = 0.65;   // Only compress loud peaks
  const ratio = 3;           // Gentle 3:1 compression
  const attackMs = 10;       // Slower attack preserves transients
  const releaseMs = 150;     // Smooth release
  const makeupGain = 1.1;    // Minimal makeup — preserve dynamics

  const attackCoeff = 1 - Math.exp(-1 / (SAMPLE_RATE * attackMs / 1000));
  const releaseCoeff = 1 - Math.exp(-1 / (SAMPLE_RATE * releaseMs / 1000));

  let envelope = 0;

  for (let i = 0; i < len; i++) {
    // Detect peak level (linked stereo)
    const peak = Math.max(Math.abs(left[i]), Math.abs(right[i]));

    // Envelope follower
    if (peak > envelope) {
      envelope += attackCoeff * (peak - envelope);
    } else {
      envelope += releaseCoeff * (peak - envelope);
    }

    // Compute gain reduction
    let gain = 1;
    if (envelope > threshold) {
      const over = envelope - threshold;
      const compressed = threshold + over / ratio;
      gain = compressed / envelope;
    }

    // Apply makeup gain with gentle soft-clip (only catches true overs)
    const finalGain = gain * makeupGain;
    const sL = left[i] * finalGain;
    const sR = right[i] * finalGain;
    // Soft-clip only when above ±0.95, otherwise pass through clean
    left[i] = Math.abs(sL) > 0.95 ? Math.tanh(sL) : sL;
    right[i] = Math.abs(sR) > 0.95 ? Math.tanh(sR) : sR;
  }
}

// ---- WAV encoding ----

/**
 * Convert stereo Float32 PCM data to Int16 WAV buffer.
 */
export function createStereoWavBuffer(left: Float32Array, right: Float32Array): ArrayBuffer {
  const numChannels = 2;
  const bytesPerSample = 2;
  const numSamples = left.length;
  const dataLength = numSamples * numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');

  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, BIT_DEPTH, true);

  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Interleaved stereo: L R L R ...
  for (let i = 0; i < numSamples; i++) {
    const lClamped = Math.max(-1, Math.min(1, left[i]));
    const rClamped = Math.max(-1, Math.min(1, right[i]));
    const offset = 44 + i * numChannels * bytesPerSample;
    view.setInt16(offset, Math.max(-32768, Math.min(32767, Math.floor(lClamped * 32767))), true);
    view.setInt16(offset + 2, Math.max(-32768, Math.min(32767, Math.floor(rClamped * 32767))), true);
  }

  return buffer;
}

/**
 * Convert mono Float32 PCM data to Int16 WAV buffer (kept for SamplePlayer cache files).
 */
export function createWavBuffer(floatData: Float32Array): ArrayBuffer {
  const numChannels = 1;
  const bytesPerSample = 2;
  const numSamples = floatData.length;
  const dataLength = numSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');

  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, BIT_DEPTH, true);

  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, floatData[i]));
    view.setInt16(44 + i * bytesPerSample, Math.max(-32768, Math.min(32767, Math.floor(clamped * 32767))), true);
  }

  return buffer;
}

/**
 * Convert ArrayBuffer to base64 string.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
