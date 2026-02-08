import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { TabEvent, GuitarString, RiffLayer } from '../engine/types';
import { TAB_STRING_ORDER } from '../engine/chords';
import { LAYER_COLORS, TECHNIQUE_SYMBOLS } from './TabDisplay';

// Layout constants
const STRING_SPACING = 22;
const STEP_WIDTH = 18;
const TOP_PADDING = 24;    // Space for chord names above staff
const BOTTOM_PADDING = 10;
const LABEL_WIDTH = 24;    // Width for string labels column
const STRING_COUNT = 6;
const STAFF_HEIGHT = (STRING_COUNT - 1) * STRING_SPACING;
const TOTAL_HEIGHT = TOP_PADDING + STAFF_HEIGHT + BOTTOM_PADDING;

// Colors
const STRING_LINE_COLOR = 'rgba(255, 255, 255, 0.08)';
const BAR_LINE_COLOR = 'rgba(255, 255, 255, 0.3)';
const FRET_BG_COLOR = '#0B0B0F';
const CHORD_COLOR = '#4A7AFF';
const DEFAULT_NOTE_COLOR = 'rgba(255, 255, 255, 0.9)';
const LABEL_COLOR = 'rgba(255, 255, 255, 0.5)';

interface GraphicalTabProps {
  events: TabEvent[];
  progression: string[];
  stepsPerBar?: number;
}

// Build a grid of events indexed by [stringName][step]
interface PlacedNote {
  fret: number;
  technique?: string;
  layer?: RiffLayer;
}

function buildGrid(events: TabEvent[], totalSteps: number) {
  const grid: Record<GuitarString, (PlacedNote | null)[]> = {} as any;
  for (const s of TAB_STRING_ORDER) {
    grid[s] = Array(totalSteps).fill(null);
  }
  for (const ev of events) {
    if (ev.step >= 0 && ev.step < totalSteps) {
      grid[ev.string][ev.step] = {
        fret: ev.fret,
        technique: ev.technique || undefined,
        layer: ev.layer,
      };
    }
  }
  return grid;
}

// Format fret number to display string
function fretDisplay(fret: number): string {
  if (fret > 9) {
    return String(fret); // Show full number in pro view
  }
  return String(fret);
}

export function GraphicalTab({
  events,
  progression,
  stepsPerBar = 16,
}: GraphicalTabProps) {
  const totalSteps = progression.length * stepsPerBar;
  const contentWidth = totalSteps * STEP_WIDTH + STEP_WIDTH; // extra padding at end
  const grid = buildGrid(events, totalSteps);

  // String label column (fixed)
  const labelSvg = (
    <Svg width={LABEL_WIDTH} height={TOTAL_HEIGHT}>
      {TAB_STRING_ORDER.map((s, i) => {
        const y = TOP_PADDING + i * STRING_SPACING;
        return (
          <SvgText
            key={s}
            x={LABEL_WIDTH - 4}
            y={y + 4}
            fill={LABEL_COLOR}
            fontSize={12}
            fontWeight="600"
            textAnchor="end"
          >
            {s}
          </SvgText>
        );
      })}
    </Svg>
  );

  // Main content SVG
  const mainSvg = (
    <Svg width={contentWidth} height={TOTAL_HEIGHT}>
      {/* String lines */}
      {TAB_STRING_ORDER.map((_, i) => {
        const y = TOP_PADDING + i * STRING_SPACING;
        return (
          <Line
            key={`str-${i}`}
            x1={0}
            y1={y}
            x2={contentWidth}
            y2={y}
            stroke={STRING_LINE_COLOR}
            strokeWidth={1}
          />
        );
      })}

      {/* Bar lines & chord names */}
      {progression.map((chord, barIdx) => {
        const x = barIdx * stepsPerBar * STEP_WIDTH;
        return (
          <React.Fragment key={`bar-${barIdx}`}>
            {/* Bar line */}
            <Line
              x1={x}
              y1={TOP_PADDING}
              x2={x}
              y2={TOP_PADDING + STAFF_HEIGHT}
              stroke={BAR_LINE_COLOR}
              strokeWidth={1}
            />
            {/* Chord name */}
            <SvgText
              x={x + 4}
              y={TOP_PADDING - 8}
              fill={CHORD_COLOR}
              fontSize={11}
              fontWeight="600"
            >
              {chord}
            </SvgText>
          </React.Fragment>
        );
      })}
      {/* Final bar line */}
      <Line
        x1={totalSteps * STEP_WIDTH}
        y1={TOP_PADDING}
        x2={totalSteps * STEP_WIDTH}
        y2={TOP_PADDING + STAFF_HEIGHT}
        stroke={BAR_LINE_COLOR}
        strokeWidth={1.5}
      />

      {/* Notes */}
      {TAB_STRING_ORDER.map((s, stringIdx) => {
        const y = TOP_PADDING + stringIdx * STRING_SPACING;
        return grid[s].map((note, step) => {
          if (!note) return null;
          const x = step * STEP_WIDTH + STEP_WIDTH / 2;
          const text = fretDisplay(note.fret);
          const noteColor = note.layer ? LAYER_COLORS[note.layer] : DEFAULT_NOTE_COLOR;
          const textWidth = text.length > 1 ? 16 : 10;
          const techSymbol = note.technique ? TECHNIQUE_SYMBOLS[note.technique] : null;

          return (
            <React.Fragment key={`${s}-${step}`}>
              {/* Background rect to break the string line */}
              <Rect
                x={x - textWidth / 2 - 1}
                y={y - 7}
                width={textWidth + 2}
                height={14}
                fill={FRET_BG_COLOR}
              />
              {/* Fret number */}
              <SvgText
                x={x}
                y={y + 4}
                fill={noteColor}
                fontSize={11}
                fontWeight="600"
                textAnchor="middle"
              >
                {text}
              </SvgText>
              {/* Technique symbol above the note */}
              {techSymbol && (
                <SvgText
                  x={x}
                  y={y - 10}
                  fill={noteColor}
                  fontSize={9}
                  fontWeight="600"
                  textAnchor="middle"
                  opacity={0.8}
                >
                  {techSymbol}
                </SvgText>
              )}
            </React.Fragment>
          );
        });
      })}
    </Svg>
  );

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {/* Fixed string labels */}
        <View style={styles.labels}>{labelSvg}</View>
        {/* Scrollable tab content */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
          style={styles.scrollView}
        >
          {mainSvg}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: TOTAL_HEIGHT,
  },
  row: {
    flexDirection: 'row',
  },
  labels: {
    width: LABEL_WIDTH,
  },
  scrollView: {
    flex: 1,
  },
});
