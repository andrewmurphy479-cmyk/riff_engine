/**
 * Pure offline mixdown: TabEvents -> mastered stereo Float32 buffers.
 *
 * No Expo/React Native imports — usable both from the app (AudioExporter)
 * and from node CLIs (tools/batch.ts), so batch listening audits hear the
 * exact same render path users get.
 *
 * Audit A9: this used to be a genuinely different renderer from live playback
 * — its own Schroeder reverb, a peak normalize, and a compressor, with no
 * polyphony scaling, no strum spread and no same-string choking. A shared riff
 * did not sound like the app that made it. It now mirrors the playbackGraph
 * signal path:
 *
 *   note (velocity x polyphony scale, panned) ──┬──> mix ──> soft-knee limiter
 *                                               └──> send 0.12 ──> room IR ──┘
 *
 * with the same grouped humanization, the same 12ms strum spread, and the same
 * 25ms choke when a string is re-struck while still ringing. The room and the
 * limiter come from masterChain, which playbackGraph also loads, so the two
 * cannot drift apart again.
 */
import { TabEvent } from '../engine/types';
import { convolve } from './convolve';
import { fretToMidiNote } from './noteMapping';
import {
  applySoftKneeLimiter,
  IR_SECONDS,
  makeImpulseResponse,
  REVERB_SEND_LEVEL,
} from './masterChain';
import {
  synthesizeTone,
  MuteParams,
  SAMPLE_RATE,
} from './KarplusStrong';
import { layerVelocity, ringMsFor, velocityToLayer } from './toneBank';
import {
  CHOKE_FADE_S,
  chokeGain,
  groupedJitter,
  polyphonyScale,
  STEPS_PER_BEAT,
  strumDelay,
} from './timing';

export interface OfflineRenderOptions {
  /**
   * Wet level for the shared room. Defaults to the live bus send; overriding
   * it makes the export stop matching the app, so this is for auditioning
   * only.
   */
  reverbMix?: number;
  /**
   * Extra silence past the natural decay, in seconds (default 0.3).
   *
   * The render already sizes itself to the last note's ring plus the reverb
   * tail; this is only padding on top of that. It used to be the *whole* tail,
   * back when notes were truncated to their notated duration.
   */
  tailSeconds?: number;
  /** Palm-mute character overrides (tuning/audition). */
  muteParams?: Partial<MuteParams>;
  /** Progress callback, 0..1 across the note-render loop. */
  onProgress?: (fraction: number) => void;
  /**
   * Source of the humanization jitter. Defaults to Math.random; pin it to make
   * a render reproducible (tests compare two renders sample-for-sample, which
   * only works if their onsets line up).
   */
  random?: () => number;
}

export interface StereoMix {
  left: Float32Array;
  right: Float32Array;
}

/** The room, built once and reused across renders — it is a pure function of rate. */
let cachedIR: ReturnType<typeof makeImpulseResponse> | null = null;
function roomIR() {
  if (!cachedIR) cachedIR = makeImpulseResponse(SAMPLE_RATE);
  return cachedIR;
}

