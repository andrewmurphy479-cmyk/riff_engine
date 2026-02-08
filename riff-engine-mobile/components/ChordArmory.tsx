import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useRiffStore } from '../store/useRiffStore';
import { getAllowedChordsForDifficulty } from '../engine/difficulty';
import { getRandomMoodProgression } from '../engine/progressions';
import { getChordShape } from '../engine/theory';
import { CHORD_CARD_DATA } from '../engine/chordCardData';
import { SamplePlayer } from '../audio/SamplePlayer';
import { fretToMidiNote } from '../audio/noteMapping';
import { ChordCard } from './ChordCard';
import { colors, spacing, borderRadius, chordColors } from '../theme/colors';

const ALL_CHORDS = ['Em', 'C', 'G', 'D', 'Am', 'A', 'E', 'Dm', 'F', 'B7'];

export function ChordArmory() {
  const {
    mood,
    difficulty,
    numBars,
    customProgression,
    isChordArmoryOpen,
    addChordToProgression,
    removeChordFromProgression,
    setCustomProgression,
    closeChordArmory,
  } = useRiffStore();

  const allowedChords = getAllowedChordsForDifficulty(difficulty);
  const hasProgression = customProgression && customProgression.length > 0;

  // Pre-generate tones when modal opens
  useEffect(() => {
    if (!isChordArmoryOpen) return;
    const tonesToPregen = allowedChords.flatMap((chordId) => {
      const shape = getChordShape(chordId);
      return shape.map((note) => ({
        midiNote: fretToMidiNote(note.string, note.fret),
        durationMs: 800,
        velocity: 0.6,
        guitarString: note.string,
      }));
    });
    SamplePlayer.preGenerateTones(tonesToPregen);
  }, [isChordArmoryOpen]);

  const handlePlayPreview = (chordId: string) => {
    const shape = getChordShape(chordId);
    shape.forEach(({ string: guitarString, fret }, i) => {
      setTimeout(() => {
        SamplePlayer.playNote(guitarString, fret, 0.6, 800);
      }, i * 30);
    });
  };

  const handleShuffle = () => {
    const prog = getRandomMoodProgression(mood, numBars, allowedChords);
    setCustomProgression(prog);
  };

  const handleClear = () => {
    setCustomProgression(null);
  };

  const handleCardSelect = (chord: string) => {
    addChordToProgression(chord);
  };

  // Sort: allowed chords first
  const sortedChords = [...ALL_CHORDS].sort((a, b) => {
    const aAllowed = allowedChords.includes(a) ? 0 : 1;
    const bAllowed = allowedChords.includes(b) ? 0 : 1;
    return aAllowed - bAllowed;
  });

  return (
    <Modal
      visible={isChordArmoryOpen}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <SafeAreaView style={styles.modalRoot}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Chord Armory</Text>
          <TouchableOpacity style={styles.doneButton} onPress={closeChordArmory} activeOpacity={0.7}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Progression strip */}
        <View style={styles.progressionContainer}>
          {hasProgression ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.progressionScroll}
            >
              {customProgression.map((chord, index) => (
                <React.Fragment key={`${index}-${chord}`}>
                  {index > 0 && <Text style={styles.arrow}>{'>'}</Text>}
                  <TouchableOpacity
                    style={styles.progressionChip}
                    onPress={() => removeChordFromProgression(index)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.progressionChipText}>{chord}</Text>
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.placeholder}>Tap cards to build a progression</Text>
          )}
        </View>

        {/* Card grid */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.cardGrid}
          showsVerticalScrollIndicator={false}
        >
          {sortedChords.map((chordId) => {
            const isAllowed = allowedChords.includes(chordId);
            const isSelected = customProgression?.includes(chordId) ?? false;
            return (
              <ChordCard
                key={chordId}
                chordId={chordId}
                isSelected={isSelected}
                isAllowed={isAllowed}
                onSelect={() => handleCardSelect(chordId)}
                onPlayPreview={() => handlePlayPreview(chordId)}
              />
            );
          })}
        </ScrollView>

        {/* Bottom bar */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.bottomButton} onPress={handleShuffle} activeOpacity={0.7}>
            <Text style={styles.bottomButtonText}>Shuffle</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bottomButton, !hasProgression && styles.bottomButtonDisabled]}
            onPress={handleClear}
            activeOpacity={0.7}
            disabled={!hasProgression}
          >
            <Text style={[styles.bottomButtonText, !hasProgression && styles.bottomButtonTextDisabled]}>
              Clear
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bottomButtonPrimary]}
            onPress={closeChordArmory}
            activeOpacity={0.7}
          >
            <Text style={styles.bottomButtonPrimaryText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: chordColors.modalBackground,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  doneButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accent,
  },
  progressionContainer: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.sm,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  progressionScroll: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  progressionChip: {
    backgroundColor: colors.chipActive,
    borderWidth: 1,
    borderColor: colors.chipActiveBorder,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
  },
  progressionChipText: {
    color: colors.accentLight,
    fontSize: 15,
    fontWeight: '600',
  },
  arrow: {
    color: colors.textMuted,
    fontSize: 14,
    marginHorizontal: spacing.xs,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
  scrollArea: {
    flex: 1,
    marginTop: spacing.md,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.lg,
  },
  bottomBar: {
    flexDirection: 'row',
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
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  bottomButtonDisabled: {
    opacity: 0.4,
  },
  bottomButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  bottomButtonTextDisabled: {
    color: colors.textDisabled,
  },
  bottomButtonPrimary: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  bottomButtonPrimaryText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
});
