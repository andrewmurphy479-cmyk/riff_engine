import { describe, it, expect } from "vitest";
import { chokeGain } from "./timing";

describe("chokeGain", () => {
  it("starts at 1, ends at 0, and stays in range", () => {
    const fadeSamples = 1102; // ~25ms at 44.1kHz
    expect(chokeGain(0, 0, fadeSamples)).toBeCloseTo(1, 5);
    expect(chokeGain(fadeSamples, 0, fadeSamples)).toBe(0);
    for (let t = 0; t <= fadeSamples; t += 37) {
      const g = chokeGain(t, 0, fadeSamples);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
    }
  });

  it("is a raised cosine, not a straight line — near-flat at both ends", () => {
    // A linear ramp has the same step size everywhere. The raised cosine's
    // step size near the endpoints (zero slope) is much smaller than its
    // step size through the middle (steepest point) — that's what keeps a
    // re-strike on a still-loud note from reading as a click.
    const fadeSamples = 1102;
    const stepNearStart = chokeGain(0, 0, fadeSamples) - chokeGain(10, 0, fadeSamples);
    const stepNearMiddle =
      chokeGain(fadeSamples / 2 - 5, 0, fadeSamples) -
      chokeGain(fadeSamples / 2 + 5, 0, fadeSamples);
    expect(stepNearStart).toBeLessThan(stepNearMiddle * 0.3);
  });

  it("monotonically decreases across the fade", () => {
    const fadeSamples = 1102;
    let prev = chokeGain(0, 0, fadeSamples);
    for (let t = 1; t <= fadeSamples; t += 11) {
      const g = chokeGain(t, 0, fadeSamples);
      expect(g).toBeLessThanOrEqual(prev + 1e-9);
      prev = g;
    }
  });
});
