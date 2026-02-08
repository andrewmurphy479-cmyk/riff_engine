import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChipSelector } from './ui/ChipSelector';
import { Difficulty } from '../engine/types';
import { DIFFICULTIES, DIFFICULTY_CONFIGS } from '../engine/difficulty';
import { colors, spacing, typography } from '../theme/colors';

interface DifficultySelectorProps {
  selected: Difficulty;
  onSelect: (difficulty: Difficulty) => void;
}

const difficultyOptions = DIFFICULTIES.map((difficulty) => ({
  id: difficulty,
  label: DIFFICULTY_CONFIGS[difficulty].label,
}));

export function DifficultySelector({ selected, onSelect }: DifficultySelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Difficulty</Text>
      <ChipSelector
        options={difficultyOptions}
        selected={selected}
        onSelect={onSelect}
        horizontal
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
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
