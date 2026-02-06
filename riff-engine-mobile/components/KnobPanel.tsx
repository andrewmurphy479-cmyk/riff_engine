import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Card } from './ui/Card';
import { Slider } from './ui/Slider';
import { useRiffStore } from '../store/useRiffStore';
import { getTempoRange } from '../engine/generator';
import { colors, spacing, typography, borderRadius } from '../theme/colors';

export function KnobPanel() {
  const {
    mood,
    tempo,
    bassMovement,
    bluesyFeel,
    complexity,
    energy,
    setTempo,
    setBassMovement,
    setBluesyFeel,
    setComplexity,
    setEnergy,
    isCustomizeExpanded,
    toggleCustomizeExpanded,
  } = useRiffStore();

  const [minTempo, maxTempo] = getTempoRange(mood);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={toggleCustomizeExpanded}
        activeOpacity={0.7}
      >
        <Text style={styles.headerText}>Customize</Text>
        <Text style={styles.chevron}>
          {isCustomizeExpanded ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>

      {isCustomizeExpanded && (
        <Card style={styles.card}>
          <Slider
            label="Tempo"
            value={tempo}
            onValueChange={(v) => setTempo(Math.round(v))}
            minimumValue={minTempo}
            maximumValue={maxTempo}
            step={1}
          />
          <View style={styles.tempoHint}>
            <Text style={styles.tempoHintText}>{minTempo} BPM</Text>
            <Text style={styles.tempoValue}>{tempo} BPM</Text>
            <Text style={styles.tempoHintText}>{maxTempo} BPM</Text>
          </View>

          <View style={styles.divider} />

          <Slider
            label="More Bass"
            value={bassMovement}
            onValueChange={(v) => setBassMovement(Math.round(v))}
          />

          <Slider
            label="Bluesy Feel"
            value={bluesyFeel}
            onValueChange={(v) => setBluesyFeel(Math.round(v))}
          />

          <Slider
            label="Complexity"
            value={complexity}
            onValueChange={(v) => setComplexity(Math.round(v))}
          />

          <Slider
            label="Energy"
            value={energy}
            onValueChange={(v) => setEnergy(Math.round(v))}
          />
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  headerText: {
    color: colors.textPrimary,
    fontSize: typography.body.fontSize,
    fontWeight: '700',
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 12,
  },
  card: {
    marginTop: spacing.sm,
  },
  tempoHint: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  tempoHintText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  tempoValue: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginVertical: spacing.md,
  },
});
