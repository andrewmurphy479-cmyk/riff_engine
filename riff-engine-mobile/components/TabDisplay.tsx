import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Card } from './ui/Card';
import { TabEvent, GuitarString, Technique, RiffLayer } from '../engine/types';
import { TAB_STRING_ORDER } from '../engine/chords';
import { colors, spacing, borderRadius, typography } from '../theme/colors';
import { GraphicalTab } from './GraphicalTab';

interface TabDisplayProps {
  events: TabEvent[];
  progression: string[];
  stepsPerBar?: number;
}

// View mode type
type ViewMode = 'tab' | 'pro';

// Technique symbols
export const TECHNIQUE_SYMBOLS: Record<string, string> = {
  hammer: 'h',
  pull: 'p',
  slide: '/',
  bend: 'b',
};

// Layer colors for visual distinction
export const LAYER_COLORS: Record<RiffLayer, string> = {
  melody: '#5AAFA8',  // Desaturated teal for melody
  bass: '#C8B95A',    // Desaturated yellow for bass
  fills: '#C47070',   // Desaturated coral for fills
};

// Grid cell with fret, technique, and layer info
interface GridCell {
  fret: number;
  technique?: Technique;
  layer?: RiffLayer;
}

// Rendered character with color info
interface ColoredChar {
  char: string;
  layer?: RiffLayer;
}

// Render tab from events - returns colored character data
function renderTabColored(
  events: TabEvent[],
  progression: string[],
  stepsPerBar = 16
): { chordLine: string; tabLines: ColoredChar[][] } {
  const totalSteps = progression.length * stepsPerBar;
  const strings: GuitarString[] = TAB_STRING_ORDER;

  // Initialize tab grid with nulls
  const tab: Record<GuitarString, (GridCell | null)[]> = {} as Record<GuitarString, (GridCell | null)[]>;
  for (const s of strings) {
    tab[s] = Array(totalSteps).fill(null);
  }

  // Place events on grid
  for (const event of events) {
    if (event.step >= 0 && event.step < totalSteps) {
      tab[event.string][event.step] = {
        fret: event.fret,
        technique: event.technique,
        layer: event.layer,
      };
    }
  }

  // Build chord label line
  let chordLine = '  ';
  for (let bar = 0; bar < progression.length; bar++) {
    const chord = progression[bar] || '';
    chordLine += '|' + chord.padEnd(stepsPerBar, ' ');
  }
  chordLine += '|';

  // Build tab lines with layer info
  const tabLines: ColoredChar[][] = [];
  for (const s of strings) {
    const lineChars: ColoredChar[] = [];

    // String label
    lineChars.push({ char: s });
    lineChars.push({ char: ' ' });

    for (let bar = 0; bar < progression.length; bar++) {
      lineChars.push({ char: '|' });
      let skip = false;
      for (let step = 0; step < stepsPerBar; step++) {
        if (skip) {
          skip = false;
          continue;
        }
        const globalStep = bar * stepsPerBar + step;
        const cell = tab[s][globalStep];
        if (cell !== null) {
          const fretStr = formatFret(cell.fret, cell.technique);
          if (fretStr.length > 1 && step < stepsPerBar - 1) {
            // 2-digit fret: render both chars, consume next step's position
            for (const ch of fretStr) {
              lineChars.push({ char: ch, layer: cell.layer });
            }
            skip = true;
          } else {
            lineChars.push({ char: fretStr, layer: cell.layer });
          }
        } else {
          lineChars.push({ char: '-' });
        }
      }
    }
    lineChars.push({ char: '|' });
    tabLines.push(lineChars);
  }

  return { chordLine, tabLines };
}

// Format fret number with optional technique indicator
function formatFret(fret: number, technique?: Technique): string {
  if (technique) {
    return TECHNIQUE_SYMBOLS[technique] || String(fret);
  }
  return String(fret);
}

// Render a line of colored characters
function ColoredLine({ chars }: { chars: ColoredChar[] }) {
  return (
    <Text style={styles.tabLine}>
      {chars.map((c, i) => (
        <Text
          key={i}
          style={c.layer ? { color: LAYER_COLORS[c.layer] } : undefined}
        >
          {c.char}
        </Text>
      ))}
    </Text>
  );
}

export function TabDisplay({
  events,
  progression,
  stepsPerBar = 16,
}: TabDisplayProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('tab');

  if (!events || events.length === 0) {
    return (
      <Card style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            Tap "Start Building" to create a guitar riff
          </Text>
        </View>
      </Card>
    );
  }

  const { chordLine, tabLines } = renderTabColored(events, progression, stepsPerBar);

  // Check if we have any layer info (for showing legend)
  const hasLayers = events.some(e => e.layer);

  return (
    <Card style={styles.container} noPadding>
      {/* View mode switcher */}
      <View style={styles.switcherRow}>
        <View style={styles.switcher}>
          <TouchableOpacity
            style={[styles.switchSegment, viewMode === 'tab' && styles.switchSegmentActive]}
            onPress={() => setViewMode('tab')}
            activeOpacity={0.7}
          >
            <Text style={[styles.switchText, viewMode === 'tab' && styles.switchTextActive]}>
              Tab
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.switchSegment, viewMode === 'pro' && styles.switchSegmentActive]}
            onPress={() => setViewMode('pro')}
            activeOpacity={0.7}
          >
            <Text style={[styles.switchText, viewMode === 'pro' && styles.switchTextActive]}>
              Pro
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab content */}
      {viewMode === 'tab' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View style={styles.tabContainer}>
            <Text style={styles.chordLine}>{chordLine}</Text>
            {tabLines.map((lineChars, index) => (
              <ColoredLine key={index} chars={lineChars} />
            ))}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.proContainer}>
          <GraphicalTab
            events={events}
            progression={progression}
            stepsPerBar={stepsPerBar}
          />
        </View>
      )}

      {/* Layer legend */}
      {hasLayers && (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: LAYER_COLORS.melody }]} />
            <Text style={styles.legendText}>Melody</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: LAYER_COLORS.bass }]} />
            <Text style={styles.legendText}>Bass</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: LAYER_COLORS.fills }]} />
            <Text style={styles.legendText}>Fills</Text>
          </View>
        </View>
      )}
    </Card>
  );
}

// Platform-specific monospace font
const monoFont = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    minHeight: 160,
  },
  switcherRow: {
    alignItems: 'flex-end',
    paddingTop: spacing.sm,
    paddingRight: spacing.sm,
    paddingBottom: 0,
  },
  switcher: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    padding: 2,
  },
  switchSegment: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.sm - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchSegmentActive: {
    backgroundColor: colors.accent,
  },
  switchText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  switchTextActive: {
    color: colors.white,
  },
  proContainer: {
    paddingVertical: spacing.sm,
  },
  tabContainer: {
    padding: spacing.md,
  },
  chordLine: {
    fontFamily: monoFont,
    fontSize: 14,
    color: colors.accent,
    marginBottom: spacing.xs,
    letterSpacing: 0,
  },
  tabLine: {
    fontFamily: monoFont,
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
    letterSpacing: 0,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.body.fontSize,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
