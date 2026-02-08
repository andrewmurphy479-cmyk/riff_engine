import { TabEvent, GeneratorConfig, RiffLayer, LayerState, LayeredRiff, Mood, NotePosition } from './types';
import { generateProgression } from './progressions';
import { getChordBass, getChordAltBass, getChordTrebleForComplexity } from './chords';
import { getMoodRhythm, BarConfig } from './styles';
import { getDifficultyConfig, getAllowedChordsForDifficulty } from './difficulty';
import { getAbsolutePitch } from './voiceLeading';
import { selectBlueprint, varyBlueprint } from './blueprints';
import { resolveBlueprintBass, resolveBlueprintTreble, findBlueprintGaps } from './blueprintResolver';

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

// Build bar config for layered generation
function buildLayerBarConfig(config: GeneratorConfig, barPosition: number, totalBars: number): BarConfig {
  const diffConfig = config.difficulty
    ? getDifficultyConfig(config.difficulty)
    : null;

  return {
    density: Math.max(0.55, Math.min(1.45, 0.75 + 0.1 * config.energy)),
    complexity: config.complexity,
    bassMovement: config.bassMovement,
    melody: Math.round((config.complexity + config.energy) / 2),
    openStrings: 3,
    energy: config.energy,
    barPosition,
    totalBars,
    mood: config.mood,
    maxFret: diffConfig?.maxFret ?? 12,
    allowSyncopation: diffConfig?.allowSyncopation ?? true,
    allowBassWalks: diffConfig?.allowBassWalks ?? true,
    fillProbMult: diffConfig?.fillProbMult ?? 1.0,
    ornamentProbMult: diffConfig?.ornamentProbMult ?? 1.0,
    maxMelodyNotesPerBar: diffConfig?.maxMelodyNotesPerBar ?? 8,
  };
}

// Generate melody layer using blueprint system
export function generateMelodyLayer(
  progression: string[],
  config: GeneratorConfig
): TabEvent[] {
  // Select a blueprint for melodic identity
  const blueprint = selectBlueprint(config.style, {
    energy: config.energy,
    complexity: config.complexity,
    mood: config.mood,
  });

  const allEvents: TabEvent[] = [];
  let lastNote: NotePosition | null = null;

  for (let barIndex = 0; barIndex < progression.length; barIndex++) {
    const chord = progression[barIndex];
    const nextChord = progression[(barIndex + 1) % progression.length];
    const barConfig = buildLayerBarConfig(config, barIndex, progression.length);
    const offset = barIndex * 16;

    // Vary blueprint for this bar position
    const variedBP = varyBlueprint(blueprint, barIndex, progression.length);

    // Resolve only treble notes for melody layer
    const result = resolveBlueprintTreble(
      variedBP, chord, barIndex, offset, barConfig, lastNote, nextChord
    );

    allEvents.push(...result.events);
    lastNote = result.lastNote;
  }

  // Assign velocity dynamics for melody layer
  assignLayerVelocity(allEvents, 'melody', config.mood);

  return allEvents;
}

// Generate bass layer using blueprint system
export function generateBassLayer(
  progression: string[],
  config: GeneratorConfig
): TabEvent[] {
  // Use same blueprint selection as melody for coherent bass pattern
  const blueprint = selectBlueprint(config.style, {
    energy: config.energy,
    complexity: config.complexity,
    mood: config.mood,
  });

  const allEvents: TabEvent[] = [];

  for (let barIndex = 0; barIndex < progression.length; barIndex++) {
    const chord = progression[barIndex];
    const barConfig = buildLayerBarConfig(config, barIndex, progression.length);
    const offset = barIndex * 16;

    const variedBP = varyBlueprint(blueprint, barIndex, progression.length);

    // Resolve only bass notes from blueprint
    const bassEvents = resolveBlueprintBass(variedBP, chord, barIndex, offset, barConfig);

    // Fallback: if blueprint has no bass notes, use alternating bass
    if (bassEvents.length === 0) {
      const bass = getChordBass(chord);
      const altBass = getChordAltBass(chord);
      allEvents.push({
        string: bass.string, fret: bass.fret,
        step: offset + 0, duration: 2, layer: 'bass',
      });
      allEvents.push({
        string: altBass.string, fret: altBass.fret,
        step: offset + 8, duration: 2, layer: 'bass',
      });
    } else {
      allEvents.push(...bassEvents);
    }
  }

  // Assign velocity dynamics for bass layer
  assignLayerVelocity(allEvents, 'bass', config.mood);

  return allEvents;
}

// Generate fills layer — places chord tones in blueprint gaps
export function generateFillsLayer(
  progression: string[],
  config: GeneratorConfig,
  existingMelody: TabEvent[],
  existingBass: TabEvent[]
): TabEvent[] {
  const events: TabEvent[] = [];

  // Track used positions from existing layers
  const usedPositions = new Set<string>();
  for (const e of [...existingMelody, ...existingBass]) {
    usedPositions.add(`${e.string}:${e.step}`);
  }

  const maxFret = config.difficulty
    ? getDifficultyConfig(config.difficulty).maxFret
    : 12;

  // Get the blueprint to find gaps
  const blueprint = selectBlueprint(config.style, {
    energy: config.energy,
    complexity: config.complexity,
    mood: config.mood,
  });

  for (let barIndex = 0; barIndex < progression.length; barIndex++) {
    const chord = progression[barIndex];
    const treble = getChordTrebleForComplexity(chord, config.complexity, maxFret);
    const offset = barIndex * 16;

    const variedBP = varyBlueprint(blueprint, barIndex, progression.length);

    // Find gaps in the blueprint (steps where no notes exist)
    const gaps = findBlueprintGaps(variedBP, offset);

    // Find melody notes in this bar for reference
    const barMelody = existingMelody.filter(
      e => e.step >= offset && e.step < offset + 16
    );

    // Place chord tones at gaps, scaled by complexity
    const fillProb = 0.2 * (config.complexity / 5);

    for (const step of gaps) {
      const key = (s: string) => `${s}:${step}`;
      const freeNotes = treble.filter(n => !usedPositions.has(key(n.string)));

      if (freeNotes.length > 0 && Math.random() < fillProb) {
        // Find a note that connects well between adjacent melody notes
        const prevMelody = barMelody.filter(m => m.step < step).pop();
        const nextMelody = barMelody.filter(m => m.step > step)[0];

        let fillNote = freeNotes[0];

        if (prevMelody && nextMelody) {
          const prevPitch = getAbsolutePitch({ string: prevMelody.string, fret: prevMelody.fret });
          const nextPitch = getAbsolutePitch({ string: nextMelody.string, fret: nextMelody.fret });
          const targetPitch = (prevPitch + nextPitch) / 2;

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
