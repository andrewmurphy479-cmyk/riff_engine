import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius } from '../theme/colors';

interface PlaybackControlsProps {
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  onNewRiff: () => void;
  onExport: () => void;
  disabled?: boolean;
}

export function PlaybackControls({
  isPlaying,
  onPlay,
  onStop,
  onNewRiff,
  onExport,
  disabled = false,
}: PlaybackControlsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        {/* Play/Stop Button */}
        <TouchableOpacity
          style={[styles.playButton, isPlaying && styles.playButtonActive]}
          onPress={isPlaying ? onStop : onPlay}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text style={styles.playIcon}>{isPlaying ? '■' : '▶'}</Text>
          <Text style={styles.playText}>{isPlaying ? 'Stop' : 'Play'}</Text>
        </TouchableOpacity>

        {/* Export Button */}
        <TouchableOpacity
          style={styles.exportButton}
          onPress={onExport}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text style={styles.exportIcon}>↗</Text>
          <Text style={styles.exportText}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* New Riff Button */}
      <TouchableOpacity
        style={styles.newRiffButton}
        onPress={onNewRiff}
        activeOpacity={0.7}
      >
        <Text style={styles.newRiffIcon}>⟳</Text>
        <Text style={styles.newRiffText}>Generate New Riff</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  topRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  playButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 56,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.lg,
  },
  playButtonActive: {
    backgroundColor: colors.error,
  },
  playIcon: {
    color: colors.white,
    fontSize: 16,
  },
  playText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '800',
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 56,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  exportIcon: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '700',
  },
  exportText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  newRiffButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 48,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  newRiffIcon: {
    color: colors.textPrimary,
    fontSize: 18,
  },
  newRiffText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
});
