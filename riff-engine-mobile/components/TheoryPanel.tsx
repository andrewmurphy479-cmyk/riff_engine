import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from './ui/Card';
import { ChordTheory, ScaleDefinition } from '../engine/theory';
import { colors, spacing, typography } from '../theme/colors';

// ── Sub-components (reusable in drawer) ──

interface ChordInfoProps {
  chordTheory: ChordTheory;
}

export function ChordInfo({ chordTheory }: ChordInfoProps) {
  return (
    <View style={styles.section}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Chord</Text>
        <Text style={styles.badge}>{chordTheory.quality}</Text>
      </View>
      <Text style={styles.chordName}>{chordTheory.name}</Text>
      <View style={styles.row}>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Notes</Text>
          <Text style={styles.infoValue}>{chordTheory.notes.join(' - ')}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Formula</Text>
          <Text style={styles.infoValue}>{chordTheory.intervals}</Text>
        </View>
      </View>
      <Text style={styles.description}>{chordTheory.description}</Text>
    </View>
  );
}

interface ScaleInfoProps {
  scale: ScaleDefinition;
  mood: string;
}

export function ScaleInfo({ scale, mood }: ScaleInfoProps) {
  return (
    <View style={styles.section}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Scale</Text>
        <Text style={styles.badge}>{scale.character}</Text>
      </View>
      <Text style={styles.scaleName}>{scale.name}</Text>
      <View style={styles.infoBlock}>
        <Text style={styles.infoLabel}>Interval pattern</Text>
        <Text style={styles.infoValue}>
          {scale.intervals.map((iv, i) => {
            if (i === 0) return 'R';
            const gap = iv - scale.intervals[i - 1];
            return gap === 1 ? 'H' : gap === 2 ? 'W' : `${gap / 2}W`;
          }).join(' - ')}
        </Text>
      </View>
      <Text style={styles.description}>{scale.description}</Text>
      <Text style={styles.moodHint}>
        Your riff in {mood} mood uses this scale.
      </Text>
    </View>
  );
}

interface ProgressionInfoProps {
  progression: string[];
  currentBarIndex: number;
}

export function ProgressionInfo({ progression, currentBarIndex }: ProgressionInfoProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.cardTitle}>Progression</Text>
      <View style={styles.progressionRow}>
        {progression.map((ch, i) => {
          const isCurrent = i === currentBarIndex;
          return (
            <View key={`${i}-${ch}`} style={styles.progChipWrap}>
              <View style={[styles.progChip, isCurrent && styles.progChipActive]}>
                <Text style={[styles.progChipText, isCurrent && styles.progChipTextActive]}>
                  {ch}
                </Text>
              </View>
              {i < progression.length - 1 && (
                <Text style={styles.progArrow}>{'>'}</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Combined panel (original export, wraps all 3 in Cards) ──

interface TheoryPanelProps {
  chord: string;
  chordTheory: ChordTheory | null;
  scale: ScaleDefinition | null;
  mood: string;
  progression: string[];
  currentBarIndex: number;
}

export function TheoryPanel({
  chord,
  chordTheory,
  scale,
  mood,
  progression,
  currentBarIndex,
}: TheoryPanelProps) {
  return (
    <View style={styles.container}>
      {chordTheory && (
        <Card style={styles.card}>
          <ChordInfo chordTheory={chordTheory} />
        </Card>
      )}

      {scale && (
        <Card style={styles.card}>
          <ScaleInfo scale={scale} mood={mood} />
        </Card>
      )}

      <Card style={styles.card}>
        <ProgressionInfo progression={progression} currentBarIndex={currentBarIndex} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  card: {
    gap: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  badge: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent,
    backgroundColor: colors.chipActive,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  chordName: {
    fontSize: typography.h3.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  scaleName: {
    fontSize: typography.h3.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  infoBlock: {
    gap: 2,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  description: {
    fontSize: typography.caption.fontSize,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  moodHint: {
    fontSize: 12,
    fontStyle: 'italic',
    color: colors.textMuted,
    marginTop: 2,
  },
  progressionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  progChipWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  progChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.chipInactive,
  },
  progChipActive: {
    backgroundColor: colors.chipActive,
    borderWidth: 1,
    borderColor: colors.chipActiveBorder,
  },
  progChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  progChipTextActive: {
    color: colors.accent,
  },
  progArrow: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
