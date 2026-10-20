import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feel } from "../engine/riff/rhythm";
import { hapticSelect } from "../lib/haptics";
import { borderRadius, colors, spacing } from "../theme/colors";

const FEELS: readonly { key: Feel; label: string }[] = [
  { key: "driving",   label: "driving"   },
  { key: "laid_back", label: "laid back" },
  { key: "heavy",     label: "heavy"     },
  { key: "bouncy",    label: "bouncy"    },
];

interface Props {
  value: Feel | null;
  locked: boolean;
  onChange: (feel: Feel | null) => void;
  onToggleLock: () => void;
}

export function FeelSelector({ value, locked, onChange, onToggleLock }: Props) {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.labelWrap}
        onPress={() => {
          hapticSelect();
          onToggleLock();
        }}
        activeOpacity={0.6}
        hitSlop={8}
        accessibilityRole="switch"
        accessibilityState={{ checked: locked }}
        accessibilityLabel="Lock feel when generating"
      >
        <Ionicons
          name={locked ? "lock-closed" : "lock-open-outline"}
          size={11}
          color={locked ? colors.accent : colors.textMuted}
        />
        <Text style={[styles.label, locked && styles.labelLocked]}>Feel</Text>
      </TouchableOpacity>
      <View style={styles.chips}>
        {FEELS.map((f) => {
          const active = value === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => {
                hapticSelect();
                onChange(active ? null : f.key);
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${f.label} feel`}
            >
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {f.label}
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
    minWidth: 48,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0,
  },
  labelLocked: {
    color: colors.accent,
  },
  chips: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 10,
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
    color: colors.accent,
  },
});
