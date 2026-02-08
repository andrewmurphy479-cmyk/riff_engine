import { Mood, NotePosition, GuitarString } from './types';
import { CHORD_TREBLE_NOTES, CHORD_BASS } from './chords';

// ── Note names by MIDI number mod 12 ──
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Open-string MIDI values (standard tuning)
const STRING_MIDI: Record<GuitarString, number> = {
  E: 40, A: 45, D: 50, G: 55, B: 59, e: 64,
};

// Fretboard string order (low to high, left to right in diagram)
export const FRETBOARD_STRINGS: GuitarString[] = ['E', 'A', 'D', 'G', 'B', 'e'];

// ── Scale definitions ──

export interface ScaleDefinition {
  name: string;
  key: string;
  intervals: number[];      // semitones from root
  character: string;         // short tag
  description: string;       // 1-2 educational sentences
}

export const SCALES: Record<string, ScaleDefinition> = {
  major: {
    name: 'Major (Ionian)',
    key: 'major',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    character: 'Bright',
    description: 'The most common major scale. Its bright, resolved sound is the foundation of Western music.',
  },
  naturalMinor: {
    name: 'Natural Minor (Aeolian)',
    key: 'naturalMinor',
    intervals: [0, 2, 3, 5, 7, 8, 10],
    character: 'Melancholy',
    description: 'The relative minor of the major scale. Its flat 3rd, 6th, and 7th give it a darker, reflective quality.',
  },
  harmonicMinor: {
    name: 'Harmonic Minor',
    key: 'harmonicMinor',
    intervals: [0, 2, 3, 5, 7, 8, 11],
    character: 'Exotic',
    description: 'Like natural minor but with a raised 7th, creating a distinctive 1.5-step gap that sounds exotic and dramatic.',
  },
  dorian: {
    name: 'Dorian',
    key: 'dorian',
    intervals: [0, 2, 3, 5, 7, 9, 10],
    character: 'Soulful',
    description: 'A minor mode with a raised 6th that gives it a brighter, jazzy feel. Think Carlos Santana or Daft Punk.',
  },
  mixolydian: {
    name: 'Mixolydian',
    key: 'mixolydian',
    intervals: [0, 2, 4, 5, 7, 9, 10],
    character: 'Bluesy',
    description: 'A major scale with a flat 7th. Common in blues, rock, and folk — it wants to resolve but never quite does.',
  },
  phrygian: {
    name: 'Phrygian',
    key: 'phrygian',
    intervals: [0, 1, 3, 5, 7, 8, 10],
    character: 'Dark',
    description: 'A minor mode with a flat 2nd that creates an intense, Spanish-influenced sound full of tension.',
  },
  pentatonicMajor: {
    name: 'Major Pentatonic',
    key: 'pentatonicMajor',
    intervals: [0, 2, 4, 7, 9],
    character: 'Open',
    description: 'Five notes from the major scale. Its simplicity makes it nearly impossible to play a wrong note.',
  },
  pentatonicMinor: {
    name: 'Minor Pentatonic',
    key: 'pentatonicMinor',
    intervals: [0, 3, 5, 7, 10],
    character: 'Gritty',
    description: 'The go-to scale for rock and blues soloing. Every guitarist learns this one first.',
  },
  blues: {
    name: 'Blues',
    key: 'blues',
    intervals: [0, 3, 5, 6, 7, 10],
    character: 'Raw',
    description: 'Minor pentatonic plus the "blue note" (flat 5th). That extra note adds the signature blues tension.',
  },
};

// ── Mood → scale mapping ──

export const MOOD_SCALES: Record<Mood, string[]> = {
  uplifting:  ['major', 'pentatonicMajor'],
  sad:        ['naturalMinor', 'pentatonicMinor'],
  mysterious: ['phrygian', 'harmonicMinor'],
  nostalgic:  ['major', 'mixolydian'],
  gritty:     ['blues', 'pentatonicMinor'],
  cinematic:  ['naturalMinor', 'harmonicMinor'],
  driving:    ['mixolydian', 'pentatonicMinor'],
  dreamy:     ['major', 'pentatonicMajor'],
  tense:      ['phrygian', 'harmonicMinor'],
  soulful:    ['dorian', 'blues'],
};

