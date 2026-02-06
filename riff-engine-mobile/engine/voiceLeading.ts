import { NotePosition, GuitarString, Mood } from './types';

// String pitch order (low to high in semitones from low E)
const STRING_PITCH: Record<GuitarString, number> = {
  'E': 0,
  'A': 5,
  'D': 10,
  'G': 15,
  'B': 19,
  'e': 24,
};

// Get absolute pitch of a note position (for comparison)
export function getAbsolutePitch(note: NotePosition): number {
  return STRING_PITCH[note.string] + note.fret;
}

// Calculate melodic distance between two notes
export function melodicDistance(a: NotePosition, b: NotePosition): number {
  return Math.abs(getAbsolutePitch(a) - getAbsolutePitch(b));
}

// Select next note with voice leading preference
// Prefers notes close to the previous note, with some randomness
export function selectWithVoiceLeading(
  options: NotePosition[],
  previous: NotePosition | null,
  randomness: number = 0.3 // 0 = strict voice leading, 1 = random
): NotePosition {
  if (!previous || options.length <= 1 || Math.random() < randomness * 0.5) {
    return options[Math.floor(Math.random() * options.length)];
  }

  // Score each option by distance (lower is better)
  const scored = options.map(note => ({
    note,
    distance: melodicDistance(note, previous),
  }));

  // Sort by distance
  scored.sort((a, b) => a.distance - b.distance);

  // Weighted selection favoring closer notes
  // But allow some variety based on randomness
  const weights = scored.map((_, i) => Math.pow(1 - randomness, i));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < scored.length; i++) {
    random -= weights[i];
    if (random <= 0) return scored[i].note;
  }

  return scored[0].note;
}

// Get notes that lead toward a target note (for fills/transitions)
export function getLeadingNotes(
  current: NotePosition,
  target: NotePosition,
  steps: number = 2
): NotePosition[] {
  const currentPitch = getAbsolutePitch(current);
  const targetPitch = getAbsolutePitch(target);
  const direction = targetPitch > currentPitch ? 1 : -1;
  const totalDistance = Math.abs(targetPitch - currentPitch);

  const result: NotePosition[] = [];

  // Create stepping stones toward target
  for (let i = 1; i <= steps; i++) {
    const intermediatePitch = currentPitch + Math.round((totalDistance * i / (steps + 1)) * direction);
    const note = pitchToNotePosition(intermediatePitch, current.string);
    if (note) result.push(note);
  }

  return result;
}

// Convert absolute pitch back to a note position
// Prefers staying on the same or adjacent string
function pitchToNotePosition(
  targetPitch: number,
  preferredString: GuitarString
): NotePosition | null {
  const strings: GuitarString[] = ['E', 'A', 'D', 'G', 'B', 'e'];
  const preferredIdx = strings.indexOf(preferredString);

  // Try preferred string first, then adjacent strings
  const searchOrder = [0, -1, 1, -2, 2].map(offset => preferredIdx + offset).filter(i => i >= 0 && i < 6);

  for (const idx of searchOrder) {
    const string = strings[idx];
    const basePitch = STRING_PITCH[string];
    const fret = targetPitch - basePitch;

    if (fret >= 0 && fret <= 12) {
      return { string, fret };
    }
  }

  // Fallback: find any valid position
  for (const string of strings) {
    const basePitch = STRING_PITCH[string];
    const fret = targetPitch - basePitch;
    if (fret >= 0 && fret <= 12) {
      return { string, fret };
    }
  }

  return null;
}

// Check if a note is a chromatic neighbor to any chord tone
export function isChromaticNeighbor(note: NotePosition, chordTones: NotePosition[]): boolean {
  const notePitch = getAbsolutePitch(note);
  return chordTones.some(ct => Math.abs(getAbsolutePitch(ct) - notePitch) === 1);
}

