import { GuitarString, NotePosition } from './types';

export const FRETBOARD_STRINGS: GuitarString[] = ['E', 'A', 'D', 'G', 'B', 'e'];

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
  A7: {
    name: 'A dominant 7th',
    root: 'A',
    quality: 'dominant 7th',
    intervals: '1 - 3 - 5 - b7',
    notes: ['A', 'C#', 'E', 'G'],
    description: 'An easy open dominant 7th that adds bluesy tension. One lifted finger transforms A major into a blues essential.',
  },
  E7: {
    name: 'E dominant 7th',
    root: 'E',
    quality: 'dominant 7th',
    intervals: '1 - 3 - 5 - b7',
    notes: ['E', 'G#', 'B', 'D'],
    description: 'A full six-string dominant 7th. Its open D string provides the b7 that pulls toward Am or A.',
  },
  D7: {
    name: 'D dominant 7th',
    root: 'D',
    quality: 'dominant 7th',
    intervals: '1 - 3 - 5 - b7',
    notes: ['D', 'F#', 'A', 'C'],
    description: 'A compact dominant 7th on the top four strings. The C natural creates tension that resolves to G.',
  },
  G7: {
    name: 'G dominant 7th',
    root: 'G',
    quality: 'dominant 7th',
    intervals: '1 - 3 - 5 - b7',
    notes: ['G', 'B', 'D', 'F'],
    description: 'A dominant 7th that yearns to resolve to C. The F on the high string adds unmistakable blues flavor.',
  },
  Bm: {
    name: 'B minor',
    root: 'B',
    quality: 'minor',
    intervals: '1 - b3 - 5',
    notes: ['B', 'D', 'F#'],
    description: 'The first barre chord most guitarists learn. Its dark sound is essential in the key of D and G.',
  },
  Cadd9: {
    name: 'C add 9',
    root: 'C',
    quality: 'major (add 9)',
    intervals: '1 - 3 - 5 - 9',
    notes: ['C', 'E', 'G', 'D'],
    description: 'C major with an added 9th (D). A shimmering, modern voicing beloved in pop and acoustic music.',
  },
};

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
  A7: [
    { string: 'A', fret: 0 },
    { string: 'D', fret: 2 },
    { string: 'G', fret: 0 },
    { string: 'B', fret: 2 },
    { string: 'e', fret: 0 },
  ],
  E7: [
    { string: 'E', fret: 0 },
    { string: 'A', fret: 2 },
    { string: 'D', fret: 0 },
    { string: 'G', fret: 1 },
    { string: 'B', fret: 0 },
    { string: 'e', fret: 0 },
  ],
  D7: [
    { string: 'D', fret: 0 },
    { string: 'G', fret: 2 },
    { string: 'B', fret: 1 },
    { string: 'e', fret: 2 },
  ],
  G7: [
    { string: 'E', fret: 3 },
    { string: 'A', fret: 2 },
    { string: 'D', fret: 0 },
    { string: 'G', fret: 0 },
    { string: 'B', fret: 0 },
    { string: 'e', fret: 1 },
  ],
  Bm: [
    { string: 'A', fret: 2 },
    { string: 'D', fret: 4 },
    { string: 'G', fret: 4 },
    { string: 'B', fret: 3 },
    { string: 'e', fret: 2 },
  ],
  Cadd9: [
    { string: 'A', fret: 3 },
    { string: 'D', fret: 2 },
    { string: 'G', fret: 0 },
    { string: 'B', fret: 3 },
    { string: 'e', fret: 0 },
  ],
};

export function getChordShape(chord: string): NotePosition[] {
  return CHORD_FULL_SHAPES[chord] ?? [];
}
