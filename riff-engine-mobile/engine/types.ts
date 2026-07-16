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
  /**
   * Swing feel: fractional steps to delay this event's onset at playback.
   * `step` stays on the straight grid (views and playhead sync key off it);
   * only the audible onset moves. Derived from RiffSpec.swing in toEvents.
   */
  swingOffset?: number;
}
