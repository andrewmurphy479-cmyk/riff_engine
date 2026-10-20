import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { hapticSelect } from "../lib/haptics";
import { colors, spacing } from "../theme/colors";

const MIN_BPM = 40;
const MAX_BPM = 220;
const STEP = 5;

interface Props {
  value: number;
  isOverride: boolean;
  onChange: (bpm: number | null) => void;
  metronomeEnabled?: boolean;
  countInEnabled?: boolean;
  onToggleMetronome?: () => void;
  onToggleCountIn?: () => void;
}

function clamp(v: number): number {
  return Math.max(MIN_BPM, Math.min(MAX_BPM, v));
}

export function TempoStepper({
  value,
  isOverride,
  onChange,
  metronomeEnabled = false,
  countInEnabled = false,
  onToggleMetronome,
  onToggleCountIn,
}: Props) {
  const step = (delta: number) => {
    hapticSelect();
    onChange(clamp(value + delta));
  };
  const reset = () => {
    hapticSelect();
    onChange(null);
  };

  return (
    <View style={styles.row}>
      {(onToggleMetronome || onToggleCountIn) && (
        <View style={styles.clickCluster}>
          {onToggleMetronome && (
            <TouchableOpacity
              onPress={() => {
                hapticSelect();
                onToggleMetronome();
              }}
              activeOpacity={0.6}
              hitSlop={6}
              accessibilityRole="switch"
              accessibilityState={{ checked: metronomeEnabled }}
              accessibilityLabel="Metronome click"
            >
              <Text
                style={[
                  styles.clickLabel,
                  metronomeEnabled && styles.clickLabelActive,
                ]}
              >
                Click
              </Text>
            </TouchableOpacity>
          )}
          {onToggleCountIn && (
            <TouchableOpacity
              onPress={() => {
                hapticSelect();
                onToggleCountIn();
              }}
              activeOpacity={0.6}
              hitSlop={6}
              accessibilityRole="switch"
              accessibilityState={{ checked: countInEnabled }}
              accessibilityLabel="Count-in before playback"
            >
              <Text
                style={[
                  styles.clickLabel,
                  countInEnabled && styles.clickLabelActive,
                ]}
              >
                Count-in
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <TouchableOpacity
        style={styles.stepButton}
        onPress={() => step(-STEP)}
        disabled={value <= MIN_BPM}
        activeOpacity={0.6}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Decrease tempo"
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
        accessibilityRole="button"
        accessibilityLabel="Increase tempo"
      >
        <Ionicons name="add" size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      {isOverride && (
        <TouchableOpacity
          style={styles.resetButton}
          onPress={reset}
          activeOpacity={0.6}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Reset tempo to the riff's default"
        >
          <Text style={styles.resetLabel}>Reset</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.chipInactive,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  valueWrap: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    minWidth: 66,
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
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
  },
  clickCluster: {
    marginRight: "auto",
    gap: 4,
  },
  clickLabel: {
    minHeight: 24,
    textAlignVertical: "center",
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "none",
  },
  clickLabelActive: {
    color: colors.accent,
  },
  resetLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "none",
  },
});
