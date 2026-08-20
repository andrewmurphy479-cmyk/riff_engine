/**
 * Audit A9 regression tests: the offline render must stay the same renderer as
 * live playback.
 *
 * The live graph can't be instantiated here (it needs the native audio module),
 * so these assert the properties that actually diverged — ring length, the
 * two-stage velocity, choking, polyphony scaling, and the absence of a peak
 * normalize — plus the shared-module wiring that keeps them from drifting apart
 * again.
 */
import { describe, expect, it } from "vitest";

import { TabEvent } from "../engine/types";
import { softKnee, makeImpulseResponse, REVERB_SEND_LEVEL } from "./masterChain";
import { renderEventsToStereo } from "./offlineRender";
import { SAMPLE_RATE } from "./KarplusStrong";
import { ringMsFor, layerVelocity } from "./toneBank";
import {
  CHOKE_FADE_S,
  chokeGain,
  jitterRangeFor,
  polyphonyScale,
  strumDelay,
} from "./timing";

const BPM = 120;

/** Zero jitter, so two renders can be compared sample-for-sample. */
const FIXED_RANDOM = () => 0.5;

function note(over: Partial<TabEvent> = {}): TabEvent {
  return {
    step: 0,
    duration: 4,
    string: "E",
    fret: 5,
    velocity: 0.8,
    technique: "pluck",
    ...over,
  } as TabEvent;
}

function peak(buf: Float32Array): number {
  let max = 0;
  for (let i = 0; i < buf.length; i++) max = Math.max(max, Math.abs(buf[i]));
  return max;
}

/** Total L+R energy in a window; pan-independent, so string choice is neutral. */
function windowEnergy(
  mix: { left: Float32Array; right: Float32Array },
  from: number,
  to: number,
): number {
  let sum = 0;
  for (let i = Math.max(0, from); i < Math.min(to, mix.left.length); i++) {
    sum += mix.left[i] * mix.left[i] + mix.right[i] * mix.right[i];
  }
  return sum;
}

/** Average window energy over several renders, to beat the noise excitation. */
function meanEnergy(
  events: TabEvent[],
  from: number,
  to: number,
  runs: number,
): number {
  let total = 0;
  for (let i = 0; i < runs; i++) {
    total += windowEnergy(
      renderEventsToStereo(events, BPM, {
        reverbMix: 0,
        tailSeconds: 0,
        random: FIXED_RANDOM,
      }),
      from,
      to,
    );
  }
  return total / runs;
}

/** Peak of a sample window, for checking a note actually stopped sounding. */
function peakBetween(buf: Float32Array, from: number, to: number): number {
  let max = 0;
  for (let i = Math.max(0, from); i < Math.min(to, buf.length); i++) {
    max = Math.max(max, Math.abs(buf[i]));
  }
  return max;
}

describe("renderEventsToStereo", () => {
  it("rings a note for its natural length, not its notated duration", () => {
    // A single 16th note on the low E still rings ~3.5s, the way the live
    // ToneBank buffer does. The old renderer truncated to the grid duration.
    const { left } = renderEventsToStereo([note({ duration: 1 })], BPM, {
      reverbMix: 0,
      tailSeconds: 0,
    });
    const notatedEnd = Math.round((1 / 4) * (60 / BPM) * SAMPLE_RATE);
    const ringEnd = Math.round((ringMsFor("E") / 1000) * SAMPLE_RATE);
    expect(peakBetween(left, notatedEnd * 2, ringEnd)).toBeGreaterThan(0.001);
  });

  it("stops a choked note ringing under the note that replaced it", () => {
    // Karplus-Strong excites with noise, so no two renders are sample-identical
    // and the choke can't be checked by subtraction. Control instead: the same
    // loud first note in both cases, and a near-silent second note whose only
    // job is to trigger the choke. Its own contribution is negligible, so any
    // energy drop in the tail is the first note being cut off.
    const RUNS = 12;
    // One bar in. At 120bpm a step is 0.125s, so this lands at 2.0s — inside
    // the low E's 3.5s ring, which is what makes a choke possible at all.
    const restruckAt = 16;
    const onset = Math.round((restruckAt / 4) * (60 / BPM) * SAMPLE_RATE);
    const from = onset + Math.ceil(CHOKE_FADE_S * SAMPLE_RATE) + 1;
    const to = from + SAMPLE_RATE; // one second of tail, still within the ring

    const first = note({ step: 0, string: "E", fret: 5, velocity: 1 });
    const trigger = note({
      step: restruckAt,
      string: "E",
      fret: 5,
      velocity: 0.02,
    });

    const ringing = meanEnergy([first], from, to, RUNS);
    const choked = meanEnergy([first, trigger], from, to, RUNS);
    expect(choked).toBeLessThan(ringing * 0.25);
  });

  it("does not peak-normalize the mix", () => {
    // The old renderer forced every export to 0.9 peak, so a quiet riff and a
    // loud one came out the same loudness — neither matching the app.
    const quiet = renderEventsToStereo([note({ velocity: 0.25 })], BPM);
    const loud = renderEventsToStereo([note({ velocity: 1 })], BPM);
    expect(peak(quiet.left)).toBeLessThan(peak(loud.left));
    expect(peak(quiet.left)).not.toBeCloseTo(0.9, 1);
  });

  it("keeps output inside the limiter's ceiling", () => {
    // Ten notes at once across strings; the soft knee asymptotes at 0.95.
    const stack: TabEvent[] = ["E", "A", "D", "G", "B", "e"].map((s) =>
      note({ string: s as TabEvent["string"], velocity: 1 }),
    );
    const { left, right } = renderEventsToStereo(stack, BPM);
    expect(peak(left)).toBeLessThanOrEqual(0.95);
    expect(peak(right)).toBeLessThanOrEqual(0.95);
  });

  it("produces only finite samples", () => {
    const { left, right } = renderEventsToStereo(
      [note(), note({ step: 4, string: "A" }), note({ step: 8, fret: 0 })],
      BPM,
    );
    expect(left.every(Number.isFinite)).toBe(true);
    expect(right.every(Number.isFinite)).toBe(true);
  });

  it("sizes the buffer to the natural decay plus the reverb tail", () => {
    const { left } = renderEventsToStereo([note()], BPM, { tailSeconds: 0 });
    const ring = (ringMsFor("E") / 1000) * SAMPLE_RATE;
    expect(left.length).toBeGreaterThan(ring);
  });
});

