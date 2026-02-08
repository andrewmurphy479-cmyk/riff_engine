import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRiffStore } from '../store/useRiffStore';
import { GenerationMode } from '../engine/types';
import { colors, spacing, borderRadius } from '../theme/colors';

const MODES: { key: GenerationMode; label: string }[] = [
  { key: 'quickRiff', label: 'Quick Riff' },
  { key: 'layerBuilder', label: 'Layer Builder' },
  { key: 'customChords', label: 'Custom Chords' },
];

export function ModeSelector() {
  const { generationMode, setGenerationMode } = useRiffStore();

  return (
    <View style={styles.container}>
      <View style={styles.segmentedControl}>
        {MODES.map(({ key, label }) => {
          const isActive = generationMode === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.segment, isActive && styles.segmentActive]}
              onPress={() => setGenerationMode(key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
  },
  segmentActive: {
    backgroundColor: colors.accent,
  },
  segmentText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.white,
  },
});
