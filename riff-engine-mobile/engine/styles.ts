import { TabEvent, GuitarString, NotePosition, Technique, Mood } from './types';
import { getChordTreble, getChordTrebleForComplexity, getChordBass, getChordAltBass, getBassWalk, STRINGS } from './chords';
import {
  selectWithVoiceLeading,
  getChromaticApproach,
  getAbsolutePitch,
  generateMotif,
  getCurrentMotif,
  resetMotif,
  transposeMotifToChord,
  varyMotif,
  shouldUseMotif,
  Motif,
  initializePhrase,
  getPhraseConfig,
  getMelodicTarget,
  generateMelodicLine,
  selectTowardTarget,
  PhraseConfig,
} from './voiceLeading';

type UsedSlots = Set<string>;

function slotKey(string: GuitarString, step: number): string {
  return `${string}:${step}`;
}

function isSlotFree(used: UsedSlots, string: GuitarString, step: number): boolean {
  return !used.has(slotKey(string, step));
}

function addEventIfFree(
  events: TabEvent[],
  used: UsedSlots,
  string: GuitarString,
  fret: number,
  step: number,
  duration = 1
): boolean {
  if (!isSlotFree(used, string, step)) return false;
  events.push({ string, fret, step, duration });
  used.add(slotKey(string, step));
  return true;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface BarConfig {
  density: number;
  complexity: number;
  bassMovement: number;
  melody: number;
  openStrings: number;
  energy: number;
  barPosition: number;  // 0-3 for which bar we're in
  totalBars: number;    // Total bars in the phrase
  mood: Mood;           // Current mood for rhythmic variation
  maxFret: number;              // Difficulty-based fret limit
  allowSyncopation: boolean;    // Whether off-beat rhythms are allowed
  allowBassWalks: boolean;      // Whether bass walks between chords are allowed
  fillProbMult: number;         // 0-1, multiplier for fill probability
  ornamentProbMult: number;     // 0-1, multiplier for ornament probability
}

// Mood-specific rhythmic patterns
// Each pattern is an array of step positions (0-15) for treble notes
interface MoodRhythm {
  trebleSteps: number[][];      // Options for treble hit positions
  syncopationProb: number;      // Probability of using syncopated pattern
  restProb: number;             // Probability of adding rests/space
  accentSteps: number[];        // Steps that should be accented (played louder)
}

const MOOD_RHYTHMS: Record<Mood, MoodRhythm> = {
  uplifting: {
    trebleSteps: [[4, 12], [4, 10, 12], [2, 6, 10, 14]],
    syncopationProb: 0.3,
    restProb: 0.1,
    accentSteps: [0, 8],
  },
  sad: {
    trebleSteps: [[4, 12], [6, 14], [4]],  // Sparse, breathing room
    syncopationProb: 0.1,
    restProb: 0.4,
    accentSteps: [4],
  },
  mysterious: {
    trebleSteps: [[3, 11], [5, 9, 15], [2, 7, 13]],  // Unexpected positions
    syncopationProb: 0.6,
    restProb: 0.3,
    accentSteps: [3, 11],
  },
  nostalgic: {
    trebleSteps: [[4, 12], [4, 8, 12], [2, 6, 10, 14]],  // Flowing, predictable
    syncopationProb: 0.15,
    restProb: 0.15,
    accentSteps: [0, 4, 8, 12],
  },
  gritty: {
    trebleSteps: [[3, 7, 11, 15], [2, 5, 10, 14], [1, 4, 9, 12]],  // Aggressive syncopation
    syncopationProb: 0.7,
    restProb: 0.05,
    accentSteps: [0, 3, 8, 11],
  },
  cinematic: {
    trebleSteps: [[4, 12], [8], [4, 14]],  // Dramatic, uses silence
    syncopationProb: 0.2,
    restProb: 0.5,
    accentSteps: [0, 8],
  },
  driving: {
    trebleSteps: [[2, 4, 6, 10, 12, 14], [0, 2, 4, 6, 8, 10, 12, 14]],  // Relentless
    syncopationProb: 0.1,
    restProb: 0.0,
    accentSteps: [0, 4, 8, 12],
  },
  dreamy: {
    trebleSteps: [[6, 14], [4, 10], [5, 13]],  // Floating, space
    syncopationProb: 0.4,
    restProb: 0.45,
    accentSteps: [6],
  },
  tense: {
    trebleSteps: [[2, 3, 4, 12], [0, 1, 8, 9], [4, 5, 6, 14, 15]],  // Clustered then space
    syncopationProb: 0.5,
    restProb: 0.2,
    accentSteps: [0, 8],
  },
  soulful: {
    trebleSteps: [[5, 13], [3, 7, 11, 15], [5, 9, 13]],  // Behind the beat
    syncopationProb: 0.5,
    restProb: 0.2,
    accentSteps: [5, 13],
  },
};

// Get rhythmic pattern for mood
export function getMoodRhythm(mood: Mood): MoodRhythm {
  return MOOD_RHYTHMS[mood] || MOOD_RHYTHMS.nostalgic;
}

// Chord root MIDI notes (for motif transposition)
const CHORD_ROOTS: Record<string, number> = {
  'C': 48, 'Cm': 48,
  'D': 50, 'Dm': 50,
  'E': 52, 'Em': 52,
  'F': 53, 'Fm': 53,
  'G': 55, 'Gm': 55,
  'A': 57, 'Am': 57,
  'B': 59, 'Bm': 59, 'B7': 59,
};

function getChordRoot(chord: string): number {
  return CHORD_ROOTS[chord] || 48; // Default to C
}

// Track last note for voice leading across bars
let lastTrebleNote: NotePosition | null = null;

// Track current motif for the riff
let activeMotif: Motif | null = null;

// Get motif notes for a specific bar, transposed to the current chord
// Returns note+step pairs, or null if no motif should be used this bar
export function getMotifNotesForBar(
  chord: string,
  config: BarConfig
): { note: NotePosition; step: number }[] | null {
  if (!shouldUseMotif(config.barPosition, config.complexity)) return null;

  const motif = getCurrentMotif();
  if (!motif) return null;

  // Pick variation by bar position
  let variedMotif: Motif;
  switch (config.barPosition) {
    case 0:
      variedMotif = motif; // Original - introduce the motif
      break;
    case 1:
      variedMotif = Math.random() < 0.5 ? motif : varyMotif(motif, 'retrograde');
      break;
    case 2:
      variedMotif = varyMotif(motif, 'invert');
      break;
    case 3:
      variedMotif = motif; // Original for resolution
      break;
    default:
      variedMotif = motif;
  }

  const chordRoot = getChordRoot(chord);
  // Transpose motif to chord, placing at step 4 (beat 2) for melodic interest
  const baseStep = 4;
  const motifNotes = transposeMotifToChord(variedMotif, chordRoot, baseStep, 'G');

  return motifNotes.length > 0 ? motifNotes : null;
}

export function resetVoiceLeading(): void {
  lastTrebleNote = null;
  resetMotif();
  activeMotif = null;
}

// Initialize motif and phrase for a new riff
export function initializeMotif(complexity: number, mood?: Mood): void {
  activeMotif = generateMotif(complexity);
  if (mood) {
    initializePhrase(mood);
  }
}

// Get the active motif
export function getActiveMotif(): Motif | null {
  return activeMotif;
}

// Apply ornaments (hammer-ons, pull-offs) to events based on complexity
// This proactively INSERTS ornament notes rather than just marking existing ones
export function applyOrnaments(events: TabEvent[], config: BarConfig): void {
  if (config.complexity < 3) return; // No ornaments for simpler playing
  if (config.ornamentProbMult <= 0) return; // Difficulty disables ornaments

  // Higher complexity = more ornaments, scaled by difficulty multiplier
  const ornamentProb = (0.25 + (config.complexity - 3) * 0.15) * config.ornamentProbMult; // 25-55% base, scaled
  const maxOrnaments = config.complexity - 1; // 2-4 ornaments per bar max

  // Find treble notes that could receive ornaments
  const trebleEvents = events.filter(e =>
    ['G', 'B', 'e'].includes(e.string) &&
    e.fret > 0 && // Need a fret to hammer onto or pull from
    e.fret <= 5   // Keep in open position area
  );

  // Track which steps are used to avoid collisions
  const usedSteps = new Set(events.map(e => `${e.string}:${e.step}`));

  let ornamentsAdded = 0;

  // Shuffle to randomize which notes get ornaments
  const shuffled = [...trebleEvents].sort(() => Math.random() - 0.5);

  for (const event of shuffled) {
    if (ornamentsAdded >= maxOrnaments) break;
    if (Math.random() > ornamentProb) continue;

    // Determine ornament type based on context
    const useHammerOn = Math.random() < 0.6; // Hammer-ons more common

    if (useHammerOn && event.fret >= 2) {
      // Insert a grace note BEFORE this event, hammer onto it
      const graceStep = event.step - 1;
      const graceKey = `${event.string}:${graceStep}`;

      if (graceStep >= 0 && !usedSteps.has(graceKey)) {
        // Grace note is 1-2 frets below target
        const graceFret = event.fret - (Math.random() < 0.7 ? 2 : 1);
        if (graceFret >= 0) {
          events.push({
            string: event.string,
            fret: graceFret,
            step: graceStep,
            duration: 1,
          });
          event.technique = 'hammer';
          usedSteps.add(graceKey);
          ornamentsAdded++;
        }
      }
    } else if (!useHammerOn && event.fret <= 3) {
      // Insert a higher note BEFORE, pull off to this event
      const graceStep = event.step - 1;
      const graceKey = `${event.string}:${graceStep}`;

      if (graceStep >= 0 && !usedSteps.has(graceKey)) {
        // Grace note is 1-2 frets above target
        const graceFret = event.fret + (Math.random() < 0.7 ? 2 : 1);
        if (graceFret <= 7) {
          events.push({
            string: event.string,
            fret: graceFret,
            step: graceStep,
            duration: 1,
          });
          event.technique = 'pull';
          usedSteps.add(graceKey);
          ornamentsAdded++;
        }
      }
    }
  }

  // Also check for slide opportunities on larger intervals
  if (config.complexity >= 4) {
    const sorted = [...events].sort((a, b) => a.step - b.step);
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      // Same string, close in time, larger fret jump
      if (current.string === next.string &&
          next.step - current.step <= 3 &&
          !next.technique) {
        const fretDiff = Math.abs(next.fret - current.fret);
        if (fretDiff >= 3 && fretDiff <= 7 && Math.random() < 0.3) {
          next.technique = 'slide';
        }
      }
    }
  }
}

