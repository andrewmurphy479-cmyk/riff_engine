import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChipSelector } from './ui/ChipSelector';
import { Style } from '../engine/types';
import { STYLES } from '../engine/generator';
import { colors, spacing, typography } from '../theme/colors';

interface StyleSelectorProps {
  selected: Style;
  onSelect: (style: Style) => void;
  allowedStyles?: Style[];
}

export function StyleSelector({ selected, onSelect, allowedStyles }: StyleSelectorProps) {
  const styleOptions = useMemo(() => {
    const availableStyles = allowedStyles
      ? STYLES.filter((style) => allowedStyles.includes(style.id))
      : STYLES;

    return availableStyles.map((style) => ({
      id: style.id,
      label: style.label,
    }));
  }, [allowedStyles]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Style</Text>
      <ChipSelector
        options={styleOptions}
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
