import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AudioEngine, useAudioEngine } from "../../audio/AudioEngine";
import { AudioExporter } from "../../audio/AudioExporter";
import { RiffTabView } from "../../components/RiffTabView";
import { FEEL_DISPLAY_NAMES, PHRASE_LABELS } from "../../engine/riff/display";
import { ScreenHeading } from "../../components/ScreenHeading";
import { analog } from "../../theme/analog";
import { RiffSpec } from "../../engine/riff/spec";
import { riffSpecToEvents, stripTechniques } from "../../engine/riff/toEvents";
import { hapticTap } from "../../lib/haptics";
import { useNewRiffStore } from "../../store/useNewRiffStore";
import { borderRadius, colors, spacing } from "../../theme/colors";

export default function LibraryScreen() {
  const savedRiffs = useNewRiffStore((s) => s.savedRiffs);
  const unsaveRiff = useNewRiffStore((s) => s.unsaveRiff);

  const [openRiff, setOpenRiff] = useState<RiffSpec | null>(null);

  const handleOpen = useCallback((riff: RiffSpec) => setOpenRiff(riff), []);
  const handleClose = useCallback(() => setOpenRiff(null), []);
  const handleRemove = useCallback(
    (seed: number) => {
      unsaveRiff(seed);
      setOpenRiff(null);
    },
    [unsaveRiff],
  );

  // If the currently open riff gets unsaved externally, close the modal.
  useEffect(() => {
    if (openRiff && !savedRiffs.some((r) => r.seed === openRiff.seed)) {
      setOpenRiff(null);
    }
  }, [savedRiffs, openRiff]);

  if (savedRiffs.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeading title="Library" subtitle="Keep the phrases worth coming back to." />
        <View style={styles.emptyState}>
          <View style={styles.emptyArt}><Ionicons name="albums-outline" size={52} color={colors.accent} /></View>
          <Text style={styles.emptyTitle}>Start your collection</Text>
          <Text style={styles.emptySubtitle}>
            Tap the heart on the Create tab to save a riff you like.
          </Text>
          <TouchableOpacity style={styles.createButton} onPress={() => router.push("/")} accessibilityRole="button" accessibilityLabel="Create a riff">
            <Text style={styles.createButtonLabel}>Find a riff to keep</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeading title="Library" subtitle={`${savedRiffs.length} ${savedRiffs.length === 1 ? "riff" : "riffs"} to come back to. Make one your own.`} />

      <FlatList
        data={savedRiffs}
        keyExtractor={(r) => String(r.seed)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <SavedRiffRow riff={item} onPress={() => handleOpen(item)} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <Modal
        visible={openRiff !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}
      >
        {openRiff && (
          <DetailSheet
            riff={openRiff}
            onClose={handleClose}
            onRemove={() => handleRemove(openRiff.seed)}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

interface RowProps {
  riff: RiffSpec;
  onPress: () => void;
}

function SavedRiffRow({ riff, onPress }: RowProps) {
  const scalePretty = riff.scale
    .replace(/_/g, " ")
    .replace("+blue", " + blue");
  const phraseTags = PHRASE_LABELS[riff.motif_structure] ?? [];

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Open saved riff in ${riff.key}, ${riff.tempo_bpm} BPM`}
    >
      <View style={styles.recordLabel}><Text style={styles.recordKey}>{riff.key}</Text><Ionicons name="musical-note" size={18} color={analog.oxblood} /></View>
      <View style={styles.rowLeft}>
        <Text style={styles.rowTitle}>
          {riff.key} {scalePretty}
        </Text>
        <Text style={styles.rowSub}>
          {riff.tempo_bpm} BPM
          {riff.feel ? ` / ${FEEL_DISPLAY_NAMES[riff.feel] ?? riff.feel.replace(/_/g, " ")}` : ""}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowPhrase}>{phraseTags.join(" ")}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

interface SheetProps {
  riff: RiffSpec;
  onClose: () => void;
  onRemove: () => void;
}

function DetailSheet({ riff, onClose, onRemove }: SheetProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const showEmbellishments = useNewRiffStore((s) => s.showEmbellishments);
  const toggleEmbellishments = useNewRiffStore((s) => s.toggleEmbellishments);

  const audioEngine = useAudioEngine({
    onPlaybackStart: () => setIsPlaying(true),
    onPlaybackEnd: () => {
      setIsPlaying(false);
      setActiveStep(null);
    },
    onStepPlay: (step) => setActiveStep(step < 0 ? null : step),
  });

  useEffect(() => {
    return () => AudioEngine.stop();
  }, []);

  // The sheet only mounts for an opened riff, so warming here costs nothing
  // for the rest of the library (audit A8).
  useEffect(() => {
    const events = riffSpecToEvents(riff);
    audioEngine.prepare(showEmbellishments ? events : stripTechniques(events));
  }, [riff, showEmbellishments, audioEngine]);

  const handlePlayToggle = useCallback(() => {
    hapticTap();
    if (isPlaying) {
      audioEngine.stop();
      return;
    }
    const events = riffSpecToEvents(riff);
    audioEngine.play(
      showEmbellishments ? events : stripTechniques(events),
      riff.tempo_bpm,
      false,
      { bars: riff.bars.length },
    );
  }, [riff, isPlaying, audioEngine, showEmbellishments]);

  const handleShare = useCallback(async () => {
    if (isSharing) return;
    if (isPlaying) audioEngine.stop();
    setIsSharing(true);
    try {
      // Let the spinner paint before the synchronous render blocks the JS thread.
      await new Promise((resolve) => setTimeout(resolve, 60));
      const events = riffSpecToEvents(riff);
      const result = await AudioExporter.exportToWav(
        showEmbellishments ? events : stripTechniques(events),
        riff.tempo_bpm,
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
  }, [riff, isSharing, isPlaying, audioEngine, showEmbellishments]);

  return (
    <SafeAreaView style={styles.sheet}>
      <View style={styles.sheetHeader}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Close saved riff"
        >
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.sheetTitle}>From your collection</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.sheetScroll}
        contentContainerStyle={styles.sheetContent}
        showsVerticalScrollIndicator={false}
      >
        <RiffTabView
          riff={riff}
          showEmbellishments={showEmbellishments}
          onToggleEmbellishments={toggleEmbellishments}
          activeStep={activeStep}
          footer={
            <View style={styles.sheetControls}>
              <TouchableOpacity
                style={styles.playButton}
                onPress={handlePlayToggle}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={isPlaying ? "Stop saved riff" : "Play saved riff"}
              >
                <Ionicons
                  name={isPlaying ? "stop" : "play"}
                  size={14}
                  color={colors.white}
                />
                <Text style={styles.playLabel}>
                  {isPlaying ? "Stop" : "Play"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={handleShare}
                disabled={isSharing}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Share saved riff"
              >
                {isSharing ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Ionicons
                    name="share-outline"
                    size={16}
                    color={colors.accent}
                  />
                )}
                <Text style={styles.shareLabel}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={onRemove}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Remove saved riff"
              >
                <Ionicons name="trash-outline" size={16} color={colors.heart} />
                <Text style={styles.removeLabel}>Remove</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    width: "100%",
    maxWidth: 740,
    alignSelf: "center",
    paddingVertical: spacing.sm,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 12,
  },
  rowLeft: {
    flex: 1,
  },
  rowTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 3,
  },
  rowSub: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  rowRight: {
    alignItems: "flex-end",
  },
  rowPhrase: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "monospace",
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  recordLabel: { width: 50, minHeight: 68, borderRadius: 10, backgroundColor: analog.butter, alignItems: "center", justifyContent: "center", gap: 5 },
  recordKey: { fontFamily: analog.headingFont, fontSize: 23, fontWeight: "700", color: analog.oxblood },
  emptyArt: { width: 112, height: 112, borderRadius: 28, backgroundColor: analog.butter, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  createButton: { borderRadius: 28, backgroundColor: analog.oxblood, paddingVertical: 15, paddingHorizontal: 24, marginTop: 8 },
  createButtonLabel: { color: analog.paper, fontSize: 15, fontWeight: "600" },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: {
    fontFamily: analog.headingFont,
    fontSize: 27,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 280,
    color: colors.textSecondary,
    textAlign: "center",
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.background,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    color: colors.accent,
    fontFamily: analog.headingFont,
    fontSize: 20,
    fontWeight: "700",
    flexShrink: 1,
  },
  sheetScroll: {
    flex: 1,
  },
  sheetContent: {
    width: "100%",
    maxWidth: 740,
    alignSelf: "center",
    paddingVertical: spacing.md,
  },
  sheetControls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  playButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  playLabel: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  shareButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.chipInactive,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "600",
  },
  removeButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.heartBg,
    borderWidth: 1,
    borderColor: colors.heartBorder,
  },
  removeLabel: {
    color: colors.heart,
    fontSize: 12,
    fontWeight: "600",
  },
  closeButton: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
});
