// Shared Karplus-Strong synthesis module
// Used by both ToneBank (real-time playback buffers) and AudioExporter (offline render)

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
    pluckPosition: 0.05 + v * 0.20,     // Wider range: bridge (bright) to neck (warm)
    toneOffset: (v - 0.5) * 0.7,        // More tonal contrast between soft/hard
    noiseAmount: 0.1 + v * 0.6,         // Soft = clean, hard = noisy
    amplitude: 0.3 + v * 0.7,           // More dynamic range
    transientLevel: v * 0.9,            // Stronger pick attack at high velocity
  };
}

/**
 * Palm-mute character parameters. Loop damping alone can't produce a real
 * palm mute: Karplus-Strong decay scales with frequency, so on the low E a
 * damping tweak still rings for seconds. Instead the mute path applies an
 * explicit two-stage output envelope — a fast "chunk" stage (the palm
 * absorbing the string) blended with a quicker-dying pitched body — plus a
 * short tail and reduced body resonance (the palm damps the top too).
 * Exposed as overridable params so tools/muteAudition.ts can A/B variants.
 */
export interface MuteParams {
  /** Fast-stage decay time constant (the palm 'chunk'), ms. */
  chunkDecayMs: number;
  /** Slow-stage decay time constant (pitched body under the palm), ms. */
  bodyDecayMs: number;
  /** Blend of the slow stage (0..1): higher = more audible pitch. */
  bodyBlend: number;
  /** Ring-out tail for muted notes, ms (caps sustainTailMs). */
  tailMs: number;
  /** Body-resonance scale while muted. */
  bodyResScale: number;
  /** Output gain — palm mutes are compressed and punchy. */
  gain: number;
  dampingMod: number;
  transientScale: number;
  noiseScale: number;
  toneOffset: number;
}

export const DEFAULT_MUTE_PARAMS: MuteParams = {
  chunkDecayMs: 22,
  bodyDecayMs: 120,
  bodyBlend: 0.25,
  tailMs: 50,
  bodyResScale: 0.3,
  gain: 1.12,
  dampingMod: -0.012,
  transientScale: 1.0,
  noiseScale: 0.6,
  toneOffset: -0.3,
};

/**
 * Technique-dependent synthesis modifiers.
 */
