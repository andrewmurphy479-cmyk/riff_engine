export type GuitarString = 'E' | 'A' | 'D' | 'G' | 'B' | 'e';

export interface NotePosition {
  string: GuitarString;
  fret: number;
}

export type Technique = 'hammer' | 'pull' | 'slide' | 'bend' | null;

export interface TabEvent {
  string: GuitarString;
  fret: number;
  step: number;
  duration: number;
  technique?: Technique;
  velocity?: number;
}
