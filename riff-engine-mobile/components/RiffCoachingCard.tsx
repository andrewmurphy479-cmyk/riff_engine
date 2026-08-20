import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { coachingFor } from "../engine/riff/coaching";
import { RiffSpec } from "../engine/riff/spec";
import { hapticTap } from "../lib/haptics";
import { borderRadius, colors, spacing, typography } from "../theme/colors";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Icon per tip id. Falls back to a generic bulb for anything unmapped. */
const TIP_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  palm_mute: "hand-left-outline",
  legato: "git-merge-outline",
  diads: "layers-outline",
  stretch: "resize-outline",
  position: "locate-outline",
  open_strings: "radio-outline",
  swing: "pulse-outline",
  sixteenths: "speedometer-outline",
  repeat: "repeat-outline",
};

/**
 * Tips shown at once. The engine ranks most-useful-first and returns
 * everything it found, but the tail is near-constant across riffs — every
 * generated riff repeats a bar, and ~86% touch an open string — so showing all
 * of them buries the two or three that are actually specific to this riff.
 */
const MAX_TIPS = 4;

interface Props {
  riff: RiffSpec;
  /** Start expanded. Off by default so the tab stays scannable. */
  defaultOpen?: boolean;
}

/**
 * How to play this riff — the counterpart to RiffContextCard, which explains
 * what the riff *is*. Everything here is derived from the spec, so it stays
 * true for a generated riff nobody has ever seen.
 */
export function RiffCoachingCard({ riff, defaultOpen = false }: Props) {
  const coaching = useMemo(() => coachingFor(riff), [riff]);
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => {
    hapticTap();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.header}
        onPress={toggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={
          open ? "Hide how to play this" : "Show how to play this"
        }
      >
        <View style={styles.headerText}>
          <Text style={styles.kicker}>HOW TO PLAY IT</Text>
          <Text style={styles.headline}>{coaching.headline}</Text>
        </View>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.accent}
        />
      </TouchableOpacity>

      {open && (
        <View style={styles.tips}>
          {coaching.tips.slice(0, MAX_TIPS).map((tip) => (
            <View key={tip.id} style={styles.tip}>
              <Ionicons
                name={TIP_ICONS[tip.id] ?? "bulb-outline"}
                size={16}
                color={colors.accent}
                style={styles.tipIcon}
              />
              <View style={styles.tipText}>
                <Text style={styles.tipLabel}>{tip.label}</Text>
                <Text style={styles.tipBody}>{tip.body}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.cardSolid,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: "rgba(249, 115, 22, 0.18)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headerText: { flex: 1 },
  kicker: {
    ...typography.small,
    color: colors.accent,
    letterSpacing: 1.2,
    fontWeight: "700",
    marginBottom: 4,
  },
  headline: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  tips: { marginTop: spacing.md, gap: spacing.md },
  tip: { flexDirection: "row", gap: 10 },
  tipIcon: { marginTop: 2 },
  tipText: { flex: 1 },
  tipLabel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 3,
  },
  tipBody: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12.5,
    lineHeight: 18,
  },
});
