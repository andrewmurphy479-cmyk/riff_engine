import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { borderRadius, colors, spacing } from "../theme/colors";

interface Props {
  phraseTags: readonly string[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

export function BarSelector({ phraseTags, currentIndex, onSelect }: Props) {
  return (
    <View style={styles.row}>
      {phraseTags.map((tag, i) => {
        const active = i === currentIndex;
        return (
          <TouchableOpacity
            key={i}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onSelect(i)}
            activeOpacity={0.7}
          >
            <Text style={[styles.barLabel, active && styles.labelActive]}>
              BAR {i + 1}
            </Text>
            <Text style={[styles.tag, active && styles.tagActive]}>{tag}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.chipInactive,
    borderWidth: 1,
    borderColor: colors.chipInactiveBorder,
    alignItems: "center",
  },
  chipActive: {
    backgroundColor: colors.chipActive,
    borderColor: colors.chipActiveBorder,
  },
  barLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  labelActive: {
    color: colors.textSecondary,
  },
  tag: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "monospace",
    marginTop: 2,
  },
  tagActive: {
    color: colors.accent,
  },
});
