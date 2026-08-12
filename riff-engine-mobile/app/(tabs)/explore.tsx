import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { hapticSelect, hapticTap } from "../../lib/haptics";
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
  // 'bar' = loop the selected bar; 'riff' = play the whole riff, auto-following
  // the sounding bar on the fretboard.
  const [playMode, setPlayMode] = useState<"bar" | "riff" | null>(null);
  const playModeRef = useRef<"bar" | "riff" | null>(null);
  // Set when riff-mode playback advances the bar itself, so the stop-on-bar-
  // change effect can tell auto-follow apart from a manual bar tap.
  const followingBarChange = useRef(false);
  const lastFollowBar = useRef(-1);

  const {
    play: playAudio,
    stop: stopAudio,
    prepare: prepareAudio,
  } = useAudioEngine({
    onPlaybackStart: () => setIsPlaying(true),
    onPlaybackEnd: () => {
      setIsPlaying(false);
      setActiveStep(null);
      setPlayMode(null);
      playModeRef.current = null;
    },
    onStepPlay: (step) => {
      if (step < 0) {
        setActiveStep(null);
        return;
      }
      if (playModeRef.current === "riff") {
        const barIdx = Math.floor(step / STEPS_PER_BAR);
        // Only flag genuine bar advances — a flag set on a same-bar step would
        // go stale and swallow the next manual bar tap's stop.
        if (barIdx !== lastFollowBar.current) {
          lastFollowBar.current = barIdx;
          followingBarChange.current = true;
          setCurrentBarIndex(barIdx);
        }
        setActiveStep(step % STEPS_PER_BAR);
      } else {
        setActiveStep(step);
      }
    },
  });

  useEffect(() => {
    setCurrentBarIndex(0);
  }, [currentRiff?.seed]);

  // Stop playback if the riff changes
  useEffect(() => {
    stopAudio();
  }, [currentRiff?.seed, stopAudio]);

  // Warm the tone cache for the riff on screen (audit A8).
  useEffect(() => {
    if (!currentRiff) return;
    const events = riffSpecToEvents(currentRiff);
    prepareAudio(showEmbellishments ? events : stripTechniques(events));
  }, [currentRiff, showEmbellishments, prepareAudio]);

  // Stop playback when the user manually picks a different bar — but not when
  // riff playback is the one advancing the bar.
  useEffect(() => {
    if (followingBarChange.current) {
      followingBarChange.current = false;
      return;
    }
    stopAudio();
  }, [currentBarIndex, stopAudio]);

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

  // Big play tile: the full riff, fretboard following along bar by bar.
  const handlePlayRiff = useCallback(() => {
    if (isPlaying && playMode === "riff") {
      stopAudio();
      return;
    }
    const events = riffSpecToEvents(currentRiff);
    const riffEvents = showEmbellishments ? events : stripTechniques(events);
    if (riffEvents.length === 0) return;
    setPlayMode("riff");
    playModeRef.current = "riff";
    lastFollowBar.current = -1;
    playAudio(riffEvents, effectiveBpm, false, {
      bars: currentRiff.bars.length,
    });
  }, [isPlaying, playMode, stopAudio, playAudio, currentRiff, effectiveBpm, showEmbellishments]);

  // Bar tile: loop just the selected bar for close study.
  const handlePlayBar = useCallback(() => {
    if (isPlaying && playMode === "bar") {
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
    setPlayMode("bar");
    playModeRef.current = "bar";
    playAudio(barEvents, effectiveBpm, true, { bars: 1 });
  }, [isPlaying, playMode, stopAudio, playAudio, currentRiff, clampedIndex, effectiveBpm, showEmbellishments]);

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
          style={[
            styles.playTile,
            isPlaying && playMode === "riff" && styles.playTileActive,
          ]}
          onPress={() => {
            hapticTap();
            handlePlayRiff();
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={
            isPlaying && playMode === "riff" ? "Stop riff" : "Play full riff"
          }
        >
          <Ionicons
            name={isPlaying && playMode === "riff" ? "stop" : "play"}
            size={22}
            color={colors.white}
          />
        </TouchableOpacity>
        <Toggle
          icon={isPlaying && playMode === "bar" ? "stop-outline" : "repeat"}
          label="Bar"
          active={isPlaying && playMode === "bar"}
          onPress={handlePlayBar}
        />
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
      onPress={() => {
        hapticSelect();
        onPress();
      }}
      activeOpacity={0.7}
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
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
