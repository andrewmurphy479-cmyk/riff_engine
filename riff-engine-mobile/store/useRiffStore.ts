import { create } from 'zustand';
import { Mood, Style, Difficulty, GeneratedRiff, GeneratorConfig, PlaybackState, Preset } from '../engine/types';
import { generateRiff, getTempoRange } from '../engine/generator';
import {
  getDifficultyConfig,
  clampTempoForDifficulty,
  clampComplexityForDifficulty,
  isStyleAllowedForDifficulty,
} from '../engine/difficulty';

interface RiffState {
  // Current settings
  mood: Mood;
  style: Style;
  difficulty: Difficulty;
  tempo: number;
  bassMovement: number;
  bluesyFeel: number;
  complexity: number;
  energy: number;

  // Generated riff
  currentRiff: GeneratedRiff | null;

  // Playback
  playbackState: PlaybackState;

  // UI state
  isCustomizeExpanded: boolean;
  selectedPresetId: string | null;

  // Actions
  setMood: (mood: Mood) => void;
  setStyle: (style: Style) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  setTempo: (tempo: number) => void;
  setBassMovement: (value: number) => void;
  setBluesyFeel: (value: number) => void;
  setComplexity: (value: number) => void;
  setEnergy: (value: number) => void;
  setPlaybackState: (state: PlaybackState) => void;
  setCustomizeExpanded: (expanded: boolean) => void;
  toggleCustomizeExpanded: () => void;
  generateNewRiff: () => void;
  applyPreset: (preset: Preset) => void;
  getConfig: () => GeneratorConfig;
}

export const useRiffStore = create<RiffState>((set, get) => ({
  // Default settings
  mood: 'nostalgic',
  style: 'travis',
  difficulty: 'intermediate',
  tempo: 95,
  bassMovement: 3,
  bluesyFeel: 3,
  complexity: 3,
  energy: 3,

  // Initial state
  currentRiff: null,
  playbackState: 'stopped',
  isCustomizeExpanded: false,
  selectedPresetId: null,

  // Setters
  setMood: (mood) => {
    const [min, max] = getTempoRange(mood);
    const currentTempo = get().tempo;
    // Adjust tempo if outside new mood's range
    const tempo = currentTempo < min ? min : currentTempo > max ? max : currentTempo;
    set({ mood, tempo, selectedPresetId: null });
  },

  setStyle: (style) => set({ style, selectedPresetId: null }),

  setDifficulty: (difficulty) => {
    const state = get();
    const config = getDifficultyConfig(difficulty);

    // Clamp tempo to new difficulty range
    const tempo = clampTempoForDifficulty(state.tempo, difficulty);

    // Clamp complexity to new difficulty max
    const complexity = clampComplexityForDifficulty(state.complexity, difficulty);

    // Reset style if not allowed for new difficulty
    const style = isStyleAllowedForDifficulty(state.style, difficulty)
      ? state.style
      : config.allowedStyles[0];

    set({ difficulty, tempo, complexity, style, selectedPresetId: null });
  },

  setTempo: (tempo) => set({ tempo, selectedPresetId: null }),

  setBassMovement: (bassMovement) => set({ bassMovement, selectedPresetId: null }),

  setBluesyFeel: (bluesyFeel) => set({ bluesyFeel, selectedPresetId: null }),

  setComplexity: (complexity) => set({ complexity, selectedPresetId: null }),

  setEnergy: (energy) => set({ energy, selectedPresetId: null }),

  setPlaybackState: (playbackState) => set({ playbackState }),

  setCustomizeExpanded: (isCustomizeExpanded) => set({ isCustomizeExpanded }),

  toggleCustomizeExpanded: () => set((state) => ({ isCustomizeExpanded: !state.isCustomizeExpanded })),

  // Generate new riff with current settings
  generateNewRiff: () => {
    const state = get();
    const config: GeneratorConfig = {
      mood: state.mood,
      style: state.style,
      tempo: state.tempo,
      bassMovement: state.bassMovement,
      bluesyFeel: state.bluesyFeel,
      complexity: state.complexity,
      energy: state.energy,
    };

    const riff = generateRiff(config);
    set({ currentRiff: riff });
  },

  // Apply a preset
  applyPreset: (preset) => {
    set({
      mood: preset.mood,
      style: preset.style,
      tempo: preset.tempo,
      bassMovement: preset.bass,
      bluesyFeel: preset.blues,
      complexity: preset.complexity,
      energy: preset.energy,
      selectedPresetId: preset.id,
    });
    // Generate riff with new settings
    get().generateNewRiff();
  },

  // Get current config
  getConfig: () => {
    const state = get();
    return {
      mood: state.mood,
      style: state.style,
      tempo: state.tempo,
      bassMovement: state.bassMovement,
      bluesyFeel: state.bluesyFeel,
      complexity: state.complexity,
      energy: state.energy,
    };
  },
}));
