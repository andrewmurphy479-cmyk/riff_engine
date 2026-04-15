import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
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
import { RiffTabView } from "../../components/RiffTabView";
import { PHRASE_LABELS } from "../../engine/riff/display";
import { RiffSpec } from "../../engine/riff/spec";
import { riffSpecToEvents } from "../../engine/riff/toEvents";
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
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Library</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="heart-outline" size={56} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No saved riffs yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap the heart on the Create tab to save a riff you like.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Library</Text>
        <Text style={styles.headerCount}>
          {savedRiffs.length} {savedRiffs.length === 1 ? "riff" : "riffs"}
        </Text>
      </View>

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
    >
      <View style={styles.rowLeft}>
        <Text style={styles.rowTitle}>
          {riff.key} {scalePretty}
        </Text>
        <Text style={styles.rowSub}>
          {riff.tempo_bpm} BPM
          {riff.feel ? ` · ${riff.feel}` : ""}
          {riff.rhythm_name ? ` · ${riff.rhythm_name}` : ""}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowPhrase}>{phraseTags.join(" ")}</Text>
        <Text style={styles.rowSeed}>seed {riff.seed}</Text>
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

  const audioEngine = useAudioEngine({
    onPlaybackStart: () => setIsPlaying(true),
    onPlaybackEnd: () => setIsPlaying(false),
  });

  useEffect(() => {
    return () => AudioEngine.stop();
  }, []);

  const handlePlayToggle = useCallback(() => {
    if (isPlaying) {
      audioEngine.stop();
      return;
    }
    audioEngine.play(riffSpecToEvents(riff), riff.tempo_bpm);
  }, [riff, isPlaying, audioEngine]);

  return (
    <SafeAreaView style={styles.sheet}>
      <View style={styles.sheetHeader}>
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.sheetTitle}>Saved Riff</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.sheetScroll}
        contentContainerStyle={styles.sheetContent}
        showsVerticalScrollIndicator={false}
      >
        <RiffTabView
          riff={riff}
          footer={
            <View style={styles.sheetControls}>
              <TouchableOpacity
                style={styles.playButton}
                onPress={handlePlayToggle}
                activeOpacity={0.7}
              >
                <Text style={styles.playGlyph}>{isPlaying ? "■" : "▶"}</Text>
                <Text style={styles.playLabel}>
                  {isPlaying ? "Stop" : "Play"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={onRemove}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={16} color="#FF4E78" />
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
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 2,
  },
  headerCount: {
    marginLeft: spacing.sm,
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: "monospace",
  },
  listContent: {
    paddingVertical: spacing.sm,
  },
  separator: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    marginHorizontal: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowLeft: {
    flex: 1,
  },
  rowTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "700",
    textTransform: "lowercase",
    marginBottom: 3,
  },
  rowSub: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    fontFamily: "monospace",
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
  rowSeed: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: "monospace",
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
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  sheetScroll: {
    flex: 1,
  },
  sheetContent: {
    paddingVertical: spacing.md,
  },
  sheetControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(74, 122, 255, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(74, 122, 255, 0.35)",
  },
  playGlyph: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
  },
  playLabel: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  removeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: borderRadius.sm,
    backgroundColor: "rgba(255, 78, 120, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 78, 120, 0.3)",
  },
  removeLabel: {
    color: "#FF4E78",
    fontSize: 12,
    fontWeight: "600",
  },
});
