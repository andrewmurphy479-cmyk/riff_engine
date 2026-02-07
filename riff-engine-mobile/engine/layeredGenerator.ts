import { TabEvent, GeneratorConfig, RiffLayer, LayerState, LayeredRiff, Mood } from './types';
import { generateProgression } from './progressions';
import { getChordBass, getChordAltBass, getChordTrebleForComplexity } from './chords';
import { getMoodRhythm } from './styles';
import { getDifficultyConfig, getAllowedChordsForDifficulty } from './difficulty';
import {
  initializePhrase,
  getPhraseConfig,
  getMelodicTarget,
  generateMelodicLine,
  getAbsolutePitch,
  generateMotif,
  getCurrentMotif,
  transposeMotifToChord,
  varyMotif,
  shouldUseMotif,
  Motif,
} from './voiceLeading';

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

// Assign velocity to layered events based on layer type and beat position
function assignLayerVelocity(events: TabEvent[], layer: RiffLayer, mood: Mood): void {
  const moodRhythm = getMoodRhythm(mood);

  for (const event of events) {
    const stepInBar = event.step % 16;

    // Base velocity from beat strength
    let velocity: number;
    if (stepInBar === 0 || stepInBar === 8) {
      velocity = 0.85;
    } else if (stepInBar === 4 || stepInBar === 12) {
      velocity = 0.75;
    } else {
      velocity = 0.6;
    }

    // Accent boost
    if (moodRhythm.accentSteps.includes(stepInBar)) {
      velocity = Math.min(1.0, velocity + 0.1);
    }

    // Layer-specific ranges
    switch (layer) {
      case 'bass':
        velocity = Math.max(0.75, Math.min(0.85, velocity));
        break;
      case 'fills':
        velocity = Math.max(0.5, Math.min(0.65, velocity));
        break;
      // melody: full range
    }

    // Technique adjustments
    if (event.technique === 'hammer' || event.technique === 'pull') {
      velocity = Math.min(velocity, 0.55);
    }

    // Slight random variation
    velocity += (Math.random() - 0.5) * 0.1;
    event.velocity = Math.max(0.3, Math.min(1.0, velocity));
  }
}

// Generate just the chord progression
export function generateProgressionForRiff(config: GeneratorConfig): string[] {
  const allowedChords = config.difficulty
    ? getAllowedChordsForDifficulty(config.difficulty)
    : undefined;

  return generateProgression(
    config.mood,
    config.numBars ?? 4,
    config.bluesyFeel,
    config.energy,
    allowedChords
  );
}

