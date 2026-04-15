import { TabEvent, GuitarString, Technique } from "../types";
import { RiffSpec } from "./spec";

const STRING_INDEX_TO_LETTER: readonly GuitarString[] = [
  "E", "A", "D", "G", "B", "e",
];

const STEPS_PER_BAR = 16;

export function riffSpecToEvents(riff: RiffSpec): TabEvent[] {
  const events: TabEvent[] = [];
  riff.bars.forEach((bar, barIdx) => {
    for (const note of bar.notes) {
      events.push({
        string: STRING_INDEX_TO_LETTER[note.string],
        fret: note.fret,
        step: barIdx * STEPS_PER_BAR + note.step,
        duration: note.duration,
        velocity: note.velocity / 127,
        technique: note.technique === "hammer" || note.technique === "slide"
          ? (note.technique as Technique)
          : null,
      });
    }
  });
  return events;
}
