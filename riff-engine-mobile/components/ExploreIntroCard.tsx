import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNewRiffStore } from "../store/useNewRiffStore";
import { colors, spacing } from "../theme/colors";

export function ExploreIntroCard() {
  const dismissed = useNewRiffStore((s) => s.exploreIntroDismissed);
  const dismiss = useNewRiffStore((s) => s.dismissExploreIntro);

  if (dismissed) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="bulb-outline" size={16} color={colors.accent} />
        <Text style={styles.title}>What am I looking at?</Text>
        <TouchableOpacity
          onPress={dismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
      <Text style={styles.body}>
        Each colored dot is a note in your riff, placed on a guitar fretboard.
        The colors show each note's role — root, third, fifth, and so on.
        Toggle "Scale" below to see the full shape these notes come from.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: "#12121e",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(74, 122, 255, 0.15)",
    gap: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  body: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
});