// Get a chromatic approach note to a target
export function getChromaticApproach(
  target: NotePosition,
  fromBelow: boolean = true
): NotePosition | null {
  const targetPitch = getAbsolutePitch(target);
  const approachPitch = fromBelow ? targetPitch - 1 : targetPitch + 1;
  return pitchToNotePosition(approachPitch, target.string);
}

// ============= MELODIC MOTIF SYSTEM =============
// A motif is a short memorable pattern that repeats throughout a riff

export interface MotifNote {
  intervalFromRoot: number;  // Semitones from chord root
  stepOffset: number;        // Rhythmic position within motif (0, 1, 2, etc.)
}

export interface Motif {
  notes: MotifNote[];
  length: number;  // Total steps the motif spans
}

// Currently active motif for the riff
let currentMotif: Motif | null = null;

// Motif templates - common melodic shapes
const MOTIF_TEMPLATES: Motif[] = [
  // Ascending third
  { notes: [{ intervalFromRoot: 0, stepOffset: 0 }, { intervalFromRoot: 4, stepOffset: 2 }], length: 4 },
  // Descending second
  { notes: [{ intervalFromRoot: 7, stepOffset: 0 }, { intervalFromRoot: 5, stepOffset: 2 }], length: 4 },
  // Neighbor tone
  { notes: [{ intervalFromRoot: 0, stepOffset: 0 }, { intervalFromRoot: 2, stepOffset: 1 }, { intervalFromRoot: 0, stepOffset: 2 }], length: 4 },
  // Arpeggio up
  { notes: [{ intervalFromRoot: 0, stepOffset: 0 }, { intervalFromRoot: 4, stepOffset: 1 }, { intervalFromRoot: 7, stepOffset: 2 }], length: 4 },
  // Turn figure
  { notes: [{ intervalFromRoot: 0, stepOffset: 0 }, { intervalFromRoot: 2, stepOffset: 1 }, { intervalFromRoot: 0, stepOffset: 2 }, { intervalFromRoot: -1, stepOffset: 3 }], length: 4 },
  // Scale run down
  { notes: [{ intervalFromRoot: 7, stepOffset: 0 }, { intervalFromRoot: 5, stepOffset: 1 }, { intervalFromRoot: 4, stepOffset: 2 }, { intervalFromRoot: 2, stepOffset: 3 }], length: 4 },
  // Pentatonic lick
  { notes: [{ intervalFromRoot: 0, stepOffset: 0 }, { intervalFromRoot: 3, stepOffset: 1 }, { intervalFromRoot: 5, stepOffset: 3 }], length: 4 },
  // Blues bend feel
  { notes: [{ intervalFromRoot: 3, stepOffset: 0 }, { intervalFromRoot: 4, stepOffset: 2 }, { intervalFromRoot: 0, stepOffset: 4 }], length: 6 },
];

// Generate a new motif for a riff
export function generateMotif(complexity: number): Motif {
  // Higher complexity allows longer/more complex motifs
  const maxNotes = Math.min(complexity + 1, 4);
  const availableTemplates = MOTIF_TEMPLATES.filter(m => m.notes.length <= maxNotes);

  if (availableTemplates.length === 0) {
    currentMotif = MOTIF_TEMPLATES[0];
  } else {
    currentMotif = availableTemplates[Math.floor(Math.random() * availableTemplates.length)];
  }

  return currentMotif;
}

// Get current motif
export function getCurrentMotif(): Motif | null {
  return currentMotif;
}

// Reset motif (call when generating new riff)
export function resetMotif(): void {
  currentMotif = null;
}

// Transpose motif to fit a chord
// Returns note positions that can be played
export function transposeMotifToChord(
  motif: Motif,
  chordRoot: number,  // MIDI note of chord root
  baseStep: number,   // Starting step position
  preferredString: GuitarString = 'G'
): { note: NotePosition; step: number }[] {
  const result: { note: NotePosition; step: number }[] = [];

  for (const mNote of motif.notes) {
    const targetPitch = chordRoot + mNote.intervalFromRoot;
    // Convert to fretboard position relative to open strings
    const relativePitch = targetPitch - 40; // 40 = low E MIDI note

    const notePos = pitchToNotePosition(relativePitch, preferredString);
    if (notePos) {
      result.push({
        note: notePos,
        step: baseStep + mNote.stepOffset,
      });
    }
  }

  return result;
}

