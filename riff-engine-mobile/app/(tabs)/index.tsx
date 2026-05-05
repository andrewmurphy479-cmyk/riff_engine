import React, { useCallback, useEffect, useState } from "react";
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
  const savedRiffs = useNewRiffStore((s) => s.savedRiffs);
  const generateNewRiff = useNewRiffStore((s) => s.generateNewRiff);
  const rerollBar = useNewRiffStore((s) => s.rerollBar);
  const setFeel = useNewRiffStore((s) => s.setFeel);
  const setKey = useNewRiffStore((s) => s.setKey);
  const setLevel = useNewRiffStore((s) => s.setLevel);
  const setTempoOverride = useNewRiffStore((s) => s.setTempoOverride);
  const setIsLooping = useNewRiffStore((s) => s.setIsLooping);
  const toggleEmbellishments = useNewRiffStore((s) => s.toggleEmbellishments);
  const toggleLock = useNewRiffStore((s) => s.toggleLock);
  const toggleSaveCurrent = useNewRiffStore((s) => s.toggleSaveCurrent);

  const effectiveBpm = tempoOverride ?? currentRiff?.tempo_bpm ?? 110;

  const [isPlaying, setIsPlaying] = useState(false);

  const audioEngine = useAudioEngine({
    onPlaybackStart: () => setIsPlaying(true),
    onPlaybackEnd: () => setIsPlaying(false),
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
    audioEngine.play(
      showEmbellishments ? events : stripTechniques(events),
      effectiveBpm,
      isLooping,
    );
  }, [currentRiff, isPlaying, audioEngine, effectiveBpm, isLooping, showEmbellishments]);

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
      audioEngine.play(barEvents, effectiveBpm, true);
    },
    [currentRiff, effectiveBpm, audioEngine, setIsLooping, showEmbellishments],
  );

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
            />
          </View>
        )}
      </ScrollView>

      <TempoStepper
        value={effectiveBpm}
        isOverride={tempoOverride !== null}
        onChange={setTempoOverride}
      />

      <RiffActionBar
        isPlaying={isPlaying}
        isSaved={isSaved}
        isLooping={isLooping}
        disabled={!currentRiff}
        onPlayToggle={handlePlayToggle}
        onGenerate={handleGenerate}
        onSaveToggle={toggleSaveCurrent}
        onLoopToggle={handleLoopToggle}
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
