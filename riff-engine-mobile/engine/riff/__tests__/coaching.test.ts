/**
 * Coaching is derived, not authored, so the risk is that it describes a riff
 * that isn't the one on screen — a palm-mute tip on a riff with no mutes, a
 * "one position" tip on a riff that shifts. These check the derivation against
 * real generated riffs as well as hand-built edge cases.
 */
import { describe, expect, it } from "vitest";

import { analyzeRiff, coachingFor } from "../coaching";
import { generateSafe } from "../generate";
import { Feel, Level } from "../rhythm";
import { Bar, Note, RiffSpec } from "../spec";

const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];
const FEELS: (Feel | null)[] = [null, "driving", "heavy", "bouncy", "laid_back"];
const KEYS = ["E", "A", "D", "G", "C", "B", "F#"];

function note(over: Partial<Note> = {}): Note {
  return {
    step: 0,
    duration: 4,
    string: 0,
    fret: 5,
    velocity: 90,
    technique: "pluck",
    ...over,
  };
}

function spec(bars: Bar[], over: Partial<RiffSpec> = {}): RiffSpec {
  return {
    key: "E",
    scale: "minor_pentatonic",
    tempo_bpm: 110,
    time_sig: [4, 4],
    bars,
    motif_structure: "AA'AB",
    seed: 1,
    rhythm_name: "straight_8ths",
    feel: "driving",
    ...over,
  };
}

function tipIds(riff: RiffSpec): string[] {
  return coachingFor(riff).tips.map((t) => t.id);
}

describe("analyzeRiff", () => {
  it("counts techniques", () => {
    const a = analyzeRiff(
      spec([
        {
          notes: [
            note({ step: 0, technique: "mute" }),
            note({ step: 2, technique: "mute" }),
            note({ step: 4, technique: "hammer" }),
            note({ step: 6, technique: "pull" }),
            note({ step: 8 }),
          ],
        },
      ]),
    );
    expect(a.muteCount).toBe(2);
    expect(a.hammerCount).toBe(1);
    expect(a.pullCount).toBe(1);
  });

  it("counts a stacked step once, not once per note", () => {
    const a = analyzeRiff(
      spec([
        {
          notes: [
            note({ step: 0, string: 0 }),
            note({ step: 0, string: 1 }),
            note({ step: 4, string: 0 }),
          ],
        },
      ]),
    );
    expect(a.diadCount).toBe(1);
  });

  it("does not merge same-step notes across different bars", () => {
    const bar: Bar = { notes: [note({ step: 0 })] };
    expect(analyzeRiff(spec([bar, { notes: [note({ step: 0 })] }])).diadCount).toBe(0);
  });

  it("excludes open strings from the fret span", () => {
    const a = analyzeRiff(
      spec([
        { notes: [note({ fret: 0 }), note({ step: 4, fret: 5 }), note({ step: 8, fret: 7 })] },
      ]),
    );
    expect(a.minFret).toBe(5);
    expect(a.maxFret).toBe(7);
    expect(a.fretSpan).toBe(2);
    expect(a.openStringCount).toBe(1);
  });

  it("reports no fret range for an all-open riff", () => {
    const a = analyzeRiff(spec([{ notes: [note({ fret: 0 }), note({ step: 4, fret: 0 })] }]));
    expect(a.minFret).toBeNull();
    expect(a.maxFret).toBeNull();
    expect(a.fretSpan).toBe(0);
  });

  it("detects identical bars regardless of note order", () => {
    const barA: Bar = { notes: [note({ step: 0 }), note({ step: 4, fret: 7 })] };
    const barAReordered: Bar = { notes: [note({ step: 4, fret: 7 }), note({ step: 0 })] };
    const barB: Bar = { notes: [note({ step: 2, fret: 9 })] };
    const a = analyzeRiff(spec([barA, barB, barAReordered, barB]));
    expect(a.repeatedBars).toEqual([0, 2]);
  });

  it("never reports empty bars as a repeat", () => {
    const a = analyzeRiff(spec([{ notes: [] }, { notes: [] }]));
    expect(a.repeatedBars).toBeNull();
  });

  it("treats the low E and A as the low strings", () => {
    expect(
      analyzeRiff(spec([{ notes: [note({ string: 0 }), note({ step: 4, string: 1 })] }]))
        .lowStringsOnly,
    ).toBe(true);
    expect(
      analyzeRiff(spec([{ notes: [note({ string: 0 }), note({ step: 4, string: 3 })] }]))
        .lowStringsOnly,
    ).toBe(false);
  });

  it("picks the busiest bar to drill first", () => {
    const sparse: Bar = { notes: [note({ step: 0 })] };
    const busy: Bar = {
      notes: [0, 1, 2, 3, 4, 5].map((i) =>
        note({ step: i, duration: 1, fret: 5 + i, technique: "hammer" }),
      ),
    };
    expect(analyzeRiff(spec([sparse, busy, sparse, sparse])).hardestBarIndex).toBe(1);
  });

  it("reads swing off the spec, ignoring a straight ratio", () => {
    expect(analyzeRiff(spec([{ notes: [note()] }], { swing: 0.6 })).swung).toBe(true);
    expect(analyzeRiff(spec([{ notes: [note()] }], { swing: 0.5 })).swung).toBe(false);
    expect(analyzeRiff(spec([{ notes: [note()] }])).swung).toBe(false);
  });
});

