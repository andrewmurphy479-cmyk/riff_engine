import { TabEvent, GuitarString } from "../types";
import { RiffSpec } from "./spec";

const STRING_INDEX_TO_LETTER: readonly GuitarString[] = [
  "E", "A", "D", "G", "B", "e",
];

const STEPS_PER_BAR = 16;
const STEPS_PER_BEAT = 4;

export function stripTechniques(events: TabEvent[]): TabEvent[] {
  return events.map(({ technique: _t, ...rest }) => rest);
}

/**
 * Fractional steps a swung onset lags its straight grid slot. The beat is
 * warped piecewise-linearly: the off-beat 8th (position 2 of 4) moves to
 * `swing` of the beat, and the 16ths on either side keep their proportional
 * spot inside their half. swing = 0.5 is the identity.
 */
export function swingOffsetFor(step: number, swing: number): number {
  const p = step % STEPS_PER_BEAT;
  if (p === 0) return 0;
  const swungPos =
    p === 2 ? STEPS_PER_BEAT * swing
    : p === 1 ? 2 * swing
    : 2 + 2 * swing; // p === 3
  return swungPos - p;
}

export function riffSpecToEvents(riff: RiffSpec): TabEvent[] {
  const events: TabEvent[] = [];
  const swing = riff.swing;
  riff.bars.forEach((bar, barIdx) => {
    for (const note of bar.notes) {
      const event: TabEvent = {
        string: STRING_INDEX_TO_LETTER[note.string],
        fret: note.fret,
        step: barIdx * STEPS_PER_BAR + note.step,
        duration: note.duration,
        velocity: note.velocity / 127,
      };
      if (note.technique !== "pluck") {
        event.technique = note.technique;
      }
      if (swing !== undefined) {
        const offset = swingOffsetFor(note.step, swing);
        if (offset !== 0) event.swingOffset = offset;
      }
      events.push(event);
    }
  });
  return events;
}
