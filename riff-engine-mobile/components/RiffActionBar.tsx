import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { hapticSelect, hapticTap } from "../lib/haptics";
import { colors, spacing } from "../theme/colors";

interface Props {
  isPlaying: boolean;
  isSaved: boolean;
  isLooping: boolean;
  isSharing?: boolean;
  disabled?: boolean;
  onPlayToggle: () => void;
  onGenerate: () => void;
  onSaveToggle: () => void;
  onLoopToggle: () => void;
  onShare?: () => void;
}

export function RiffActionBar({
  isPlaying,
  isSaved,
  isLooping,
  isSharing,
  disabled,
  onPlayToggle,
  onGenerate,
  onSaveToggle,
  onLoopToggle,
  onShare,
}: Props) {
  return (
    <View style={styles.bar}>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={() => {
          hapticTap();
          onGenerate();
        }}
        disabled={disabled}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel="Generate new riff"
      >
        <Ionicons name="shuffle" size={22} color={colors.textSecondary} />
        <Text style={styles.iconLabel}>New</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.iconButton}
        onPress={() => {
          hapticSelect();
          onLoopToggle();
        }}
        disabled={disabled}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel={isLooping ? "Turn looping off" : "Turn looping on"}
      >
        <Ionicons
          name="repeat"
          size={22}
          color={isLooping ? colors.accent : colors.textSecondary}
        />
        <Text style={[styles.iconLabel, isLooping && styles.iconLabelActive]}>
          Loop
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.playButton, disabled && styles.playDisabled]}
        onPress={() => {
          hapticTap();
          onPlayToggle();
        }}
        disabled={disabled}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? "Stop playback" : "Play riff"}
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
        onPress={() => {
          hapticSelect();
          onSaveToggle();
        }}
        disabled={disabled}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel={isSaved ? "Remove riff from library" : "Save riff to library"}
      >
        <Ionicons
          name={isSaved ? "heart" : "heart-outline"}
          size={22}
          color={isSaved ? colors.heart : colors.textSecondary}
        />
        <Text style={styles.iconLabel}>{isSaved ? "Saved" : "Save"}</Text>
      </TouchableOpacity>

      {onShare && (
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => {
            hapticTap();
            onShare();
          }}
          disabled={disabled || isSharing}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Share riff as audio"
        >
          {isSharing ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Ionicons
              name="share-outline"
              size={22}
              color={colors.textSecondary}
            />
          )}
          <Text style={styles.iconLabel}>Share</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
    gap: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  iconButton: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    minHeight: 48,
    gap: 2,
  },
  iconLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "none",
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
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.accent,
    flex: 2,
    minHeight: 52,
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
