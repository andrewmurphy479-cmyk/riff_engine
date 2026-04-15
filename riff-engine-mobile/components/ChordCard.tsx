import React, { useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import { colors, spacing, borderRadius, chordColors, getChordColors, ChordColorSet } from '../theme/colors';
import { CHORD_THEORY, getChordShape, FRETBOARD_STRINGS } from '../engine/theory';
import { CHORD_CARD_DATA, ChordCardMeta } from '../engine/chordCardData';
import { GuitarString } from '../engine/types';

interface ChordCardProps {
  chordId: string;
  isSelected: boolean;
  isAllowed: boolean;
  onSelect: () => void;
  onPlayPreview: () => void;
  isPairHighlighted?: boolean;
  pairSourceColor?: string;
  isPairSource?: boolean;
  isPairAuto?: boolean;
  onLongPress?: () => void;
}

const STRING_X: Record<GuitarString, number> = {
  E: 12, A: 32, D: 52, G: 72, B: 92, e: 112,
};
const FRET_SPACING = 18;
const FRET_OFFSET = 10;

// ── Mini Fretboard with strum glow ──

interface MiniFretboardProps {
  chordId: string;
  strumKey: number;
  accentColor: string;
}

function MiniFretboard({ chordId, strumKey, accentColor }: MiniFretboardProps) {
  const shape = getChordShape(chordId);
  const maxFret = Math.max(...shape.map((n) => n.fret), 3);
  const fretCount = Math.min(maxFret + 1, 5);
  const height = fretCount * FRET_SPACING + FRET_OFFSET + 4;

  // One animated value per note in shape (up to 6)
  const glowAnims = useRef(shape.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (strumKey === 0) return;
    // Reset all
    glowAnims.forEach((a) => a.setValue(0));
    // Stagger animate each dot
    const animations = glowAnims.map((anim, i) =>
      Animated.sequence([
        Animated.delay(i * 30),
        Animated.timing(anim, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
      ])
    );
    Animated.parallel(animations).start();
  }, [strumKey]);

  // Compute dot positions for the glow overlay
  const dotPositions = shape.map((note) => ({
    x: STRING_X[note.string],
    y: note.fret === 0
      ? FRET_OFFSET - 1
      : FRET_OFFSET + (note.fret - 0.5) * FRET_SPACING,
  }));

  return (
    <View style={{ position: 'relative', width: 124, height }}>
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
      {/* Glow overlay dots */}
      {dotPositions.map((pos, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: pos.x - 8,
            top: pos.y - 8,
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: accentColor,
            opacity: glowAnims[i],
            shadowColor: accentColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.9,
            shadowRadius: 6,
            elevation: 4,
          }}
        />
      ))}
    </View>
  );
}

// ── Difficulty dots ──

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

// ── Card Front ──

interface CardFrontProps {
  chordId: string;
  meta: ChordCardMeta;
  chordColor: ChordColorSet;
  strumKey: number;
  onPlayPreview: () => void;
  onFlip: () => void;
}

