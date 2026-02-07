import { Difficulty, Style } from './types';

export interface DifficultyConfig {
  id: Difficulty;
  label: string;
  tempoRange: [number, number];
  maxComplexity: number;
  allowedStyles: Style[];
  allowedChords: string[];
  maxFret: number;
  allowSyncopation: boolean;
  allowBassWalks: boolean;
  allowSwing: boolean;
  fillProbMult: number;      // 0.0-1.0, multiplier for fill probability
  ornamentProbMult: number;  // 0.0-1.0, multiplier for ornament probability
}

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  beginner: {
    id: 'beginner',
    label: 'Beginner',
    tempoRange: [60, 90],
    maxComplexity: 2,
    allowedStyles: ['travis', 'strum'],
    allowedChords: ['Am', 'C', 'G', 'D', 'Em'],
    maxFret: 3,
    allowSyncopation: false,
    allowBassWalks: false,
    allowSwing: false,
    fillProbMult: 0,
    ornamentProbMult: 0,
  },
  intermediate: {
    id: 'intermediate',
    label: 'Intermediate',
    tempoRange: [70, 120],
    maxComplexity: 4,
    allowedStyles: ['travis', 'strum', 'arpeggio'],
    allowedChords: ['Am', 'C', 'G', 'D', 'Em', 'A', 'E', 'Dm', 'F'],
    maxFret: 5,
    allowSyncopation: true,
    allowBassWalks: true,
    allowSwing: true,
    fillProbMult: 0.5,
    ornamentProbMult: 0.6,
  },
  advanced: {
    id: 'advanced',
    label: 'Advanced',
    tempoRange: [60, 160],
    maxComplexity: 5,
    allowedStyles: ['travis', 'strum', 'arpeggio', 'crosspicking'],
    allowedChords: ['Am', 'C', 'G', 'D', 'Em', 'A', 'E', 'Dm', 'F', 'B7'],
    maxFret: 12,
    allowSyncopation: true,
    allowBassWalks: true,
    allowSwing: true,
    fillProbMult: 1.0,
    ornamentProbMult: 1.0,
  },
};

export const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced'];

export function getDifficultyConfig(difficulty: Difficulty): DifficultyConfig {
  return DIFFICULTY_CONFIGS[difficulty];
}

export function getTempoRangeForDifficulty(difficulty: Difficulty): [number, number] {
  return DIFFICULTY_CONFIGS[difficulty].tempoRange;
}

export function getMaxComplexityForDifficulty(difficulty: Difficulty): number {
  return DIFFICULTY_CONFIGS[difficulty].maxComplexity;
}

export function getAllowedStylesForDifficulty(difficulty: Difficulty): Style[] {
  return DIFFICULTY_CONFIGS[difficulty].allowedStyles;
}

export function getAllowedChordsForDifficulty(difficulty: Difficulty): string[] {
  return DIFFICULTY_CONFIGS[difficulty].allowedChords;
}

export function isStyleAllowedForDifficulty(style: Style, difficulty: Difficulty): boolean {
  return DIFFICULTY_CONFIGS[difficulty].allowedStyles.includes(style);
}

export function isChordAllowedForDifficulty(chord: string, difficulty: Difficulty): boolean {
  return DIFFICULTY_CONFIGS[difficulty].allowedChords.includes(chord);
}

// Clamp tempo to difficulty range
export function clampTempoForDifficulty(tempo: number, difficulty: Difficulty): number {
  const [min, max] = DIFFICULTY_CONFIGS[difficulty].tempoRange;
  return Math.max(min, Math.min(max, tempo));
}

// Clamp complexity to difficulty max
export function clampComplexityForDifficulty(complexity: number, difficulty: Difficulty): number {
  const maxComplexity = DIFFICULTY_CONFIGS[difficulty].maxComplexity;
  return Math.min(complexity, maxComplexity);
}
