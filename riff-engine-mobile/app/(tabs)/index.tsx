import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { FeelSelector } from "../../components/FeelSelector";
import { KeySelector } from "../../components/KeySelector";
import { LevelSelector } from "../../components/LevelSelector";
import { RiffActionBar } from "../../components/RiffActionBar";
import { RiffTabView } from "../../components/RiffTabView";
import { TempoStepper } from "../../components/TempoStepper";
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

  // Bar loops re-base steps to 0-15; this offset maps them back onto the
  // full tab so the playhead lands in the right bar.
  const playheadOffsetRef = useRef(0);
  // What's currently sounding, so tempo changes can restart the same thing.
  const lastPlayedRef = useRef<{ events: TabEvent[]; loop: boolean } | null>(null);

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

  const handlePlayToggle = useCallback(() => {
    if (!currentRiff) return;
    if (isPlaying) {
      audioEngine.stop();
      return;
    }
    const events = riffSpecToEvents(currentRiff);
    const playEvents = showEmbellishments ? events : stripTechniques(events);
    playheadOffsetRef.current = 0;
    lastPlayedRef.current = { events: playEvents, loop: isLooping };
    audioEngine.play(playEvents, effectiveBpm, isLooping, {
      countIn: countInEnabled,
      metronome: metronomeEnabled,
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
      lastPlayedRef.current = { events: barEvents, loop: true };
      audioEngine.play(barEvents, effectiveBpm, true, {
        countIn: countInEnabled,
        metronome: metronomeEnabled,
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
        const { events, loop } = lastPlayedRef.current;
        audioEngine.play(events, newBpm, loop, {
          countIn: false,
          metronome: metronomeEnabled,
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

  const handleBarTap = useCallback(
    (barIdx: number) => {
      Alert.alert(
        `Bar ${barIdx + 1}`,
        undefined,
        [
          { text: "Loop this bar", onPress: () => handleLoopBar(barIdx) },
          {
            text: "Re-roll this bar",
            onPress: () => {
              if (isPlaying) audioEngine.stop();
              rerollBar(barIdx);
            },
          },
          { text: "Cancel", style: "cancel" },
        ],
        { cancelable: true },
      );
    },
    [handleLoopBar, rerollBar, isPlaying, audioEngine],
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
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  cardWrap: {
    marginTop: spacing.xs,
  },
});
