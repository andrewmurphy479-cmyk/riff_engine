import { describe, it, expect } from "vitest";
import { synthesizeMono, SAMPLE_RATE } from "./KarplusStrong";

function rms(mono: Float32Array, from: number, to: number): number {
  let sumSq = 0;
  for (let i = from; i < to; i++) sumSq += mono[i] * mono[i];
  return Math.sqrt(sumSq / (to - from));
}

describe("synthesizeMono release fade", () => {
  it("eases a low string down to near-silence by buffer end, not an abrupt mute", () => {
    // Low strings barely decay within their fixed ring window — an unchoked
    // low note (typically a riff's last note, since nothing re-strikes its
    // string) used to hit a flat 25ms end-of-buffer taper while still ~30%
    // of peak, which reads as an artificial mute rather than a fade-out.
    const mono = synthesizeMono({
      midiNote: 40, // low E
      durationMs: 3500,
      velocity: 0.5,
      technique: "pluck",
      guitarString: "E",
      sustainTailMs: 0,
    });
    const n = mono.length;
    const last20ms = Math.floor(SAMPLE_RATE * 0.02);
    const bodyRms = rms(mono, n - last20ms - Math.floor(SAMPLE_RATE * 0.2), n - last20ms);
    const endRms = rms(mono, n - last20ms, n);
    expect(endRms).toBeLessThan(bodyRms * 0.15);
  });

  it("keeps no discontinuity across the release taper (no click)", () => {
    const mono = synthesizeMono({
      midiNote: 40,
      durationMs: 3500,
      velocity: 0.5,
      technique: "pluck",
      guitarString: "E",
      sustainTailMs: 0,
    });
    const n = mono.length;
    const tailStart = n - Math.floor(SAMPLE_RATE * 0.45);
    let maxDelta = 0;
    for (let i = tailStart + 1; i < n; i++) {
      maxDelta = Math.max(maxDelta, Math.abs(mono[i] - mono[i - 1]));
    }
    expect(maxDelta).toBeLessThan(0.01);
  });

  it("still tapers a high string over a short, snappy window", () => {
    // High strings are already decayed to near-nothing well before their
    // (shorter) ring window ends, so they don't need — and shouldn't get —
    // the long low-string taper.
    const mono = synthesizeMono({
      midiNote: 76,
      durationMs: 2200,
      velocity: 0.5,
      technique: "pluck",
      guitarString: "e",
      sustainTailMs: 0,
    });
    const n = mono.length;
    expect(rms(mono, n - Math.floor(SAMPLE_RATE * 0.02), n)).toBeLessThan(0.001);
  });
});
