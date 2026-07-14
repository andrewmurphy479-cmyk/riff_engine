/**
 * Property tests for the riff engine. These replace the retired Python
 * byte-parity harness (__validate__.ts): instead of freezing exact output,
 * they assert the musical invariants every generated riff must satisfy,
 * so the engine is free to evolve.
 */
import { describe, expect, it } from "vitest";

import { midiAt } from "../fretboard";
import {
  generate,
  generateSafe,
  LEVEL_STRETCH_LIMIT,
} from "../generate";
import { passesStretchCheck } from "../playability";
import { allowedForLevel, Feel, Level, RHYTHM_LIBRARY } from "../rhythm";
import { roleOf } from "../scale";
import { RiffSpec } from "../spec";

const FEELS: (Feel | null)[] = [null, "driving", "heavy", "bouncy", "laid_back"];
const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];
const SEEDS = [1, 7, 42, 101, 303, 1337, 2024, 90210];

interface Case {
  feel: Feel | null;
  level: Level;
  seed: number;
}

const CASES: Case[] = FEELS.flatMap((feel) =>
  LEVELS.flatMap((level) => SEEDS.map((seed) => ({ feel, level, seed }))),
);

function flatPositions(riff: RiffSpec): [number, number][] {
  return riff.bars.flatMap((bar) => bar.notes.map((n): [number, number] => [n.string, n.fret]));
}

function hookShape(riff: RiffSpec, barIdx: number): string {
  return JSON.stringify(
    riff.bars[barIdx].notes.map((n) => [n.step, n.duration, n.string, n.fret, n.technique]),
  );
}

describe("generateSafe", () => {
  it("never throws across the full feel/level/seed matrix", () => {
    for (const c of CASES) {
      expect(() => generateSafe({ ...c })).not.toThrow();
    }
  });
});

describe("generated riff invariants", () => {
  const riffs: { c: Case; riff: RiffSpec }[] = CASES.map((c) => ({
    c,
    riff: generateSafe({ ...c }),
  }));

  it("always yields 4 bars in AA'AB form", () => {
    for (const { riff } of riffs) {
      expect(riff.bars).toHaveLength(4);
      expect(riff.motif_structure).toBe("AA'AB");
    }
  });

  it("bar 3 repeats bar 1 exactly (the hook reads identically)", () => {
    for (const { riff } of riffs) {
      expect(hookShape(riff, 2)).toBe(hookShape(riff, 0));
    }
  });

  it("resolves bar 4 to the root", () => {
    for (const { riff } of riffs) {
      const lastBar = riff.bars[3].notes;
      const last = lastBar[lastBar.length - 1];
      const includeBlue = riff.scale.includes("blue");
      const role = roleOf(midiAt(last.string, last.fret), riff.key, includeBlue);
      expect(role).toBe("root");
    }
  });

  it("every note belongs to the riff's scale", () => {
    for (const { riff } of riffs) {
      const includeBlue = riff.scale.includes("blue");
      for (const bar of riff.bars) {
        for (const n of bar.notes) {
          const role = roleOf(midiAt(n.string, n.fret), riff.key, includeBlue);
          expect(role).not.toBeNull();
        }
      }
    }
  });

  it("respects the level's stretch limit", () => {
    for (const { c, riff } of riffs) {
      expect(
        passesStretchCheck(flatPositions(riff), LEVEL_STRETCH_LIMIT[c.level]),
      ).toBe(true);
    }
  });

  it("only uses rhythm templates allowed at the requested level", () => {
    for (const { c, riff } of riffs) {
      const template = RHYTHM_LIBRARY.find((t) => t.name === riff.rhythm_name);
      expect(template).toBeDefined();
      expect(allowedForLevel(template!, c.level)).toBe(true);
    }
  });

  it("keeps velocities in MIDI range with real dynamic contrast", () => {
    let sawDistinctVelocities = false;
    for (const { riff } of riffs) {
      const velocities = riff.bars.flatMap((b) => b.notes.map((n) => n.velocity));
      for (const v of velocities) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(127);
      }
      if (new Set(velocities).size > 1) sawDistinctVelocities = true;
    }
    expect(sawDistinctVelocities).toBe(true);
  });

  it("palm-mutes only low strings, and only on heavy/driving riffs", () => {
    for (const { riff } of riffs) {
      for (const bar of riff.bars) {
        for (const n of bar.notes) {
          if (n.technique === "mute") {
            expect(n.string).toBeLessThanOrEqual(1);
            expect(["heavy", "driving"]).toContain(riff.feel);
          }
        }
      }
    }
  });

  it("pedal templates actually chug: most notes sit on one pitch", () => {
    for (const { riff } of riffs) {
      const template = RHYTHM_LIBRARY.find((t) => t.name === riff.rhythm_name);
      if (!template?.pedal) continue;
      for (const bar of riff.bars) {
        const midis = bar.notes.map((n) => midiAt(n.string, n.fret));
        const counts = new Map<number, number>();
        for (const m of midis) counts.set(m, (counts.get(m) ?? 0) + 1);
        const modeCount = Math.max(...counts.values());
        expect(modeCount).toBeGreaterThanOrEqual(Math.ceil(midis.length / 2));
      }
    }
  });
});

describe("determinism", () => {
  it("same seed and options produce an identical riff", () => {
    for (const c of CASES.filter((_, i) => i % 5 === 0)) {
      let a: RiffSpec;
      try {
        a = generate({ ...c, max_attempts: 50 });
      } catch {
        continue; // over-constrained combo; determinism of success is what we test
      }
      const b = generate({ ...c, max_attempts: 50 });
      expect(b).toEqual(a);
    }
  });
});

describe("template coverage", () => {
  it("every feel has at least 2 templates at every level", () => {
    for (const feel of ["driving", "heavy", "bouncy", "laid_back"] as Feel[]) {
      for (const level of LEVELS) {
        const available = RHYTHM_LIBRARY.filter(
          (t) => t.feel === feel && allowedForLevel(t, level),
        );
        expect(
          available.length,
          `feel=${feel} level=${level} has ${available.length} template(s)`,
        ).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
