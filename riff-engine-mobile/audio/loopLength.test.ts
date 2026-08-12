import { describe, expect, it } from "vitest";

import { generateSafe } from "../engine/riff/generate";
import { Feel, Level } from "../engine/riff/rhythm";
import { riffSpecToEvents } from "../engine/riff/toEvents";
import { TabEvent } from "../engine/types";
import { STEPS_PER_BAR, totalStepsFor } from "./loopLength";

const FEELS: Feel[] = ["driving", "heavy", "bouncy", "laid_back"];
const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];
const KEYS = ["E", "A", "D", "G", "C", "B", "F#"];

function ev(step: number, duration = 1, swingOffset?: number): TabEvent {
  const e: TabEvent = { string: "E", fret: 0, step, duration };
  if (swingOffset !== undefined) e.swingOffset = swingOffset;
  return e;
}

describe("totalStepsFor", () => {
  it("uses the explicit bar count when given", () => {
    expect(totalStepsFor([ev(0)], 4)).toBe(64);
    expect(totalStepsFor([ev(0)], 1)).toBe(16);
    expect(totalStepsFor([ev(0)], 8)).toBe(128);
  });

  it("ignores a bogus bar count and falls back to derivation", () => {
    expect(totalStepsFor([ev(60)], 0)).toBe(64);
    expect(totalStepsFor([ev(60)], -3)).toBe(64);
  });

  it("rounds up to the end of the bar the last note STARTS in", () => {
    // The A5 bug: a riff whose last note lands mid-bar looped from there,
    // cutting the turnaround short.
    expect(totalStepsFor([ev(0), ev(60)])).toBe(64);
    expect(totalStepsFor([ev(0), ev(48)])).toBe(64);
    expect(totalStepsFor([ev(0), ev(16)])).toBe(32);
  });

  it("does not buy an extra bar for a note that rings past the barline", () => {
    expect(totalStepsFor([ev(63, 4)])).toBe(64);
    expect(totalStepsFor([ev(63, 1, 0.48)])).toBe(64);
  });

  it("treats a single re-based bar loop as one bar", () => {
    expect(totalStepsFor([ev(0), ev(4), ev(12)], 1)).toBe(STEPS_PER_BAR);
    expect(totalStepsFor([ev(0), ev(4), ev(12)])).toBe(STEPS_PER_BAR);
  });

  it("never returns zero for an empty event list", () => {
    expect(totalStepsFor([])).toBe(STEPS_PER_BAR);
  });

  it("gives every generated riff a whole-bar loop, both paths", () => {
    let checked = 0;
    for (let i = 0; i < 120; i++) {
      const riff = generateSafe({
        feel: FEELS[i % FEELS.length],
        level: LEVELS[i % LEVELS.length],
        key: KEYS[i % KEYS.length],
        seed: 4242 + i * 7919,
      });
      const events = riffSpecToEvents(riff);
      const expected = riff.bars.length * STEPS_PER_BAR;

      expect(totalStepsFor(events, riff.bars.length)).toBe(expected);
      expect(totalStepsFor(events)).toBe(expected);
      // The metronome derives its click count from this, so it must divide
      // into whole beats — the old rounding dropped a click on ~1% of riffs.
      expect(totalStepsFor(events, riff.bars.length) % 4).toBe(0);
      checked++;
    }
    expect(checked).toBe(120);
  });
});
