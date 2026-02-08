import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRiffStore } from '../../store/useRiffStore';
import { getDifficultyConfig } from '../../engine/difficulty';
import {
  MOOD_SCALES,
  SCALES,
  CHORD_THEORY,
  getScaleNotesOnFretboard,
} from '../../engine/theory';
import { FretboardExplorer } from '../../components/FretboardExplorer';
import { BarNavigator } from '../../components/BarNavigator';
import { TheoryPanel } from '../../components/TheoryPanel';
import { Card } from '../../components/ui/Card';
import { colors, spacing, borderRadius } from '../../theme/colors';

const STEPS_PER_BAR = 16;

// ── Tile config ──

type TileConfig = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

const OVERLAY_TILES: TileConfig[] = [
  { id: 'scale', icon: 'musical-note-outline', label: 'Scale' },
  { id: 'names', icon: 'text-outline', label: 'Names' },
];

const INFO_TILES: TileConfig[] = [
  { id: 'legend', icon: 'color-palette-outline', label: 'Legend' },
  { id: 'theory', icon: 'book-outline', label: 'Theory' },
];

// ── Swatch (for Legend card) ──

function Swatch({ color, ring }: { color: string; ring?: string }) {
  return (
    <View
      style={[
        styles.swatch,
        { backgroundColor: color },
        ring ? { borderWidth: 1.5, borderColor: ring } : null,
      ]}
    />
  );
}

// ── TileButton ──

function TileButton({
  config,
  active,
  onPress,
}: {
  config: TileConfig;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tileBtn, active && styles.tileBtnActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons
        name={config.icon}
        size={18}
        color={active ? colors.accent : colors.textSecondary}
      />
      <Text style={[styles.tileLabel, active && styles.tileLabelActive]}>
        {config.label}
      </Text>
    </TouchableOpacity>
  );
}

// ── Main Screen ──