// ── Chord theory ──

export interface ChordTheory {
  name: string;
  root: string;
  quality: string;
  intervals: string;
  notes: string[];
  description: string;
}

export const CHORD_THEORY: Record<string, ChordTheory> = {
  Em: {
    name: 'E minor',
    root: 'E',
    quality: 'minor',
    intervals: '1 - b3 - 5',
    notes: ['E', 'G', 'B'],
    description: 'An open minor chord with a deep, resonant sound. Often the starting point for fingerpicking patterns.',
  },
  C: {
    name: 'C major',
    root: 'C',
    quality: 'major',
    intervals: '1 - 3 - 5',
    notes: ['C', 'E', 'G'],
    description: 'One of the first chords every guitarist learns. Bright and open with no sharps or flats.',
  },
  G: {
    name: 'G major',
    root: 'G',
    quality: 'major',
    intervals: '1 - 3 - 5',
    notes: ['G', 'B', 'D'],
    description: 'A full, ringing major chord that uses all six strings. The backbone of countless folk and rock songs.',
  },
  D: {
    name: 'D major',
    root: 'D',
    quality: 'major',
    intervals: '1 - 3 - 5',
    notes: ['D', 'F#', 'A'],
    description: 'A bright, compact chord on the top four strings. Its F# gives it a distinctive sparkle.',
  },
  Am: {
    name: 'A minor',
    root: 'A',
    quality: 'minor',
    intervals: '1 - b3 - 5',
    notes: ['A', 'C', 'E'],
    description: 'The relative minor of C major. A melancholy but versatile chord used across all genres.',
  },
  A: {
    name: 'A major',
    root: 'A',
    quality: 'major',
    intervals: '1 - 3 - 5',
    notes: ['A', 'C#', 'E'],
    description: 'A warm, open chord that forms the basis of many rock and country progressions.',
  },
  E: {
    name: 'E major',
    root: 'E',
    quality: 'major',
    intervals: '1 - 3 - 5',
    notes: ['E', 'G#', 'B'],
    description: 'The fullest open chord on guitar, using all six strings. A natural home key for the instrument.',
  },
  Dm: {
    name: 'D minor',
    root: 'D',
    quality: 'minor',
    intervals: '1 - b3 - 5',
    notes: ['D', 'F', 'A'],
    description: 'A compact minor chord on the top four strings. Often paired with Am and E in minor progressions.',
  },
  F: {
    name: 'F major',
    root: 'F',
    quality: 'major',
    intervals: '1 - 3 - 5',
    notes: ['F', 'A', 'C'],
    description: 'The IV chord in C major. In open position it uses a partial barre shape on the first fret.',
  },
  B7: {
    name: 'B dominant 7th',
    root: 'B',
    quality: 'dominant 7th',
    intervals: '1 - 3 - 5 - b7',
    notes: ['B', 'D#', 'F#', 'A'],
    description: 'A dominant 7th chord that creates strong pull toward Em or E. The b7 (A) adds blues tension.',
  },
};

// ── Chord root note as MIDI ──

const CHORD_ROOT_MIDI: Record<string, number> = {
  Em: 40, C: 48, G: 43, D: 50, Am: 45,
  A: 45, E: 40, Dm: 50, F: 41, B7: 47,
};

// ── Fretboard scale computation ──

export interface FretboardNote {
  string: GuitarString;
  fret: number;
  noteName: string;
  isRoot: boolean;
  isChordTone: boolean;
  inScale: boolean;
}

/**
 * Compute all scale notes on the fretboard for a given chord and scale.
 */
