import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChipSelector } from './ui/ChipSelector';
import { Mood } from '../engine/types';
import { MOODS } from '../engine/generator';
import { colors, spacing, typography } from '../theme/colors';

interface MoodSelectorProps {
  selected: Mood;
  onSelect: (mood: Mood) => void;
}

// Capitalize first letter
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const moodOptions = MOODS.map((mood) => ({
  id: mood,
  label: capitalize(mood),
}));

export function MoodSelector({ selected, onSelect }: MoodSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Mood</Text>
      <ChipSelector
        options={moodOptions}
        selected={selected}
        onSelect={onSelect}
        horizontal
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.small.fontSize,
    fontWeight: '600',
    marginBottom: spacing.sm,
    marginLeft: spacing.lg,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
