import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme/colors';

interface BarNavigatorProps {
  chords: string[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

export function BarNavigator({ chords, currentIndex, onSelect }: BarNavigatorProps) {
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to keep active bar visible
  useEffect(() => {
    if (scrollRef.current) {
      const chipWidth = 72 + spacing.sm; // approximate chip + gap
      scrollRef.current.scrollTo({
        x: Math.max(0, currentIndex * chipWidth - 60),
        animated: true,
      });
    }
  }, [currentIndex]);

  const canPrev = currentIndex > 0;
  const canNext = currentIndex < chords.length - 1;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.arrow, !canPrev && styles.arrowDisabled]}
        onPress={() => canPrev && onSelect(currentIndex - 1)}
        disabled={!canPrev}
        activeOpacity={0.7}
      >
        <Ionicons
          name="chevron-back"
          size={18}
          color={canPrev ? colors.textPrimary : colors.textDisabled}
        />
      </TouchableOpacity>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scroll}
      >
        {chords.map((chord, i) => {
          const isActive = i === currentIndex;
          return (
            <TouchableOpacity
              key={`${i}-${chord}`}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => onSelect(i)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipBarNum, isActive && styles.chipBarNumActive]}>
                {i + 1}
              </Text>
              <Text style={[styles.chipChord, isActive && styles.chipChordActive]}>
                {chord}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        style={[styles.arrow, !canNext && styles.arrowDisabled]}
        onPress={() => canNext && onSelect(currentIndex + 1)}
        disabled={!canNext}
        activeOpacity={0.7}
      >
        <Ionicons
          name="chevron-forward"
          size={18}
          color={canNext ? colors.textPrimary : colors.textDisabled}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  arrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowDisabled: {
    opacity: 0.4,
  },
  scroll: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  scrollContent: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.chipInactive,
  },
  chipActive: {
    backgroundColor: colors.chipActive,
    borderWidth: 1,
    borderColor: colors.chipActiveBorder,
  },
  chipBarNum: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  chipBarNumActive: {
    color: colors.accent,
  },
  chipChord: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chipChordActive: {
    color: colors.accent,
  },
});