export function getScaleNotesOnFretboard(
  chord: string,
  scaleKey: string,
  maxFret: number
): FretboardNote[] {
  const scale = SCALES[scaleKey];
  if (!scale) return [];

  const rootMidi = CHORD_ROOT_MIDI[chord] ?? 40;
  const rootPitchClass = rootMidi % 12;

  // Build set of pitch classes in this scale
  const scalePitchClasses = new Set(
    scale.intervals.map((iv) => (rootPitchClass + iv) % 12)
  );

  // Build set of chord tone pitch classes
  const chordTheory = CHORD_THEORY[chord];
  const chordPitchClasses = new Set<number>();
  if (chordTheory) {
    for (const noteName of chordTheory.notes) {
      const idx = NOTE_NAMES.indexOf(noteName);
      if (idx >= 0) chordPitchClasses.add(idx);
    }
  }

  const result: FretboardNote[] = [];

  for (const str of FRETBOARD_STRINGS) {
    const openMidi = STRING_MIDI[str];
    for (let fret = 0; fret <= maxFret; fret++) {
      const midi = openMidi + fret;
      const pitchClass = midi % 12;
      const noteName = NOTE_NAMES[pitchClass];
      const inScale = scalePitchClasses.has(pitchClass);

      if (inScale) {
        result.push({
          string: str,
          fret,
          noteName,
          isRoot: pitchClass === rootPitchClass,
          isChordTone: chordPitchClasses.has(pitchClass),
          inScale: true,
        });
      }
    }
  }

  return result;
}

// ── Full chord fingerings for fretboard display ──

const CHORD_FULL_SHAPES: Record<string, NotePosition[]> = {
  Em: [
    { string: 'E', fret: 0 },
    { string: 'A', fret: 2 },
    { string: 'D', fret: 2 },
    { string: 'G', fret: 0 },
    { string: 'B', fret: 0 },
    { string: 'e', fret: 0 },
  ],
  C: [
    { string: 'A', fret: 3 },
    { string: 'D', fret: 2 },
    { string: 'G', fret: 0 },
    { string: 'B', fret: 1 },
    { string: 'e', fret: 0 },
  ],
  G: [
    { string: 'E', fret: 3 },
    { string: 'A', fret: 2 },
    { string: 'D', fret: 0 },
    { string: 'G', fret: 0 },
    { string: 'B', fret: 0 },
    { string: 'e', fret: 3 },
  ],
  D: [
    { string: 'D', fret: 0 },
    { string: 'G', fret: 2 },
    { string: 'B', fret: 3 },
    { string: 'e', fret: 2 },
  ],
  Am: [
    { string: 'A', fret: 0 },
    { string: 'D', fret: 2 },
    { string: 'G', fret: 2 },
    { string: 'B', fret: 1 },
    { string: 'e', fret: 0 },
  ],
  A: [
    { string: 'A', fret: 0 },
    { string: 'D', fret: 2 },
    { string: 'G', fret: 2 },
    { string: 'B', fret: 2 },
    { string: 'e', fret: 0 },
  ],
  E: [
    { string: 'E', fret: 0 },
    { string: 'A', fret: 2 },
    { string: 'D', fret: 2 },
    { string: 'G', fret: 1 },
    { string: 'B', fret: 0 },
    { string: 'e', fret: 0 },
  ],
  Dm: [
    { string: 'D', fret: 0 },
    { string: 'G', fret: 2 },
    { string: 'B', fret: 3 },
    { string: 'e', fret: 1 },
  ],
  F: [
    { string: 'D', fret: 3 },
    { string: 'G', fret: 2 },
    { string: 'B', fret: 1 },
    { string: 'e', fret: 1 },
  ],
  B7: [
    { string: 'A', fret: 2 },
    { string: 'D', fret: 1 },
    { string: 'G', fret: 2 },
    { string: 'B', fret: 0 },
    { string: 'e', fret: 2 },
  ],
};

/**
 * Get the full chord fingering for fretboard display.
 */
export function getChordShape(chord: string): NotePosition[] {
  return CHORD_FULL_SHAPES[chord] ?? [];
}

// ── Helpers ──

export function midiToNoteName(midi: number): string {
  return NOTE_NAMES[midi % 12];
}

export function getChordRootPitchClass(chord: string): number {
  const rootMidi = CHORD_ROOT_MIDI[chord] ?? 40;
  return rootMidi % 12;
}
