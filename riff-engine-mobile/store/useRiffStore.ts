import { create } from 'zustand';
import { Mood, Style, Difficulty, GeneratedRiff, GeneratorConfig, PlaybackState, Preset, RiffLayer, LayerState, TabEvent } from '../engine/types';
import { generateRiff, getTempoRange } from '../engine/generator';
import {
  getDifficultyConfig,
  clampTempoForDifficulty,
  clampComplexityForDifficulty,
  isStyleAllowedForDifficulty,
} from '../engine/difficulty';
import {
  generateProgressionForRiff,
  generateMelodyLayer,
  generateBassLayer,
  generateFillsLayer,
  combineLayers,
  createInitialLayerState,
  getNextLayer,
  areAllLayersComplete,
} from '../engine/layeredGenerator';

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

  // Generated riff (legacy full generation)
  currentRiff: GeneratedRiff | null;

  // Layered generation
  isLayeredMode: boolean;
  progression: string[] | null;
  layers: LayerState;

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

  // Layered generation actions
  setLayeredMode: (enabled: boolean) => void;
  startLayeredGeneration: () => void;
  generateCurrentLayer: () => void;
  regenerateCurrentLayer: () => void;
  approveCurrentLayer: () => void;
  goBackToLayer: (layer: RiffLayer) => void;
  setLayerComplexity: (layer: RiffLayer, complexity: number) => void;
  toggleLayerMute: (layer: RiffLayer) => void;
  toggleLayerLock: (layer: RiffLayer) => void;
  getCurrentLayerEvents: () => TabEvent[];
  getAllLayerEvents: () => TabEvent[];
  getPlayableLayerEvents: () => TabEvent[];
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

  // Layered generation state
  isLayeredMode: true, // Default to layered mode
  progression: null,
  layers: createInitialLayerState(),

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

  // Layered generation actions
  setLayeredMode: (enabled) => set({ isLayeredMode: enabled }),

  startLayeredGeneration: () => {
    const state = get();
    const config = state.getConfig();
    const oldLayers = state.layers;

    // Check what's locked
    const melodyLocked = oldLayers.layerLocked.melody && oldLayers.melody;
    const bassLocked = oldLayers.layerLocked.bass && oldLayers.bass;
    const fillsLocked = oldLayers.layerLocked.fills && oldLayers.fills;

    // If melody is locked, keep the old progression
    // Otherwise generate a new one
    const progression = melodyLocked && state.progression
      ? state.progression
      : generateProgressionForRiff(config);

    // Create new layer state, preserving complexity and lock settings
    const layers = createInitialLayerState(state.complexity);
    layers.layerComplexity = { ...oldLayers.layerComplexity };
    layers.layerLocked = { ...oldLayers.layerLocked };

    // Preserve locked layers
    if (melodyLocked) {
      layers.melody = oldLayers.melody;
      layers.isLayerApproved.melody = true;
    }
    if (bassLocked) {
      layers.bass = oldLayers.bass;
      layers.isLayerApproved.bass = true;
    }
    if (fillsLocked) {
      layers.fills = oldLayers.fills;
      layers.isLayerApproved.fills = true;
    }

    // Find first unlocked layer to start with
    const layerOrder: RiffLayer[] = ['melody', 'bass', 'fills'];
    let startLayer: RiffLayer = 'melody';
    for (const layer of layerOrder) {
      if (!layers.isLayerApproved[layer]) {
        startLayer = layer;
        break;
      }
    }
    layers.currentLayer = startLayer;

    // Generate the first unlocked layer
    const layerComplexity = layers.layerComplexity[startLayer];
    const layerConfig = { ...config, complexity: layerComplexity };

    if (startLayer === 'melody' && !melodyLocked) {
      layers.melody = generateMelodyLayer(progression, layerConfig);
    } else if (startLayer === 'bass' && !bassLocked) {
      layers.bass = generateBassLayer(progression, layerConfig);
    } else if (startLayer === 'fills' && !fillsLocked && layers.melody && layers.bass) {
      layers.fills = generateFillsLayer(progression, layerConfig, layers.melody, layers.bass);
    }

    set({
      progression,
      layers,
      currentRiff: null,
    });
  },

  generateCurrentLayer: () => {
    const state = get();
    if (!state.progression) return;

    const baseConfig = state.getConfig();
    const currentLayer = state.layers.currentLayer;

    // Use layer-specific complexity
    const layerComplexity = state.layers.layerComplexity[currentLayer];
    const config = { ...baseConfig, complexity: layerComplexity };

    let layerUpdate: Partial<LayerState> = {};

    switch (currentLayer) {
      case 'melody':
        layerUpdate.melody = generateMelodyLayer(state.progression, config);
        break;
      case 'bass':
        layerUpdate.bass = generateBassLayer(state.progression, config);
        break;
      case 'fills':
        if (state.layers.melody && state.layers.bass) {
          layerUpdate.fills = generateFillsLayer(
            state.progression,
            config,
            state.layers.melody,
            state.layers.bass
          );
        }
        break;
    }

    set({ layers: { ...state.layers, ...layerUpdate } });
  },

  regenerateCurrentLayer: () => {
    // Just regenerate the current layer
    get().generateCurrentLayer();
  },

  setLayerComplexity: (layer, complexity) => {
    const state = get();
    const layers = {
      ...state.layers,
      layerComplexity: {
        ...state.layers.layerComplexity,
        [layer]: complexity,
      },
    };
    set({ layers });
  },

  toggleLayerMute: (layer) => {
    const state = get();
    const layers = {
      ...state.layers,
      layerMuted: {
        ...state.layers.layerMuted,
        [layer]: !state.layers.layerMuted[layer],
      },
    };
    set({ layers });
  },

  toggleLayerLock: (layer) => {
    const state = get();
    const layers = {
      ...state.layers,
      layerLocked: {
        ...state.layers.layerLocked,
        [layer]: !state.layers.layerLocked[layer],
      },
    };
    set({ layers });
  },

  goBackToLayer: (layer) => {
    const state = get();
    const layerOrder: RiffLayer[] = ['melody', 'bass', 'fills'];
    const targetIndex = layerOrder.indexOf(layer);

    // Build new isLayerApproved, unapproving target and all subsequent layers
    const newApproved = { ...state.layers.isLayerApproved };
    for (let i = targetIndex; i < layerOrder.length; i++) {
      newApproved[layerOrder[i]] = false;
    }

    const layers = {
      ...state.layers,
      currentLayer: layer,
      isLayerApproved: newApproved,
    };

    // Clear the final riff since we're editing again
    set({ layers, currentRiff: null });
  },

  approveCurrentLayer: () => {
    const state = get();
    const layers = { ...state.layers };
    const currentLayer = layers.currentLayer;

    // Mark current layer as approved
    layers.isLayerApproved = {
      ...layers.isLayerApproved,
      [currentLayer]: true,
    };

    // Move to next layer
    const nextLayer = getNextLayer(currentLayer);

    if (nextLayer) {
      layers.currentLayer = nextLayer;

      // Auto-generate the next layer with its layer-specific complexity
      const baseConfig = state.getConfig();
      const layerComplexity = layers.layerComplexity[nextLayer];
      const config = { ...baseConfig, complexity: layerComplexity };

      switch (nextLayer) {
        case 'bass':
          layers.bass = generateBassLayer(state.progression!, config);
          break;
        case 'fills':
          if (layers.melody && layers.bass) {
            layers.fills = generateFillsLayer(
              state.progression!,
              config,
              layers.melody,
              layers.bass
            );
          }
          break;
      }
    }

    // If all layers complete, build the final riff
    if (areAllLayersComplete(layers)) {
      const allEvents = combineLayers(layers);
      const config = state.getConfig();

      set({
        layers,
        currentRiff: {
          progression: state.progression!,
          events: allEvents,
          tempo: config.tempo,
          config,
        },
      });
    } else {
      set({ layers });
    }
  },

  getCurrentLayerEvents: () => {
    const state = get();
    const layers = state.layers;
    const events: TabEvent[] = [];

    // Include approved layers for context during preview
    // This lets user hear how layers work together

    // Always include approved melody
    if (layers.isLayerApproved.melody && layers.melody) {
      events.push(...layers.melody);
    }

    // Include approved bass
    if (layers.isLayerApproved.bass && layers.bass) {
      events.push(...layers.bass);
    }

    // Add current layer being previewed (if not already included as approved)
    switch (layers.currentLayer) {
      case 'melody':
        if (!layers.isLayerApproved.melody && layers.melody) {
          events.push(...layers.melody);
        }
        break;
      case 'bass':
        if (!layers.isLayerApproved.bass && layers.bass) {
          events.push(...layers.bass);
        }
        break;
      case 'fills':
        if (layers.fills) {
          events.push(...layers.fills);
        }
        break;
    }

    // Sort by step for proper playback
    return events.sort((a, b) => a.step - b.step);
  },

  getAllLayerEvents: () => {
    const state = get();
    return combineLayers(state.layers);
  },

  // Get events respecting mute state (for playback)
  getPlayableLayerEvents: () => {
    const state = get();
    const layers = state.layers;
    const events: TabEvent[] = [];

    if (!layers.layerMuted.melody && layers.melody) {
      events.push(...layers.melody);
    }
    if (!layers.layerMuted.bass && layers.bass) {
      events.push(...layers.bass);
    }
    if (!layers.layerMuted.fills && layers.fills) {
      events.push(...layers.fills);
    }

    return events.sort((a, b) => a.step - b.step);
  },
}));
