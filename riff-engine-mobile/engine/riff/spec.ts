export type Technique = "pluck" | "hammer" | "slide" | "mute";

export interface PitchedStep {
  step: number;
  duration: number;
  midi: number;
}

export interface Note {
  step: number;
  duration: number;
  string: number;
  fret: number;
  velocity: number;
  technique: Technique;
}

export interface Bar {
  notes: Note[];
}

export interface RiffSpec {
  key: string;
  scale: string;
  tempo_bpm: number;
  time_sig: [number, number];
  bars: Bar[];
  motif_structure: string;
  seed: number;
  rhythm_name: string | null;
  feel: string | null;
}
