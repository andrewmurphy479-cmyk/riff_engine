import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Level } from "../engine/riff/rhythm";
import { hapticSelect } from "../lib/haptics";
import { LEVELS } from "../store/useNewRiffStore";
import { borderRadius, colors, spacing } from "../theme/colors";

const LABELS: Record<Level, string> = {
  beginner: "beginner",
  intermediate: "intermediate",
  advanced: "advanced",
};

interface Props {
  value: Level;
  onChange: (level: Level) => void;
}

export function LevelSelector({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.labelWrap}>
        <Text style={styles.label}>LVL</Text>
      </View>
      <View style={styles.chips}>
        {LEVELS.map((lvl) => {
          const active = value === lvl;
          return (
            <TouchableOpacity
              key={lvl}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => {
                hapticSelect();
                onChange(lvl);
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${LABELS[lvl]} level`}
            >
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {LABELS[lvl]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  labelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 44,
  },
  label: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  chips: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: borderRadius.full,
    backgroundColor: colors.chipInactive,
    borderWidth: 1,
    borderColor: colors.chipInactiveBorder,
  },
  chipActive: {
    backgroundColor: colors.chipActive,
    borderColor: colors.chipActiveBorder,
  },
  chipLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  chipLabelActive: {
    color: colors.textPrimary,
  },
});
