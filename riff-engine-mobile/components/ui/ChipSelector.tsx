import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors, borderRadius, spacing } from '../../theme/colors';

interface ChipOption<T> {
  id: T;
  label: string;
}

interface ChipSelectorProps<T extends string> {
  options: ChipOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  horizontal?: boolean;
}

export function ChipSelector<T extends string>({
  options,
  selected,
  onSelect,
  horizontal = true,
}: ChipSelectorProps<T>) {
  const content = options.map((option) => {
    const isSelected = option.id === selected;
    return (
      <TouchableOpacity
        key={option.id}
        style={[styles.chip, isSelected && styles.chipSelected]}
        onPress={() => onSelect(option.id)}
        activeOpacity={0.7}
      >
        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
          {option.label}
        </Text>
      </TouchableOpacity>
    );
  });

  if (horizontal) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {content}
      </ScrollView>
    );
  }

  return <View style={styles.gridContainer}>{content}</View>;
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.chipInactive,
    borderWidth: 1,
    borderColor: colors.chipInactiveBorder,
  },
  chipSelected: {
    backgroundColor: colors.chipActive,
    borderColor: colors.chipActiveBorder,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: colors.accent,
  },
});
