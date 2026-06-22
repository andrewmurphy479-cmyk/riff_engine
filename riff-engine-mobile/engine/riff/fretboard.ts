import { Bar } from "./spec";

export const OPEN_MIDI: readonly number[] = [40, 45, 50, 55, 59, 64];
export const STRING_COUNT = 6;
export const MAX_FRET = 15;

const PITCH_CLASSES: readonly string[] = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

const PITCH_CLASS_INDEX: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(PITCH_CLASSES.map((name, i) => [name, i])),
);

export function midiAt(stringIdx: number, fret: number): number {
  return OPEN_MIDI[stringIdx] + fret;
}

export function positionsForMidi(
  midi: number,
  maxFret: number = MAX_FRET,
): [number, number][] {
  const out: [number, number][] = [];
  for (let s = 0; s < STRING_COUNT; s++) {
    const fret = midi - OPEN_MIDI[s];
    if (fret >= 0 && fret <= maxFret) {
      out.push([s, fret]);
    }
  }
  return out;
}

export function noteNameToPitchClass(name: string): number {
  return PITCH_CLASS_INDEX[name];
}

export function pitchToName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const pc = PITCH_CLASSES[midi % 12];
  return `${pc}${octave}`;
}

const MIN_FRET_SPAN = 5;

export function fretRangeForBar(
  bar: Bar,
  padding: number = 2,
): { minFret: number; maxFret: number } {
  if (bar.notes.length === 0) {
    return { minFret: 0, maxFret: 7 };
  }

  let lo = MAX_FRET;
  let hi = 0;
  for (const n of bar.notes) {
    if (n.fret < lo) lo = n.fret;
    if (n.fret > hi) hi = n.fret;
  }

  if (hi - lo < MIN_FRET_SPAN) {
    const extra = MIN_FRET_SPAN - (hi - lo);
    const padLo = Math.floor(extra / 2);
    lo = Math.max(0, lo - padLo);
    hi = lo + MIN_FRET_SPAN;
  }

  lo = Math.max(0, lo - padding);
  hi = Math.min(MAX_FRET, hi + padding);

  if (hi - lo < MIN_FRET_SPAN) {
    hi = Math.min(MAX_FRET, lo + MIN_FRET_SPAN);
    if (hi - lo < MIN_FRET_SPAN) {
      lo = Math.max(0, hi - MIN_FRET_SPAN);
    }
  }

  return { minFret: lo, maxFret: hi };
}
