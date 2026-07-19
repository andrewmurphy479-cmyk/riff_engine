// Web Audio playback graph (react-native-audio-api).
//
// One shared AudioContext feeding a master bus:
//
//   note gain ──┬──> master ──> soft limiter ──> destination
//               └──> reverb send ──> convolver (generated IR) ──> master
//
// Reverb and limiting live on the bus, NOT inside each clip. The expo-av
// architecture baked reverb into every cached WAV, so overlapping ring tails
// stacked six wet copies — the failure mode that sank the ring-length fix
// (commit 34661aa, reverted in c641f61). Here tails share one room and one
// ceiling, and gain automation is sample-accurate instead of bridge-latency
// volume stepping.

import {
  AudioContext,
  AudioManager,
  ConvolverNode,
  GainNode,
  WaveShaperNode,
} from 'react-native-audio-api';
import { SAMPLE_RATE } from './KarplusStrong';

// Wet level for the shared room. The old per-clip bake used 0.08 per note; a
// bus send reads louder on dense riffs because tails overlap, so stay modest.
const REVERB_SEND_LEVEL = 0.12;
const IR_SECONDS = 1.3;
const IR_PREDELAY_S = 0.015;

// Soft-knee limiter curve: unity below the knee, tanh compression above it,
// C1-continuous at the join. Keeps six overlapping ring tails from hard
// clipping at the destination without audibly coloring normal levels.
const KNEE_START = 0.6;
const KNEE_RANGE = 0.35; // asymptote at KNEE_START + KNEE_RANGE = 0.95

function makeSoftKneeCurve(): Float32Array<ArrayBuffer> {
  const N = 2048;
  const curve = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * 2 - 1;
    const ax = Math.abs(x);
    const shaped =
      ax <= KNEE_START
        ? ax
        : KNEE_START + KNEE_RANGE * Math.tanh((ax - KNEE_START) / KNEE_RANGE);
    curve[i] = Math.sign(x) * shaped;
  }
  return curve;
}

// Exponentially decaying stereo noise, progressively low-passed so the tail
// darkens as it dies — reads as a small room. Channels use independent noise
// for width. ConvolverNode normalizes the IR, so level is stable regardless
// of IR energy.
function makeImpulseResponse(ctx: AudioContext) {
  const length = Math.floor(SAMPLE_RATE * IR_SECONDS);
  const preSamples = Math.floor(SAMPLE_RATE * IR_PREDELAY_S);
  const buffer = ctx.createBuffer(2, length, SAMPLE_RATE);

  for (let ch = 0; ch < 2; ch++) {
    const data = new Float32Array(length);
    let lp = 0;
    for (let i = preSamples; i < length; i++) {
      const t = i / SAMPLE_RATE;
      const decayPhase = (t - IR_PREDELAY_S) / (IR_SECONDS - IR_PREDELAY_S);
      const env = Math.exp(-3.2 * decayPhase);
      const coeff = 0.55 - 0.35 * decayPhase;
      lp += coeff * (Math.random() * 2 - 1 - lp);
      data[i] = lp * env;
    }
    buffer.copyToChannel(data, ch);
  }
  return buffer;
}

class PlaybackGraphImpl {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private limiter: WaveShaperNode | null = null;
  private convolver: ConvolverNode | null = null;
  private reverbSend: GainNode | null = null;

  get isInitialized(): boolean {
    return this.ctx !== null;
  }

  get context(): AudioContext {
    if (!this.ctx) {
      throw new Error('PlaybackGraph.initialize() has not completed');
    }
    return this.ctx;
  }

  async initialize(): Promise<void> {
    if (this.ctx) return;

    // 'playback' plays through the ringer switch, like expo-av's
    // playsInSilentModeIOS; allow haptics so lib/haptics keeps working
    // during playback.
    AudioManager.setAudioSessionOptions({
      iosCategory: 'playback',
      iosMode: 'default',
      iosAllowHaptics: true,
    });
    await AudioManager.setAudioSessionActivity(true);

    // Run the context at the synth's rate so buffer playback never depends on
    // the implementation resampling AudioBuffers to a different context rate.
    const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });

    const limiter = ctx.createWaveShaper();
    limiter.curve = makeSoftKneeCurve();
    limiter.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.value = 1.0;
    master.connect(limiter);

    const convolver = ctx.createConvolver();
    convolver.buffer = makeImpulseResponse(ctx);
    convolver.connect(master);

    const reverbSend = ctx.createGain();
    reverbSend.gain.value = REVERB_SEND_LEVEL;
    reverbSend.connect(convolver);

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    this.ctx = ctx;
    this.master = master;
    this.limiter = limiter;
    this.convolver = convolver;
    this.reverbSend = reverbSend;
  }

  /** Route a note's gain node into the bus: dry + shared reverb send. */
  connectNote(node: GainNode): void {
    node.connect(this.master!);
    node.connect(this.reverbSend!);
  }

  /** Route a metronome tick dry only — clicks don't belong in the room. */
  connectDry(node: GainNode): void {
    node.connect(this.master!);
  }
}

export const PlaybackGraph = new PlaybackGraphImpl();
