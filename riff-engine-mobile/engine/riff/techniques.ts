import type { Bar, Note } from "./spec";

const HAMMER_PULL_MAX_GAP = 4;
const HAMMER_PULL_MAX_DF = 2;

// Palm-mute eligibility: short notes on the two lowest strings.
const MUTE_MAX_STRING = 1;
const MUTE_MAX_DURATION = 2;

/**
 * Palm-mute unaccented short notes on the low strings — the chug voicing of
 * heavy/driving riffs. Accented steps ring open so the hits punch through.
 * Accent membership (not velocity) decides muting, so the A-repeat bar always
 * mutes identically to bar A regardless of per-note velocity humanization.
 */
export function tagMutes(bars: Bar[], accents: ReadonlySet<number>): Bar[] {
  return bars.map((bar) => ({
    ...bar,
    notes: bar.notes.map((note) => {
      if (note.technique !== "pluck") return note;
      if (note.string > MUTE_MAX_STRING) return note;
      if (note.duration > MUTE_MAX_DURATION) return note;
      if (accents.has(note.step)) return note;
      return { ...note, technique: "mute" as const };
    }),
  }));
}

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
