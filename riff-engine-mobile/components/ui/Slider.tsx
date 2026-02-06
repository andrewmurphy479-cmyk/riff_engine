import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import RNSlider from '@react-native-community/slider';
import { colors, spacing, typography } from '../../theme/colors';

interface SliderProps {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  showValue?: boolean;
}

export function Slider({
  label,
  value,
  onValueChange,
  minimumValue = 1,
  maximumValue = 5,
  step = 1,
  showValue = true,
}: SliderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {showValue && <Text style={styles.value}>{value}</Text>}
      </View>
      <RNSlider
        style={styles.slider}
        value={value}
        onValueChange={onValueChange}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        step={step}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.card}
        thumbTintColor={colors.accent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
  },
  value: {
    color: colors.textMuted,
    fontSize: typography.small.fontSize,
    fontWeight: '600',
  },
  slider: {
    height: 40,
    marginHorizontal: -spacing.sm,
  },
});