// Get dynamic intensity based on bar position
// Creates a "build and release" feel across the phrase
function getBarIntensity(config: BarConfig): { densityMod: number; addNotes: boolean } {
  const { barPosition, totalBars, energy } = config;

  // Intensity curve: start moderate, build, peak at bar 3, resolve on bar 4
  // Bar 0: 0.85, Bar 1: 1.0, Bar 2: 1.15, Bar 3: 0.9 (slight pullback for resolution)
  const intensityCurve = [0.85, 1.0, 1.15, 0.95];
  const baseIntensity = intensityCurve[barPosition] || 1.0;

  // Energy affects how pronounced the dynamics are
  const dynamicRange = 0.5 + (energy - 1) * 0.1;
  const densityMod = 1 + (baseIntensity - 1) * dynamicRange;

  // More likely to add extra notes in building bars
  const addNotes = barPosition === 1 || barPosition === 2;

  return { densityMod, addNotes };
}

// Travis picking style - with melodic phrases, voice leading, and mood-based rhythm
export function barTravis(chord: string, config: BarConfig): TabEvent[] {
  const events: TabEvent[] = [];
  const used: UsedSlots = new Set();

  const bass = getChordBass(chord);
  const altBass = getChordAltBass(chord);
  const treble = getChordTrebleForComplexity(chord, config.complexity, config.maxFret);

  // Get phrase configuration for musical structure
  const phraseConfig = getPhraseConfig(config.barPosition, config.totalBars, config.mood);

  // Get mood-specific rhythm
  const moodRhythm = getMoodRhythm(config.mood);

  // Get dynamic intensity for this bar
  const { densityMod, addNotes } = getBarIntensity(config);

  // ===== BASS PATTERN (Foundation) =====
  // Consistent alternating bass - the backbone of Travis picking
  addEventIfFree(events, used, bass.string, bass.fret, 0, 2);
  addEventIfFree(events, used, altBass.string, altBass.fret, 8, 2);

  // ===== MELODIC CONTENT =====
  // Determine number of melody notes based on complexity and phrase intensity
  const baseNotes = 2 + Math.floor(config.complexity / 2); // 2-4 notes
  const numMelodyNotes = Math.round(baseNotes * phraseConfig.intensity);

  // Get melodic target for this bar
  const melodicTarget = getMelodicTarget(treble, phraseConfig, lastTrebleNote);

  // Generate melodic line following the phrase contour
  const melodicLine = generateMelodicLine(
    treble,
    phraseConfig,
    Math.max(2, numMelodyNotes),
    lastTrebleNote
  );

  // Place melody notes at musically appropriate positions
  // Travis picking typically has melody on beats 2 and 4 (steps 4 and 12)
  // With pickups on the "and" of beats
  let melodyPositions: number[];
  if (!config.allowSyncopation) {
    // Beginner: on-beat only
    melodyPositions = [4, 12];
  } else if (config.complexity <= 2) {
    melodyPositions = [4, 12];
  } else if (config.complexity <= 3) {
    melodyPositions = [4, 10, 12];  // Medium: add a pickup
  } else {
    melodyPositions = [4, 6, 10, 12, 14];  // Complex: more movement
  }

  // Check for motif notes — use them instead of melodic line when available
  const motifNotes = getMotifNotesForBar(chord, config);
  const usedMotifSteps = new Set<number>();

  if (motifNotes) {
    // Place motif notes first at their designated steps
    for (const mn of motifNotes) {
      if (addEventIfFree(events, used, mn.note.string, mn.note.fret, mn.step)) {
        lastTrebleNote = mn.note;
        usedMotifSteps.add(mn.step);
      }
    }
  }

  // Fill remaining melody positions with melodic line (skip steps already used by motif)
  let melodicIdx = 0;
  for (const step of melodyPositions) {
    if (usedMotifSteps.has(step)) continue;
    if (melodicIdx >= melodicLine.length) break;

    const note = melodicLine[melodicIdx];
    melodicIdx++;

    // For the last note in resolution bars, ensure it's the target
    const useNote = (phraseConfig.isResolution && melodicIdx === melodicLine.length)
      ? melodicTarget
      : note;

    if (addEventIfFree(events, used, useNote.string, useNote.fret, step)) {
      lastTrebleNote = useNote;
    }
  }

  // ===== OPTIONAL EMBELLISHMENTS =====
  // Only add if complexity supports it and not a sparse mood
  if (config.complexity >= 3 && moodRhythm.restProb < 0.3) {
    // Add passing tone or neighbor on beat 3 area
    const embellishStep = 6;
    if (!used.has(slotKey(treble[0]?.string || 'G', embellishStep))) {
      // Select note moving toward the next melody note
      const nextMelodyNote = melodicLine[1] || melodicTarget;
      const passingNote = selectTowardTarget(treble, nextMelodyNote, lastTrebleNote, 0.8);

      if (Math.random() < 0.4 * phraseConfig.intensity) {
        addEventIfFree(events, used, passingNote.string, passingNote.fret, embellishStep);
      }
    }
  }

  return events;
}

