import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, spacing } from "../theme/colors";

const MIN_BPM = 40;
const MAX_BPM = 220;
const STEP = 5;

interface Props {
  value: number;
  isOverride: boolean;
  onChange: (bpm: number | null) => void;
}

function clamp(v: number): number {
  return Math.max(MIN_BPM, Math.min(MAX_BPM, v));
}

export function TempoStepper({ value, isOverride, onChange }: Props) {
  const step = (delta: number) => onChange(clamp(value + delta));
  const reset = () => onChange(null);

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.stepButton}
        onPress={() => step(-STEP)}
        disabled={value <= MIN_BPM}
        activeOpacity={0.6}
        hitSlop={6}
      >
        <Ionicons name="remove" size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      <View style={styles.valueWrap}>
        <Text style={[styles.value, isOverride && styles.valueActive]}>
          {value}
        </Text>
        <Text style={styles.unit}>BPM</Text>
      </View>

      <TouchableOpacity
        style={styles.stepButton}
        onPress={() => step(STEP)}
        disabled={value >= MAX_BPM}
        activeOpacity={0.6}
        hitSlop={6}
      >
        <Ionicons name="add" size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      {isOverride && (
        <TouchableOpacity
          style={styles.resetButton}
          onPress={reset}
          activeOpacity={0.6}
          hitSlop={6}
        >
          <Text style={styles.resetLabel}>reset</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  stepButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  valueWrap: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    minWidth: 76,
    justifyContent: "center",
  },
  value: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  valueActive: {
    color: colors.accent,
  },
  unit: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  resetButton: {
    position: "absolute",
    right: spacing.lg,
  },
  resetLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
});
