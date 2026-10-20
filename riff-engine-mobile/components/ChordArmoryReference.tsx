import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AudioEngine } from "../audio/AudioEngine";
import { fretToMidiNote } from "../audio/noteMapping";
import { CHORD_CARD_DATA } from "../engine/chordCardData";
import { getChordShape } from "../engine/theory";
import {
  borderRadius,
  chordColors,
  colors,
  getChordColors,
  spacing,
} from "../theme/colors";
import { ChordCard } from "./ChordCard";
import { ScreenHeading } from "./ScreenHeading";
import { analog } from "../theme/analog";

const ALL_CHORDS = [
  "Em", "C", "G", "D", "Am", "A", "E", "Dm", "F",
  "B7", "A7", "E7", "D7", "G7", "Bm", "Cadd9",
] as const;

const PROGRESSION_CHORD_GAP_MS = 1100;
const PROGRESSION_STRUM_GAP_MS = 30;
const PROGRESSION_NOTE_DURATION_MS = 1000;

export function ChordArmoryReference() {
  const [progression, setProgression] = useState<string[]>([]);

  const [pairSourceChord, setPairSourceChord] = useState<string | null>(null);
  const [highlightedPairs, setHighlightedPairs] = useState<Set<string>>(
    new Set(),
  );

  const [isPlayingProgression, setIsPlayingProgression] = useState(false);
  const playTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const hasProgression = progression.length > 0;

  const clearPlayTimeouts = useCallback(() => {
    playTimeoutsRef.current.forEach((t) => clearTimeout(t));
    playTimeoutsRef.current = [];
  }, []);

  const stopProgressionPlayback = useCallback(() => {
    clearPlayTimeouts();
    setIsPlayingProgression(false);
    AudioEngine.stopAllNotes();
  }, [clearPlayTimeouts]);

  useEffect(() => {
    const tones = ALL_CHORDS.flatMap((chordId) =>
      getChordShape(chordId).map((note) => ({
        midiNote: fretToMidiNote(note.string, note.fret),
        durationMs: PROGRESSION_NOTE_DURATION_MS,
        velocity: 0.6,
        guitarString: note.string,
      })),
    );
    AudioEngine.prepareTones(tones);
  }, []);

  useEffect(() => () => clearPlayTimeouts(), [clearPlayTimeouts]);

  const handlePlayPreview = useCallback((chordId: string) => {
    const shape = getChordShape(chordId);
    shape.forEach(({ string: guitarString, fret }, i) => {
      setTimeout(() => {
        AudioEngine.playNote(
          guitarString,
          fret,
          0.6,
          PROGRESSION_NOTE_DURATION_MS,
        );
      }, i * PROGRESSION_STRUM_GAP_MS);
    });
  }, []);

  const handlePlayProgression = useCallback(() => {
    if (isPlayingProgression) {
      stopProgressionPlayback();
      return;
    }
    if (progression.length === 0) return;

    setIsPlayingProgression(true);
    progression.forEach((chordId, chordIdx) => {
      const shape = getChordShape(chordId);
      shape.forEach(({ string: guitarString, fret }, stringIdx) => {
        const t = setTimeout(() => {
          AudioEngine.playNote(
            guitarString,
            fret,
            0.6,
            PROGRESSION_NOTE_DURATION_MS,
          );
        }, chordIdx * PROGRESSION_CHORD_GAP_MS + stringIdx * PROGRESSION_STRUM_GAP_MS);
        playTimeoutsRef.current.push(t);
      });
    });
    const endTimer = setTimeout(() => {
      setIsPlayingProgression(false);
      playTimeoutsRef.current = [];
    }, progression.length * PROGRESSION_CHORD_GAP_MS);
    playTimeoutsRef.current.push(endTimer);
  }, [progression, isPlayingProgression, stopProgressionPlayback]);

  const handleShuffle = useCallback(() => {
    stopProgressionPlayback();
    const length = 4;
    const out: string[] = [];
    for (let i = 0; i < length; i++) {
      out.push(ALL_CHORDS[Math.floor(Math.random() * ALL_CHORDS.length)]);
    }
    setProgression(out);
  }, [stopProgressionPlayback]);

  const handleClear = useCallback(() => {
    stopProgressionPlayback();
    setProgression([]);
  }, [stopProgressionPlayback]);

  const handleCardSelect = useCallback((chordId: string) => {
    setPairSourceChord(null);
    setHighlightedPairs(new Set());
    setProgression((prev) => [...prev, chordId]);
  }, []);

  const handleRemove = useCallback((index: number) => {
    setProgression((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleLongPress = useCallback(
    (chordId: string) => {
      if (pairSourceChord === chordId) {
        setPairSourceChord(null);
        setHighlightedPairs(new Set());
      } else {
        const meta = CHORD_CARD_DATA[chordId];
        if (meta) {
          setPairSourceChord(chordId);
          setHighlightedPairs(new Set(meta.pairsWellWith));
        }
      }
    },
    [pairSourceChord],
  );

  const lastProgChord = hasProgression
    ? progression[progression.length - 1]
    : null;

  const autoPairs = useMemo(() => {
    if (pairSourceChord || !lastProgChord) return new Set<string>();
    const meta = CHORD_CARD_DATA[lastProgChord];
    return new Set(meta?.pairsWellWith ?? []);
  }, [pairSourceChord, lastProgChord]);

  const usingAutoPairs = !pairSourceChord && autoPairs.size > 0;
  const effectiveHighlights = pairSourceChord ? highlightedPairs : autoPairs;
  const effectivePairSourceColor = pairSourceChord
    ? getChordColors(pairSourceChord).accent
    : lastProgChord
    ? getChordColors(lastProgChord).accent
    : undefined;

  return (
    <View style={styles.root}>
      <ScreenHeading title="Chord Armory" subtitle="Collect a few shapes. Hear where they lead." />

      <View style={styles.progressionContainer}>
        <Text style={styles.progressionLabel}>Your progression</Text>
        {hasProgression ? (
          <View style={styles.progressionRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.progressionScroll}
              style={styles.progressionScrollFlex}
            >
              {progression.map((chord, index) => {
                const chipColor = getChordColors(chord);
                return (
                  <React.Fragment key={`${index}-${chord}`}>
                    {index > 0 && <Text style={styles.arrow}>{">"}</Text>}
                    <TouchableOpacity
                      style={[
                        styles.progressionChip,
                        {
                          backgroundColor: chipColor.bg,
                          borderColor: chipColor.border,
                        },
                      ]}
                      onPress={() => handleRemove(index)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${chord} at position ${index + 1}`}
                    >
                      <Text
                        style={[
                          styles.progressionChipText,
                          { color: chipColor.text },
                        ]}
                      >
                        {chord}
                      </Text>
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={[
                styles.progressionPlayBtn,
                isPlayingProgression && styles.progressionPlayBtnActive,
              ]}
              onPress={handlePlayProgression}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={isPlayingProgression ? "Stop progression" : "Play progression"}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={styles.progressionPlayIcon}>
                {isPlayingProgression ? "\u25A0" : "\u25B6"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.placeholder}>
            Tap a chord card to add it here.
          </Text>
        )}
      </View>
      <Text style={styles.cardHint}>Play to listen. Hold a card for pair suggestions.</Text>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.cardGrid}
        showsVerticalScrollIndicator={false}
      >
        {ALL_CHORDS.map((chordId) => {
          const isSelected = progression.includes(chordId);
          const isPairHighlighted = effectiveHighlights.has(chordId);
          const isPairSource = pairSourceChord === chordId;
          return (
            <View key={chordId} style={styles.cardSlot}>
              <ChordCard
                chordId={chordId}
                isSelected={isSelected}
                isAllowed={true}
                onSelect={() => handleCardSelect(chordId)}
                onPlayPreview={() => handlePlayPreview(chordId)}
                isPairHighlighted={isPairHighlighted}
                pairSourceColor={effectivePairSourceColor}
                isPairSource={isPairSource}
                isPairAuto={usingAutoPairs}
                onLongPress={() => handleLongPress(chordId)}
              />
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.bottomButton}
          onPress={handleShuffle}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Shuffle progression"
        >
          <Text style={styles.bottomButtonText}>Shuffle</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bottomButton, !hasProgression && styles.bottomButtonDisabled]}
          onPress={handleClear}
          activeOpacity={0.7}
          disabled={!hasProgression}
          accessibilityRole="button"
          accessibilityLabel="Clear progression"
        >
          <Text
            style={[
              styles.bottomButtonText,
              !hasProgression && styles.bottomButtonTextDisabled,
            ]}
          >
            Clear
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: chordColors.modalBackground,
  },
  progressionLabel: { fontSize: 13, fontWeight: "700", color: analog.oxblood, marginBottom: 8 },
  cardHint: { color: colors.textMuted, fontSize: 12, lineHeight: 18, paddingHorizontal: 20, paddingTop: 12, width: "100%", maxWidth: 740, alignSelf: "center" },
  progressionContainer: {
    backgroundColor: analog.butter,
    width: "92%",
    maxWidth: 700,
    alignSelf: "center",
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    minHeight: 86,
    justifyContent: "center",
    padding: spacing.md,
  },
  progressionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressionScrollFlex: {
    flex: 1,
  },
  progressionScroll: {
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  progressionPlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: spacing.sm,
  },
  progressionPlayBtnActive: {
    backgroundColor: analog.indigo,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  progressionPlayIcon: {
    color: colors.white,
    fontSize: 13,
    marginLeft: 1,
  },
  cardSlot: {
    width: "48%",
    marginBottom: spacing.md,
  },
  progressionChip: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
  },
  progressionChipText: {
    fontSize: 15,
    fontWeight: "600",
  },
  arrow: {
    color: colors.textMuted,
    fontSize: 14,
    marginHorizontal: spacing.xs,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "left",
    paddingVertical: spacing.xs,
  },
  scrollArea: {
    flex: 1,
    marginTop: spacing.md,
  },
  cardGrid: {
    width: "100%",
    maxWidth: 740,
    alignSelf: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  bottomBar: {
    width: "100%",
    maxWidth: 740,
    alignSelf: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  bottomButton: {
    minHeight: 44,
    justifyContent: "center",
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  bottomButtonDisabled: {
    opacity: 0.4,
  },
  bottomButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  bottomButtonTextDisabled: {
    color: colors.textDisabled,
  },
});
