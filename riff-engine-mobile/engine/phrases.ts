import { TabEvent, NotePosition, GuitarString } from './types';
import { getChordTreble, getChordBass } from './chords';
import { selectWithVoiceLeading, getAbsolutePitch } from './voiceLeading';

interface PhraseConfig {
  density: number;
  complexity: number;
  energy: number;
  style: 'travis' | 'arpeggio' | 'crosspicking' | 'strum';
}

interface Motif {
  events: TabEvent[];
  lastNote: NotePosition | null;
}

// Rhythmic templates for different feels
const RHYTHMIC_PATTERNS = {
  // [step positions for treble hits]
  basic: [4, 12],
  syncopated: [3, 7, 12],
  driving: [2, 6, 10, 14],
  sparse: [4],
  busy: [2, 4, 6, 10, 12, 14],
  offbeat: [2, 6, 10, 14],
  anticipated: [3, 7, 11, 15], // Push before beats
};

// Select rhythm pattern based on energy/complexity
function selectRhythmPattern(config: PhraseConfig): number[] {
  const patterns: number[][] = [];
  const weights: number[] = [];

  // Basic is always an option
  patterns.push(RHYTHMIC_PATTERNS.basic);
  weights.push(3);

  if (config.energy >= 3) {
    patterns.push(RHYTHMIC_PATTERNS.driving);
    weights.push(config.energy - 2);
  }

  if (config.complexity >= 3) {
    patterns.push(RHYTHMIC_PATTERNS.syncopated);
    weights.push(config.complexity - 2);
  }

  if (config.energy >= 4) {
    patterns.push(RHYTHMIC_PATTERNS.busy);
    weights.push(config.energy - 3);
  }

  if (config.complexity >= 4) {
    patterns.push(RHYTHMIC_PATTERNS.anticipated);
    weights.push(config.complexity - 3);
  }

  if (config.energy <= 2) {
    patterns.push(RHYTHMIC_PATTERNS.sparse);
    weights.push(3 - config.energy);
  }

  // Weighted selection
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  for (let i = 0; i < patterns.length; i++) {
    random -= weights[i];
    if (random <= 0) return patterns[i];
  }
  return patterns[0];
}

// Generate a 1-bar motif
export function generateMotif(
  chord: string,
  config: PhraseConfig,
  previousNote: NotePosition | null = null
): Motif {
  const events: TabEvent[] = [];
  const bass = getChordBass(chord);
  const treble = getChordTreble(chord);

  // Determine voice leading randomness based on complexity
  // Lower complexity = stricter voice leading = more predictable melodies
  const randomness = 0.2 + (config.complexity - 1) * 0.1;

  // Select rhythm pattern
  const trebleSteps = selectRhythmPattern(config);

  // Bass pattern based on style
  const bassSteps = config.style === 'arpeggio' ? [0, 8] : [0, 8];

  // Add bass notes
  for (const step of bassSteps) {
    events.push({
      string: bass.string,
      fret: bass.fret,
      step,
      duration: 2,
    });
  }

  // Add treble notes with voice leading
  let lastNote = previousNote;
  for (const step of trebleSteps) {
    const note = selectWithVoiceLeading(treble, lastNote, randomness);
    events.push({
      string: note.string,
      fret: note.fret,
      step,
      duration: 1,
    });
    lastNote = note;
  }

  return { events, lastNote };
}

// Vary a motif for the second bar (subtle changes)
export function varyMotif(
  original: Motif,
  newChord: string,
  config: PhraseConfig,
  variationType: 'subtle' | 'moderate' | 'contrast' = 'subtle'
): Motif {
  const bass = getChordBass(newChord);
  const treble = getChordTreble(newChord);
  const events: TabEvent[] = [];

  // Determine how much to vary
  const variationAmount = variationType === 'subtle' ? 0.3 :
                          variationType === 'moderate' ? 0.6 : 0.9;

  let lastNote = original.lastNote;

  for (const origEvent of original.events) {
    // Keep bass notes but update for new chord
    if (['E', 'A', 'D'].includes(origEvent.string)) {
      events.push({
        string: bass.string,
        fret: bass.fret,
        step: origEvent.step,
        duration: origEvent.duration,
      });
      continue;
    }

    // Vary treble notes
    if (Math.random() < variationAmount) {
      // Change this note
      const note = selectWithVoiceLeading(treble, lastNote, 0.3);
      events.push({
        string: note.string,
        fret: note.fret,
        step: origEvent.step,
        duration: origEvent.duration,
      });
      lastNote = note;
    } else {
      // Try to keep similar position on new chord
      const closest = findClosestChordTone(origEvent, treble);
      events.push({
        string: closest.string,
        fret: closest.fret,
        step: origEvent.step,
        duration: origEvent.duration,
      });
      lastNote = closest;
    }
  }

  return { events, lastNote };
}

// Find the closest chord tone to a given note
function findClosestChordTone(note: TabEvent, chordTones: NotePosition[]): NotePosition {
  const notePitch = getAbsolutePitch({ string: note.string, fret: note.fret });

  let closest = chordTones[0];
  let minDistance = Math.abs(getAbsolutePitch(closest) - notePitch);

  for (const ct of chordTones) {
    const distance = Math.abs(getAbsolutePitch(ct) - notePitch);
    if (distance < minDistance) {
      minDistance = distance;
      closest = ct;
    }
  }

  return closest;
}

// Generate a complete 2-bar phrase
export function generate2BarPhrase(
  chord1: string,
  chord2: string,
  config: PhraseConfig,
  previousNote: NotePosition | null = null
): { events: TabEvent[]; lastNote: NotePosition | null } {
  // Generate first bar motif
  const motif1 = generateMotif(chord1, config, previousNote);

  // Generate second bar as variation
  const sameChord = chord1 === chord2;
  const variationType = sameChord ? 'subtle' : 'moderate';
  const motif2 = varyMotif(motif1, chord2, config, variationType);

  // Offset bar 2 events by 16 steps
  const bar2Events = motif2.events.map(e => ({
    ...e,
    step: e.step + 16,
  }));

  return {
    events: [...motif1.events, ...bar2Events],
    lastNote: motif2.lastNote,
  };
}

// Generate a 4-bar phrase with proper structure
// Bars 1-2: Statement, Bars 3-4: Response/Resolution
export function generate4BarPhrase(
  chords: string[],
  config: PhraseConfig
): TabEvent[] {
  if (chords.length !== 4) {
    throw new Error('generate4BarPhrase requires exactly 4 chords');
  }

  // First 2 bars: Statement
  const phrase1 = generate2BarPhrase(chords[0], chords[1], config, null);

  // Bars 3-4: Response (slightly varied)
  // Use higher energy variation for contrast
  const responseConfig = {
    ...config,
    energy: Math.min(5, config.energy + 0.5),
  };
  const phrase2 = generate2BarPhrase(chords[2], chords[3], responseConfig, phrase1.lastNote);

  // Offset phrase 2 by 32 steps (2 bars)
  const phrase2Events = phrase2.events.map(e => ({
    ...e,
    step: e.step + 32,
  }));

  return [...phrase1.events, ...phrase2Events];
}
