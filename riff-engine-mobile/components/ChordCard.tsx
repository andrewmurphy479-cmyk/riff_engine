import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import { colors, spacing, borderRadius, chordColors } from '../theme/colors';
import { CHORD_THEORY, getChordShape, FRETBOARD_STRINGS } from '../engine/theory';
import { CHORD_CARD_DATA, ChordCardMeta } from '../engine/chordCardData';
import { GuitarString } from '../engine/types';

interface ChordCardProps {
  chordId: string;
  isSelected: boolean;
  isAllowed: boolean;
  onSelect: () => void;
  onPlayPreview: () => void;
}

const STRING_X: Record<GuitarString, number> = {
  E: 12, A: 32, D: 52, G: 72, B: 92, e: 112,
};
const FRET_SPACING = 18;
const FRET_OFFSET = 10;

function MiniFretboard({ chordId }: { chordId: string }) {
  const shape = getChordShape(chordId);
  const maxFret = Math.max(...shape.map((n) => n.fret), 3);
  const fretCount = Math.min(maxFret + 1, 5);
  const height = fretCount * FRET_SPACING + FRET_OFFSET + 4;

  return (
    <Svg width={124} height={height}>
      {/* Nut */}
      <Line x1={8} y1={FRET_OFFSET} x2={116} y2={FRET_OFFSET} stroke="rgba(255,255,255,0.5)" strokeWidth={2} />
      {/* Strings */}
      {FRETBOARD_STRINGS.map((s) => (
        <Line
          key={s}
          x1={STRING_X[s]}
          y1={FRET_OFFSET}
          x2={STRING_X[s]}
          y2={height}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1}
        />
      ))}
      {/* Frets */}
      {Array.from({ length: fretCount }, (_, i) => (
        <Line
          key={i}
          x1={8}
          y1={FRET_OFFSET + (i + 1) * FRET_SPACING}
          x2={116}
          y2={FRET_OFFSET + (i + 1) * FRET_SPACING}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1}
        />
      ))}
      {/* Finger dots */}
      {shape.map((note, i) => {
        const x = STRING_X[note.string];
        const y =
          note.fret === 0
            ? FRET_OFFSET - 1
            : FRET_OFFSET + (note.fret - 0.5) * FRET_SPACING;
        return (
          <Circle
            key={i}
            cx={x}
            cy={y}
            r={note.fret === 0 ? 3.5 : 5}
            fill={note.fret === 0 ? 'transparent' : 'rgba(255,255,255,0.85)'}
            stroke={note.fret === 0 ? 'rgba(255,255,255,0.6)' : 'none'}
            strokeWidth={note.fret === 0 ? 1.5 : 0}
          />
        );
      })}
    </Svg>
  );
}

function DifficultyDots({ tier }: { tier: number }) {
  return (
    <View style={dotStyles.container}>
      {[1, 2, 3].map((n) => (
        <View
          key={n}
          style={[dotStyles.dot, n <= tier ? dotStyles.dotFilled : dotStyles.dotEmpty]}
        />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    marginTop: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotFilled: {
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  dotEmpty: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
});

export function ChordCard({ chordId, isSelected, isAllowed, onSelect, onPlayPreview }: ChordCardProps) {
  const meta: ChordCardMeta = CHORD_CARD_DATA[chordId] ?? {
    nickname: chordId,
    flavorText: '',
    quality: 'major' as const,
    pairsWellWith: [],
    difficultyTier: 1 as const,
  };
  const theory = CHORD_THEORY[chordId];
  const qualityColors = chordColors[meta.quality];

  return (
    <TouchableOpacity
      style={[
        cardStyles.card,
        { borderColor: isSelected ? chordColors.selectedGlow : qualityColors.border },
        isSelected && cardStyles.cardSelected,
        !isAllowed && cardStyles.cardDisabled,
      ]}
      onPress={onSelect}
      activeOpacity={isAllowed ? 0.7 : 1}
      disabled={!isAllowed}
    >
      {/* Quality color top bar */}
      <View style={[cardStyles.topBar, { backgroundColor: qualityColors.accent }]} />

      {/* Header row */}
      <View style={cardStyles.header}>
        <Text style={[cardStyles.nickname, { color: qualityColors.text }]} numberOfLines={1}>
          {meta.nickname}
        </Text>
        <TouchableOpacity
          style={[cardStyles.playBtn, { backgroundColor: qualityColors.bg }]}
          onPress={(e) => {
            e.stopPropagation();
            onPlayPreview();
          }}
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[cardStyles.playIcon, { color: qualityColors.accent }]}>{'▶'}</Text>
        </TouchableOpacity>
      </View>

      {/* Chord name */}
      <Text style={cardStyles.chordName}>{chordId}</Text>

      {/* Flavor text */}
      <Text style={cardStyles.flavorText} numberOfLines={2}>
        {meta.flavorText}
      </Text>

      {/* Theory info */}
      {theory && (
        <View style={cardStyles.theoryBox}>
          <Text style={cardStyles.theoryLine}>Intervals: {theory.intervals}</Text>
          <Text style={cardStyles.theoryLine}>Notes: {theory.notes.join(' - ')}</Text>
          <Text style={cardStyles.theoryLine}>
            Pairs with: {meta.pairsWellWith.join(', ')}
          </Text>
        </View>
      )}

      {/* Mini fretboard */}
      <View style={cardStyles.fretboardWrap}>
        <MiniFretboard chordId={chordId} />
      </View>

      {/* Difficulty dots */}
      <DifficultyDots tier={meta.difficultyTier} />

      {/* Selected badge */}
      {isSelected && (
        <View style={cardStyles.badge}>
          <Text style={cardStyles.badgeText}>IN PROGRESSION</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  cardSelected: {
    shadowColor: chordColors.selectedGlow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  cardDisabled: {
    opacity: 0.4,
  },
  topBar: {
    height: 4,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingTop: spacing.sm,
  },
  nickname: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  playBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 11,
    marginLeft: 2,
  },
  chordName: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 2,
  },
  flavorText: {
    fontSize: 10,
    fontStyle: 'italic',
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    lineHeight: 14,
  },
  theoryBox: {
    marginHorizontal: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.xs + 1,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  theoryLine: {
    fontSize: 9.5,
    color: colors.textSecondary,
    lineHeight: 14,
  },
  fretboardWrap: {
    alignItems: 'center',
    marginBottom: 2,
  },
  badge: {
    backgroundColor: colors.accent,
    paddingVertical: 3,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 1,
  },
});
