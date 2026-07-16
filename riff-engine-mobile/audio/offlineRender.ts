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
  MuteParams,
  SAMPLE_RATE,
} from './KarplusStrong';

export interface OfflineRenderOptions {
  /** Wet mix for the master reverb (export default 0.15). */
  reverbMix?: number;
  /** Silence appended after the last note, in seconds (default 1.2). */
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

export function renderEventsToStereo(
  events: TabEvent[],
  bpm: number,
  options: OfflineRenderOptions = {},
): StereoMix {
  const { reverbMix = 0.15, tailSeconds = 1.2, muteParams, onProgress } = options;

  const secondsPerStep = 60 / bpm / STEPS_PER_BEAT;
  const maxStep = Math.max(
    ...events.map((e) => e.step + (e.swingOffset ?? 0) + e.duration),
  );
  const totalSamples = Math.ceil((maxStep * secondsPerStep + tailSeconds) * SAMPLE_RATE);

  const mixL = new Float32Array(totalSamples);
  const mixR = new Float32Array(totalSamples);

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

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const jitterMs = stepJitter.get(event.step) ?? 0;
    const jitterSamples = Math.round((jitterMs / 1000) * SAMPLE_RATE);
    const startSample = Math.max(
      0,
      Math.floor(
        (event.step + (event.swingOffset ?? 0)) * secondsPerStep * SAMPLE_RATE,
      ) + jitterSamples,
    );
    const durationMs = event.duration * secondsPerStep * 1000;

    const { left, right } = synthesizeTone({
      midiNote: fretToMidiNote(event.string, event.fret),
      durationMs,
      velocity: event.velocity ?? 0.7,
      technique: event.technique ?? undefined,
      guitarString: event.string,
      muteParams,
    });

    for (let j = 0; j < left.length; j++) {
      const idx = startSample + j;
      if (idx >= totalSamples) break;
      mixL[idx] += left[j];
      mixR[idx] += right[j];
    }

    onProgress?.((i + 1) / events.length);
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
