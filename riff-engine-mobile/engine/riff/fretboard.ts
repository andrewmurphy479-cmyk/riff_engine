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