// Apply variation to a motif (inversion, retrograde, etc.)
export function varyMotif(motif: Motif, variationType: 'invert' | 'retrograde' | 'augment'): Motif {
  const notes = [...motif.notes];

  switch (variationType) {
    case 'invert':
      // Flip intervals (ascending becomes descending)
      const centerInterval = notes[0].intervalFromRoot;
      return {
        notes: notes.map(n => ({
          ...n,
          intervalFromRoot: centerInterval - (n.intervalFromRoot - centerInterval),
        })),
        length: motif.length,
      };

    case 'retrograde':
      // Reverse note order
      const reversed = [...notes].reverse();
      return {
        notes: reversed.map((n, i) => ({
          ...n,
          stepOffset: notes[i].stepOffset,
        })),
        length: motif.length,
      };

    case 'augment':
      // Double the rhythmic values
      return {
        notes: notes.map(n => ({
          ...n,
          stepOffset: n.stepOffset * 2,
        })),
        length: motif.length * 2,
      };

    default:
      return motif;
  }
}

// Check if we should use the motif in this bar
export function shouldUseMotif(barPosition: number, complexity: number): boolean {
  if (!currentMotif) return false;

  // Bar 0: always introduce motif
  // Bar 1: sometimes repeat
  // Bar 2: often vary
  // Bar 3: resolve, maybe use
  const probs = [0.8, 0.5, 0.6, 0.4];
  const baseProb = probs[barPosition] || 0.4;

  // Higher complexity = more motif usage
  const adjustedProb = baseProb * (0.7 + complexity * 0.1);

  return Math.random() < adjustedProb;
}

// ============= MELODIC PHRASE SYSTEM =============
// Creates musical phrases with clear contours and target notes

export type MelodicContour = 'arch' | 'descent' | 'ascent' | 'wave' | 'static' | 'question' | 'answer';

export interface PhraseConfig {
  contour: MelodicContour;
  targetInterval: number;  // Target note as interval from chord root (0=root, 4=3rd, 7=5th)
  intensity: number;       // 0-1, affects note density and range
  isResolution: boolean;   // End on a stable note?
}

// Mood to phrase character mapping
const MOOD_PHRASE_STYLES: Record<Mood, { contours: MelodicContour[], targetIntervals: number[], intensity: number }> = {
  uplifting: { contours: ['arch', 'ascent', 'wave'], targetIntervals: [0, 4, 7], intensity: 0.7 },
  sad: { contours: ['descent', 'arch', 'static'], targetIntervals: [0, 3, 7], intensity: 0.4 },
  mysterious: { contours: ['wave', 'static', 'descent'], targetIntervals: [7, 4, 0], intensity: 0.5 },
  nostalgic: { contours: ['arch', 'descent', 'wave'], targetIntervals: [0, 4, 7], intensity: 0.5 },
  gritty: { contours: ['ascent', 'arch', 'wave'], targetIntervals: [0, 7, 4], intensity: 0.8 },
  cinematic: { contours: ['arch', 'ascent', 'descent'], targetIntervals: [7, 0, 4], intensity: 0.6 },
  driving: { contours: ['ascent', 'wave', 'arch'], targetIntervals: [0, 7, 4], intensity: 0.9 },
  dreamy: { contours: ['wave', 'static', 'arch'], targetIntervals: [4, 7, 0], intensity: 0.3 },
  tense: { contours: ['ascent', 'wave', 'static'], targetIntervals: [7, 4, 0], intensity: 0.6 },
  soulful: { contours: ['arch', 'wave', 'descent'], targetIntervals: [4, 0, 7], intensity: 0.5 },
};

