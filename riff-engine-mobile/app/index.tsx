import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MoodSelector } from '../components/MoodSelector';
import { StyleSelector } from '../components/StyleSelector';
import { DifficultySelector } from '../components/DifficultySelector';
import { KnobPanel } from '../components/KnobPanel';
import { TabDisplay } from '../components/TabDisplay';
import { PlaybackControls } from '../components/PlaybackControls';
import { ExportModal } from '../components/ExportModal';
import { LayerBuilder } from '../components/LayerBuilder';
import { ModeSelector } from '../components/ModeSelector';
import { useAudioEngine } from '../audio/AudioEngine';
import { useRiffStore } from '../store/useRiffStore';
import { getAllowedStylesForDifficulty } from '../engine/difficulty';
import { colors, spacing, typography } from '../theme/colors';

export default function HomeScreen() {
  const router = useRouter();
  const isAutoRegeneratingRef = useRef(false);
  const handlePlayRef = useRef<() => void>(() => {});
  const stoppingRef = useRef(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const {
    mood,
    style,
    difficulty,
    tempo,
    bassMovement,
    bluesyFeel,
    complexity,
    energy,
    numBars,
    currentRiff,
    playbackState,
    isLooping,
    isLayeredMode,
    progression,
    layers,
    setMood,
    setStyle,
    setDifficulty,
    setPlaybackState,
    toggleLooping,
    generateNewRiff,
    getCurrentLayerEvents,
    getAllLayerEvents,
    getPlayableLayerEvents,
  } = useRiffStore();

  // Keep a ref to isLooping so the onPlaybackEnd callback always sees current value
  const isLoopingRef = useRef(isLooping);
  isLoopingRef.current = isLooping;

  // Use the new audio engine
  const audioEngine = useAudioEngine({
    onPlaybackStart: () => setPlaybackState('playing'),
    onPlaybackEnd: () => {
      if (stoppingRef.current) {
        stoppingRef.current = false;
        setPlaybackState('stopped');
      } else if (isLoopingRef.current) {
        setTimeout(() => handlePlayRef.current(), 50);
      } else {
        setPlaybackState('stopped');
      }
    },
  });

  // Generate riff when entering Quick Riff mode (or on mount if already in it)
  useEffect(() => {
    if (!isLayeredMode) {
      generateNewRiff();
    }
  }, [isLayeredMode]);

  // Auto-regenerate on parameter changes (with debounce) - only in non-layered mode
  useEffect(() => {
    if (!currentRiff) return;
    if (isAutoRegeneratingRef.current) return;
    if (isLayeredMode) return; // Don't auto-regenerate in layered mode

    isAutoRegeneratingRef.current = true;

    const timeoutId = setTimeout(() => {
      // Stop current playback if playing
      if (playbackState === 'playing') {
        audioEngine.stop();
      }
      generateNewRiff();
      isAutoRegeneratingRef.current = false;
    }, 300); // 300ms debounce for sliders

    return () => {
      clearTimeout(timeoutId);
      isAutoRegeneratingRef.current = false;
    };
  }, [mood, style, tempo, bassMovement, bluesyFeel, complexity, energy, numBars, difficulty, isLayeredMode]);

  const handlePlay = useCallback(() => {
    if (isLayeredMode && progression) {
      // Check if all layers are complete
      const allComplete = layers.isLayerApproved.melody &&
                          layers.isLayerApproved.bass &&
                          layers.isLayerApproved.fills;

      if (allComplete) {
        // Play with mute states respected
        const events = getPlayableLayerEvents();
        if (events.length > 0) {
          audioEngine.play(events, tempo);
        }
      } else {
        // Play current layer with approved layers for preview
        const events = getCurrentLayerEvents();
        if (events.length > 0) {
          audioEngine.play(events, tempo);
        }
      }
    } else if (currentRiff) {
      audioEngine.play(currentRiff.events, currentRiff.tempo);
    }
  }, [currentRiff, audioEngine, isLayeredMode, progression, layers, getCurrentLayerEvents, getPlayableLayerEvents, tempo]);

  // Keep ref in sync so onPlaybackEnd can call handlePlay
  handlePlayRef.current = handlePlay;

  const handleStop = useCallback(() => {
    stoppingRef.current = true;
    audioEngine.stop();
  }, [audioEngine]);

  const handleNewRiff = useCallback(() => {
    // Stop current playback if playing
    if (playbackState === 'playing') {
      handleStop();
    }
    generateNewRiff();
  }, [playbackState, handleStop, generateNewRiff]);

  const handleExport = useCallback(() => {
    // Stop playback before export
    if (playbackState === 'playing') {
      handleStop();
    }
    setShowExportModal(true);
  }, [playbackState, handleStop]);

  const openPresets = useCallback(() => {
    router.push('/presets');
  }, [router]);

  // Get allowed styles for current difficulty
  const allowedStyles = getAllowedStylesForDifficulty(difficulty);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Riff Engine</Text>
        <TouchableOpacity
          style={styles.presetsButton}
          onPress={openPresets}
          activeOpacity={0.7}
        >
          <Text style={styles.presetsButtonText}>Presets</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Mode Selector */}
        <ModeSelector />

        {/* Difficulty Selector */}
        <DifficultySelector selected={difficulty} onSelect={setDifficulty} />

        {/* Mood Selector */}
        <MoodSelector selected={mood} onSelect={setMood} />

        {/* Style Selector */}
        <StyleSelector
          selected={style}
          onSelect={setStyle}
          allowedStyles={allowedStyles}
        />

        {/* Customization Panel */}
        <KnobPanel />

        {/* Layer Builder (only in layered mode) */}
        {isLayeredMode && <LayerBuilder />}

        {/* Tab Display */}
        <TabDisplay
          events={isLayeredMode && progression ? getAllLayerEvents() : (currentRiff?.events || [])}
          progression={isLayeredMode && progression ? progression : (currentRiff?.progression || [])}
        />

        {/* Progression Info */}
        {(currentRiff || (isLayeredMode && progression)) && (
          <View style={styles.infoBar}>
            <Text style={styles.infoText}>
              {(isLayeredMode && progression ? progression : currentRiff?.progression)?.join(' -> ')}
            </Text>
            <Text style={styles.tempoText}>{tempo} BPM</Text>
          </View>
        )}
      </ScrollView>

      {/* Playback Controls */}
      <PlaybackControls
        isPlaying={playbackState === 'playing'}
        isLooping={isLooping}
        onPlay={handlePlay}
        onStop={handleStop}
        onNewRiff={handleNewRiff}
        onExport={handleExport}
        onToggleLoop={toggleLooping}
        disabled={!currentRiff && !(isLayeredMode && progression)}
        isLayeredMode={isLayeredMode}
      />

      {/* Export Modal */}
      <ExportModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        events={isLayeredMode && progression ? getAllLayerEvents() : (currentRiff?.events || [])}
        tempo={tempo}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  title: {
    fontSize: typography.h2.fontSize,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  presetsButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  presetsButtonText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  infoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: 12,
  },
  infoText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  tempoText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
});
