/**
 * Deterministic cross-language PRNG for the riff engine.
 *
 * Mulberry32 — 32-bit-state linear generator. Must produce byte-identical
 * output to engine/rng.py in updated_engine_logic, for the same seed.
 *
 * Consumes exactly one u32 per random()/randrange()/choice() call.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  private nextU32(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t = t ^ (t + Math.imul(t ^ (t >>> 7), t | 61));
    return (t ^ (t >>> 14)) >>> 0;
  }

  random(): number {
    return this.nextU32() / 0x100000000;
  }

  randrange(n: number): number {
    if (n <= 0) throw new Error(`randrange(n) requires n > 0, got ${n}`);
    return this.nextU32() % n;
  }

  choice<T>(seq: readonly T[]): T {
    if (seq.length === 0) throw new Error("Rng.choice() called on empty sequence");
    return seq[this.randrange(seq.length)];
  }
}