// Current phrase state for continuity across bars
let currentPhraseContour: MelodicContour = 'arch';
let phraseTargetPitch: number = 0;
let phraseStartPitch: number = 0;

// Initialize phrase for a new riff
export function initializePhrase(mood: Mood): void {
  const style = MOOD_PHRASE_STYLES[mood] || MOOD_PHRASE_STYLES.nostalgic;
  currentPhraseContour = style.contours[Math.floor(Math.random() * style.contours.length)];
  phraseTargetPitch = 0;
  phraseStartPitch = 0;
}

// Get phrase config for a specific bar
export function getPhraseConfig(barPosition: number, totalBars: number, mood: Mood): PhraseConfig {
  const style = MOOD_PHRASE_STYLES[mood] || MOOD_PHRASE_STYLES.nostalgic;

  // Question/answer structure: bars 0-1 are question, 2-3 are answer
  const isFirstHalf = barPosition < totalBars / 2;
  const isLastBar = barPosition === totalBars - 1;

  let contour: MelodicContour;
  let targetInterval: number;
  let intensity: number;
  let isResolution: boolean;

  if (isFirstHalf) {
    // Question phrase - build tension
    contour = barPosition === 0 ? currentPhraseContour : 'wave';
    targetInterval = style.targetIntervals[1] || 4; // Usually the 3rd - creates expectation
    intensity = style.intensity * (0.8 + barPosition * 0.1);
    isResolution = false;
  } else {
    // Answer phrase - resolve
    contour = isLastBar ? 'descent' : 'arch';
    targetInterval = isLastBar ? 0 : style.targetIntervals[0]; // End on root
    intensity = style.intensity * (isLastBar ? 0.6 : 0.9);
    isResolution = isLastBar;
  }

  return { contour, targetInterval, intensity, isResolution };
}

// Generate melodic target note for a bar based on chord and phrase config
export function getMelodicTarget(
  chordTones: NotePosition[],
  config: PhraseConfig,
  previousNote: NotePosition | null
): NotePosition {
  if (chordTones.length === 0) {
    return { string: 'G', fret: 0 };
  }

  // Sort by pitch
  const sorted = [...chordTones].sort((a, b) => getAbsolutePitch(a) - getAbsolutePitch(b));

  // Find note closest to target interval
  // For simplicity, map intervals to chord tone indices
  // 0 = root (lowest), 4 = middle (3rd), 7 = highest (5th)
  let targetIndex: number;
  if (config.targetInterval <= 2) {
    targetIndex = 0; // Root
  } else if (config.targetInterval <= 5) {
    targetIndex = Math.min(1, sorted.length - 1); // 3rd
  } else {
    targetIndex = Math.min(2, sorted.length - 1); // 5th
  }

  let target = sorted[targetIndex];

  // Adjust based on contour and previous note
  if (previousNote && config.contour !== 'static') {
    const prevPitch = getAbsolutePitch(previousNote);
    const targetPitch = getAbsolutePitch(target);

    // For descent contour, prefer notes below previous
    if (config.contour === 'descent' && targetPitch > prevPitch) {
      const lowerOptions = sorted.filter(n => getAbsolutePitch(n) < prevPitch);
      if (lowerOptions.length > 0) {
        target = lowerOptions[lowerOptions.length - 1]; // Highest of lower options
      }
    }

    // For ascent contour, prefer notes above previous
    if (config.contour === 'ascent' && targetPitch < prevPitch) {
      const higherOptions = sorted.filter(n => getAbsolutePitch(n) > prevPitch);
      if (higherOptions.length > 0) {
        target = higherOptions[0]; // Lowest of higher options
      }
    }
  }

  return target;
}