function CardFront({ chordId, meta, chordColor, strumKey, onPlayPreview, onFlip }: CardFrontProps) {
  return (
    <View style={cardStyles.cardInner}>
      {/* Quality color top bar */}
      <View style={[cardStyles.topBar, { backgroundColor: chordColor.accent }]} />

      {/* Header row */}
      <View style={cardStyles.header}>
        <Text style={[cardStyles.nickname, { color: chordColor.text }]} numberOfLines={1}>
          {meta.nickname}
        </Text>
        <TouchableOpacity
          style={[cardStyles.playBtn, { backgroundColor: chordColor.bg }]}
          onPress={(e) => {
            e.stopPropagation();
            onPlayPreview();
          }}
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[cardStyles.playIcon, { color: chordColor.accent }]}>{'▶'}</Text>
        </TouchableOpacity>
      </View>

      {/* Chord name */}
      <Text style={cardStyles.chordName}>{chordId}</Text>

      {/* Flavor text */}
      <Text style={cardStyles.flavorText} numberOfLines={2}>
        {meta.flavorText}
      </Text>

      {/* Mini fretboard */}
      <View style={cardStyles.fretboardWrap}>
        <MiniFretboard chordId={chordId} strumKey={strumKey} accentColor={chordColor.accent} />
      </View>

      {/* Difficulty dots */}
      <DifficultyDots tier={meta.difficultyTier} />

      {/* Flip info button */}
      <TouchableOpacity
        style={cardStyles.flipBtn}
        onPress={(e) => {
          e.stopPropagation();
          onFlip();
        }}
        activeOpacity={0.6}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Text style={[cardStyles.flipBtnText, { color: chordColor.text }]}>i</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Card Back ──

interface CardBackProps {
  chordId: string;
  meta: ChordCardMeta;
  chordColor: ChordColorSet;
  onFlip: () => void;
}

function CardBack({ chordId, meta, chordColor, onFlip }: CardBackProps) {
  const theory = CHORD_THEORY[chordId];
  return (
    <View style={cardStyles.cardInner}>
      {/* Accent top bar */}
      <View style={[cardStyles.topBar, { backgroundColor: chordColor.accent }]} />

      <View style={cardStyles.backContent}>
        {/* Full name */}
        <Text style={[cardStyles.backTitle, { color: chordColor.text }]}>
          {theory?.name ?? chordId}
        </Text>

        {/* Intervals */}
        {theory && (
          <View style={cardStyles.backRow}>
            <Text style={cardStyles.backLabel}>Intervals</Text>
            <Text style={cardStyles.backValue}>{theory.intervals}</Text>
          </View>
        )}

        {/* Notes */}
        {theory && (
          <View style={cardStyles.backRow}>
            <Text style={cardStyles.backLabel}>Notes</Text>
            <Text style={cardStyles.backValue}>{theory.notes.join(' - ')}</Text>
          </View>
        )}

        {/* Pairs with — colored mini chips */}
        <View style={cardStyles.backRow}>
          <Text style={cardStyles.backLabel}>Pairs with</Text>
          <View style={cardStyles.pairChipRow}>
            {meta.pairsWellWith.map((pairId) => {
              const pc = getChordColors(pairId);
              return (
                <View key={pairId} style={[cardStyles.pairChip, { backgroundColor: pc.bg, borderColor: pc.border }]}>
                  <Text style={[cardStyles.pairChipText, { color: pc.text }]}>{pairId}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Theory description */}
        {theory && (
          <Text style={cardStyles.backDescription}>{theory.description}</Text>
        )}
      </View>

      {/* Close button */}
      <TouchableOpacity
        style={cardStyles.flipBtn}
        onPress={(e) => {
          e.stopPropagation();
          onFlip();
        }}
        activeOpacity={0.6}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Text style={[cardStyles.flipBtnText, { color: chordColor.text }]}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main ChordCard ──

export function ChordCard({
  chordId,
  isSelected,
  isAllowed,
  onSelect,
  onPlayPreview,
  isPairHighlighted,
  pairSourceColor,
  isPairSource,
  isPairAuto,
  onLongPress,
}: ChordCardProps) {
  const meta: ChordCardMeta = CHORD_CARD_DATA[chordId] ?? {
    nickname: chordId,
    flavorText: '',
    quality: 'major' as const,
    pairsWellWith: [],
    difficultyTier: 1 as const,
  };
  const chordColor = getChordColors(chordId, meta.quality);

  // Strum key counter
  const strumKeyRef = useRef(0);
  const [strumKey, setStrumKey] = React.useState(0);

  // Flip animation
  const flipAnim = useRef(new Animated.Value(0)).current;
  const [isFlipped, setIsFlipped] = React.useState(false);

  const handleFlip = useCallback(() => {
    const toValue = isFlipped ? 0 : 1;
    setIsFlipped(!isFlipped);
    Animated.spring(flipAnim, {
      toValue,
      tension: 80,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [isFlipped, flipAnim]);

  // Flip interpolations
  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: ['0deg', '90deg', '90deg', '180deg'],
  });
  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });
  const backRotate = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: ['180deg', '270deg', '270deg', '360deg'],
  });
  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  // Pair glow pulse
  const pairGlowAnim = useRef(new Animated.Value(0)).current;
  const pairGlowLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isPairHighlighted) {
      if (pairGlowLoopRef.current) {
        pairGlowLoopRef.current.stop();
        pairGlowLoopRef.current = null;
      }
      if (isPairAuto) {
        Animated.timing(pairGlowAnim, {
          toValue: 0.7,
          duration: 250,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }).start();
      } else {
        pairGlowAnim.setValue(0.4);
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(pairGlowAnim, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
              easing: Easing.inOut(Easing.ease),
            }),
            Animated.timing(pairGlowAnim, {
              toValue: 0.4,
              duration: 400,
              useNativeDriver: true,
              easing: Easing.inOut(Easing.ease),
            }),
          ])
        );
        pairGlowLoopRef.current = loop;
        loop.start();
      }
    } else {
      if (pairGlowLoopRef.current) {
        pairGlowLoopRef.current.stop();
        pairGlowLoopRef.current = null;
      }
      Animated.timing(pairGlowAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isPairHighlighted, isPairAuto]);

  const handlePlay = useCallback(() => {
    strumKeyRef.current += 1;
    setStrumKey(strumKeyRef.current);
    onPlayPreview();
  }, [onPlayPreview]);

  return (
    <View style={{ width: '100%' }}>
      <TouchableOpacity
        style={[
          cardStyles.card,
          { borderColor: isSelected ? chordColors.selectedGlow : chordColor.border },
          isSelected && cardStyles.cardSelected,
          !isAllowed && cardStyles.cardDisabled,
        ]}
        onPress={onSelect}
        onLongPress={onLongPress}
        delayLongPress={400}
        activeOpacity={isAllowed ? 0.7 : 1}
        disabled={!isAllowed}
      >
        {/* Front face */}
        <Animated.View
          style={[
            cardStyles.face,
            {
              opacity: frontOpacity,
              transform: [{ perspective: 800 }, { rotateY: frontRotate }],
            },
          ]}
        >
          <CardFront
            chordId={chordId}
            meta={meta}
            chordColor={chordColor}
            strumKey={strumKey}
            onPlayPreview={handlePlay}
            onFlip={handleFlip}
          />
        </Animated.View>

        {/* Back face */}
        <Animated.View
          style={[
            cardStyles.face,
            cardStyles.backFace,
            {
              opacity: backOpacity,
              transform: [{ perspective: 800 }, { rotateY: backRotate }],
            },
          ]}
        >
          <CardBack
            chordId={chordId}
            meta={meta}
            chordColor={chordColor}
            onFlip={handleFlip}
          />
        </Animated.View>

        {/* Selected badge */}
        {isSelected && (
          <View style={cardStyles.badge}>
            <Text style={cardStyles.badgeText}>IN PROGRESSION</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Pair glow overlay — outside TouchableOpacity so it doesn't interfere */}
      {(isPairHighlighted || isPairSource) && (
        <Animated.View
          pointerEvents="none"
          style={[
            cardStyles.pairGlow,
            {
              borderColor: pairSourceColor ?? chordColor.accent,
              opacity: isPairSource ? 1 : pairGlowAnim,
            },
          ]}
        />
      )}

      {/* Pair source badge */}
      {isPairSource && (
        <View style={[cardStyles.pairBadge, { backgroundColor: chordColor.accent }]}>
          <Text style={cardStyles.pairBadgeText}>PAIRS</Text>
        </View>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    overflow: 'hidden',
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
  face: {
    width: '100%',
    backfaceVisibility: 'hidden',
  },
  backFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  cardInner: {
    width: '100%',
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
  fretboardWrap: {
    alignItems: 'center',
    marginBottom: 2,
  },
  flipBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flipBtnText: {
    fontSize: 12,
    fontWeight: '700',
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
  // Back face styles
  backContent: {
    padding: spacing.sm + 2,
    paddingTop: spacing.sm,
  },
  backTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  backRow: {
    marginBottom: spacing.xs + 2,
  },
  backLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  backValue: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  pairChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  pairChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  pairChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  backDescription: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
  // Pair glow
  pairGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: borderRadius.md + 2,
    borderWidth: 2,
  },
  pairBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pairBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.5,
  },
});
