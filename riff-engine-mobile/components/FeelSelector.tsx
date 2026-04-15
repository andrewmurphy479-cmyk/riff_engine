import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feel } from "../engine/riff/rhythm";
import { colors, borderRadius, spacing } from "../theme/colors";

const FEELS: readonly { key: Feel; label: string }[] = [
  { key: "driving",   label: "driving"   },
  { key: "laid_back", label: "laid back" },
  { key: "heavy",     label: "heavy"     },
  { key: "bouncy",    label: "bouncy"    },
];

interface Props {
  value: Feel | null;
  onChange: (feel: Feel | null) => void;
}

export function FeelSelector({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {FEELS.map((f) => {
        const active = value === f.key;
        return (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(active ? null : f.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: borderRadius.full,
    backgroundColor: colors.chipInactive,
    borderWidth: 1,
    borderColor: colors.chipInactiveBorder,
  },
  chipActive: {
    backgroundColor: colors.chipActive,
    borderColor: colors.chipActiveBorder,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  labelActive: {
    color: colors.textPrimary,
  },
});