describe("shared master chain", () => {
  it("generates a deterministic impulse response", () => {
    // Live and offline must convolve against the same room; a Math.random IR
    // would give each path its own.
    const a = makeImpulseResponse(SAMPLE_RATE);
    const b = makeImpulseResponse(SAMPLE_RATE);
    expect(Array.from(a.left.slice(0, 256))).toEqual(
      Array.from(b.left.slice(0, 256)),
    );
    // Past the 15ms predelay, where the noise actually starts. The channels
    // use independent noise for stereo width.
    expect(Array.from(a.left.slice(2000, 2064))).not.toEqual(
      Array.from(a.right.slice(2000, 2064)),
    );
  });

  it("defaults the reverb send to the live bus level", () => {
    expect(REVERB_SEND_LEVEL).toBe(0.12);
  });

  it("applies the soft knee above the threshold and unity below it", () => {
    expect(softKnee(0.3)).toBeCloseTo(0.3, 6);
    expect(softKnee(-0.3)).toBeCloseTo(-0.3, 6);
    expect(softKnee(0.6)).toBeCloseTo(0.6, 6);
    expect(softKnee(5)).toBeLessThan(0.95);
    expect(softKnee(5)).toBeGreaterThan(0.9);
    expect(softKnee(-5)).toBeGreaterThan(-0.95);
  });
});

describe("shared scheduling rules", () => {
  it("scales polyphony equal-power", () => {
    expect(polyphonyScale(1)).toBe(1);
    expect(polyphonyScale(4)).toBeCloseTo(0.5, 6);
  });

  it("spreads simultaneous notes but leaves single notes alone", () => {
    expect(strumDelay(0, 1)).toBe(0);
    expect(strumDelay(1, 1)).toBe(0);
    expect(strumDelay(2, 3)).toBeCloseTo(0.024, 6);
  });

  it("humanizes downbeats tighter than off-beats", () => {
    expect(jitterRangeFor(0)).toBeLessThan(jitterRangeFor(1));
    expect(jitterRangeFor(16)).toBe(jitterRangeFor(0));
    expect(jitterRangeFor(4)).toBe(jitterRangeFor(0));
  });

  it("ramps the choke linearly and holds silence after it", () => {
    const fade = 100;
    expect(chokeGain(0, 500, fade)).toBe(1);
    expect(chokeGain(499, 500, fade)).toBe(1);
    expect(chokeGain(500, 500, fade)).toBe(1);
    expect(chokeGain(550, 500, fade)).toBeCloseTo(0.5, 6);
    expect(chokeGain(600, 500, fade)).toBe(0);
    expect(chokeGain(10_000, 500, fade)).toBe(0);
    // Never choked: the string is not struck again.
    expect(chokeGain(10_000, Infinity, fade)).toBe(1);
  });

  it("quantizes synthesis velocity to layers", () => {
    // Two velocities in the same layer synthesize identically; the difference
    // between them is applied downstream as gain.
    expect(layerVelocity(0.82)).toBe(layerVelocity(0.95));
    expect(layerVelocity(0.1)).not.toBe(layerVelocity(0.9));
  });
});
