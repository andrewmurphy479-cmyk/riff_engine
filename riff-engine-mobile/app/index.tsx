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
    setMood,
    setStyle,
    setDifficulty,
    setPlaybackState,
    generateNewRiff,
  } = useRiffStore();

  // Use the new audio engine
  const audioEngine = useAudioEngine({
    onPlaybackStart: () => setPlaybackState('playing'),
    onPlaybackEnd: () => setPlaybackState('stopped'),
  });

  // Generate initial riff on mount
  useEffect(() => {
    if (!currentRiff) {
      generateNewRiff();
    }
  }, []);

  // Auto-regenerate on parameter changes (with debounce)
  useEffect(() => {
    if (!currentRiff) return;
    if (isAutoRegeneratingRef.current) return;

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
  }, [mood, style, tempo, bassMovement, bluesyFeel, complexity, energy, difficulty]);

  const handlePlay = useCallback(() => {
    if (currentRiff) {
      audioEngine.play(currentRiff.events, currentRiff.tempo);
    }
  }, [currentRiff, audioEngine]);

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

        {/* Tab Display */}
        <TabDisplay
          events={currentRiff?.events || []}
          progression={currentRiff?.progression || []}
        />

        {/* Progression Info */}
        {currentRiff && (
          <View style={styles.infoBar}>
            <Text style={styles.infoText}>
              {currentRiff.progression.join(' -> ')}
            </Text>
            <Text style={styles.tempoText}>{currentRiff.tempo} BPM</Text>
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
        disabled={!currentRiff}
      />

      {/* Export Modal */}
      <ExportModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        events={currentRiff?.events || []}
        tempo={currentRiff?.tempo || 100}
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