function techniqueParams(technique: Technique | undefined, mute: MuteParams) {
  switch (technique) {
    case 'hammer':
    case 'pull':
      return {
        dampingMod: 0.001,      // Slightly longer sustain — legato ring
        transientScale: 0.05,   // Near-zero pick attack — finger articulation
        noiseScale: 0.2,        // Very clean excitation
        toneOffset: -0.18,      // Noticeably warmer
      };
    case 'bend':
      return {
        dampingMod: -0.001,     // Slightly less sustain (finger friction)
        transientScale: 0.6,
        noiseScale: 0.7,
        toneOffset: 0.05,       // Slightly brighter from tension
      };
    case 'mute':
      return {
        dampingMod: mute.dampingMod,
        transientScale: mute.transientScale,
        noiseScale: mute.noiseScale,
        toneOffset: mute.toneOffset,
      };
    case 'pluck':
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
  /** Extra samples rendered past durationMs so the string rings out naturally. */
  sustainTailMs?: number;
  /** Palm-mute character overrides (tuning/audition); merged over defaults. */
  muteParams?: Partial<MuteParams>;
}

// Default ring-out tail added to every synthesized note. Karplus-Strong damping
// provides a realistic decay curve over this window — without it, notes get
// hard-cut at their nominal duration and feel staccato.
const DEFAULT_SUSTAIN_TAIL_MS = 120;

export interface StereoSamples {
  left: Float32Array;
  right: Float32Array;
}

/**
 * Per-string pan position, for callers that pan at playback time instead of
 * baking it into the samples (see {@link synthesizeMono}).
 */
export function stringPan(guitarString?: GuitarString): number {
  return guitarString ? STRING_PAN[guitarString] : 0;
}

/**
 * Synthesize a guitar tone using extended Karplus-Strong algorithm.
 * Returns MONO Float32 PCM in [-1, 1] — the signal before per-string panning.
 *
 * The live playback path (ToneBank) caches this and pans with a
 * StereoPannerNode, which halves cache memory for identical output: the pan
 * here is nothing but a static constant-power gain pair, the same law the
 * node applies. Offline rendering still uses the stereo wrapper below.
 */
export function synthesizeMono(opts: SynthOptions): Float32Array<ArrayBuffer> {
  const {
    midiNote,
    durationMs,
    velocity = 0.7,
    technique,
    guitarString,
    sustainTailMs = DEFAULT_SUSTAIN_TAIL_MS,
  } = opts;

  const isMuted = technique === 'mute';
  const mp: MuteParams = { ...DEFAULT_MUTE_PARAMS, ...opts.muteParams };

  const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
  // Muted notes die under the palm — no long ring-out tail.
  const effectiveTailMs = isMuted ? Math.min(sustainTailMs, mp.tailMs) : sustainTailMs;
  const totalDurationMs = durationMs + effectiveTailMs;
  const numSamples = Math.floor((totalDurationMs / 1000) * SAMPLE_RATE);
  const vp = velocityParams(velocity);
  const tp = techniqueParams(technique, mp);

  // Classify by actual guitar string when available, not just MIDI pitch
  const isBassString = guitarString
    ? (['E', 'A', 'D'] as string[]).includes(guitarString)
    : midiNote < 52;
  const isTrebleString = guitarString
    ? (['G', 'B', 'e'] as string[]).includes(guitarString)
    : midiNote > 59;

  // --- Karplus-Strong delay line with fractional delay for pitch accuracy ---
  const exactPeriod = SAMPLE_RATE / frequency;
  const periodLength = Math.floor(exactPeriod);
  const fracDelay = exactPeriod - periodLength;
  // First-order allpass coefficient for fractional delay compensation
  const fracCoeff = (1 - fracDelay) / (1 + fracDelay);
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

  // Frequency-aware excitation pre-filtering
  // Bass strings get more smoothing (warmer), treble strings get less (preserves clarity)
  const filterPasses = isBassString ? 3 : (isTrebleString ? 1 : 2);
  const filterCoeff = isBassString ? 0.35 : (isTrebleString ? 0.2 : 0.3);
  for (let pass = 0; pass < filterPasses; pass++) {
    let prev = wavetable[0];
    for (let i = 1; i < periodLength; i++) {
      wavetable[i] = prev * filterCoeff + wavetable[i] * (1 - filterCoeff);
      prev = wavetable[i];
    }
  }

  // --- Generate mono PCM using extended Karplus-Strong ---
  const mono = new Float32Array(numSamples);

  const baseDamping = isBassString ? 0.998 : (isTrebleString ? 0.994 : 0.996);
  const freqFactor = Math.min(1, 150 / frequency);
  const damping = Math.max(0.98, baseDamping - (1 - freqFactor) * 0.002 + tp.dampingMod);

  const stiffness = isTrebleString ? 0.0003 : (isBassString ? 0.00005 : 0.0001);

  const baseTone = isBassString ? 0.45 : (isTrebleString ? 0.65 : 0.55);
  const toneFilter = Math.max(0.2, Math.min(0.85, baseTone + vp.toneOffset + tp.toneOffset));

  let lpState = 0;
  let apState = 0;
  let fracPrevIn = 0;
  let fracPrevOut = 0;

  // --- Pick transient (scaled by technique) ---
  const effectiveTransient = vp.transientLevel * tp.transientScale;
  const transientDurationMs = 1.5 + velocity * 1.5;
  const transientSamples = Math.floor((transientDurationMs / 1000) * SAMPLE_RATE);
  const transientBuffer = new Float32Array(transientSamples);

  if (effectiveTransient > 0.05) {
    let hpPrev = 0;
    let lpPrev2 = 0;
    for (let i = 0; i < transientSamples; i++) {
      const noise = (Math.random() * 2 - 1);
      // Band-pass: HP to remove lows, then LP to remove harsh highs
      const lpFiltered = hpPrev * 0.65 + noise * 0.35;
      hpPrev = lpFiltered;
      const hpFiltered = noise - lpFiltered;
      // Gentle LP to tame extreme highs
      lpPrev2 = lpPrev2 * 0.3 + hpFiltered * 0.7;
      // Raised cosine envelope (smoother than sine)
      const phase = i / transientSamples;
      const env = 0.5 * (1 - Math.cos(2 * Math.PI * phase));
      transientBuffer[i] = lpPrev2 * env * effectiveTransient * 0.2;
    }
  }

  // Palm-mute envelope constants (two-stage decay after a short hold).
  const muteHoldSamples = SAMPLE_RATE * 0.006;
  const muteChunkTau = (mp.chunkDecayMs / 1000) * SAMPLE_RATE;
  const muteBodyTau = (mp.bodyDecayMs / 1000) * SAMPLE_RATE;

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

    // Allpass dispersion — gradual ramp-in for smooth attack (no discontinuity)
    const apRamp = Math.min(1, i / (SAMPLE_RATE * 0.003));
    const apCoeff = 0.5 - stiffness * (i / numSamples);
    const apOut = apCoeff * (filtered - apState) + wavetable[tableIndex];
    apState = apOut;
    const apBlend = 0.15 * apRamp;
    filtered = filtered * (1 - apBlend) + apOut * apBlend;

    // Fractional delay allpass — corrects pitch to exact frequency
    const fracOut = fracCoeff * (filtered - fracPrevOut) + fracPrevIn;
    fracPrevIn = filtered;
    fracPrevOut = fracOut;
    filtered = fracOut;

    wavetable[tableIndex] = filtered;

    // Body resonance (6-mode) — scaled inversely with pitch
    // Bass strings need less body resonance (avoids mud), treble gets more (adds fullness)
    const t = i / SAMPLE_RATE;
    let bodyRes = 0;
    let bodyScale = isBassString ? 0.4 : (isTrebleString ? 1.2 : 0.8);
    if (isMuted) bodyScale *= mp.bodyResScale;
    for (let b = 0; b < BODY_MODES.length; b++) {
      const mode = BODY_MODES[b];
      bodyRes += Math.sin(2 * Math.PI * mode.freq * t + mode.phase) *
                 mode.amp * Math.exp(-mode.decay * t) * bodyScale;
    }

    let sample = filtered * 0.85 + bodyRes;

    // Pick transient
    if (i < transientSamples) {
      sample += transientBuffer[i];
    }

    // Smooth tanh saturation — no branching, no discontinuities
    sample = Math.tanh(sample * 1.2) * 0.83;

    // Quick attack envelope
    const envelope = Math.min(1, 1 - Math.exp(-i / (SAMPLE_RATE * 0.002)));
    sample *= envelope;

    // Palm-mute decay: after a short hold, a fast "chunk" stage blended with
    // a quicker-dying pitched body. Frequency-independent, unlike loop
    // damping, so the low E chugs as tightly as the high strings.
    if (isMuted) {
      const dt = Math.max(0, i - muteHoldSamples);
      const muteEnv =
        (1 - mp.bodyBlend) * Math.exp(-dt / muteChunkTau) +
        mp.bodyBlend * Math.exp(-dt / muteBodyTau);
      sample *= muteEnv * mp.gain;
    }

    mono[i] = sample * vp.amplitude;
  }

  // DC blocker (removes sub-bass rumble <30Hz without killing clarity)
  let dcPrev = 0;
  let dcOut = 0;
  // Frequency-correct at any sample rate (was hardcoded for 44.1kHz).
  const dcCoeff = 1 - (2 * Math.PI * 30) / SAMPLE_RATE;
  for (let i = 0; i < numSamples; i++) {
    dcOut = mono[i] - dcPrev + dcCoeff * dcOut;
    dcPrev = mono[i];
    mono[i] = dcOut;
  }

  // Gentle presence shelf (~2-5kHz boost for clarity)
  let presLP = 0;
  const presFreq = 3500;
  const presCoeff = 1 - Math.exp(-2 * Math.PI * presFreq / SAMPLE_RATE);
  const presAmount = isTrebleString ? 0.08 : (isBassString ? 0.03 : 0.05);
  for (let i = 0; i < numSamples; i++) {
    presLP += presCoeff * (mono[i] - presLP);
    // Subtract LP to get HP (presence frequencies), add a fraction back
    mono[i] += (mono[i] - presLP) * presAmount;
  }

  // Release fade — last 25ms cosine-tapers to silence so the WAV ends at zero,
  // preventing the speaker-cone snap that causes an end-of-file crackle.
  const fadeSamples = Math.min(numSamples, Math.floor(SAMPLE_RATE * 0.025));
  const fadeStart = numSamples - fadeSamples;
  for (let i = fadeStart; i < numSamples; i++) {
    const phase = (i - fadeStart) / fadeSamples;
    const gain = Math.cos(phase * Math.PI * 0.5);
    mono[i] *= gain;
  }

  return mono;
}

/**
 * Stereo tone: {@link synthesizeMono} with the per-string constant-power pan
 * baked into the samples. Used by the offline/export render path, where there
 * is no node graph to pan with.
 */
export function synthesizeTone(opts: SynthOptions): StereoSamples {
  const mono = synthesizeMono(opts);
  const gains = panToGains(stringPan(opts.guitarString));
  const numSamples = mono.length;

  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    left[i] = mono[i] * gains.left;
    right[i] = mono[i] * gains.right;
  }

  return { left, right };
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
 * Convert mono Float32 PCM data to Int16 WAV buffer (currently unused at runtime; kept for tooling).
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