// Generate melody layer only
export function generateMelodyLayer(
  progression: string[],
  config: GeneratorConfig
): TabEvent[] {
  const events: TabEvent[] = [];

  // Initialize phrase and motif for melodic continuity
  initializePhrase(config.mood);
  const motif = generateMotif(config.complexity);

  // Get maxFret from difficulty config
  const maxFret = config.difficulty
    ? getDifficultyConfig(config.difficulty).maxFret
    : 12;

  let lastNote: { string: any; fret: number } | null = null;

  for (let barIndex = 0; barIndex < progression.length; barIndex++) {
    const chord = progression[barIndex];
    const treble = getChordTrebleForComplexity(chord, config.complexity, maxFret);

    // Get phrase config for musical structure
    const phraseConfig = getPhraseConfig(barIndex, progression.length, config.mood);

    // Determine number of melody notes (simpler = fewer), capped by difficulty
    const diffConfig = config.difficulty
      ? getDifficultyConfig(config.difficulty)
      : null;
    const maxMelody = diffConfig?.maxMelodyNotesPerBar ?? 8;
    const numNotes = Math.min(
      config.complexity <= 2 ? 2 : config.complexity <= 3 ? 3 : 4,
      maxMelody
    );

    // Get melodic target and generate line
    const melodicTarget = getMelodicTarget(treble, phraseConfig, lastNote);
    const melodicLine = generateMelodicLine(treble, phraseConfig, numNotes, lastNote);

    // Check for motif notes
    let motifNotes: { note: { string: any; fret: number }; step: number }[] | null = null;
    if (shouldUseMotif(barIndex, config.complexity)) {
      const currentMotif = getCurrentMotif();
      if (currentMotif) {
        // Pick variation by bar position
        let variedMotif: Motif;
        switch (barIndex) {
          case 0: variedMotif = currentMotif; break;
          case 1: variedMotif = Math.random() < 0.5 ? currentMotif : varyMotif(currentMotif, 'retrograde'); break;
          case 2: variedMotif = varyMotif(currentMotif, 'invert'); break;
          default: variedMotif = currentMotif;
        }
        const chordRoot = CHORD_ROOTS[chord] || 48;
        const transposed = transposeMotifToChord(variedMotif, chordRoot, 4, 'G');
        if (transposed.length > 0) motifNotes = transposed;
      }
    }

    // Melody positions - beats 2 and 4 are primary (steps 4 and 12)
    let positions = numNotes <= 2
      ? [4, 12]
      : numNotes <= 3
        ? [4, 8, 12]
        : [4, 6, 10, 12];

    // Enforce difficulty-based melody note cap
    if (positions.length > maxMelody) {
      positions = positions.slice(0, maxMelody);
    }

    const offset = barIndex * 16;
    const usedMotifSteps = new Set<number>();

    // Place motif notes first
    if (motifNotes) {
      for (const mn of motifNotes) {
        const step = mn.step + offset;
        events.push({
          string: mn.note.string,
          fret: mn.note.fret,
          step,
          duration: 2,
          layer: 'melody',
        });
        lastNote = mn.note;
        usedMotifSteps.add(mn.step); // Track local step (0-15)
      }
    }

    // Fill remaining positions with melodic line
    let melodicIdx = 0;
    for (const pos of positions) {
      if (usedMotifSteps.has(pos)) continue;
      if (melodicIdx >= melodicLine.length) break;

      const step = pos + offset;
      const note = melodicLine[melodicIdx];
      melodicIdx++;

      // For resolution, use target
      const useNote = (phraseConfig.isResolution && melodicIdx === melodicLine.length)
        ? melodicTarget
        : note;

      events.push({
        string: useNote.string,
        fret: useNote.fret,
        step,
        duration: 2,
        layer: 'melody',
      });

      lastNote = useNote;
    }
  }

  // Assign velocity dynamics for melody layer
  assignLayerVelocity(events, 'melody', config.mood);

  return events;
}

// Generate bass layer only
export function generateBassLayer(
  progression: string[],
  config: GeneratorConfig
): TabEvent[] {
  const events: TabEvent[] = [];

  for (let barIndex = 0; barIndex < progression.length; barIndex++) {
    const chord = progression[barIndex];
    const bass = getChordBass(chord);
    const altBass = getChordAltBass(chord);

    const offset = barIndex * 16;

    // Alternating bass - the foundation of fingerstyle
    // Root on beat 1 (step 0)
    events.push({
      string: bass.string,
      fret: bass.fret,
      step: offset + 0,
      duration: 2,
      layer: 'bass',
    });

    // 5th on beat 3 (step 8)
    events.push({
      string: altBass.string,
      fret: altBass.fret,
      step: offset + 8,
      duration: 2,
      layer: 'bass',
    });

    // Optional: add more bass movement for higher complexity
    if (config.bassMovement >= 4) {
      // Add bass on beat 2 occasionally
      if (Math.random() < 0.3) {
        events.push({
          string: bass.string,
          fret: bass.fret,
          step: offset + 4,
          duration: 1,
          layer: 'bass',
        });
      }
    }
  }

  // Assign velocity dynamics for bass layer
  assignLayerVelocity(events, 'bass', config.mood);

  return events;
}

