import { TabEvent, GeneratorConfig, GeneratedRiff, Mood, Style, Difficulty } from './types';
import { generateProgression } from './progressions';
import { STYLE_FUNCTIONS, applyBassWalk, applyFill, applyOrnaments, resetVoiceLeading, initializeMotif, BarConfig } from './styles';
import { GuitarString } from './types';
import {
  getDifficultyConfig,
  clampTempoForDifficulty,
  clampComplexityForDifficulty,
  getAllowedChordsForDifficulty,
} from './difficulty';

// Mood configurations for tempo ranges
const MOOD_TEMPO: Record<Mood, [number, number]> = {
  uplifting: [95, 135],
  sad: [70, 105],
  mysterious: [80, 115],
  nostalgic: [72, 102],
  gritty: [92, 130],
  cinematic: [60, 92],
  driving: [110, 160],
  dreamy: [68, 98],
  tense: [78, 120],
  soulful: [78, 120],
};

// Build internal config from GeneratorConfig
function buildBarConfig(config: GeneratorConfig, barPosition: number = 0, totalBars: number = 4): BarConfig {
  // Density based on energy and complexity
  const density = Math.max(0.55, Math.min(1.45, 0.75 + 0.1 * config.energy));

  return {
    density,
    complexity: config.complexity,
    bassMovement: config.bassMovement,
    melody: Math.round((config.complexity + config.energy) / 2),
    openStrings: 3, // Default middle value
    energy: config.energy,
    barPosition,
    totalBars,
    mood: config.mood,
  };
}

// Generate events for a full progression
function generateEventsForProgression(
  progression: string[],
  style: Style,
  config: GeneratorConfig
): TabEvent[] {
  const barFn = STYLE_FUNCTIONS[style];
  const outEvents: TabEvent[] = [];

  // Reset voice leading and initialize new motif/phrase for this riff
  resetVoiceLeading();
  initializeMotif(config.complexity, config.mood);

  for (let barIndex = 0; barIndex < progression.length; barIndex++) {
    const chord = progression[barIndex];
    const nextChord = progression[(barIndex + 1) % progression.length];
    // Build config with bar position for dynamic contrast
    const barConfig = buildBarConfig(config, barIndex, progression.length);
    const barEvents = barFn(chord, barConfig);

    // Track used slots for fills/bass-walks
    const used = new Set<string>();
    for (const ev of barEvents) {
      used.add(`${ev.string}:${ev.step}`);
    }

    const prevChord = barIndex > 0 ? progression[barIndex - 1] : progression[progression.length - 1];

    // Apply bass walk (leads INTO this bar from previous)
    applyBassWalk(barEvents, used, prevChord, chord, barConfig);

    // Apply fills (leads OUT of this bar to next) - now with next chord awareness
    applyFill(barEvents, used, chord, barConfig, nextChord);

    // Apply ornaments (hammer-ons, pull-offs) for higher complexity
    applyOrnaments(barEvents, barConfig);

    // Offset events to correct bar position
    const offset = barIndex * 16;
    for (const ev of barEvents) {
      outEvents.push({
        string: ev.string,
        fret: ev.fret,
        step: ev.step + offset,
        duration: ev.duration,
        technique: ev.technique, // Preserve ornament markers
      });
    }
  }

  // Apply swing feel based on mood
  const swungEvents = applySwing(outEvents, config.mood, config.bluesyFeel);

  return swungEvents;
}

// Get random tempo within mood's range
function getTempoForMood(mood: Mood, preferredTempo?: number): number {
  const [min, max] = MOOD_TEMPO[mood];
  if (preferredTempo && preferredTempo >= min && preferredTempo <= max) {
    return preferredTempo;
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Moods that benefit from swing feel
const SWING_MOODS: Partial<Record<Mood, number>> = {
  soulful: 0.7,      // Strong swing
  nostalgic: 0.4,    // Light swing
  dreamy: 0.3,       // Subtle swing
  gritty: 0.5,       // Medium swing (bluesy)
  cinematic: 0.2,    // Very subtle
};

// Apply swing/shuffle feel to events
// Swing shifts the "and" beats (positions 2, 6, 10, 14 in each bar) later
function applySwing(events: TabEvent[], mood: Mood, bluesyFeel: number): TabEvent[] {
  const swingAmount = SWING_MOODS[mood] || 0;

  // Bluesy feel increases swing
  const effectiveSwing = swingAmount + (bluesyFeel - 1) * 0.1;

  if (effectiveSwing < 0.15) {
    return events; // Not enough swing to bother
  }

  // Steps that get swung (the "and" of each beat in 16th note resolution)
  // In a bar: 2, 6, 10, 14 are the off-beat 8th notes
  const swungSteps = new Set([2, 6, 10, 14]);

  return events.map(event => {
    const stepInBar = event.step % 16;

    if (swungSteps.has(stepInBar)) {
      // Apply swing: shift step by 1 (from 2 to 3, 6 to 7, etc.)
      // But only if we randomly decide to swing this note
      if (Math.random() < effectiveSwing) {
        return {
          ...event,
          step: event.step + 1,
        };
      }
    }

    return event;
  });
}

// Main generator function
export function generateRiff(config: GeneratorConfig, difficulty?: Difficulty): GeneratedRiff {
  // Apply difficulty constraints if specified
  let effectiveConfig = { ...config };
  let allowedChords: string[] | undefined;

  if (difficulty) {
    effectiveConfig.tempo = clampTempoForDifficulty(config.tempo, difficulty);
    effectiveConfig.complexity = clampComplexityForDifficulty(config.complexity, difficulty);
    allowedChords = getAllowedChordsForDifficulty(difficulty);
  }

  // Get tempo (use provided or generate from mood)
  const tempo = effectiveConfig.tempo > 0
    ? effectiveConfig.tempo
    : getTempoForMood(effectiveConfig.mood);

  // Generate progression
  const progression = generateProgression(
    effectiveConfig.mood,
    4, // 4 bars
    effectiveConfig.bluesyFeel,
    effectiveConfig.energy,
    allowedChords
  );

  // Generate events
  const events = generateEventsForProgression(
    progression,
    effectiveConfig.style,
    effectiveConfig
  );

  return {
    progression,
    events,
    tempo,
    config: { ...effectiveConfig, tempo },
  };
}

// Get tempo range for a mood
export function getTempoRange(mood: Mood): [number, number] {
  return MOOD_TEMPO[mood];
}

// Available moods
export const MOODS: Mood[] = [
  'uplifting',
  'sad',
  'mysterious',
  'nostalgic',
  'gritty',
  'cinematic',
  'driving',
  'dreamy',
  'tense',
  'soulful',
];

// Available styles
export const STYLES: { id: Style; label: string }[] = [
  { id: 'travis', label: 'Travis' },
  { id: 'arpeggio', label: 'Arpeggio' },
  { id: 'crosspicking', label: 'Crosspick' },
  { id: 'strum', label: 'Strum' },
];