// Arpeggio style - broken chord with melodic direction and mood variation
export function barArpeggio(chord: string, config: BarConfig): TabEvent[] {
  const events: TabEvent[] = [];
  const used: UsedSlots = new Set();

  const bass = getChordBass(chord);
  const altBass = getChordAltBass(chord);
  const treble = getChordTrebleForComplexity(chord, config.complexity, config.maxFret);
  const randomness = 0.2 + (config.complexity - 1) * 0.1;

  // Get mood-specific rhythm
  const moodRhythm = getMoodRhythm(config.mood);

  // Determine direction based on mood
  // Sad/dreamy tend to descend, uplifting/driving tend to ascend
  const descendingMoods: Mood[] = ['sad', 'dreamy', 'cinematic', 'mysterious'];
  const ascendingBias = descendingMoods.includes(config.mood) ? 0.3 : 0.6;
  const direction = Math.random() < ascendingBias ? 'ascending' : 'alternating';

  // Sort treble by pitch for directed arpeggios
  const sortedTreble = [...treble].sort((a, b) => getAbsolutePitch(a) - getAbsolutePitch(b));

  // Determine step pattern based on mood and syncopation allowance
  let steps: number[];
  if (!config.allowSyncopation) {
    // No syncopation: quarter notes only
    steps = [0, 4, 8, 12];
  } else if (moodRhythm.restProb > 0.3) {
    // Sparse moods: fewer notes
    steps = [0, 4, 8, 12];
  } else if (moodRhythm.syncopationProb > 0.5) {
    // Syncopated moods: offset positions
    steps = [0, 3, 6, 8, 11, 14];
  } else {
    // Standard 8th note arpeggio
    steps = [0, 2, 4, 6, 8, 10, 12, 14];
  }

  // Check for motif notes — inject at accent positions
  const motifNotes = getMotifNotesForBar(chord, config);
  const motifByStep = new Map<number, NotePosition>();
  if (motifNotes) {
    for (const mn of motifNotes) {
      motifByStep.set(mn.step, mn.note);
    }
  }

  let trebleIdx = 0;
  let ascending = direction === 'ascending';

  for (const step of steps) {
    // Apply rest probability
    if (step !== 0 && step !== 8 && Math.random() < moodRhythm.restProb * 0.5) {
      continue;
    }

    if (step === 0) {
      // Root bass on beat 1
      addEventIfFree(events, used, bass.string, bass.fret, step, 2);
    } else if (step === 8) {
      // Alternate bass on beat 3
      addEventIfFree(events, used, altBass.string, altBass.fret, step, 2);
    } else {
      let note: NotePosition;

      // Use motif note at accent positions if available
      const isAccent = moodRhythm.accentSteps.includes(step);
      if (isAccent && motifByStep.has(step)) {
        note = motifByStep.get(step)!;
      } else if (direction === 'ascending') {
        note = sortedTreble[trebleIdx % sortedTreble.length];
        trebleIdx++;
      } else {
        // Alternating up/down
        if (ascending) {
          note = sortedTreble[Math.min(trebleIdx, sortedTreble.length - 1)];
          trebleIdx++;
          if (trebleIdx >= sortedTreble.length) {
            ascending = false;
            trebleIdx = sortedTreble.length - 2;
          }
        } else {
          note = sortedTreble[Math.max(0, trebleIdx)];
          trebleIdx--;
          if (trebleIdx < 0) {
            ascending = true;
            trebleIdx = 1;
          }
        }
      }

      addEventIfFree(events, used, note.string, note.fret, step);
      lastTrebleNote = note;
    }
  }

  return events;
}

