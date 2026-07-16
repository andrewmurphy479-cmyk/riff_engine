/**
 * Power-chord / diad pass: thickens accented strong-beat hits with a second
 * note — root+5th (adjacent string, +2 frets) or root+octave (two strings up,
 * +2 frets). Both shapes are fixed physical grips, so playability validates
 * the whole riff's fret path with the harmony notes included; any diad that
 * would break the level's stretch limit is silently dropped.
 *
 * Feel rules: only heavy/driving riffs get diads (one seeded roll decides per
 * riff). Beginners stay single-note except a power-chord landing on the
 * riff's final hit. Bar 3 (the A-repeat) always mirrors bar 1's diads so the
 * hook reads identically.
 */
import { MAX_FRET, midiAt } from "./fretboard";
import { passesStretchCheck } from "./playability";
import { Level } from "./rhythm";
import { Rng } from "./rng";
import { roleOf } from "./scale";
import { Bar, Note } from "./spec";

const DIAD_CHANCE: Record<string, number> = {
  heavy: 0.85,
  driving: 0.6,
};

const OCTAVE_SHAPE_CHANCE = 0.25;
const DIAD_FRET_OFFSET = 2;

type Shape = "fifth" | "octave";

// String offset per shape. Valid only across the 4ths-tuned low strings
// (E-A-D-G): +1 string +2 frets = perfect 5th, +2 strings +2 frets = octave.
const SHAPE_STRING_OFFSET: Record<Shape, number> = { fifth: 1, octave: 2 };
const MAX_HARMONY_STRING = 3; // G string — the last one tuned a 4th up

export interface DiadOptions {
  rng: Rng;
  feel: string;
  level: Level;
  /** Grid positions (step values) the template accents. */
  accents: ReadonlySet<number>;
  stretchLimit: number;
  key: string;
  includeBlue: boolean;
}

/** Harmony note for a root under the given shape, or null if the grip falls
 * off the low-string block, off the neck, or outside the riff's scale. */
function harmonyFor(
  root: Note,
  shape: Shape,
  key: string,
  includeBlue: boolean,
): Note | null {
  const hString = root.string + SHAPE_STRING_OFFSET[shape];
  const hFret = root.fret + DIAD_FRET_OFFSET;
  if (hString > MAX_HARMONY_STRING) return null;
  if (hFret > MAX_FRET) return null;
  // Keep the "every note is in the scale" invariant: a fifth above the scale's
  // 5 or blue degree leaves the pool, so those roots simply don't get fifths.
  if (roleOf(midiAt(hString, hFret), key, includeBlue) === null) return null;
  return {
    step: root.step,
    duration: root.duration,
    string: hString,
    fret: hFret,
    velocity: root.velocity,
    technique: root.technique === "mute" ? "mute" : "pluck",
  };
}

function insertSorted(notes: Note[], note: Note): void {
  let i = 0;
  while (
    i < notes.length &&
    (notes[i].step < note.step ||
      (notes[i].step === note.step && notes[i].string < note.string))
  ) {
    i++;
  }
  notes.splice(i, 0, note);
}

function flatPositions(bars: readonly Bar[]): [number, number][] {
  return bars.flatMap((bar) =>
    bar.notes.map((n): [number, number] => [n.string, n.fret]),
  );
}

export function addDiads(bars: Bar[], opts: DiadOptions): Bar[] {
  const { rng, feel, level, accents, stretchLimit, key, includeBlue } = opts;

  const chance = DIAD_CHANCE[feel] ?? 0;
  if (chance === 0) return bars;
  if (rng.random() >= chance) return bars;
  const preferred: Shape =
    rng.random() < OCTAVE_SHAPE_CHANCE ? "octave" : "fifth";

  const work = bars.map((bar) => ({
    ...bar,
    notes: bar.notes.map((n) => ({ ...n })),
  }));

  const lastBarIdx = work.length - 1;
  const lastBarNotes = work[lastBarIdx]?.notes ?? [];
  const finalStep = lastBarNotes.length
    ? Math.max(...lastBarNotes.map((n) => n.step))
    : -1;

  const isEligible = (note: Note, barIdx: number): boolean => {
    if (note.technique !== "pluck" && note.technique !== "mute") return false;
    const isFinalHit = barIdx === lastBarIdx && note.step === finalStep;
    if (level === "beginner") return isFinalHit;
    return (accents.has(note.step) && note.step % 4 === 0) || isFinalHit;
  };

  const harmonyWithFallback = (root: Note): Note | null =>
    harmonyFor(root, preferred, key, includeBlue) ??
    harmonyFor(root, preferred === "fifth" ? "octave" : "fifth", key, includeBlue);

  // Try one addition (optionally paired with its bar-3 mirror); keep it only
  // if the whole riff still passes the level's stretch check as a unit.
  const tryAdd = (barIdx: number, harmony: Note, mirrorBarIdx?: number): void => {
    const inserted: { barIdx: number; note: Note }[] = [];
    insertSorted(work[barIdx].notes, harmony);
    inserted.push({ barIdx, note: harmony });

    if (mirrorBarIdx !== undefined) {
      // The A-repeat bar has identical fingering, so its root sits at the
      // same step on a lower string; only velocity (jitter) may differ.
      const mirrorRoot = work[mirrorBarIdx].notes.find(
        (n) => n.step === harmony.step && n.string < harmony.string,
      );
      const mirror: Note = {
        ...harmony,
        velocity: mirrorRoot?.velocity ?? harmony.velocity,
      };
      insertSorted(work[mirrorBarIdx].notes, mirror);
      inserted.push({ barIdx: mirrorBarIdx, note: mirror });
    }

    if (!passesStretchCheck(flatPositions(work), stretchLimit)) {
      for (const { barIdx: b, note } of inserted) {
        const i = work[b].notes.indexOf(note);
        if (i >= 0) work[b].notes.splice(i, 1);
      }
    }
  };

  work.forEach((bar, barIdx) => {
    // Bar 3 (index 2) is the A-repeat: it only ever mirrors bar 1's diads.
    if (barIdx === 2) return;
    for (const note of [...bar.notes]) {
      if (!isEligible(note, barIdx)) continue;
      const harmony = harmonyWithFallback(note);
      if (!harmony) continue;
      tryAdd(barIdx, harmony, barIdx === 0 ? 2 : undefined);
    }
  });

  return work;
}
