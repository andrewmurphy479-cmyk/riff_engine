import type { Bar, Note } from "./spec";

const HAMMER_PULL_MAX_GAP = 4;
const HAMMER_PULL_MAX_DF = 2;

/**
 * Tag same-string consecutive notes with hammer/pull articulations.
 * Articulation lives on the destination note (guitar-notation convention).
 */
export function tagTechniques(bars: Bar[]): Bar[] {
  return bars.map((bar) => {
    const sorted = [...bar.notes].sort((a, b) => a.step - b.step);
    const lastByString = new Map<number, Note>();
    const tagged: Note[] = sorted.map((note) => {
      const prev = lastByString.get(note.string);
      lastByString.set(note.string, note);
      if (!prev || note.technique !== "pluck") return note;
      const gap = note.step - prev.step;
      if (gap <= 0) return note;
      const df = note.fret - prev.fret;
      const absDf = Math.abs(df);
      if (absDf === 0) return note;
      if (absDf <= HAMMER_PULL_MAX_DF && gap <= HAMMER_PULL_MAX_GAP) {
        return { ...note, technique: df > 0 ? "hammer" : "pull" };
      }
      return note;
    });
    return { ...bar, notes: tagged };
  });
}
