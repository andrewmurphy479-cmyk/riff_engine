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
import { riffSpecToEvents } from "../toEvents";

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
      const finalStep = Math.max(...lastBar.map((n) => n.step));
      // The lowest note of the final hit — a power-chord landing still
      // resolves to root; its 5th/octave rides on top.
      const finalHit = lastBar.filter((n) => n.step === finalStep);
      const last = finalHit.reduce((lo, n) =>
        midiAt(n.string, n.fret) < midiAt(lo.string, lo.fret) ? n : lo,
      );
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
            expect(["heavy", "driving"]).toContain(riff.feel);
            if (n.string <= 1) continue;
            // A muted diad's harmony note may ride one grip higher — the palm
            // covers the whole shape — but only with a muted root under it.
            const root = bar.notes.find(
              (m) =>
                m.step === n.step &&
                m.string < n.string &&
                m.technique === "mute",
            );
            expect(
              root,
              `stray mute on string ${n.string} without a muted diad root`,
            ).toBeDefined();
            expect(root!.string).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it("pedal templates actually chug: most hits sit on one pitch", () => {
    for (const { riff } of riffs) {
      const template = RHYTHM_LIBRARY.find((t) => t.name === riff.rhythm_name);
      if (!template?.pedal) continue;
      for (const bar of riff.bars) {
        // One pitch per *hit* (lowest note of the step) — a diad stab on an
        // accent is still a single hit, not two votes against the pedal.
        const lowestByStep = new Map<number, number>();
        for (const n of bar.notes) {
          const midi = midiAt(n.string, n.fret);
          const prev = lowestByStep.get(n.step);
          if (prev === undefined || midi < prev) lowestByStep.set(n.step, midi);
        }
        const midis = [...lowestByStep.values()];
        const counts = new Map<number, number>();
        for (const m of midis) counts.set(m, (counts.get(m) ?? 0) + 1);
        const modeCount = Math.max(...counts.values());
        expect(modeCount).toBeGreaterThanOrEqual(Math.ceil(midis.length / 2));
      }
    }
  });

  it("diads: harmony notes are a 5th or octave above the hit's root, on heavy/driving only", () => {
    let sawDiad = false;
    for (const { c, riff } of riffs) {
      for (const bar of riff.bars) {
        const byStep = new Map<number, typeof bar.notes>();
        for (const n of bar.notes) {
          const group = byStep.get(n.step) ?? [];
          group.push(n);
          byStep.set(n.step, group);
        }
        for (const group of byStep.values()) {
          expect(group.length).toBeLessThanOrEqual(2);
          if (group.length !== 2) continue;
          sawDiad = true;
          expect(["heavy", "driving"]).toContain(riff.feel);
          const [a, b] = [...group].sort(
            (x, y) => midiAt(x.string, x.fret) - midiAt(y.string, y.fret),
          );
          const interval = midiAt(b.string, b.fret) - midiAt(a.string, a.fret);
          expect([7, 12]).toContain(interval);
          // Fixed grips: +2 frets, one or two strings up.
          expect(b.fret - a.fret).toBe(2);
          expect([1, 2]).toContain(b.string - a.string);
          if (c.level === "beginner") {
            // Beginners only get the power-chord landing on the final hit.
            const lastBar = riff.bars[riff.bars.length - 1];
            const finalStep = Math.max(...lastBar.notes.map((n) => n.step));
            expect(bar).toBe(lastBar);
            expect(a.step).toBe(finalStep);
          }
        }
      }
    }
    expect(sawDiad).toBe(true);
  });

  it("swing: ratio present exactly on swung templates and inside the seeded range", () => {
    let sawSwing = false;
    for (const { riff } of riffs) {
      const template = RHYTHM_LIBRARY.find((t) => t.name === riff.rhythm_name);
      if (template?.swing) {
        sawSwing = true;
        expect(riff.swing).toBeGreaterThanOrEqual(0.57);
        expect(riff.swing).toBeLessThanOrEqual(0.62);
      } else {
        expect(riff.swing).toBeUndefined();
      }
    }
    expect(sawSwing).toBe(true);
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
  it("every feel has at least 4 templates at every level", () => {
    for (const feel of ["driving", "heavy", "bouncy", "laid_back"] as Feel[]) {
      for (const level of LEVELS) {
        const available = RHYTHM_LIBRARY.filter(
          (t) => t.feel === feel && allowedForLevel(t, level),
        );
        expect(
          available.length,
          `feel=${feel} level=${level} has ${available.length} template(s)`,
        ).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it("swung templates never carry 16th subdivisions", () => {
    for (const t of RHYTHM_LIBRARY.filter((t) => t.swing)) {
      expect(
        t.steps.every(([step, dur]) => step % 2 === 0 && dur >= 2),
        `template ${t.name} mixes swing with 16ths`,
      ).toBe(true);
    }
  });
});

describe("toEvents swing offsets", () => {
  it("delays only off-beat onsets, by the beat-warp amount", () => {
    for (const c of CASES) {
      const riff = generateSafe({ ...c });
      const events = riffSpecToEvents(riff);
      for (const e of events) {
        if (riff.swing === undefined || e.step % 4 === 0) {
          expect(e.swingOffset).toBeUndefined();
        } else if (e.step % 4 === 2) {
          expect(e.swingOffset).toBeCloseTo(4 * riff.swing - 2, 10);
          expect(e.swingOffset!).toBeGreaterThan(0);
        }
      }
    }
  });
});
