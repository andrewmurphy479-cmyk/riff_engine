// V2 follow-ups (not in v1 scope):
// - Whole-riff 2x2 mini-fretboard heatmap showing all 4 bars at once
// - Playback scrubbing with live fretboard highlight (sync to AudioEngine.onStepPlay)
// - Phrase-structure educational card explaining what AA'AB means musically
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BarSelector } from "../../components/BarSelector";
import { RiffBarMetaStrip } from "../../components/RiffBarMetaStrip";
import { RiffContextCard } from "../../components/RiffContextCard";
import { RiffFretboardView } from "../../components/RiffFretboardView";
import { PHRASE_LABELS } from "../../engine/riff/display";
import { useNewRiffStore } from "../../store/useNewRiffStore";
import { borderRadius, colors, spacing } from "../../theme/colors";

export default function ExploreScreen() {
  const currentRiff = useNewRiffStore((s) => s.currentRiff);
  const [currentBarIndex, setCurrentBarIndex] = useState(0);
  const [showScaleShape, setShowScaleShape] = useState(true);
  const [showNoteNames, setShowNoteNames] = useState(false);

  useEffect(() => {
    setCurrentBarIndex(0);
  }, [currentRiff?.seed]);

  if (!currentRiff) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons
            name="musical-notes-outline"
            size={56}
            color={colors.textMuted}
          />
          <Text style={styles.emptyTitle}>Nothing to study yet</Text>
          <Text style={styles.emptySubtitle}>
            Pull a riff on the Create tab to study it here.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const includeBlue = currentRiff.scale.includes("blue");
  const phraseTags =
    PHRASE_LABELS[currentRiff.motif_structure] ??
    currentRiff.bars.map(() => "?");
  const clampedIndex = Math.min(currentBarIndex, currentRiff.bars.length - 1);
  const currentBar = currentRiff.bars[clampedIndex];
  const currentTag = phraseTags[clampedIndex] ?? "?";

  return (
    <SafeAreaView style={styles.container}>
      <BarSelector
        phraseTags={phraseTags}
        currentIndex={clampedIndex}
        onSelect={setCurrentBarIndex}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <RiffFretboardView
          bar={currentBar}
          keyName={currentRiff.key}
          includeBlue={includeBlue}
          showScaleShape={showScaleShape}
          showNoteNames={showNoteNames}
        />

        <RiffBarMetaStrip
          riff={currentRiff}
          currentBarIndex={clampedIndex}
          phraseTag={currentTag}
        />

        <RiffContextCard
          riff={currentRiff}
          currentBarIndex={clampedIndex}
        />
      </ScrollView>

      <View style={styles.toolbar}>
        <Toggle
          icon="musical-note-outline"
          label="Scale"
          active={showScaleShape}
          onPress={() => setShowScaleShape((v) => !v)}
        />
        <Toggle
          icon="text-outline"
          label="Names"
          active={showNoteNames}
          onPress={() => setShowNoteNames((v) => !v)}
        />
      </View>
    </SafeAreaView>
  );
}

interface ToggleProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}

function Toggle({ icon, label, active, onPress }: ToggleProps) {
  return (
    <TouchableOpacity
      style={[styles.tile, active && styles.tileActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons
        name={icon}
        size={18}
        color={active ? colors.accent : colors.textSecondary}
      />
      <Text style={[styles.tileLabel, active && styles.tileLabelActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.md,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tile: {
    width: 64,
    height: 48,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.chipInactive,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  tileActive: {
    backgroundColor: colors.chipActive,
    borderWidth: 1,
    borderColor: colors.chipActiveBorder,
  },
  tileLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  tileLabelActive: {
    color: colors.accent,
  },
});
