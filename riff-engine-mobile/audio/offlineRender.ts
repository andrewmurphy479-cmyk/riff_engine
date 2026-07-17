/**
 * Pure offline mixdown: TabEvents -> mastered stereo Float32 buffers.
 *
 * No Expo/React Native imports — usable both from the app (AudioExporter)
 * and from node CLIs (tools/batch.ts), so batch listening audits hear the
 * exact same render path users get.
 */
import { TabEvent } from '../engine/types';
import { fretToMidiNote } from './noteMapping';
import {
  synthesizeTone,
  applyReverb,
  applyDynamics,
  ringLengthMs,
  MuteParams,
  SAMPLE_RATE,
} from './KarplusStrong';

export interface OfflineRenderOptions {
  /** Wet mix for the master reverb (export default 0.15). */
  reverbMix?: number;
  /** Pad appended after the last note's ring end, in seconds (default 1.2 — reverb tail space). */
  tailSeconds?: number;
  /** Palm-mute character overrides (tuning/audition). */
  muteParams?: Partial<MuteParams>;
  /** Progress callback, 0..1 across the note-render loop. */
  onProgress?: (fraction: number) => void;
}

export interface StereoMix {
  left: Float32Array;
  right: Float32Array;
}

const STEPS_PER_BEAT = 4;
// Same-string choke: fade length ending exactly at the next same-string onset.
const CHOKE_FADE_MS = 25;

interface PlacedNote {
  event: TabEvent;
  startSample: number;
  ringSamples: number;
  /** Samples from this note's start to the next same-string onset (Infinity if none). */
  chokeRel: number;
}

export function renderEventsToStereo(
  events: TabEvent[],
  bpm: number,
  options: OfflineRenderOptions = {},
): StereoMix {
  const { reverbMix = 0.15, tailSeconds = 1.2, muteParams, onProgress } = options;

  const secondsPerStep = 60 / bpm / STEPS_PER_BEAT;

  // Grouped humanization: one jitter value per unique step so simultaneous
  // notes stay together; downbeats tighter than off-beats.
  const stepJitter = new Map<number, number>();
  for (const event of events) {
    if (!stepJitter.has(event.step)) {
      const stepInBar = event.step % 16;
      const isDownbeat = stepInBar % 4 === 0;
      const jitterRange = isDownbeat ? 3 : 8;
      stepJitter.set(event.step, (Math.random() - 0.5) * 2 * jitterRange);
    }
  }

  // Pass 1: place every note (humanized start + natural ring length) so choke
  // points and the exact buffer size are known before synthesis. Notes ring at
  // full length until the SAME string is struck again — other strings ring over.
  const placed: PlacedNote[] = events.map((event) => {
    const jitterMs = stepJitter.get(event.step) ?? 0;
    const jitterSamples = Math.round((jitterMs / 1000) * SAMPLE_RATE);
    const startSample = Math.max(
      0,
      Math.floor(
        (event.step + (event.swingOffset ?? 0)) * secondsPerStep * SAMPLE_RATE,
      ) + jitterSamples,
    );
    const ringMs = ringLengthMs(
      event.string,
      fretToMidiNote(event.string, event.fret),
      event.technique ?? undefined,
      muteParams,
    );
    const ringSamples = Math.floor((ringMs / 1000) * SAMPLE_RATE);
    return { event, startSample, ringSamples, chokeRel: Infinity };
  });

  for (const p of placed) {
    for (const q of placed) {
      if (
        q.event.string === p.event.string &&
        q.startSample > p.startSample &&
        q.startSample - p.startSample < p.chokeRel
      ) {
        p.chokeRel = q.startSample - p.startSample;
      }
    }
  }

  let lastRingEnd = 0;
  for (const p of placed) {
    lastRingEnd = Math.max(lastRingEnd, p.startSample + Math.min(p.ringSamples, p.chokeRel));
  }
  const totalSamples = lastRingEnd + Math.ceil(tailSeconds * SAMPLE_RATE);

  const mixL = new Float32Array(totalSamples);
  const mixR = new Float32Array(totalSamples);

  const chokeFadeSamples = Math.floor((CHOKE_FADE_MS / 1000) * SAMPLE_RATE);

  for (let i = 0; i < placed.length; i++) {
    const { event, startSample, chokeRel } = placed[i];

    const { left, right } = synthesizeTone({
      midiNote: fretToMidiNote(event.string, event.fret),
      velocity: event.velocity ?? 0.7,
      technique: event.technique ?? undefined,
      guitarString: event.string,
      muteParams,
    });

    const fadeStart = chokeRel - chokeFadeSamples;
    for (let j = 0; j < left.length; j++) {
      if (j >= chokeRel) break;
      const idx = startSample + j;
      if (idx >= totalSamples) break;
      let gain = 1;
      if (j >= fadeStart) {
        gain = Math.cos(((j - fadeStart) / chokeFadeSamples) * Math.PI * 0.5);
      }
      mixL[idx] += left[j] * gain;
      mixR[idx] += right[j] * gain;
    }

    onProgress?.((i + 1) / placed.length);
  }

  applyReverb(mixL, mixR, reverbMix);

  // Normalize to 0.9 peak before dynamics.
  let maxAmplitude = 0;
  for (let i = 0; i < totalSamples; i++) {
    const absL = Math.abs(mixL[i]);
    const absR = Math.abs(mixR[i]);
    if (absL > maxAmplitude) maxAmplitude = absL;
    if (absR > maxAmplitude) maxAmplitude = absR;
  }
  if (maxAmplitude > 0) {
    const normalizeRatio = 0.9 / maxAmplitude;
    for (let i = 0; i < totalSamples; i++) {
      mixL[i] *= normalizeRatio;
      mixR[i] *= normalizeRatio;
    }
  }

  applyDynamics(mixL, mixR);

  return { left: mixL, right: mixR };
}
