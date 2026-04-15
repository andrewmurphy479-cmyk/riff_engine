import React, { useCallback, useEffect, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { FeelSelector } from "../../components/FeelSelector";
import { RiffActionBar } from "../../components/RiffActionBar";
import { RiffTabView } from "../../components/RiffTabView";
import { useAudioEngine } from "../../audio/AudioEngine";
import { useNewRiffStore } from "../../store/useNewRiffStore";
import { riffSpecToEvents } from "../../engine/riff/toEvents";
import { colors, spacing } from "../../theme/colors";

export default function HomeScreen() {
  const currentRiff = useNewRiffStore((s) => s.currentRiff);
  const feel = useNewRiffStore((s) => s.feel);
  const savedRiffs = useNewRiffStore((s) => s.savedRiffs);
  const generateNewRiff = useNewRiffStore((s) => s.generateNewRiff);
  const setFeel = useNewRiffStore((s) => s.setFeel);
  const toggleSaveCurrent = useNewRiffStore((s) => s.toggleSaveCurrent);

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
    audioEngine.play(riffSpecToEvents(currentRiff), currentRiff.tempo_bpm);
  }, [currentRiff, isPlaying, audioEngine]);

  const handleGenerate = useCallback(() => {
    if (isPlaying) audioEngine.stop();
    generateNewRiff();
  }, [isPlaying, audioEngine, generateNewRiff]);

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
        <FeelSelector value={feel} onChange={setFeel} />

        {currentRiff && (
          <View style={styles.cardWrap}>
            <RiffTabView riff={currentRiff} />
          </View>
        )}
      </ScrollView>

      <RiffActionBar
        isPlaying={isPlaying}
        isSaved={isSaved}
        disabled={!currentRiff}
        onPlayToggle={handlePlayToggle}
        onGenerate={handleGenerate}
        onSaveToggle={toggleSaveCurrent}
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