// Generate a melodic line following a contour
export function generateMelodicLine(
  chordTones: NotePosition[],
  config: PhraseConfig,
  numNotes: number,
  startNote: NotePosition | null
): NotePosition[] {
  if (chordTones.length === 0 || numNotes === 0) return [];

  const sorted = [...chordTones].sort((a, b) => getAbsolutePitch(a) - getAbsolutePitch(b));
  const result: NotePosition[] = [];

  // Determine start and end points based on contour
  let startIdx: number;
  let endIdx: number;

  switch (config.contour) {
    case 'arch':
      startIdx = 0;
      endIdx = 0;
      break;
    case 'descent':
      startIdx = sorted.length - 1;
      endIdx = 0;
      break;
    case 'ascent':
      startIdx = 0;
      endIdx = sorted.length - 1;
      break;
    case 'wave':
      startIdx = Math.floor(sorted.length / 2);
      endIdx = startIdx;
      break;
    case 'question':
      startIdx = 0;
      endIdx = sorted.length - 1; // End high (unresolved)
      break;
    case 'answer':
      startIdx = sorted.length - 1;
      endIdx = 0; // End low (resolved)
      break;
    default:
      startIdx = Math.floor(sorted.length / 2);
      endIdx = startIdx;
  }

  // If we have a start note, find closest chord tone
  if (startNote) {
    const startPitch = getAbsolutePitch(startNote);
    let closestDist = Infinity;
    for (let i = 0; i < sorted.length; i++) {
      const dist = Math.abs(getAbsolutePitch(sorted[i]) - startPitch);
      if (dist < closestDist) {
        closestDist = dist;
        startIdx = i;
      }
    }
  }

  // Generate the line
  for (let i = 0; i < numNotes; i++) {
    const progress = numNotes > 1 ? i / (numNotes - 1) : 0;
    let idx: number;

    switch (config.contour) {
      case 'arch':
        // Go up then down
        const archProgress = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
        idx = Math.round(startIdx + (sorted.length - 1 - startIdx) * archProgress);
        break;
      case 'wave':
        // Oscillate
        const waveOffset = Math.sin(progress * Math.PI * 2) * (sorted.length - 1) / 2;
        idx = Math.round(startIdx + waveOffset);
        break;
      default:
        // Linear interpolation for others
        idx = Math.round(startIdx + (endIdx - startIdx) * progress);
    }

    idx = Math.max(0, Math.min(sorted.length - 1, idx));
    result.push(sorted[idx]);
  }

  // For resolution, ensure we end on root
  if (config.isResolution && result.length > 0) {
    result[result.length - 1] = sorted[0];
  }

  return result;
}

// Select a note that moves toward a target
export function selectTowardTarget(
  options: NotePosition[],
  target: NotePosition,
  previous: NotePosition | null,
  directness: number = 0.7 // How directly to move toward target (0 = random, 1 = beeline)
): NotePosition {
  if (options.length === 0) return target;
  if (options.length === 1) return options[0];

  const targetPitch = getAbsolutePitch(target);
  const prevPitch = previous ? getAbsolutePitch(previous) : targetPitch;

  // Score each option
  const scored = options.map(note => {
    const notePitch = getAbsolutePitch(note);

    // Distance to target (lower is better)
    const distToTarget = Math.abs(notePitch - targetPitch);

    // Is it moving in the right direction?
    const rightDirection = (targetPitch > prevPitch && notePitch > prevPitch) ||
                          (targetPitch < prevPitch && notePitch < prevPitch) ||
                          (targetPitch === prevPitch);

    // Step size (prefer small steps)
    const stepSize = Math.abs(notePitch - prevPitch);

    // Combined score (lower is better)
    let score = distToTarget * directness;
    if (!rightDirection) score += 5;
    if (stepSize > 5) score += stepSize - 5;

    return { note, score };
  });

  // Sort by score
  scored.sort((a, b) => a.score - b.score);

  // Weighted random selection (favor better scores)
  const weights = scored.map((_, i) => Math.pow(0.5, i));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * totalWeight;

  for (let i = 0; i < scored.length; i++) {
    r -= weights[i];
    if (r <= 0) return scored[i].note;
  }

  return scored[0].note;
}
