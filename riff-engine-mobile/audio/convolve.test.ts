import { describe, expect, it } from "vitest";

import { convolve } from "./convolve";

/** Naive reference convolution, truncated to the signal length. */
function directConvolve(
  signal: Float32Array,
  kernel: Float32Array,
): Float32Array {
  const out = new Float32Array(signal.length);
  for (let i = 0; i < signal.length; i++) {
    for (let j = 0; j < kernel.length; j++) {
      const k = i + j;
      if (k >= out.length) break;
      out[k] += signal[i] * kernel[j];
    }
  }
  return out;
}

function randomSignal(n: number, seed = 1): Float32Array {
  // Deterministic LCG — tests shouldn't depend on Math.random.
  let s = seed >>> 0;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out[i] = (s / 0x100000000) * 2 - 1;
  }
  return out;
}

function maxAbsDiff(a: Float32Array, b: Float32Array): number {
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    max = Math.max(max, Math.abs(a[i] - b[i]));
  }
  return max;
}

describe("convolve", () => {
  it("matches direct convolution on random signals", () => {
    // Sizes that exercise multiple overlap-add blocks and a partial last block.
    for (const [n, m] of [
      [64, 8],
      [100, 33],
      [1000, 128],
      [1024, 256],
      [1500, 200],
    ]) {
      const signal = randomSignal(n, n + m);
      const kernel = randomSignal(m, m * 7 + 1);
      expect(maxAbsDiff(convolve(signal, kernel), directConvolve(signal, kernel)))
        .toBeLessThan(1e-3);
    }
  });

  it("treats a unit impulse kernel as identity", () => {
    const signal = randomSignal(512, 42);
    const kernel = new Float32Array([1]);
    expect(maxAbsDiff(convolve(signal, kernel), signal)).toBeLessThan(1e-6);
  });

  it("delays by the position of a shifted impulse", () => {
    const signal = randomSignal(256, 7);
    const kernel = new Float32Array(10);
    kernel[4] = 1;
    const out = convolve(signal, kernel);
    for (let i = 0; i < signal.length - 4; i++) {
      expect(Math.abs(out[i + 4] - signal[i])).toBeLessThan(1e-6);
    }
  });

  it("returns exactly the signal length, never the full tail", () => {
    expect(convolve(randomSignal(300), randomSignal(64)).length).toBe(300);
  });

  it("handles empty input without throwing", () => {
    expect(convolve(new Float32Array(0), randomSignal(8)).length).toBe(0);
    expect(convolve(randomSignal(8), new Float32Array(0)).length).toBe(8);
  });

  it("is fast enough for a full-length riff against the room IR", () => {
    // ~10s of audio against a 1.3s IR at 44.1kHz — the real offline workload.
    const signal = randomSignal(441_000, 3);
    const kernel = randomSignal(57_330, 9);
    const started = Date.now();
    convolve(signal, kernel);
    expect(Date.now() - started).toBeLessThan(10_000);
  });
});
