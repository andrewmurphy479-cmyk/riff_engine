import { TabEvent, GuitarString } from "../types";
import { RiffSpec } from "./spec";

const STRING_INDEX_TO_LETTER: readonly GuitarString[] = [
  "E", "A", "D", "G", "B", "e",
];

const STEPS_PER_BAR = 16;

export function stripTechniques(events: TabEvent[]): TabEvent[] {
  return events.map(({ technique: _t, ...rest }) => rest);
}

export function riffSpecToEvents(riff: RiffSpec): TabEvent[] {
  const events: TabEvent[] = [];
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
      events.push(event);
    }
  });
  return events;
}
