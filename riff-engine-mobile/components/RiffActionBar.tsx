import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, spacing } from "../theme/colors";

interface Props {
  isPlaying: boolean;
  isSaved: boolean;
  isLooping: boolean;
  disabled?: boolean;
  onPlayToggle: () => void;
  onGenerate: () => void;
  onSaveToggle: () => void;
  onLoopToggle: () => void;
}

export function RiffActionBar({
  isPlaying,
  isSaved,
  isLooping,
  disabled,
  onPlayToggle,
  onGenerate,
  onSaveToggle,
  onLoopToggle,
}: Props) {
  return (
    <View style={styles.bar}>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={onGenerate}
        disabled={disabled}
        activeOpacity={0.6}
      >
        <Ionicons name="shuffle" size={22} color={colors.textSecondary} />
        <Text style={styles.iconLabel}>new</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.iconButton}
        onPress={onLoopToggle}
        disabled={disabled}
        activeOpacity={0.6}
      >
        <Ionicons
          name="repeat"
          size={22}
          color={isLooping ? colors.accent : colors.textSecondary}
        />
        <Text style={[styles.iconLabel, isLooping && styles.iconLabelActive]}>
          loop
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.playButton, disabled && styles.playDisabled]}
        onPress={onPlayToggle}
        disabled={disabled}
        activeOpacity={0.85}
      >
        <Ionicons
          name={isPlaying ? "stop" : "play"}
          size={26}
          color={colors.white}
          style={isPlaying ? undefined : styles.playIconNudge}
        />
        <Text style={styles.playLabel}>{isPlaying ? "Stop" : "Play"}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.iconButton}
        onPress={onSaveToggle}
        disabled={disabled}
        activeOpacity={0.6}
      >
        <Ionicons
          name={isSaved ? "heart" : "heart-outline"}
          size={22}
          color={isSaved ? "#FF4E78" : colors.textSecondary}
        />
        <Text style={styles.iconLabel}>{isSaved ? "saved" : "save"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    backgroundColor: colors.background,
  },
  iconButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 52,
    gap: 2,
  },
  iconLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  iconLabelActive: {
    color: colors.accent,
  },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: colors.accent,
    minWidth: 130,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  playDisabled: {
    opacity: 0.4,
  },
  playIconNudge: {
    marginLeft: 2,
  },
  playLabel: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
