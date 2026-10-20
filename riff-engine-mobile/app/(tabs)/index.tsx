import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BarActionSheet } from "../../components/BarActionSheet";
import { FeelSelector } from "../../components/FeelSelector";
import { KeySelector } from "../../components/KeySelector";
import { LevelSelector } from "../../components/LevelSelector";
import { RiffActionBar } from "../../components/RiffActionBar";
import { RiffTabView } from "../../components/RiffTabView";
import { TempoStepper } from "../../components/TempoStepper";
import { ScreenHeading } from "../../components/ScreenHeading";
import { FEEL_DISPLAY_NAMES } from "../../engine/riff/display";
import { useAudioEngine } from "../../audio/AudioEngine";
import { AudioExporter } from "../../audio/AudioExporter";
import { TabEvent } from "../../engine/types";
import { useNewRiffStore } from "../../store/useNewRiffStore";
import { riffSpecToEvents, stripTechniques } from "../../engine/riff/toEvents";
import { colors, spacing } from "../../theme/colors";

export default function HomeScreen() {
  const currentRiff = useNewRiffStore((s) => s.currentRiff);
  const feel = useNewRiffStore((s) => s.feel);
  const key = useNewRiffStore((s) => s.key);
  const level = useNewRiffStore((s) => s.level);
  const lockedFields = useNewRiffStore((s) => s.lockedFields);
  const tempoOverride = useNewRiffStore((s) => s.tempoOverride);
  const isLooping = useNewRiffStore((s) => s.isLooping);
  const showEmbellishments = useNewRiffStore((s) => s.showEmbellishments);
  const metronomeEnabled = useNewRiffStore((s) => s.metronomeEnabled);
  const countInEnabled = useNewRiffStore((s) => s.countInEnabled);
  const savedRiffs = useNewRiffStore((s) => s.savedRiffs);
  const generateNewRiff = useNewRiffStore((s) => s.generateNewRiff);
  const rerollBar = useNewRiffStore((s) => s.rerollBar);
  const setFeel = useNewRiffStore((s) => s.setFeel);
  const setKey = useNewRiffStore((s) => s.setKey);
  const setLevel = useNewRiffStore((s) => s.setLevel);
  const setTempoOverride = useNewRiffStore((s) => s.setTempoOverride);
  const setIsLooping = useNewRiffStore((s) => s.setIsLooping);
  const toggleEmbellishments = useNewRiffStore((s) => s.toggleEmbellishments);
  const toggleMetronome = useNewRiffStore((s) => s.toggleMetronome);
  const toggleCountIn = useNewRiffStore((s) => s.toggleCountIn);
  const toggleLock = useNewRiffStore((s) => s.toggleLock);
  const toggleSaveCurrent = useNewRiffStore((s) => s.toggleSaveCurrent);

  const effectiveBpm = tempoOverride ?? currentRiff?.tempo_bpm ?? 110;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [barSheetIdx, setBarSheetIdx] = useState<number | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);

  // Bar loops re-base steps to 0-15; this offset maps them back onto the
  // full tab so the playhead lands in the right bar.
  const playheadOffsetRef = useRef(0);
  // What's currently sounding, so tempo changes can restart the same thing.
  const lastPlayedRef = useRef<{
    events: TabEvent[];
    loop: boolean;
    bars: number;
  } | null>(null);

  const audioEngine = useAudioEngine({
    onPlaybackStart: () => setIsPlaying(true),
    onPlaybackEnd: () => {
      setIsPlaying(false);
      setActiveStep(null);
    },
    onStepPlay: (step) =>
      setActiveStep(step < 0 ? null : step + playheadOffsetRef.current),
  });

  useEffect(() => {
    if (!currentRiff) generateNewRiff();
  }, [currentRiff, generateNewRiff]);

  // Warm the tone cache for whatever is on screen, so the play tap doesn't pay
  // for synthesis (audit A8). Prepares exactly what would sound, since the
  // embellishments toggle changes the buffers a note maps to.
  useEffect(() => {
    if (!currentRiff) return;
    const events = riffSpecToEvents(currentRiff);
    audioEngine.prepare(showEmbellishments ? events : stripTechniques(events));
  }, [currentRiff, showEmbellishments, audioEngine]);

  const handlePlayToggle = useCallback(() => {
    if (!currentRiff) return;
    if (isPlaying) {
      audioEngine.stop();
      return;
    }
    const events = riffSpecToEvents(currentRiff);
    const playEvents = showEmbellishments ? events : stripTechniques(events);
    playheadOffsetRef.current = 0;
    const bars = currentRiff.bars.length;
    lastPlayedRef.current = { events: playEvents, loop: isLooping, bars };
    audioEngine.play(playEvents, effectiveBpm, isLooping, {
      countIn: countInEnabled,
      metronome: metronomeEnabled,
      bars,
    });
  }, [currentRiff, isPlaying, audioEngine, effectiveBpm, isLooping, showEmbellishments, countInEnabled, metronomeEnabled]);

  const handleGenerate = useCallback(() => {
    if (isPlaying) audioEngine.stop();
    generateNewRiff();
  }, [isPlaying, audioEngine, generateNewRiff]);

  const handleLoopToggle = useCallback(() => {
    const next = !isLooping;
    setIsLooping(next);
    // Mid-playback toggle: take effect at next iteration boundary
    if (isPlaying) audioEngine.setLoop(next);
  }, [isLooping, setIsLooping, isPlaying, audioEngine]);

  const handleLoopBar = useCallback(
    (barIdx: number) => {
      if (!currentRiff) return;
      const STEPS_PER_BAR = 16;
      const startStep = barIdx * STEPS_PER_BAR;
      const endStep = startStep + STEPS_PER_BAR;
      const filtered = riffSpecToEvents(currentRiff)
        .filter((e) => e.step >= startStep && e.step < endStep)
        .map((e) => ({ ...e, step: e.step - startStep }));
      const barEvents = showEmbellishments ? filtered : stripTechniques(filtered);
      if (barEvents.length === 0) return;
      setIsLooping(true);
      playheadOffsetRef.current = startStep;
      lastPlayedRef.current = { events: barEvents, loop: true, bars: 1 };
      audioEngine.play(barEvents, effectiveBpm, true, {
        countIn: countInEnabled,
        metronome: metronomeEnabled,
        bars: 1,
      });
    },
    [currentRiff, effectiveBpm, audioEngine, setIsLooping, showEmbellishments, countInEnabled, metronomeEnabled],
  );

  // Live tempo: a tempo change mid-playback restarts what was playing at the
  // new BPM (no count-in — the user is already mid-practice).
  const handleTempoChange = useCallback(
    (bpm: number | null) => {
      setTempoOverride(bpm);
      if (isPlaying && lastPlayedRef.current && currentRiff) {
        const newBpm = bpm ?? currentRiff.tempo_bpm;
        const { events, loop, bars } = lastPlayedRef.current;
        audioEngine.play(events, newBpm, loop, {
          countIn: false,
          metronome: metronomeEnabled,
          bars,
        });
      }
    },
    [setTempoOverride, isPlaying, currentRiff, audioEngine, metronomeEnabled],
  );

  const handleShare = useCallback(async () => {
    if (!currentRiff || isSharing) return;
    if (isPlaying) audioEngine.stop();
    setIsSharing(true);
    try {
      // Let the spinner paint before the synchronous render blocks the JS thread.
      await new Promise((resolve) => setTimeout(resolve, 60));
      const events = riffSpecToEvents(currentRiff);
      const result = await AudioExporter.exportToWav(
        showEmbellishments ? events : stripTechniques(events),
        effectiveBpm,
      );
      if (!result.success || !result.filePath) {
        Alert.alert("Export failed", result.error ?? "Unknown error");
        return;
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.filePath, {
          mimeType: "audio/wav",
          dialogTitle: "Share riff",
        });
      } else {
        Alert.alert("Sharing unavailable", "Sharing isn't supported on this device.");
      }
      await AudioExporter.deleteExport(result.filePath);
    } finally {
      setIsSharing(false);
    }
  }, [currentRiff, isSharing, isPlaying, audioEngine, showEmbellishments, effectiveBpm]);

  const handleBarTap = useCallback((barIdx: number) => {
    setBarSheetIdx(barIdx);
  }, []);

  const handleRerollBar = useCallback(
    (barIdx: number) => {
      if (isPlaying) audioEngine.stop();
      rerollBar(barIdx);
    },
    [isPlaying, audioEngine, rerollBar],
  );

  const isSaved = currentRiff
    ? savedRiffs.some((r) => r.seed === currentRiff.seed)
    : false;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeading title="Create" subtitle="Find a phrase you wouldn't have played." />
        <TouchableOpacity
          style={styles.controlsToggle}
          onPress={() => setControlsOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: controlsOpen }}
          accessibilityLabel="Shape the next riff"
        >
          <View style={styles.controlsCopy}>
            <Text style={styles.controlsTitle}>Shape the next riff</Text>
            <Text style={styles.controlsSummary}>{level.charAt(0).toUpperCase() + level.slice(1)} / {key} / {feel ? FEEL_DISPLAY_NAMES[feel] : "Any feel"}</Text>
          </View>
          <Ionicons name={controlsOpen ? "chevron-up" : "options-outline"} size={21} color={colors.accent} />
        </TouchableOpacity>
        {controlsOpen && <View style={styles.generatorControls}>
        <LevelSelector value={level} onChange={setLevel} />
        <KeySelector
          value={key}
          locked={lockedFields.key}
          onChange={setKey}
          onToggleLock={() => toggleLock("key")}
        />
        <FeelSelector
          value={feel}
          locked={lockedFields.feel}
          onChange={setFeel}
          onToggleLock={() => toggleLock("feel")}
        />
        </View>}

        {currentRiff && (
          <View style={styles.cardWrap}>
            <RiffTabView
              riff={currentRiff}
              onBarTap={handleBarTap}
              showEmbellishments={showEmbellishments}
              onToggleEmbellishments={toggleEmbellishments}
              activeStep={activeStep}
            />
          </View>
        )}
        <Text style={styles.tabHint}>Tap a bar to loop it or try new notes.</Text>
      </ScrollView>

      <TempoStepper
        value={effectiveBpm}
        isOverride={tempoOverride !== null}
        onChange={handleTempoChange}
        metronomeEnabled={metronomeEnabled}
        countInEnabled={countInEnabled}
        onToggleMetronome={toggleMetronome}
        onToggleCountIn={toggleCountIn}
      />

      <RiffActionBar
        isPlaying={isPlaying}
        isSaved={isSaved}
        isLooping={isLooping}
        isSharing={isSharing}
        disabled={!currentRiff}
        onPlayToggle={handlePlayToggle}
        onGenerate={handleGenerate}
        onSaveToggle={toggleSaveCurrent}
        onLoopToggle={handleLoopToggle}
        onShare={handleShare}
      />

      <BarActionSheet
        barIndex={barSheetIdx}
        onLoopBar={handleLoopBar}
        onRerollBar={handleRerollBar}
        onClose={() => setBarSheetIdx(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    width: "100%",
    maxWidth: 740,
    alignSelf: "center",
    paddingBottom: spacing.lg,
  },
  cardWrap: {
    marginTop: spacing.md,
  },
  controlsToggle: { marginHorizontal: spacing.lg, padding: spacing.md, backgroundColor: colors.card, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64 },
  controlsCopy: { flex: 1 },
  controlsTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  controlsSummary: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 3 },
  generatorControls: { paddingTop: spacing.sm },
  tabHint: { fontSize: 12, lineHeight: 18, textAlign: "center", color: colors.textMuted, marginTop: spacing.md, paddingHorizontal: spacing.lg },
});
