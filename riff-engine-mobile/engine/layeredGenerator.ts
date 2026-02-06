import { TabEvent, GeneratorConfig, RiffLayer, LayerState, LayeredRiff } from './types';
import { generateProgression } from './progressions';
import { getChordBass, getChordAltBass, getChordTrebleForComplexity } from './chords';
import {
  resetVoiceLeading,
  initializePhrase,
  getPhraseConfig,
  getMelodicTarget,
  generateMelodicLine,
  getAbsolutePitch,
} from './voiceLeading';

// Generate just the chord progression
export function generateProgressionForRiff(config: GeneratorConfig): string[] {
  return generateProgression(
    config.mood,
    4, // 4 bars
    config.bluesyFeel,
    config.energy
  );
}

// Generate melody layer only
export function generateMelodyLayer(
  progression: string[],
  config: GeneratorConfig
): TabEvent[] {
  const events: TabEvent[] = [];

  // Initialize phrase for melodic continuity
  initializePhrase(config.mood);

  let lastNote: { string: any; fret: number } | null = null;

  for (let barIndex = 0; barIndex < progression.length; barIndex++) {
    const chord = progression[barIndex];
    const treble = getChordTrebleForComplexity(chord, config.complexity);

    // Get phrase config for musical structure
    const phraseConfig = getPhraseConfig(barIndex, progression.length, config.mood);

    // Determine number of melody notes (simpler = fewer)
    const numNotes = config.complexity <= 2 ? 2 : config.complexity <= 3 ? 3 : 4;

    // Get melodic target and generate line
    const melodicTarget = getMelodicTarget(treble, phraseConfig, lastNote);
    const melodicLine = generateMelodicLine(treble, phraseConfig, numNotes, lastNote);

    // Melody positions - beats 2 and 4 are primary (steps 4 and 12)
    const positions = numNotes <= 2
      ? [4, 12]
      : numNotes <= 3
        ? [4, 8, 12]
        : [4, 6, 10, 12];

    // Place melody notes
    for (let i = 0; i < Math.min(melodicLine.length, positions.length); i++) {
      const step = positions[i] + barIndex * 16;
      const note = melodicLine[i];

      // For resolution, use target
      const useNote = (phraseConfig.isResolution && i === melodicLine.length - 1)
        ? melodicTarget
        : note;

      events.push({
        string: useNote.string,
        fret: useNote.fret,
        step,
        duration: 2,
      });

      lastNote = useNote;
    }
  }

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
    });

    // 5th on beat 3 (step 8)
    events.push({
      string: altBass.string,
      fret: altBass.fret,
      step: offset + 8,
      duration: 2,
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
        });
      }
    }
  }

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

  for (let barIndex = 0; barIndex < progression.length; barIndex++) {
    const chord = progression[barIndex];
    const treble = getChordTrebleForComplexity(chord, config.complexity);
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
            // Add grace note for hammer-on
            events.push({
              string: melodyNote.string,
              fret: melodyNote.fret - 2,
              step: graceStep,
              duration: 1,
            });

            // Mark the melody note as having a technique
            melodyNote.technique = 'hammer';
            usedPositions.add(graceKey);
          }
        }
      }
    }
  }

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
export function createInitialLayerState(): LayerState {
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
