export type GuitarString = 'E' | 'A' | 'D' | 'G' | 'B' | 'e';

export interface NotePosition {
  string: GuitarString;
  fret: number;
}

export type Technique =
  | 'pluck'
  | 'hammer'
  | 'pull'
  | 'bend'
  | 'mute';

export interface TabEvent {
  string: GuitarString;
  fret: number;
  step: number;
  duration: number;
  technique?: Technique;
  velocity?: number;
}
