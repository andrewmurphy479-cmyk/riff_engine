import { describe, expect, it } from "vitest";

import { analyzeRiff } from "../coaching";
import { bpmForPct, buildDrill, repsForStep, rungForRep } from "../drill";
import { generateSafe } from "../generate";
import { Level } from "../rhythm";

const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];
const KEYS = ["E", "A", "D", "G", "C", "B", "F#"];

describe("buildDrill", () => {
  it("walks learn, build, then play", () => {
    const riff = generateSafe({ key: "E", level: "intermediate" });
    expect(buildDrill(riff).steps.map((s) => s.id)).toEqual([
      "learn",
      "build",
      "play",
    ]);
  });

  it("targets the bar the coaching analysis rates hardest", () => {
    for (const level of LEVELS) {
      for (let i = 0; i < 15; i++) {
        const riff = generateSafe({ key: KEYS[i % KEYS.length], level });
        const drill = buildDrill(riff);
        const learn = drill.steps[0];
        expect(learn.barIndex).toBe(analyzeRiff(riff).hardestBarIndex);
        // And that bar must exist and be worth looping.
        expect(riff.bars[learn.barIndex!].notes.length).toBeGreaterThan(0);
      }
    }
  });

  it("only loops the learn and build steps", () => {
    const drill = buildDrill(generateSafe({ key: "E" }));
    const byId = Object.fromEntries(drill.steps.map((s) => [s.id, s]));
    expect(byId.learn.loop).toBe(true);
    expect(byId.build.loop).toBe(true);
    expect(byId.play.loop).toBe(false);
  });

  it("ramps tempo upward and finishes at full speed", () => {
    const drill = buildDrill(generateSafe({ key: "E" }));
    const all = drill.steps.flatMap((s) => s.tempoPcts);
    for (let i = 1; i < all.length; i++) {
      expect(all[i]).toBeGreaterThan(all[i - 1]);
    }
    expect(all[all.length - 1]).toBe(100);
    expect(all[0]).toBeLessThan(100);
  });

  it("drills the whole riff once past the learn step", () => {
    const drill = buildDrill(generateSafe({ key: "E" }));
    expect(drill.steps[1].barIndex).toBeNull();
    expect(drill.steps[2].barIndex).toBeNull();
  });

  it("totals the reps across every rung of every step", () => {
    const drill = buildDrill(generateSafe({ key: "E" }));
    const expected = drill.steps.reduce(
      (n, s) => n + s.tempoPcts.length * s.repsPerRung,
      0,
    );
    expect(drill.totalReps).toBe(expected);
    expect(drill.totalReps).toBeGreaterThan(0);
  });

  it("borrows the riff's top coaching tip for the learn instruction", () => {
    // The thing you're told to concentrate on should be the thing the coaching
    // card led with, not generic practice advice.
    for (let i = 0; i < 10; i++) {
      const riff = generateSafe({ key: KEYS[i % KEYS.length] });
      const learn = buildDrill(riff).steps[0];
      expect(learn.instruction.length).toBeGreaterThan(0);
    }
  });

  it("gives every step a label, title and instruction", () => {
    for (const level of LEVELS) {
      const drill = buildDrill(generateSafe({ key: "E", level }));
      for (const step of drill.steps) {
        expect(step.label.length).toBeGreaterThan(0);
        expect(step.title.length).toBeGreaterThan(0);
        expect(step.instruction.length).toBeGreaterThan(0);
        expect(step.tempoPcts.length).toBeGreaterThan(0);
        expect(step.repsPerRung).toBeGreaterThan(0);
      }
    }
  });
});

describe("bpmForPct", () => {
  it("scales tempo by the percentage", () => {
    expect(bpmForPct(120, 50)).toBe(60);
    expect(bpmForPct(110, 100)).toBe(110);
  });

  it("floors slow riffs so they stay countable", () => {
    // 55% of a 60bpm doom riff is 33bpm — unusable as a practice pulse.
    expect(bpmForPct(60, 55)).toBe(45);
    expect(bpmForPct(200, 55)).toBeGreaterThan(45);
  });

  it("never returns a fractional tempo", () => {
    for (const bpm of [92, 96, 110, 137]) {
      for (const pct of [55, 70, 85, 100]) {
        expect(Number.isInteger(bpmForPct(bpm, pct))).toBe(true);
      }
    }
  });
});

describe("rungForRep", () => {
  const step = buildDrill(generateSafe({ key: "E" })).steps[1]; // build: 2 rungs

  it("advances a rung once its reps are done", () => {
    expect(rungForRep(step, 0).rungIndex).toBe(0);
    expect(rungForRep(step, step.repsPerRung - 1).rungIndex).toBe(0);
    expect(rungForRep(step, step.repsPerRung).rungIndex).toBe(1);
  });

  it("reports progress within the current rung", () => {
    expect(rungForRep(step, 0).repsIntoRung).toBe(0);
    expect(rungForRep(step, step.repsPerRung).repsIntoRung).toBe(0);
    expect(rungForRep(step, step.repsPerRung + 1).repsIntoRung).toBe(1);
  });

  it("clamps past the last rung instead of running off the array", () => {
    const over = rungForRep(step, repsForStep(step) + 50);
    expect(over.rungIndex).toBe(step.tempoPcts.length - 1);
    expect(over.tempoPct).toBe(step.tempoPcts[step.tempoPcts.length - 1]);
  });

  it("returns a real tempo for every rep up to the step total", () => {
    for (let rep = 0; rep <= repsForStep(step); rep++) {
      expect(step.tempoPcts).toContain(rungForRep(step, rep).tempoPct);
    }
  });
});
