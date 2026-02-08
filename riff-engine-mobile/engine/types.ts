// Guitar string names
export type GuitarString = 'E' | 'A' | 'D' | 'G' | 'B' | 'e';

// Note position on the guitar
export interface NotePosition {
  string: GuitarString;
  fret: number;
}

// Technique types for ornaments
export type Technique = 'hammer' | 'pull' | 'slide' | 'bend' | null;

// A single note event in the tab
export interface TabEvent {
  string: GuitarString;
  fret: number;
  step: number;
  duration: number;
  technique?: Technique;  // Optional ornament marker
  layer?: RiffLayer;      // Which layer this event belongs to
  velocity?: number;      // 0.0-1.0, dynamics (default 0.7)
}

// Chord definition
export interface ChordDefinition {
  treble: NotePosition[];
  bass: NotePosition;
}

// Mood configuration
export interface MoodConfig {
  repeatProb: number;
  swapProb: number;
  fillProb: number;
  tempoRange: [number, number];
  tensionBias: number;
}

// Available moods
export type Mood =
  | 'uplifting'
  | 'sad'
  | 'mysterious'
  | 'nostalgic'
  | 'gritty'
  | 'cinematic'
  | 'driving'
  | 'dreamy'
  | 'tense'
  | 'soulful';

// Playing styles
export type Style = 'travis' | 'arpeggio' | 'crosspicking' | 'strum';

// Difficulty levels
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

// Generator configuration
export interface GeneratorConfig {
  mood: Mood;
  style: Style;
  tempo: number;
  bassMovement: number;   // 1-5, "More Bass" slider
  bluesyFeel: number;     // 1-5, "Bluesy Feel" slider
  complexity: number;     // 1-5, "Complexity" slider
  energy: number;         // 1-5, "Energy" slider
  numBars: number;        // 2, 4, 6, or 8
  difficulty?: Difficulty; // Optional for backward compat
}

// Preset configuration
export interface Preset {
  id: string;
  name: string;
  mood: Mood;
  style: Style;
  tempo: number;
  bass: number;
  blues: number;
  complexity: number;
  energy: number;
}

// Generated riff result
export interface GeneratedRiff {
  progression: string[];
  events: TabEvent[];
  tempo: number;
  config: GeneratorConfig;
}

// Playback state
export type PlaybackState = 'stopped' | 'playing' | 'paused';

// Generation mode
export type GenerationMode = 'quickRiff' | 'layerBuilder' | 'customChords';

// Layer types for layered generation
export type RiffLayer = 'melody' | 'bass' | 'fills';

// Layer state
export interface LayerState {
  melody: TabEvent[] | null;
  bass: TabEvent[] | null;
  fills: TabEvent[] | null;
  currentLayer: RiffLayer;
  isLayerApproved: Record<RiffLayer, boolean>;
  layerComplexity: Record<RiffLayer, number>; // Per-layer complexity (1-5)
  layerMuted: Record<RiffLayer, boolean>; // For solo/mute in playback
  layerLocked: Record<RiffLayer, boolean>; // Lock layer to preserve during regeneration
}

// Layered riff - tracks each layer separately
export interface LayeredRiff {
  progression: string[];
  layers: LayerState;
  tempo: number;
  config: GeneratorConfig;
}
