import { GuitarString, NotePosition } from './types';

// Treble "color" notes for each chord - open position
export const CHORD_TREBLE_NOTES: Record<string, NotePosition[]> = {
  Em: [
    { string: 'G', fret: 0 },
    { string: 'B', fret: 0 },
    { string: 'e', fret: 0 },
  ],
  C: [
    { string: 'G', fret: 0 },
    { string: 'B', fret: 1 },
    { string: 'e', fret: 0 },
  ],
  G: [
    { string: 'G', fret: 0 },
    { string: 'B', fret: 0 },
    { string: 'e', fret: 3 },
  ],
  D: [
    { string: 'G', fret: 2 },
    { string: 'B', fret: 3 },
    { string: 'e', fret: 2 },
  ],
  Am: [
    { string: 'G', fret: 2 },
    { string: 'B', fret: 1 },
    { string: 'e', fret: 0 },
  ],
  A: [
    { string: 'G', fret: 2 },
    { string: 'B', fret: 2 },
    { string: 'e', fret: 0 },
  ],
  E: [
    { string: 'G', fret: 1 },
    { string: 'B', fret: 0 },
    { string: 'e', fret: 0 },
  ],
  Dm: [
    { string: 'G', fret: 2 },
    { string: 'B', fret: 3 },
    { string: 'e', fret: 1 },
  ],
  F: [
    { string: 'G', fret: 2 },
    { string: 'B', fret: 1 },
    { string: 'e', fret: 1 },
  ],
  B7: [
    { string: 'G', fret: 2 },
    { string: 'B', fret: 0 },
    { string: 'e', fret: 2 },
  ],
};

// Extended treble notes - higher positions and additional chord tones
// These provide more melodic options and better voice leading
export const CHORD_EXTENDED_NOTES: Record<string, NotePosition[]> = {
  Em: [
    { string: 'G', fret: 0 },   // G
    { string: 'B', fret: 0 },   // B
    { string: 'e', fret: 0 },   // E
    { string: 'e', fret: 3 },   // G (higher)
    { string: 'B', fret: 5 },   // E (higher)
    { string: 'G', fret: 4 },   // B (higher)
  ],
  C: [
    { string: 'G', fret: 0 },   // G
    { string: 'B', fret: 1 },   // C
    { string: 'e', fret: 0 },   // E
    { string: 'e', fret: 3 },   // G (higher)
    { string: 'B', fret: 5 },   // E (higher)
    { string: 'e', fret: 5 },   // A (add6 color)
  ],
  G: [
    { string: 'G', fret: 0 },   // G
    { string: 'B', fret: 0 },   // B
    { string: 'e', fret: 3 },   // G
    { string: 'B', fret: 3 },   // D
    { string: 'e', fret: 7 },   // B (higher)
    { string: 'G', fret: 4 },   // B
  ],
  D: [
    { string: 'G', fret: 2 },   // A
    { string: 'B', fret: 3 },   // D
    { string: 'e', fret: 2 },   // F#
    { string: 'e', fret: 5 },   // A (higher)
    { string: 'B', fret: 7 },   // F# (higher)
    { string: 'G', fret: 7 },   // D (higher)
  ],
  Am: [
    { string: 'G', fret: 2 },   // A
    { string: 'B', fret: 1 },   // C
    { string: 'e', fret: 0 },   // E
    { string: 'e', fret: 5 },   // A (higher)
    { string: 'B', fret: 5 },   // E (higher)
    { string: 'e', fret: 3 },   // G (minor 7th color)
  ],
  A: [
    { string: 'G', fret: 2 },   // A
    { string: 'B', fret: 2 },   // C#
    { string: 'e', fret: 0 },   // E
    { string: 'e', fret: 5 },   // A (higher)
    { string: 'B', fret: 5 },   // E (higher)
    { string: 'G', fret: 6 },   // C# (higher)
  ],
  E: [
    { string: 'G', fret: 1 },   // G#
    { string: 'B', fret: 0 },   // B
    { string: 'e', fret: 0 },   // E
    { string: 'e', fret: 4 },   // G# (higher)
    { string: 'B', fret: 5 },   // E (higher)
    { string: 'G', fret: 4 },   // B (higher)
  ],
  Dm: [
    { string: 'G', fret: 2 },   // A
    { string: 'B', fret: 3 },   // D
    { string: 'e', fret: 1 },   // F
    { string: 'e', fret: 5 },   // A (higher)
    { string: 'B', fret: 6 },   // F (higher)
    { string: 'e', fret: 3 },   // G (add4 color)
  ],
  F: [
    { string: 'G', fret: 2 },   // A
    { string: 'B', fret: 1 },   // C
    { string: 'e', fret: 1 },   // F
    { string: 'e', fret: 5 },   // A (higher)
    { string: 'B', fret: 5 },   // E (maj7 color)
    { string: 'G', fret: 5 },   // C (higher)
  ],
  B7: [
    { string: 'G', fret: 2 },   // A (7th)
    { string: 'B', fret: 0 },   // B
    { string: 'e', fret: 2 },   // F#
    { string: 'e', fret: 4 },   // G# (higher)
    { string: 'B', fret: 4 },   // D# (higher)
    { string: 'G', fret: 4 },   // B (higher)
  ],
};

// Bass notes for each chord (root)
export const CHORD_BASS: Record<string, NotePosition> = {
  Em: { string: 'E', fret: 0 },
  C: { string: 'A', fret: 3 },
  G: { string: 'E', fret: 3 },
  D: { string: 'D', fret: 0 },
  Am: { string: 'A', fret: 0 },
  A: { string: 'A', fret: 0 },
  E: { string: 'E', fret: 0 },
  Dm: { string: 'D', fret: 0 },
  F: { string: 'D', fret: 3 },
  B7: { string: 'A', fret: 2 },
};