// Crosspicking / rolling pattern with voice leading
export function barCrosspick(chord: string, config: BarConfig): TabEvent[] {
  const events: TabEvent[] = [];
  const used: UsedSlots = new Set();

  const treble = getChordTrebleForComplexity(chord, config.complexity, config.maxFret);
  const bass = getChordBass(chord);
  const randomness = 0.15; // Tighter voice leading for crosspicking

  // Pick 3 treble notes with voice leading consideration
  const picked: NotePosition[] = [];
  let prev = lastTrebleNote;

  for (let i = 0; i < 3 && treble.length > 0; i++) {
    const available = treble.filter(t => !picked.includes(t));
    if (available.length === 0) break;
    const note = selectWithVoiceLeading(available, prev, randomness);
    picked.push(note);
    prev = note;
  }

  // Ensure we have 3 notes
  while (picked.length < 3) {
    picked.push(randomChoice(treble));
  }

  // Sort by pitch for smooth rolling
  picked.sort((a, b) => getAbsolutePitch(a) - getAbsolutePitch(b));

  // Roll pattern: low-mid-high-mid (classic crosspick)
  const order = [0, 1, 2, 1];

  // Complexity controls 16ths vs 8ths; no syncopation forces 8th-note pattern
  const use16ths = config.complexity >= 3 && config.allowSyncopation;
  const steps = use16ths
    ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
    : [0, 2, 4, 6, 8, 10, 12, 14];

  // Check for motif notes — inject at accent positions
  const motifNotes = getMotifNotesForBar(chord, config);
  const motifByStep = new Map<number, NotePosition>();
  if (motifNotes) {
    for (const mn of motifNotes) {
      motifByStep.set(mn.step, mn.note);
    }
  }

  // Get mood accent steps for motif injection
  const moodRhythm = getMoodRhythm(config.mood);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const isAccent = moodRhythm.accentSteps.includes(step);

    // Use motif note at accent positions if available
    let note: NotePosition;
    if (isAccent && motifByStep.has(step)) {
      note = motifByStep.get(step)!;
    } else {
      note = picked[order[i % order.length]];
    }

    addEventIfFree(events, used, note.string, note.fret, step);
    lastTrebleNote = note;
  }

  // Optional bass support
  if (config.bassMovement >= 3 && Math.random() < 0.4) {
    addEventIfFree(events, used, bass.string, bass.fret, 0, 2);
  }

  return events;
}

