import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { G, Line, Rect, Text as SvgText } from "react-native-svg";
import {
  PHRASE_LABELS,
  ROLE_COLORS,
  ROLE_ORDER,
  SCALE_PRETTY,
} from "../engine/riff/display";
import { midiAt } from "../engine/riff/fretboard";
import { roleOf } from "../engine/riff/scale";
import { RiffSpec } from "../engine/riff/spec";
import { colors, spacing } from "../theme/colors";

const STRING_LABELS_HIGH_TO_LOW = ["e", "B", "G", "D", "A", "E"] as const;
const STRING_COUNT = 6;
const STEPS_PER_BAR = 16;

// Layout — mobile-scaled from to_html.py's Studio Sheet.
const STEP_WIDTH = 9;
const STRING_SPACING = 20;
const TOP_PADDING = 24;
const BOTTOM_PADDING = 10;
const LABEL_WIDTH = 24;
const STAFF_HEIGHT = (STRING_COUNT - 1) * STRING_SPACING;
const ROW_HEIGHT = TOP_PADDING + STAFF_HEIGHT + BOTTOM_PADDING;
const ROW_GAP = 10;
const BARS_PER_ROW = 2;

interface Props {
  riff: RiffSpec;
  footer?: React.ReactNode;
}

export function RiffTabView({ riff, footer }: Props) {
  const [legendOpen, setLegendOpen] = useState(false);

  const includeBlue = riff.scale.includes("blue");
  const phraseTags =
    PHRASE_LABELS[riff.motif_structure] ?? riff.bars.map(() => "?");

  const rowCount = Math.ceil(riff.bars.length / BARS_PER_ROW);
  const barsRowWidth = BARS_PER_ROW * STEPS_PER_BAR * STEP_WIDTH;
  const svgWidth = LABEL_WIDTH + barsRowWidth + STEP_WIDTH;
  const svgHeight = rowCount * ROW_HEIGHT + (rowCount - 1) * ROW_GAP;

  const scalePretty = riff.scale
    .replace(/_/g, " ")
    .replace("+blue", " + blue");
  const intervalHint = SCALE_PRETTY[riff.scale];
  const notesPerBar = riff.bars[0]?.notes.length ?? 0;

  const metaBits: string[] = [`${riff.tempo_bpm} BPM`];
  if (riff.rhythm_name) metaBits.push(riff.rhythm_name);
  metaBits.push(`${notesPerBar} notes/bar`);

  const rolesPresent = new Set<string>();
  for (const bar of riff.bars) {
    for (const note of bar.notes) {
      const midi = midiAt(note.string, note.fret);
      const r = roleOf(midi, riff.key, includeBlue);
      if (r) rolesPresent.add(r);
    }
  }
  const visibleRoles = ROLE_ORDER.filter((r) => rolesPresent.has(r));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {riff.key} {scalePretty}
        </Text>
        {intervalHint && (
          <Text style={styles.subtitle}>{intervalHint}</Text>
        )}
        <Text style={styles.metaLine}>{metaBits.join("  ·  ")}</Text>
      </View>

      <View style={styles.tabWrap}>
        <Svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        >
          {Array.from({ length: rowCount }).map((_, rowIdx) => {
            const rowY = rowIdx * (ROW_HEIGHT + ROW_GAP);
            const barStart = rowIdx * BARS_PER_ROW;
            const barEnd = Math.min(barStart + BARS_PER_ROW, riff.bars.length);
            const barsInRow = barEnd - barStart;
            const rowTotalSteps = barsInRow * STEPS_PER_BAR;

            return (
              <G key={`row-${rowIdx}`} y={rowY}>
                {/* Beat-grid columns */}
                {Array.from({ length: rowTotalSteps + 1 }).map((_, s) => {
                  if (s % 4 !== 0) return null;
                  const x = LABEL_WIDTH + s * STEP_WIDTH;
                  const isBar = s % STEPS_PER_BAR === 0;
                  const opacity = isBar ? 0.22 : 0.07;
                  const width = isBar ? 1 : 0.5;
                  return (
                    <Line
                      key={`grid-${s}`}
                      x1={x}
                      y1={TOP_PADDING}
                      x2={x}
                      y2={TOP_PADDING + STAFF_HEIGHT}
                      stroke="#ffffff"
                      strokeWidth={width}
                      opacity={opacity}
                    />
                  );
                })}

                {/* Phrase tag above each bar in this row */}
                {Array.from({ length: barsInRow }).map((_, i) => {
                  const absoluteBarIdx = barStart + i;
                  const tag = phraseTags[absoluteBarIdx] ?? "?";
                  const bx = LABEL_WIDTH + i * STEPS_PER_BAR * STEP_WIDTH + 4;
                  return (
                    <G key={`tag-${absoluteBarIdx}`}>
                      <SvgText
                        x={bx}
                        y={TOP_PADDING - 10}
                        fill="rgba(255,255,255,0.5)"
                        fontSize={9}
                        fontWeight="700"
                        fontFamily="monospace"
                      >
                        {`BAR ${absoluteBarIdx + 1}`}
                      </SvgText>
                      <SvgText
                        x={bx + 40}
                        y={TOP_PADDING - 10}
                        fill="#4A7AFF"
                        fontSize={9}
                        fontWeight="700"
                        fontFamily="monospace"
                      >
                        {tag}
                      </SvgText>
                    </G>
                  );
                })}

                {/* String lines + labels */}
                {Array.from({ length: STRING_COUNT }).map((_, sDisp) => {
                  const y = TOP_PADDING + sDisp * STRING_SPACING;
                  return (
                    <G key={`str-${sDisp}`}>
                      <Line
                        x1={LABEL_WIDTH}
                        y1={y}
                        x2={LABEL_WIDTH + rowTotalSteps * STEP_WIDTH}
                        y2={y}
                        stroke="rgba(255,255,255,0.10)"
                        strokeWidth={1}
                      />
                      <SvgText
                        x={LABEL_WIDTH - 6}
                        y={y + 3}
                        fill="rgba(255,255,255,0.45)"
                        fontSize={10}
                        fontWeight="600"
                        textAnchor="end"
                        fontFamily="monospace"
                      >
                        {STRING_LABELS_HIGH_TO_LOW[sDisp]}
                      </SvgText>
                    </G>
                  );
                })}

                {/* Notes for bars in this row */}
                {riff.bars.slice(barStart, barEnd).flatMap((bar, bOffset) =>
                  bar.notes.map((note, nIdx) => {
                    const localStep = bOffset * STEPS_PER_BAR + note.step;
                    const x = LABEL_WIDTH + localStep * STEP_WIDTH + STEP_WIDTH / 2;
                    const sDisp = STRING_COUNT - 1 - note.string;
                    const y = TOP_PADDING + sDisp * STRING_SPACING;

                    const midi = midiAt(note.string, note.fret);
                    const role = roleOf(midi, riff.key, includeBlue) ?? "?";
                    const color = ROLE_COLORS[role] ?? ROLE_COLORS["?"];

                    const text = String(note.fret);
                    const tw = text.length > 1 ? 13 : 10;

                    return (
                      <G key={`n-${barStart + bOffset}-${nIdx}`}>
                        <Rect
                          x={x - tw / 2 - 1}
                          y={y - 7}
                          width={tw + 2}
                          height={14}
                          fill="#12121e"
                          rx={2}
                        />
                        <SvgText
                          x={x}
                          y={y + 3}
                          fill={color}
                          fontSize={10}
                          fontWeight="700"
                          textAnchor="middle"
                          fontFamily="monospace"
                        >
                          {text}
                        </SvgText>
                      </G>
                    );
                  }),
                )}
              </G>
            );
          })}
        </Svg>
      </View>

      {visibleRoles.length > 0 && (
        <View style={styles.legendWrap}>
          <TouchableOpacity
            style={styles.legendToggle}
            onPress={() => setLegendOpen((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.legendToggleLabel}>
              {legendOpen ? "Hide legend" : "Show legend"}
            </Text>
            <Text style={styles.legendChevron}>{legendOpen ? "▾" : "▸"}</Text>
          </TouchableOpacity>
          {legendOpen && (
            <View style={styles.legend}>
              {visibleRoles.map((role) => (
                <View key={role} style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: ROLE_COLORS[role] },
                    ]}
                  />
                  <Text style={styles.legendLabel}>{role}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#12121e",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
    marginHorizontal: spacing.lg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  title: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "lowercase",
  },
  subtitle: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontFamily: "monospace",
    marginTop: 2,
  },
  metaLine: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    fontFamily: "monospace",
    marginTop: 6,
  },
  tabWrap: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  legendWrap: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  legendToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  legendToggleLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  legendChevron: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  legendLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontFamily: "monospace",
  },
});