// Alternate bass notes (typically the 5th) for Travis picking
export const CHORD_ALT_BASS: Record<string, NotePosition> = {
  Em: { string: 'A', fret: 2 },  // B (5th)
  C: { string: 'E', fret: 3 },   // G (5th)
  G: { string: 'A', fret: 2 },   // B (3rd) - common alternation
  D: { string: 'A', fret: 0 },   // A (5th)
  Am: { string: 'E', fret: 0 },  // E (5th)
  A: { string: 'E', fret: 0 },   // E (5th)
  E: { string: 'A', fret: 2 },   // B (5th)
  Dm: { string: 'A', fret: 0 },  // A (5th)
  F: { string: 'A', fret: 3 },   // C (5th)
  B7: { string: 'E', fret: 2 },  // F# (5th)
};

// Bass walk transitions between chords
export const BASS_WALKS: Record<string, NotePosition[]> = {
  'Em-C': [
    { string: 'E', fret: 0 },
    { string: 'E', fret: 2 },
    { string: 'A', fret: 3 },
  ],
  'C-G': [
    { string: 'A', fret: 3 },
    { string: 'A', fret: 2 },
    { string: 'E', fret: 3 },
  ],
  'G-D': [
    { string: 'E', fret: 3 },
    { string: 'D', fret: 0 },
  ],
  'D-Em': [
    { string: 'D', fret: 0 },
    { string: 'E', fret: 0 },
  ],
  'Am-C': [
    { string: 'A', fret: 0 },
    { string: 'A', fret: 2 },
    { string: 'A', fret: 3 },
  ],
  'Am-G': [
    { string: 'A', fret: 0 },
    { string: 'E', fret: 2 },
    { string: 'E', fret: 3 },
  ],
  'Am-E': [
    { string: 'A', fret: 0 },
    { string: 'A', fret: 2 },
    { string: 'E', fret: 0 },
  ],
  'E-Am': [
    { string: 'E', fret: 0 },
    { string: 'E', fret: 2 },
    { string: 'A', fret: 0 },
  ],
  'A-D': [
    { string: 'A', fret: 0 },
    { string: 'A', fret: 2 },
    { string: 'D', fret: 0 },
  ],
  'A-E': [
    { string: 'A', fret: 0 },
    { string: 'E', fret: 2 },
    { string: 'E', fret: 0 },
  ],
  'Dm-Am': [
    { string: 'D', fret: 0 },
    { string: 'A', fret: 2 },
    { string: 'A', fret: 0 },
  ],
  'Dm-C': [
    { string: 'D', fret: 0 },
    { string: 'A', fret: 2 },
    { string: 'A', fret: 3 },
  ],
  'F-C': [
    { string: 'D', fret: 3 },
    { string: 'A', fret: 3 },
  ],
  'F-G': [
    { string: 'D', fret: 3 },
    { string: 'E', fret: 2 },
    { string: 'E', fret: 3 },
  ],
  'B7-E': [
    { string: 'A', fret: 2 },
    { string: 'E', fret: 2 },
    { string: 'E', fret: 0 },
  ],
  'B7-Em': [
    { string: 'A', fret: 2 },
    { string: 'E', fret: 2 },
    { string: 'E', fret: 0 },
  ],
  'G-Em': [
    { string: 'E', fret: 3 },
    { string: 'E', fret: 2 },
    { string: 'E', fret: 0 },
  ],
  'C-Am': [
    { string: 'A', fret: 3 },
    { string: 'A', fret: 2 },
    { string: 'A', fret: 0 },
  ],
};

// Helper to get treble notes for a chord (basic open position)
export function getChordTreble(chord: string): NotePosition[] {
  return CHORD_TREBLE_NOTES[chord] || CHORD_TREBLE_NOTES['Em'];
}

// Helper to get extended treble notes for more melodic options
export function getChordExtendedTreble(chord: string): NotePosition[] {
  return CHORD_EXTENDED_NOTES[chord] || CHORD_TREBLE_NOTES[chord] || CHORD_TREBLE_NOTES['Em'];
}

// Get treble notes with complexity-based selection
// Higher complexity = more notes to choose from (including higher positions)
export function getChordTrebleForComplexity(chord: string, complexity: number): NotePosition[] {
  const basic = CHORD_TREBLE_NOTES[chord] || CHORD_TREBLE_NOTES['Em'];
  const extended = CHORD_EXTENDED_NOTES[chord];

  if (!extended || complexity <= 2) {
    return basic;
  }

  // Complexity 3: basic + 1 extended note
  // Complexity 4: basic + 2 extended notes
  // Complexity 5: all extended notes
  const extraNotes = complexity - 2;
  const extendedToAdd = extended.slice(3, 3 + extraNotes);

  return [...basic, ...extendedToAdd];
}

// Helper to get bass note for a chord (root)
export function getChordBass(chord: string): NotePosition {
  return CHORD_BASS[chord] || CHORD_BASS['Em'];
}

// Helper to get alternate bass note for a chord (5th)
export function getChordAltBass(chord: string): NotePosition {
  return CHORD_ALT_BASS[chord] || CHORD_BASS[chord] || CHORD_BASS['Em'];
}

// Helper to get bass walk for a chord transition
export function getBassWalk(prevChord: string, chord: string): NotePosition[] | null {
  const key = `${prevChord}-${chord}`;
  return BASS_WALKS[key] || null;
}

// All available strings in order (high to low for tab display)
export const STRINGS: GuitarString[] = ['e', 'B', 'G', 'D', 'A', 'E'];

// String order for tab display (high to low)
export const TAB_STRING_ORDER: GuitarString[] = ['e', 'B', 'G', 'D', 'A', 'E'];
