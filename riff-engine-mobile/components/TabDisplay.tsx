import React from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { Card } from './ui/Card';
import { TabEvent, GuitarString, Technique } from '../engine/types';
import { TAB_STRING_ORDER } from '../engine/chords';
import { colors, spacing, typography } from '../theme/colors';

interface TabDisplayProps {
  events: TabEvent[];
  progression: string[];
  stepsPerBar?: number;
}

// Technique symbols
const TECHNIQUE_SYMBOLS: Record<string, string> = {
  hammer: 'h',
  pull: 'p',
  slide: '/',
  bend: 'b',
};

// Grid cell with fret and optional technique
interface GridCell {
  fret: number;
  technique?: Technique;
}

// Render tab from events
function renderTab(
  events: TabEvent[],
  progression: string[],
  stepsPerBar = 16
): { chordLine: string; tabLines: string[] } {
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
      };
    }
  }

  // Build chord label line - one label per bar
  // Format: "  |Dm              |G               |Dm              |A               |"
  let chordLine = '  '; // 2 char padding for string label column
  for (let bar = 0; bar < progression.length; bar++) {
    const chord = progression[bar] || '';
    // Each bar is 16 steps (matching tab lines), chord at start
    chordLine += '|' + chord.padEnd(stepsPerBar, ' ');
  }
  chordLine += '|';

  // Build tab lines
  // Format: "e |-0---2---3------|----------------|..."
  const tabLines: string[] = [];
  for (const s of strings) {
    let line = s + ' '; // String label + space
    for (let bar = 0; bar < progression.length; bar++) {
      line += '|';
      for (let step = 0; step < stepsPerBar; step++) {
        const globalStep = bar * stepsPerBar + step;
        const cell = tab[s][globalStep];
        if (cell !== null) {
          line += formatFret(cell.fret, cell.technique);
        } else {
          line += '-';
        }
      }
    }
    line += '|';
    tabLines.push(line);
  }

  return { chordLine, tabLines };
}

// Format fret number (always 1 char) with optional technique indicator
// For techniques: show technique symbol (h/p/s/b) - fret inferred from context
// For regular notes: show fret number (0-9) or letter for 10+ (a=10, b=11, etc)
function formatFret(fret: number, technique?: Technique): string {
  // If there's a technique, show just the symbol (keeps alignment at 1 char)
  if (technique) {
    return TECHNIQUE_SYMBOLS[technique] || String(fret);
  }
  // For frets 10+, use letters: a=10, b=11, c=12, etc.
  if (fret > 9) {
    return String.fromCharCode(87 + fret); // 87 + 10 = 'a'
  }
  return String(fret);
}

export function TabDisplay({
  events,
  progression,
  stepsPerBar = 16,
}: TabDisplayProps) {
  if (!events || events.length === 0) {
    return (
      <Card style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            Tap "New Riff" to generate a guitar tab
          </Text>
        </View>
      </Card>
    );
  }

  const { chordLine, tabLines } = renderTab(events, progression, stepsPerBar);

  return (
    <Card style={styles.container} noPadding>
      <ScrollView horizontal showsHorizontalScrollIndicator={true}>
        <View style={styles.tabContainer}>
          <Text style={styles.chordLine}>{chordLine}</Text>
          {tabLines.map((line, index) => (
            <Text key={index} style={styles.tabLine}>
              {line}
            </Text>
          ))}
        </View>
      </ScrollView>
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
});
