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
import { useAudioEngine } from '../audio/AudioEngine';
import { useRiffStore } from '../store/useRiffStore';
import { getAllowedStylesForDifficulty } from '../engine/difficulty';
import { colors, spacing, typography } from '../theme/colors';

export default function HomeScreen() {
  const router = useRouter();
  const isAutoRegeneratingRef = useRef(false);
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
    currentRiff,
    playbackState,
    isLayeredMode,
    progression,
    setMood,
    setStyle,
    setDifficulty,
    setPlaybackState,
    generateNewRiff,
    getCurrentLayerEvents,
    getAllLayerEvents,
  } = useRiffStore();

  // Use the new audio engine
  const audioEngine = useAudioEngine({
    onPlaybackStart: () => setPlaybackState('playing'),
    onPlaybackEnd: () => setPlaybackState('stopped'),
  });

  // Generate initial riff on mount (only in non-layered mode)
  useEffect(() => {
    if (!currentRiff && !isLayeredMode) {
      generateNewRiff();
    }
  }, []);

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
  }, [mood, style, tempo, bassMovement, bluesyFeel, complexity, energy, difficulty, isLayeredMode]);

  const handlePlay = useCallback(() => {
    if (isLayeredMode && progression) {
      // In layered mode, play current layer events
      const events = getCurrentLayerEvents();
      if (events.length > 0) {
        audioEngine.play(events, tempo);
      }
    } else if (currentRiff) {
      audioEngine.play(currentRiff.events, currentRiff.tempo);
    }
  }, [currentRiff, audioEngine, isLayeredMode, progression, getCurrentLayerEvents, tempo]);

  const handleStop = useCallback(() => {
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
        <LayerBuilder />

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
        onPlay={handlePlay}
        onStop={handleStop}
        onNewRiff={handleNewRiff}
        onExport={handleExport}
        disabled={!currentRiff && !(isLayeredMode && progression)}
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
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
