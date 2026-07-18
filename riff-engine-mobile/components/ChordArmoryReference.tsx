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
import { SamplePlayer } from "../audio/SamplePlayer";
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
    SamplePlayer.stopAll();
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
    SamplePlayer.preGenerateTones(tones);
  }, []);

  useEffect(() => () => clearPlayTimeouts(), [clearPlayTimeouts]);

  const handlePlayPreview = useCallback((chordId: string) => {
    const shape = getChordShape(chordId);
    shape.forEach(({ string: guitarString, fret }, i) => {
      setTimeout(() => {
        SamplePlayer.playNote(
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
          SamplePlayer.playNote(
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
      <View style={styles.header}>
        <Text style={styles.title}>Chord Armory</Text>
        <Text style={styles.subtitle}>
          tap to audition · long-press for pair hints
        </Text>
      </View>

      <View style={styles.progressionContainer}>
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
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={styles.progressionPlayIcon}>
                {isPlayingProgression ? "\u25A0" : "\u25B6"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.placeholder}>
            Tap cards to build a progression
          </Text>
        )}
      </View>

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
        >
          <Text style={styles.bottomButtonText}>Shuffle</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bottomButton, !hasProgression && styles.bottomButtonDisabled]}
          onPress={handleClear}
          activeOpacity={0.7}
          disabled={!hasProgression}
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  progressionContainer: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.sm,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: spacing.sm,
  },
  progressionPlayBtnActive: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  progressionPlayIcon: {
    color: colors.white,
    fontSize: 13,
    marginLeft: 1,
  },
  cardSlot: {
    width: "47%",
    marginBottom: spacing.md,
  },
  progressionChip: {
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
    textAlign: "center",
    paddingVertical: spacing.xs,
  },
  scrollArea: {
    flex: 1,
    marginTop: spacing.md,
  },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-evenly",
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.lg,
  },
  bottomBar: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
  },
  bottomButton: {
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
