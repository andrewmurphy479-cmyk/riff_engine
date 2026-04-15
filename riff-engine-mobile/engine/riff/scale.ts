import { noteNameToPitchClass } from "./fretboard";

export const MINOR_PENTATONIC_ROLES: Readonly<Record<number, string>> = {
  0: "root",
  3: "b3",
  5: "4",
  7: "5",
  10: "b7",
};

export const BLUE_NOTE_INTERVAL = 6;
export const BLUE_NOTE_ROLE = "blue";

export function notePool(
  key: string,
  lowMidi: number,
  highMidi: number,
  includeBlue: boolean = false,
): [number, string][] {
  const rootPc = noteNameToPitchClass(key);
  const intervals: Record<number, string> = { ...MINOR_PENTATONIC_ROLES };
  if (includeBlue) {
    intervals[BLUE_NOTE_INTERVAL] = BLUE_NOTE_ROLE;
  }

  const out: [number, string][] = [];
  for (let midi = lowMidi; midi <= highMidi; midi++) {
    const delta = ((midi - rootPc) % 12 + 12) % 12;
    if (intervals[delta] !== undefined) {
      out.push([midi, intervals[delta]]);
    }
  }
  return out;
}

export function roleOf(
  midi: number,
  key: string,
  includeBlue: boolean = false,
): string | null {
  const rootPc = noteNameToPitchClass(key);
  const delta = ((midi - rootPc) % 12 + 12) % 12;
  if (MINOR_PENTATONIC_ROLES[delta] !== undefined) {
    return MINOR_PENTATONIC_ROLES[delta];
  }
  if (includeBlue && delta === BLUE_NOTE_INTERVAL) {
    return BLUE_NOTE_ROLE;
  }
  return null;
}