export function renderEventsToStereo(
  events: TabEvent[],
  bpm: number,
  options: OfflineRenderOptions = {},
): StereoMix {
  const {
    reverbMix = REVERB_SEND_LEVEL,
    tailSeconds = 0.3,
    muteParams,
    onProgress,
    random,
  } = options;

  const secondsPerStep = 60 / bpm / STEPS_PER_BEAT;

  // Grouped humanization: one jitter value per unique step so simultaneous
  // notes stay together; downbeats tighter than off-beats.
  const stepJitter = groupedJitter(events.map((e) => e.step), random);

  // Simultaneous notes share the bus, so they are attenuated the same way the
  // live scheduler attenuates them.
  const stepNoteCounts = new Map<number, number>();
  for (const event of events) {
    stepNoteCounts.set(event.step, (stepNoteCounts.get(event.step) ?? 0) + 1);
  }

  // Chronological order per string is what makes choking correct — a note can
  // only choke the note that actually preceded it on its string.
  const ordered = [...events]
    .map((event, index) => ({ event, index }))
    .sort(
      (a, b) =>
        a.event.step +
        (a.event.swingOffset ?? 0) -
        (b.event.step + (b.event.swingOffset ?? 0)) ||
        a.index - b.index,
    )
    .map((x) => x.event);

  // Onsets are resolved for every note before any is rendered, because a
  // note's choke point is the *next* onset on its string — a forward
  // reference. The live graph gets this for free by ramping a live gain node;
  // offline it has to be known up front so the envelope can be baked into the
  // note's own samples rather than into the mix (which would duck whatever
  // else happened to be ringing on other strings).
  const stepStrumIndex = new Map<number, number>();
  const onsets = ordered.map((event) => {
    const count = stepNoteCounts.get(event.step) ?? 1;
    const strumIdx = stepStrumIndex.get(event.step) ?? 0;
    stepStrumIndex.set(event.step, strumIdx + 1);
    const strum = strumDelay(strumIdx, count);
    return Math.max(
      0,
      Math.round(
        ((event.step + (event.swingOffset ?? 0)) * secondsPerStep +
          (stepJitter.get(event.step) ?? 0) +
          strum) *
          SAMPLE_RATE,
      ),
    );
  });

  const nextOnSameString = new Array<number>(ordered.length).fill(Infinity);
  const pending = new Map<string, number>();
  for (let i = ordered.length - 1; i >= 0; i--) {
    const seen = pending.get(ordered[i].string);
    if (seen !== undefined) nextOnSameString[i] = seen;
    pending.set(ordered[i].string, onsets[i]);
  }

  const fadeSamples = Math.round(CHOKE_FADE_S * SAMPLE_RATE);

  // Tone cache, keyed exactly as ToneBank keys its live buffers. Karplus-Strong
  // is excited with noise, so this is not only ~4x faster on a dense riff — it
  // also means repeated notes share one noise realization, which is what the
  // live path does. Rendering each note separately gave exports a subtly
  // different texture from playback.
  const tones = new Map<string, ReturnType<typeof synthesizeTone>>();
  const toneFor = (event: TabEvent, velocity: number) => {
    const technique = event.technique ?? undefined;
    const midiNote = fretToMidiNote(event.string, event.fret);
    const key = `${midiNote}_${velocityToLayer(velocity)}_${technique ?? 'normal'}_${event.string}`;
    let tone = tones.get(key);
    if (!tone) {
      tone = synthesizeTone({
        midiNote,
        durationMs: ringMsFor(event.string, technique),
        velocity: layerVelocity(velocity),
        technique,
        guitarString: event.string,
        sustainTailMs: 0,
        muteParams,
      });
      tones.set(key, tone);
    }
    return tone;
  };

  // Notes ring for their natural length and are cut short only by a choke, so
  // the buffer is sized from where sound actually stops rather than from the
  // last notated duration. Ring length is deterministic per string/technique,
  // so this is known before anything is synthesized.
  let lastSample = 0;
  const ringSamples = ordered.map((event) =>
    Math.ceil((ringMsFor(event.string, event.technique ?? undefined) / 1000) * SAMPLE_RATE),
  );
  for (let i = 0; i < ordered.length; i++) {
    const chokeAt = nextOnSameString[i] - onsets[i];
    const audible = Math.min(ringSamples[i], chokeAt + fadeSamples);
    lastSample = Math.max(lastSample, onsets[i] + audible);
  }
  const totalSamples =
    lastSample + Math.ceil((IR_SECONDS + tailSeconds) * SAMPLE_RATE);

  const mixL = new Float32Array(totalSamples);
  const mixR = new Float32Array(totalSamples);

  for (let i = 0; i < ordered.length; i++) {
    const event = ordered[i];
    const startSample = onsets[i];

    const count = stepNoteCounts.get(event.step) ?? 1;
    const polyScale = polyphonyScale(count);
    const velocity = event.velocity ?? 0.7;

    // Two-stage velocity, exactly as live: the tone is synthesized at its
    // quantized layer velocity, and the rest of the loudness difference is
    // applied as gain (a GainNode live, a multiply here).
    const { left, right } = toneFor(event, velocity);
    const noteGain = Math.min(1, velocity * polyScale);

    // Sample offset within this note at which its string is struck again.
    const chokeAt = nextOnSameString[i] - startSample;
    const end = Math.min(startSample + left.length, totalSamples);

    for (let j = 0; j < end - startSample; j++) {
      const choke = chokeGain(j, chokeAt, fadeSamples);
      if (choke === 0) break; // fully choked; nothing further to add
      const gain = noteGain * choke;
      mixL[startSample + j] += left[j] * gain;
      mixR[startSample + j] += right[j] * gain;
    }

    onProgress?.((i + 1) / ordered.length);
  }

  // Dry + one shared room, exactly as the bus does it.
  if (reverbMix > 0) {
    const ir = roomIR();
    const wetL = convolve(mixL, ir.left);
    const wetR = convolve(mixR, ir.right);
    for (let i = 0; i < totalSamples; i++) {
      mixL[i] += wetL[i] * reverbMix;
      mixR[i] += wetR[i] * reverbMix;
    }
  }

  // No peak normalize: live playback has none, and normalizing made every
  // export a different loudness from the app that produced it.
  applySoftKneeLimiter(mixL, mixR);

  return { left: mixL, right: mixR };
}