export default function ExploreScreen() {
  const {
    mood,
    difficulty,
    generationMode,
    currentRiff,
    progression,
    getAllLayerEvents,
  } = useRiffStore();

  const isLayeredMode = generationMode === 'layerBuilder';

  // Derive events + chords from whichever mode is active
  const events = useMemo(() => {
    if (isLayeredMode && progression) {
      return getAllLayerEvents();
    }
    return currentRiff?.events ?? [];
  }, [isLayeredMode, progression, currentRiff, getAllLayerEvents]);

  const chords = useMemo(() => {
    if (isLayeredMode && progression) return progression;
    return currentRiff?.progression ?? [];
  }, [isLayeredMode, progression, currentRiff]);

  const hasRiff = chords.length > 0;

  // Bar selection
  const [currentBarIndex, setCurrentBarIndex] = useState(0);

  // Reset bar index when progression changes
  useEffect(() => {
    setCurrentBarIndex(0);
  }, [chords.length, chords[0]]);

  // Overlay toggle states
  const [showScale, setShowScale] = useState(true);
  const [showNoteNames, setShowNoteNames] = useState(false);

  // Section visibility
  const [showLegend, setShowLegend] = useState(false);
  const [showTheory, setShowTheory] = useState(false);

  // Difficulty config
  const diffConfig = getDifficultyConfig(difficulty);
  const maxFret = diffConfig.maxFret;

  // Current bar's chord
  const currentChord = chords[currentBarIndex] ?? 'Em';

  // Filter events for current bar
  const barStart = currentBarIndex * STEPS_PER_BAR;
  const barEvents = useMemo(
    () => events.filter((e) => e.step >= barStart && e.step < barStart + STEPS_PER_BAR),
    [events, barStart]
  );

  // Theory computations (memoized)
  const scaleKey = MOOD_SCALES[mood]?.[0] ?? 'major';
  const scale = SCALES[scaleKey] ?? null;
  const chordTheory = CHORD_THEORY[currentChord] ?? null;

  const scaleNotes = useMemo(
    () => getScaleNotesOnFretboard(currentChord, scaleKey, maxFret),
    [currentChord, scaleKey, maxFret]
  );


  // Overlay state lookup
  const overlayActive: Record<string, boolean> = {
    scale: showScale,
    names: showNoteNames,
  };

  const overlayToggle: Record<string, () => void> = {
    scale: () => setShowScale((v) => !v),
    names: () => setShowNoteNames((v) => !v),
  };

  // Info section state lookup
  const infoActive: Record<string, boolean> = {
    legend: showLegend,
    theory: showTheory,
  };

  const infoToggle: Record<string, () => void> = {
    legend: () => setShowLegend((v) => !v),
    theory: () => setShowTheory((v) => !v),
  };

  // ── Empty state ──
  if (!hasRiff) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="musical-notes-outline" size={56} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Nothing to explore yet</Text>
          <Text style={styles.emptySubtitle}>
            Head to the Create tab to generate a riff
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Bar Navigator — compact, at very top */}
      <BarNavigator
        chords={chords}
        currentIndex={currentBarIndex}
        onSelect={setCurrentBarIndex}
      />

      {/* Scrollable content area */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Fretboard — centered */}
        <View style={styles.fretboardWrap}>
          <FretboardExplorer
            events={barEvents}
            chord={currentChord}
            scaleNotes={scaleNotes}
            maxFret={maxFret}
            showScale={showScale}
            showNoteNames={showNoteNames}
          />
        </View>

        {/* Legend card (toggled) */}
        {showLegend && (
          <View style={styles.infoSection}>
            <Card style={styles.legendCard}>
              <Text style={styles.sectionTitle}>Color Legend</Text>

              <Text style={styles.legendGroupTitle}>Played Notes</Text>
              <View style={styles.legendRow}>
                <Swatch color="#5AAFA8" />
                <Text style={styles.legendLabel}>Melody</Text>
              </View>
              <View style={styles.legendRow}>
                <Swatch color="#C8B95A" />
                <Text style={styles.legendLabel}>Bass</Text>
              </View>
              <View style={styles.legendRow}>
                <Swatch color="#C47070" />
                <Text style={styles.legendLabel}>Fills</Text>
              </View>
              <View style={styles.legendRow}>
                <Swatch color="rgba(255,255,255,0.9)" />
                <Text style={styles.legendLabel}>Quick riff (single layer)</Text>
              </View>

              <Text style={[styles.legendGroupTitle, { marginTop: spacing.md }]}>Scale Overlay</Text>
              <View style={styles.legendRow}>
                <Swatch color={colors.accent} ring="#FFFFFF" />
                <Text style={styles.legendLabel}>
                  <Text style={styles.legendBold}>Root</Text> — chord root (white ring)
                </Text>
              </View>
              <View style={styles.legendRow}>
                <Swatch color="#5AAFA8" />
                <Text style={styles.legendLabel}>
                  <Text style={styles.legendBold}>Chord tone</Text> — other chord notes
                </Text>
              </View>
              <View style={styles.legendRow}>
                <Swatch color="rgba(255,255,255,0.35)" />
                <Text style={styles.legendLabel}>
                  <Text style={styles.legendBold}>Scale degree</Text> — safe to play
                </Text>
              </View>

            </Card>
          </View>
        )}

        {/* Theory Panel (toggled) */}
        {showTheory && (
          <TheoryPanel
            chord={currentChord}
            chordTheory={chordTheory}
            scale={scale}
            mood={mood}
            progression={chords}
            currentBarIndex={currentBarIndex}
          />
        )}
      </ScrollView>

      {/* Bottom tile toolbar — always visible */}
      <View style={styles.toolbar}>
        <View style={styles.toolbarGroup}>
          {OVERLAY_TILES.map((t) => (
            <TileButton
              key={t.id}
              config={t}
              active={overlayActive[t.id] ?? false}
              onPress={() => overlayToggle[t.id]?.()}
            />
          ))}
        </View>
        <View style={styles.toolbarDivider} />
        <View style={styles.toolbarGroup}>
          {INFO_TILES.map((t) => (
            <TileButton
              key={t.id}
              config={t}
              active={infoActive[t.id] ?? false}
              onPress={() => infoToggle[t.id]?.()}
            />
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.md,
  },
  // ── Empty state ──
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // ── Fretboard ──
  fretboardWrap: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  // ── Bottom toolbar ──
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  toolbarGroup: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  toolbarDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
  },
  tileBtn: {
    width: 52,
    height: 44,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.chipInactive,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  tileBtnActive: {
    backgroundColor: colors.chipActive,
    borderWidth: 1,
    borderColor: colors.chipActiveBorder,
  },
  tileLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tileLabelActive: {
    color: colors.accent,
  },
  // ── Info sections ──
  infoSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  legendCard: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  legendGroupTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 16,
  },
  legendBold: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
});