// Strum style with dynamic strumming patterns and mood variation
export function barStrum(chord: string, config: BarConfig): TabEvent[] {
  const events: TabEvent[] = [];
  const used: UsedSlots = new Set();

  const bass = getChordBass(chord);
  const altBass = getChordAltBass(chord);
  const treble = getChordTrebleForComplexity(chord, config.complexity, config.maxFret);

  // Get mood-specific rhythm
  const moodRhythm = getMoodRhythm(config.mood);

  // Strum patterns based on energy AND mood
  let hits: number[];

  if (!config.allowSyncopation) {
    // No syncopation: quarter notes only, capped
    hits = [0, 4, 8, 12];
  } else if (config.energy <= 2) {
    hits = [0, 8]; // Half notes
  } else if (config.energy <= 3) {
    hits = [0, 4, 8, 12]; // Quarter notes
  } else if (config.complexity >= 4) {
    hits = [0, 2, 4, 6, 8, 10, 12, 14]; // 8ths
  } else {
    hits = [0, 4, 8, 12]; // Default quarter notes
  }

  // Apply mood syncopation (only if syncopation is allowed)
  if (config.allowSyncopation && Math.random() < moodRhythm.syncopationProb) {
    // Shift some hits for syncopation
    const syncopatedMoods: Mood[] = ['gritty', 'soulful', 'mysterious', 'tense'];
    if (syncopatedMoods.includes(config.mood)) {
      // Use mood-specific pattern instead
      const moodPattern = moodRhythm.trebleSteps[Math.floor(Math.random() * moodRhythm.trebleSteps.length)];
      hits = [0, ...moodPattern.filter(s => s !== 0), 8].sort((a, b) => a - b);
      // Remove duplicates
      hits = [...new Set(hits)];
    }
  }

  // Apply rest probability for sparse moods
  if (moodRhythm.restProb > 0.3 && hits.length > 3) {
    hits = hits.filter((_, i) => i === 0 || Math.random() > moodRhythm.restProb * 0.5);
  }

  // Check for motif notes — inject at accent positions
  const motifNotes = getMotifNotesForBar(chord, config);
  const motifByStep = new Map<number, NotePosition>();
  if (motifNotes) {
    for (const mn of motifNotes) {
      motifByStep.set(mn.step, mn.note);
    }
  }

  for (const step of hits) {
    // Bass on strong beats - alternating root/5th
    const isStrongBeat = step === 0 || step === 8;
    const isAccent = moodRhythm.accentSteps.includes(step);

    if (isStrongBeat) {
      const bassNote = step === 0 ? bass : altBass;
      addEventIfFree(events, used, bassNote.string, bassNote.fret, step, 2);
    } else if (Math.random() < 0.3) {
      addEventIfFree(events, used, bass.string, bass.fret, step, 2);
    }

    // Use motif note at accent positions if available
    if (isAccent && motifByStep.has(step)) {
      const mn = motifByStep.get(step)!;
      if (addEventIfFree(events, used, mn.string, mn.fret, step)) {
        lastTrebleNote = mn;
      }
    }

    // Strum treble notes - more notes on accented/strong beats
    const baseNotes = isStrongBeat || isAccent ? 3 : 2;
    const numNotes = Math.random() < 0.5 ? baseNotes : baseNotes - 1;
    const shuffled = [...treble].sort(() => Math.random() - 0.5);

    for (let i = 0; i < Math.min(numNotes, shuffled.length); i++) {
      addEventIfFree(events, used, shuffled[i].string, shuffled[i].fret, step);
      lastTrebleNote = shuffled[i];
    }
  }

  return events;
}

