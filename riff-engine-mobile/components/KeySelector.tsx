import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GUITAR_KEYS } from "../store/useNewRiffStore";
import { borderRadius, colors, spacing } from "../theme/colors";

interface Props {
  value: string;
  locked: boolean;
  onChange: (key: string) => void;
  onToggleLock: () => void;
}

export function KeySelector({ value, locked, onChange, onToggleLock }: Props) {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.labelWrap}
        onPress={onToggleLock}
        activeOpacity={0.6}
        hitSlop={8}
      >
        <Ionicons
          name={locked ? "lock-closed" : "lock-open-outline"}
          size={11}
          color={locked ? colors.accent : colors.textMuted}
        />
        <Text style={[styles.label, locked && styles.labelLocked]}>KEY</Text>
      </TouchableOpacity>
      <View style={styles.chips}>
        {GUITAR_KEYS.map((k) => {
          const active = value === k;
          return (
            <TouchableOpacity
              key={k}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onChange(k)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {k}
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
    minWidth: 34,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: borderRadius.full,
    backgroundColor: colors.chipInactive,
    borderWidth: 1,
    borderColor: colors.chipInactiveBorder,
    alignItems: "center",
  },
  chipActive: {
    backgroundColor: colors.chipActive,
    borderColor: colors.chipActiveBorder,
  },
  chipLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "monospace",
    letterSpacing: 0.3,
  },
  chipLabelActive: {
    color: colors.textPrimary,
  },
});