// Generate fills/ornaments layer
export function generateFillsLayer(
  progression: string[],
  config: GeneratorConfig,
  existingMelody: TabEvent[],
  existingBass: TabEvent[]
): TabEvent[] {
  const events: TabEvent[] = [];

  // Track used positions
  const usedPositions = new Set<string>();
  for (const e of [...existingMelody, ...existingBass]) {
    usedPositions.add(`${e.string}:${e.step}`);
  }

  // Get maxFret from difficulty config
  const maxFret = config.difficulty
    ? getDifficultyConfig(config.difficulty).maxFret
    : 12;

  for (let barIndex = 0; barIndex < progression.length; barIndex++) {
    const chord = progression[barIndex];
    const treble = getChordTrebleForComplexity(chord, config.complexity, maxFret);
    const offset = barIndex * 16;

    // Find melody notes in this bar for reference
    const barMelody = existingMelody.filter(
      e => e.step >= offset && e.step < offset + 16
    );

    // Add passing tones and neighbor notes
    if (config.complexity >= 3) {
      // Steps that could have fills (between melody notes)
      const fillPositions = [2, 6, 10, 14];

      for (const pos of fillPositions) {
        const step = offset + pos;
        const key = (s: string) => `${s}:${step}`;

        // Check if position is free on treble strings
        const freeNotes = treble.filter(n => !usedPositions.has(key(n.string)));

        if (freeNotes.length > 0 && Math.random() < 0.3 * (config.complexity / 5)) {
          // Find a note that connects well
          const prevMelody = barMelody.filter(m => m.step < step).pop();
          const nextMelody = barMelody.filter(m => m.step > step)[0];

          let fillNote = freeNotes[0];

          // Prefer notes between prev and next melody
          if (prevMelody && nextMelody) {
            const prevPitch = getAbsolutePitch({ string: prevMelody.string, fret: prevMelody.fret });
            const nextPitch = getAbsolutePitch({ string: nextMelody.string, fret: nextMelody.fret });
            const targetPitch = (prevPitch + nextPitch) / 2;

            // Find closest to target
            fillNote = freeNotes.reduce((best, note) => {
              const bestDist = Math.abs(getAbsolutePitch(best) - targetPitch);
              const noteDist = Math.abs(getAbsolutePitch(note) - targetPitch);
              return noteDist < bestDist ? note : best;
            }, freeNotes[0]);
          }

          events.push({
            string: fillNote.string,
            fret: fillNote.fret,
            step,
            duration: 1,
            layer: 'fills',
          });

          usedPositions.add(key(fillNote.string));
        }
      }
    }

    // Add hammer-ons/pull-offs for higher complexity
    if (config.complexity >= 4) {
      for (const melodyNote of barMelody) {
        if (Math.random() < 0.25 && melodyNote.fret >= 2) {
          const graceStep = melodyNote.step - 1;
          const graceKey = `${melodyNote.string}:${graceStep}`;

          if (!usedPositions.has(graceKey) && graceStep >= offset) {
            // Add grace note for hammer-on with technique marker
            events.push({
              string: melodyNote.string,
              fret: melodyNote.fret - 2,
              step: graceStep,
              duration: 1,
              layer: 'fills',
              technique: 'hammer',
            });

            usedPositions.add(graceKey);
          }
        }
      }
    }
  }

  // Assign velocity dynamics for fills layer
  assignLayerVelocity(events, 'fills', config.mood);

  return events;
}

// Combine all layers into final events
export function combineLayers(layers: LayerState): TabEvent[] {
  const all: TabEvent[] = [];

  if (layers.melody) all.push(...layers.melody);
  if (layers.bass) all.push(...layers.bass);
  if (layers.fills) all.push(...layers.fills);

  // Sort by step for proper playback
  return all.sort((a, b) => a.step - b.step);
}

// Create initial layer state
export function createInitialLayerState(baseComplexity: number = 3): LayerState {
  return {
    melody: null,
    bass: null,
    fills: null,
    currentLayer: 'melody',
    isLayerApproved: {
      melody: false,
      bass: false,
      fills: false,
    },
    layerComplexity: {
      melody: baseComplexity,
      bass: baseComplexity,
      fills: baseComplexity,
    },
    layerMuted: {
      melody: false,
      bass: false,
      fills: false,
    },
    layerLocked: {
      melody: false,
      bass: false,
      fills: false,
    },
  };
}

// Get next layer to work on
export function getNextLayer(current: RiffLayer): RiffLayer | null {
  switch (current) {
    case 'melody':
      return 'bass';
    case 'bass':
      return 'fills';
    case 'fills':
      return null; // All done
    default:
      return 'melody';
  }
}

// Check if all layers are complete
export function areAllLayersComplete(layers: LayerState): boolean {
  return layers.isLayerApproved.melody &&
         layers.isLayerApproved.bass &&
         layers.isLayerApproved.fills;
}