// Improved bass walk that connects chords smoothly
export function applyBassWalk(
  events: TabEvent[],
  used: UsedSlots,
  prevChord: string,
  chord: string,
  config: BarConfig
): void {
  if (!config.allowBassWalks) return; // Difficulty disables bass walks
  if (config.bassMovement <= 1) return;

  const walk = getBassWalk(prevChord, chord);
  if (!walk) return;

  // Higher bass movement = more likely to use walks
  const walkProb = 0.15 + 0.12 * (config.bassMovement - 1);
  if (Math.random() > walkProb) return;

  // Place walk notes leading into the next bar
  // Use steps 13, 14, 15 for a 3-note walk, or 14, 15 for 2-note
  const walkLength = Math.min(walk.length, config.bassMovement >= 4 ? 3 : 2);
  const startStep = 16 - walkLength;

  for (let i = 0; i < walkLength; i++) {
    const walkNote = walk[walk.length - walkLength + i];
    addEventIfFree(events, used, walkNote.string, walkNote.fret, startStep + i);
  }
}

// Improved fill that targets the next chord
export function applyFill(
  events: TabEvent[],
  used: UsedSlots,
  chord: string,
  config: BarConfig,
  nextChord?: string
): void {
  if (config.fillProbMult <= 0) return; // Difficulty disables fills
  const baseFillProb = 0.25 * config.density * (0.6 + 0.12 * config.complexity) * config.fillProbMult;
  if (Math.random() > baseFillProb) return;

  const treble = getChordTreble(chord);
  const nextBass = nextChord ? getChordBass(nextChord) : null;
  const nextTreble = nextChord ? getChordTreble(nextChord) : null;

  // Fill steps - later in the bar, leading to next
  const fillSteps = config.complexity >= 4 ? [10, 12, 14] : [10, 14];

  for (let i = 0; i < fillSteps.length; i++) {
    const step = fillSteps[i];
    let note: NotePosition;

    if (nextTreble && i === fillSteps.length - 1 && config.complexity >= 3) {
      // Last fill note: chromatic approach to next chord
      const target = randomChoice(nextTreble);
      const approach = getChromaticApproach(target, Math.random() < 0.5);
      note = approach || randomChoice(treble);
    } else if (nextTreble && Math.random() < 0.4) {
      // Sometimes anticipate a note from next chord
      note = selectWithVoiceLeading(nextTreble, lastTrebleNote, 0.3);
    } else {
      // Regular fill from current chord with possible neighbor
      note = selectWithVoiceLeading(treble, lastTrebleNote, 0.4);

      // Chromatic neighbor for complexity
      if (config.complexity >= 4 && Math.random() < 0.35) {
        const neighbor = getChromaticApproach(note, Math.random() < 0.5);
        if (neighbor) note = neighbor;
      }
    }

    if (addEventIfFree(events, used, note.string, note.fret, step)) {
      lastTrebleNote = note;
      // Only add one fill note for lower complexity
      if (config.complexity < 3) break;
    }
  }
}