describe("coachingFor", () => {
  it("only mentions a technique the riff actually contains", () => {
    const plain = spec([{ notes: [note(), note({ step: 4, fret: 6 })] }]);
    const ids = tipIds(plain);
    expect(ids).not.toContain("palm_mute");
    expect(ids).not.toContain("legato");
    expect(ids).not.toContain("diads");
  });

  it("leads with technique over position", () => {
    const riff = spec([
      {
        notes: [
          note({ step: 0, technique: "mute" }),
          note({ step: 4, fret: 12, technique: "mute" }),
        ],
      },
    ]);
    expect(tipIds(riff)[0]).toBe("palm_mute");
  });

  it("distinguishes reach, travel, and staying put", () => {
    // Reach: every note inside one hand span, but a wide one.
    const wide = spec([
      { notes: [note({ fret: 5 }), note({ step: 4, fret: 9 })] },
    ]);
    expect(tipIds(wide)).toContain("stretch");
    expect(tipIds(wide)).not.toContain("position");
    expect(tipIds(wide)).not.toContain("shift");

    // Travel: the riff walks up the neck a couple of frets at a time, so no
    // single window is a stretch but the hand must move. Telling a player to
    // anchor and reach here would be actively wrong.
    const walking = spec([
      {
        notes: [2, 3, 4, 5, 8, 9, 10, 11].map((fret, i) =>
          note({ step: i * 2, fret }),
        ),
      },
    ]);
    const walkIds = tipIds(walking);
    expect(walkIds).toContain("shift");
    expect(walkIds).not.toContain("stretch");

    const tight = spec([{ notes: [note({ fret: 5 }), note({ step: 4, fret: 7 })] }]);
    expect(tipIds(tight)).toContain("position");
    expect(tipIds(tight)).not.toContain("stretch");
  });

  it("measures reach over consecutive notes, not the whole riff", () => {
    const walking = spec([
      {
        notes: [2, 3, 4, 5, 8, 9, 10, 11].map((fret, i) =>
          note({ step: i * 2, fret }),
        ),
      },
    ]);
    const a = analyzeRiff(walking);
    expect(a.fretSpan).toBe(9);
    // Widest window of four consecutive notes is 5,8,9,10 -> 5 frets.
    expect(a.handSpan).toBeLessThan(a.fretSpan);
    expect(a.shiftsPosition).toBe(true);
  });

  it("never tells a shifting riff to hold one position", () => {
    // The generator caps reach per window but not travel across the riff, so
    // wide-ranging riffs are common and this would misfire often.
    for (const level of LEVELS) {
      for (let i = 0; i < 25; i++) {
        const riff = generateSafe({ key: KEYS[i % KEYS.length], level });
        const { tips, analysis } = coachingFor(riff);
        const ids = tips.map((t) => t.id);
        if (analysis.shiftsPosition) {
          expect(ids).toContain("shift");
          expect(ids).not.toContain("position");
          expect(ids).not.toContain("stretch");
        }
      }
    }
  });

  it("prefers the swing tip over the sixteenths tip when both apply", () => {
    const riff = spec(
      [{ notes: [note({ duration: 1 }), note({ step: 1, duration: 1 })] }],
      { swing: 0.6 },
    );
    const ids = tipIds(riff);
    expect(ids).toContain("swing");
    expect(ids).not.toContain("sixteenths");
  });

  it("skips the open-string tip for a low-string chug", () => {
    // Open low strings are the point of a chug riff, not a ringing hazard.
    const riff = spec([
      { notes: [note({ string: 0, fret: 0 }), note({ step: 4, string: 1, fret: 0 })] },
    ]);
    expect(tipIds(riff)).not.toContain("open_strings");
  });

  it("produces a headline and at least one tip for every generated riff", () => {
    for (const level of LEVELS) {
      for (const feel of FEELS) {
        for (const key of KEYS) {
          const riff = generateSafe({ key, level, feel });
          const coaching = coachingFor(riff);
          expect(coaching.headline.length).toBeGreaterThan(0);
          expect(coaching.tips.length).toBeGreaterThan(0);
          for (const tip of coaching.tips) {
            expect(tip.label.length).toBeGreaterThan(0);
            expect(tip.body.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("never claims a technique a generated riff lacks", () => {
    for (const level of LEVELS) {
      for (const feel of FEELS) {
        for (let i = 0; i < 10; i++) {
          const riff = generateSafe({ key: KEYS[i % KEYS.length], level, feel });
          const { tips, analysis } = coachingFor(riff);
          const ids = tips.map((t) => t.id);
          if (ids.includes("palm_mute")) expect(analysis.muteCount).toBeGreaterThan(0);
          if (ids.includes("legato")) {
            expect(analysis.hammerCount + analysis.pullCount).toBeGreaterThan(0);
          }
          if (ids.includes("diads")) expect(analysis.diadCount).toBeGreaterThan(0);
          if (ids.includes("repeat")) expect(analysis.repeatedBars).not.toBeNull();
        }
      }
    }
  });

  it("points at a bar that exists and has notes", () => {
    for (const level of LEVELS) {
      for (let i = 0; i < 20; i++) {
        const riff = generateSafe({ key: KEYS[i % KEYS.length], level });
        const idx = analyzeRiff(riff).hardestBarIndex;
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(riff.bars.length);
        expect(riff.bars[idx].notes.length).toBeGreaterThan(0);
      }
    }
  });

  it("agrees subject and verb on the singular case", () => {
    const oneMute = spec([
      { notes: [note({ technique: "mute" }), note({ step: 4, fret: 7 })] },
    ]);
    const muteTip = coachingFor(oneMute).tips.find((t) => t.id === "palm_mute");
    expect(muteTip!.body).toContain("One note is muted");

    const oneOpen = spec([
      { notes: [note({ string: 3, fret: 0 }), note({ step: 4, string: 3, fret: 7 })] },
    ]);
    const openTip = coachingFor(oneOpen).tips.find((t) => t.id === "open_strings");
    expect(openTip!.body).toContain("One note rings open");

    const manyOpen = spec([
      {
        notes: [
          note({ string: 3, fret: 0 }),
          note({ step: 2, string: 4, fret: 0 }),
          note({ step: 4, string: 3, fret: 7 }),
        ],
      },
    ]);
    const manyTip = coachingFor(manyOpen).tips.find((t) => t.id === "open_strings");
    expect(manyTip!.body).toContain("2 notes ring open");
  });

  it("survives an empty riff without throwing", () => {
    const empty = spec([{ notes: [] }]);
    expect(() => coachingFor(empty)).not.toThrow();
    expect(coachingFor(empty).headline.length).toBeGreaterThan(0);
  });
});
