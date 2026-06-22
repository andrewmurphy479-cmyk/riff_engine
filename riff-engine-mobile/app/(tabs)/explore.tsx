import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAudioEngine } from "../../audio/AudioEngine";
import { BarSelector } from "../../components/BarSelector";
import { ExploreIntroCard } from "../../components/ExploreIntroCard";
import { RiffBarMetaStrip } from "../../components/RiffBarMetaStrip";
import { RiffContextCard } from "../../components/RiffContextCard";
import { RiffFretboardView } from "../../components/RiffFretboardView";
import { buildRiffSummary, PHRASE_LABELS } from "../../engine/riff/display";
import { fretRangeForBar } from "../../engine/riff/fretboard";
import { riffSpecToEvents, stripTechniques } from "../../engine/riff/toEvents";
import { useNewRiffStore } from "../../store/useNewRiffStore";
import { borderRadius, colors, spacing } from "../../theme/colors";

const STEPS_PER_BAR = 16;

export default function ExploreScreen() {
  const router = useRouter();
  const currentRiff = useNewRiffStore((s) => s.currentRiff);
  const tempoOverride = useNewRiffStore((s) => s.tempoOverride);
  const showEmbellishments = useNewRiffStore((s) => s.showEmbellishments);
  const [currentBarIndex, setCurrentBarIndex] = useState(0);
  const [showScaleShape, setShowScaleShape] = useState(true);
  const [showNoteNames, setShowNoteNames] = useState(false);
  const [showSequence, setShowSequence] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);

  const { play: playAudio, stop: stopAudio } = useAudioEngine({
    onPlaybackStart: () => setIsPlaying(true),
    onPlaybackEnd: () => {
      setIsPlaying(false);
      setActiveStep(null);
    },
    onStepPlay: (step) => setActiveStep(step < 0 ? null : step),
  });

  useEffect(() => {
    setCurrentBarIndex(0);
  }, [currentRiff?.seed]);

  // Stop playback if the riff or selected bar changes
  useEffect(() => {
    stopAudio();
  }, [currentRiff?.seed, currentBarIndex, stopAudio]);

  if (!currentRiff) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons
            name="musical-notes-outline"
            size={56}
            color={colors.textMuted}
          />
          <Text style={styles.emptyTitle}>Your riff lab is empty</Text>
          <Text style={styles.emptySubtitle}>
            Create your first riff and come back here to see how it's built
            — every note, every choice, explained.
          </Text>
          <TouchableOpacity
            style={styles.goCreateButton}
            onPress={() => router.push("/")}
            activeOpacity={0.7}
          >
            <Text style={styles.goCreateLabel}>Go Create</Text>
          </TouchableOpacity>
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
  const { maxFret: zoomedMaxFret } = fretRangeForBar(currentBar);
  const summary = buildRiffSummary(currentRiff);
  const effectiveBpm = tempoOverride ?? currentRiff.tempo_bpm;

  const handlePlayToggle = useCallback(() => {
    if (isPlaying) {
      stopAudio();
      return;
    }
    const startStep = clampedIndex * STEPS_PER_BAR;
    const endStep = startStep + STEPS_PER_BAR;
    const filtered = riffSpecToEvents(currentRiff)
      .filter((e) => e.step >= startStep && e.step < endStep)
      .map((e) => ({ ...e, step: e.step - startStep }));
    const barEvents = showEmbellishments ? filtered : stripTechniques(filtered);
    if (barEvents.length === 0) return;
    playAudio(barEvents, effectiveBpm, true);
  }, [isPlaying, stopAudio, playAudio, currentRiff, clampedIndex, effectiveBpm, showEmbellishments]);

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
        <Text style={styles.summaryText}>{summary}</Text>

        <ExploreIntroCard />

        <RiffFretboardView
          bar={currentBar}
          keyName={currentRiff.key}
          includeBlue={includeBlue}
          maxFret={zoomedMaxFret}
          showScaleShape={showScaleShape}
          showNoteNames={showNoteNames}
          showSequence={showSequence}
          activeStep={activeStep}
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
        <TouchableOpacity
          style={[styles.playTile, isPlaying && styles.playTileActive]}
          onPress={handlePlayToggle}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isPlaying ? "stop" : "play"}
            size={22}
            color={colors.white}
          />
        </TouchableOpacity>
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
        <Toggle
          icon="git-branch-outline"
          label="Path"
          active={showSequence}
          onPress={() => setShowSequence((v) => !v)}
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
  goCreateButton: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.accent,
  },
  goCreateLabel: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },
  summaryText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
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
  playTile: {
    width: 56,
    height: 48,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  playTileActive: {
    backgroundColor: colors.error,
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