// Assign velocity to a single event based on beat strength, technique, and layer
export function assignVelocity(event: TabEvent, config: BarConfig): void {
  const stepInBar = event.step % 16;
  const moodRhythm = getMoodRhythm(config.mood);

  // Base velocity from beat strength
  let velocity: number;
  if (stepInBar === 0 || stepInBar === 8) {
    velocity = 0.85; // Downbeats
  } else if (stepInBar === 4 || stepInBar === 12) {
    velocity = 0.75; // Backbeats
  } else {
    velocity = 0.6; // Off-beats
  }

  // Accent boost from mood rhythms
  if (moodRhythm.accentSteps.includes(stepInBar)) {
    velocity = Math.min(1.0, velocity + 0.1);
  }

  // Layer adjustments
  if (event.layer === 'bass') {
    velocity = Math.max(0.75, Math.min(0.85, velocity));
  } else if (event.layer === 'fills') {
    velocity = Math.max(0.5, Math.min(0.65, velocity));
  }
  // melody layer: use full range as computed

  // Technique adjustments
  if (event.technique === 'hammer' || event.technique === 'pull') {
    velocity = Math.min(velocity, 0.55);
  }

  // Add slight random variation (+/- 0.05)
  velocity += (Math.random() - 0.5) * 0.1;
  velocity = Math.max(0.3, Math.min(1.0, velocity));

  event.velocity = velocity;
}

// Assign velocity to all events in an array
export function assignVelocityToEvents(events: TabEvent[], config: BarConfig): void {
  for (const event of events) {
    assignVelocity(event, config);
  }
}

// Style function type
export type StyleFunction = (chord: string, config: BarConfig) => TabEvent[];

// Map of style names to functions
export const STYLE_FUNCTIONS: Record<string, StyleFunction> = {
  travis: barTravis,
  arpeggio: barArpeggio,
  crosspicking: barCrosspick,
  strum: barStrum,
};
