import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Card } from '../components/ui/Card';
import { PRESETS } from '../engine/presets';
import { useRiffStore } from '../store/useRiffStore';
import { colors, spacing, typography, borderRadius } from '../theme/colors';

// Capitalize helper
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function PresetsScreen() {
  const router = useRouter();
  const { selectedPresetId, applyPreset } = useRiffStore();

  const handleSelectPreset = useCallback(
    (presetId: string) => {
      const preset = PRESETS.find((p) => p.id === presetId);
      if (preset) {
        applyPreset(preset);
        router.back();
      }
    },
    [applyPreset, router]
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          Quick-start configurations for different vibes
        </Text>

        {PRESETS.map((preset) => {
          const isSelected = preset.id === selectedPresetId;
          return (
            <TouchableOpacity
              key={preset.id}
              onPress={() => handleSelectPreset(preset.id)}
              activeOpacity={0.7}
            >
              <Card style={[styles.presetCard, isSelected && styles.presetCardSelected]}>
                <View style={styles.presetHeader}>
                  <Text style={styles.presetName}>{preset.name}</Text>
                  {isSelected && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>Active</Text>
                    </View>
                  )}
                </View>

                <View style={styles.presetDetails}>
                  <View style={styles.detailChip}>
                    <Text style={styles.detailLabel}>Mood</Text>
                    <Text style={styles.detailValue}>{capitalize(preset.mood)}</Text>
                  </View>
                  <View style={styles.detailChip}>
                    <Text style={styles.detailLabel}>Style</Text>
                    <Text style={styles.detailValue}>{capitalize(preset.style)}</Text>
                  </View>
                  <View style={styles.detailChip}>
                    <Text style={styles.detailLabel}>Tempo</Text>
                    <Text style={styles.detailValue}>{preset.tempo} BPM</Text>
                  </View>
                </View>

                <View style={styles.knobsRow}>
                  <KnobIndicator label="Bass" value={preset.bass} />
                  <KnobIndicator label="Blues" value={preset.blues} />
                  <KnobIndicator label="Complex" value={preset.complexity} />
                  <KnobIndicator label="Energy" value={preset.energy} />
                </View>
              </Card>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

interface KnobIndicatorProps {
  label: string;
  value: number;
}

function KnobIndicator({ label, value }: KnobIndicatorProps) {
  // Map 1-5 scale to 1-3 dots
  const mapped = value <= 2 ? 1 : value <= 3 ? 2 : 3;
  return (
    <View style={styles.knobIndicator}>
      <Text style={styles.knobLabel}>{label}</Text>
      <View style={styles.knobDots}>
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={[styles.knobDot, i <= mapped && styles.knobDotActive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  presetCard: {
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  presetCardSelected: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  presetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  presetName: {
    fontSize: typography.h3.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  activeBadge: {
    backgroundColor: colors.chipActive,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  activeBadgeText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  presetDetails: {
    flexDirection: 'column',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  detailChip: {
    backgroundColor: colors.chipInactive,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  detailValue: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  knobsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  knobIndicator: {
    alignItems: 'center',
  },
  knobLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  knobDots: {
    flexDirection: 'row',
    gap: 3,
  },
  knobDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.chipInactive,
  },
  knobDotActive: {
    backgroundColor: colors.accent,
  },
});
