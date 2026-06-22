import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import { ROLE_COLORS, ROLE_HINTS, ROLE_ORDER } from "../engine/riff/display";
import { MAX_FRET, midiAt } from "../engine/riff/fretboard";
import { roleOf } from "../engine/riff/scale";
import { Bar } from "../engine/riff/spec";
import { colors, spacing } from "../theme/colors";

const STRING_COUNT = 6;
const STRING_GAP = 40;
const FRET_HEIGHT = 44;
const LEFT_MARGIN = 46;
const TOP_MARGIN = 40;
const RIGHT_MARGIN = 24;
const BOTTOM_MARGIN = 16;

const FRET_MARKERS = [3, 5, 7, 9];
const DOUBLE_MARKER = 12;

const STRING_LABELS = ["E", "A", "D", "G", "B", "e"] as const;

const STRING_STYLES = [
  { width: 2.4, color: "rgba(180,170,155,0.7)"  },
  { width: 2.0, color: "rgba(180,170,155,0.65)" },
  { width: 1.6, color: "rgba(190,180,165,0.6)"  },
  { width: 1.2, color: "rgba(210,205,195,0.55)" },
  { width: 0.9, color: "rgba(220,215,205,0.7)"  },
  { width: 0.8, color: "rgba(220,215,205,0.7)"  },
];

const GRAIN_OFFSETS = [0.12, 0.28, 0.47, 0.68, 0.85];

const PITCH_CLASSES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
] as const;

const pitchClassName = (midi: number) => PITCH_CLASSES[midi % 12];

interface ScalePosition {
  stringIdx: number;
  fret: number;
  role: string;
}

function computeScalePositions(
  keyName: string,
  includeBlue: boolean,
  maxFret: number,
): ScalePosition[] {
  const out: ScalePosition[] = [];
  for (let s = 0; s < STRING_COUNT; s++) {
    for (let f = 0; f <= maxFret; f++) {
      const midi = midiAt(s, f);
      const role = roleOf(midi, keyName, includeBlue);
      if (role) out.push({ stringIdx: s, fret: f, role });
    }
  }
  return out;
}

interface NeckBackgroundProps {
  maxFret: number;
}

const NeckBackground = React.memo(function NeckBackground({
  maxFret,
}: NeckBackgroundProps) {
  const fretCount = maxFret + 1;
  const boardWidth = (STRING_COUNT - 1) * STRING_GAP;
  const boardHeight = fretCount * FRET_HEIGHT;
  const neckLeft = LEFT_MARGIN - 10;
  const neckRight = LEFT_MARGIN + boardWidth + 10;
  const neckW = neckRight - neckLeft;
  const stringX = (i: number) => LEFT_MARGIN + i * STRING_GAP;
  const fretY = (f: number) => TOP_MARGIN + f * FRET_HEIGHT + FRET_HEIGHT / 2;
  const fretLineY = (f: number) => TOP_MARGIN + f * FRET_HEIGHT;

  return (
    <G>
      {/* 1. Neck body — rosewood */}
      <Rect
        x={neckLeft}
        y={TOP_MARGIN}
        width={neckW}
        height={boardHeight}
        rx={8}
        ry={8}
        fill="#2A1B0E"
        stroke="#3D2A18"
        strokeWidth={1.5}
      />

      {/* 2. Wood grain */}
      {GRAIN_OFFSETS.map((pct, i) => {
        const y = TOP_MARGIN + boardHeight * pct;
        return (
          <Line
            key={`grain-${i}`}
            x1={neckLeft + 4}
            y1={y}
            x2={neckRight - 4}
            y2={y}
            stroke="rgba(255,255,255,0.03)"
            strokeWidth={0.8}
          />
        );
      })}

      {/* 3. Headstock hint + tuning pegs */}
      <Path
        d={`M ${neckLeft + 12} ${TOP_MARGIN} L ${neckLeft + 6} ${TOP_MARGIN - 18} L ${neckRight - 6} ${TOP_MARGIN - 18} L ${neckRight - 12} ${TOP_MARGIN} Z`}
        fill="#1A1008"
        stroke="#2A1B0E"
        strokeWidth={1}
      />
      {STRING_LABELS.map((_, i) => {
        const pegX = neckLeft + 16 + i * ((neckW - 32) / 5);
        return (
          <Circle
            key={`peg-${i}`}
            cx={pegX}
            cy={TOP_MARGIN - 10}
            r={3}
            fill="#3D3020"
            stroke="#5A4A38"
            strokeWidth={0.8}
          />
        );
      })}

      {/* 4. Nut */}
      <Line
        x1={neckLeft + 2}
        y1={TOP_MARGIN}
        x2={neckRight - 2}
        y2={TOP_MARGIN}
        stroke="#D4C9A8"
        strokeWidth={4}
        strokeLinecap="round"
      />

      {/* 5. Fret wires */}
      {Array.from({ length: fretCount }, (_, i) => {
        if (i === 0) return null;
        const y = fretLineY(i);
        return (
          <G key={`fret-${i}`}>
            <Line
              x1={neckLeft + 2}
              y1={y + 0.5}
              x2={neckRight - 2}
              y2={y + 0.5}
              stroke="rgba(192,192,210,0.2)"
              strokeWidth={1.5}
            />
            <Line
              x1={neckLeft + 2}
              y1={y}
              x2={neckRight - 2}
              y2={y}
              stroke="rgba(192,192,210,0.5)"
              strokeWidth={1}
            />
          </G>
        );
      })}

      {/* 6. Inlay dots */}
      {FRET_MARKERS.filter((f) => f <= maxFret).map((f) => (
        <Circle
          key={`marker-${f}`}
          cx={LEFT_MARGIN + boardWidth / 2}
          cy={fretY(f)}
          r={5}
          fill="#C8BFA0"
          opacity={0.3}
        />
      ))}
      {DOUBLE_MARKER <= maxFret && (
        <G>
          <Circle
            cx={LEFT_MARGIN + boardWidth / 2 - 22}
            cy={fretY(DOUBLE_MARKER)}
            r={4}
            fill="#C8BFA0"
            opacity={0.3}
          />
          <Circle
            cx={LEFT_MARGIN + boardWidth / 2 + 22}
            cy={fretY(DOUBLE_MARKER)}
            r={4}
            fill="#C8BFA0"
            opacity={0.3}
          />
        </G>
      )}

      {/* 7. Strings */}
      {STRING_LABELS.map((s, i) => {
        const x = stringX(i);
        const style = STRING_STYLES[i];
        return (
          <Line
            key={`string-${s}`}
            x1={x}
            y1={TOP_MARGIN}
            x2={x}
            y2={TOP_MARGIN + boardHeight}
            stroke={style.color}
            strokeWidth={style.width}
          />
        );
      })}

      {/* 8. Body curve */}
      {maxFret >= 12 && (
        <Path
          d={`M ${neckLeft} ${TOP_MARGIN + boardHeight} Q ${LEFT_MARGIN + boardWidth / 2} ${TOP_MARGIN + boardHeight + 10} ${neckRight} ${TOP_MARGIN + boardHeight}`}
          fill="none"
          stroke="rgba(90,70,50,0.4)"
          strokeWidth={1.5}
        />
      )}

      {/* String labels */}
      {STRING_LABELS.map((label, i) => (
        <SvgText
          key={`label-${label}`}
          x={stringX(i)}
          y={TOP_MARGIN - 24}
          fill={colors.textMuted}
          fontSize={11}
          fontWeight="500"
          textAnchor="middle"
        >
          {label}
        </SvgText>
      ))}

      {/* Fret numbers */}
      {Array.from({ length: fretCount }, (_, i) => (
        <SvgText
          key={`fretnum-${i}`}
          x={LEFT_MARGIN - 20}
          y={fretY(i) + 4}
          fill={colors.textMuted}
          fontSize={10}
          textAnchor="middle"
        >
          {i}
        </SvgText>
      ))}
    </G>
  );
});

interface Props {
  bar: Bar;
  keyName: string;
  includeBlue: boolean;
  maxFret?: number;
  showScaleShape: boolean;
  showNoteNames: boolean;
  showSequence?: boolean;
  activeStep?: number | null;
}

export function RiffFretboardView({
  bar,
  keyName,
  includeBlue,
  maxFret = MAX_FRET,
  showScaleShape,
  showNoteNames,
  showSequence = false,
  activeStep = null,
}: Props) {
  const boardWidth = (STRING_COUNT - 1) * STRING_GAP;
  const boardHeight = (maxFret + 1) * FRET_HEIGHT;
  const svgWidth = LEFT_MARGIN + boardWidth + RIGHT_MARGIN;
  const svgHeight = TOP_MARGIN + boardHeight + BOTTOM_MARGIN;

  const stringX = (i: number) => LEFT_MARGIN + i * STRING_GAP;
  const fretY = (f: number) => TOP_MARGIN + f * FRET_HEIGHT + FRET_HEIGHT / 2;

  const scalePositions = useMemo(
    () => computeScalePositions(keyName, includeBlue, maxFret),
    [keyName, includeBlue, maxFret],
  );

  const playedKeys = useMemo(() => {
    const s = new Set<string>();
    for (const n of bar.notes) s.add(`${n.string}-${n.fret}`);
    return s;
  }, [bar]);

  const rolesPresent = useMemo(() => {
    const s = new Set<string>();
    for (const n of bar.notes) {
      const role = roleOf(midiAt(n.string, n.fret), keyName, includeBlue);
      if (role) s.add(role);
    }
    return s;
  }, [bar, keyName, includeBlue]);

  // Step → ordinal (1-indexed). Notes sharing a step (chords) share an ordinal.
  const stepOrdinals = useMemo(() => {
    const visibleSteps = new Set<number>();
    for (const n of bar.notes) {
      if (n.fret <= maxFret) visibleSteps.add(n.step);
    }
    const sorted = Array.from(visibleSteps).sort((a, b) => a - b);
    const map = new Map<number, number>();
    sorted.forEach((step, i) => map.set(step, i + 1));
    return map;
  }, [bar, maxFret]);

  // One anchor point per step (centroid of its notes) for the path line.
  const pathAnchors = useMemo(() => {
    const byStep = new Map<number, { sx: number; sy: number; count: number }>();
    for (const n of bar.notes) {
      if (n.fret > maxFret) continue;
      const entry = byStep.get(n.step) ?? { sx: 0, sy: 0, count: 0 };
      entry.sx += stringX(n.string);
      entry.sy += fretY(n.fret);
      entry.count += 1;
      byStep.set(n.step, entry);
    }
    return Array.from(byStep.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => ({ x: v.sx / v.count, y: v.sy / v.count }));
  }, [bar, maxFret]);

  const pathD = useMemo(() => {
    if (pathAnchors.length < 2) return null;
    return pathAnchors
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ");
  }, [pathAnchors]);

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={svgWidth} height={svgHeight}>
          <NeckBackground maxFret={maxFret} />

          {/* Scale-shape overlay — ghost dots at every pool position */}
          {showScaleShape && (
            <G opacity={0.2}>
              {scalePositions.map(({ stringIdx, fret, role }) => {
                const key = `${stringIdx}-${fret}`;
                if (playedKeys.has(key)) return null;
                const cx = stringX(stringIdx);
                const cy = fretY(fret);
                const color = ROLE_COLORS[role] ?? ROLE_COLORS["?"];
                return (
                  <G key={`scale-${key}`}>
                    <Circle cx={cx} cy={cy} r={5} fill={color} />
                    {showNoteNames && (
                      <SvgText
                        x={cx}
                        y={cy + 3}
                        fill="rgba(255,255,255,0.7)"
                        fontSize={7}
                        fontWeight="600"
                        textAnchor="middle"
                      >
                        {pitchClassName(midiAt(stringIdx, fret))}
                      </SvgText>
                    )}
                  </G>
                );
              })}
            </G>
          )}

          {/* Sequence path — dashed line through step anchors in play order */}
          {showSequence && pathD && (
            <Path
              d={pathD}
              fill="none"
              stroke="rgba(255,255,255,0.45)"
              strokeWidth={1.4}
              strokeDasharray="4 4"
              strokeLinecap="round"
            />
          )}

          {/* Played notes — role-colored with glow + white ring */}
          {bar.notes.map((note, i) => {
            if (note.fret > maxFret) return null;
            const cx = stringX(note.string);
            const cy = fretY(note.fret);
            const midi = midiAt(note.string, note.fret);
            const role = roleOf(midi, keyName, includeBlue) ?? "?";
            const color = ROLE_COLORS[role] ?? ROLE_COLORS["?"];
            const label = showNoteNames
              ? pitchClassName(midi)
              : String(note.fret);
            const isActive = activeStep != null && note.step === activeStep;
            return (
              <G key={`played-${i}`}>
                {isActive && (
                  <Circle cx={cx} cy={cy} r={26} fill={color} opacity={0.35} />
                )}
                <Circle
                  cx={cx}
                  cy={cy}
                  r={isActive ? 20 : 18}
                  fill={color}
                  opacity={isActive ? 0.3 : 0.15}
                />
                <Circle
                  cx={cx}
                  cy={cy}
                  r={isActive ? 13 : 12}
                  fill={color}
                  opacity={isActive ? 1 : 0.9}
                  stroke={isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)"}
                  strokeWidth={isActive ? 2.2 : 1.5}
                />
                <SvgText
                  x={cx}
                  y={cy + 3.5}
                  fill="rgba(255,255,255,0.95)"
                  fontSize={9}
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {label}
                </SvgText>
              </G>
            );
          })}

          {/* Sequence badges — ordinal of each step, shared across chord notes */}
          {showSequence &&
            bar.notes.map((note, i) => {
              if (note.fret > maxFret) return null;
              const ordinal = stepOrdinals.get(note.step);
              if (ordinal == null) return null;
              const cx = stringX(note.string) + 11;
              const cy = fretY(note.fret) - 11;
              return (
                <G key={`seq-${i}`}>
                  <Circle
                    cx={cx}
                    cy={cy}
                    r={7}
                    fill="#FFFFFF"
                    stroke="rgba(0,0,0,0.6)"
                    strokeWidth={0.8}
                  />
                  <SvgText
                    x={cx}
                    y={cy + 3}
                    fill="#0B0B0F"
                    fontSize={9}
                    fontWeight="800"
                    textAnchor="middle"
                  >
                    {ordinal}
                  </SvgText>
                </G>
              );
            })}
        </Svg>
      </ScrollView>

      <View style={styles.legend}>
        {ROLE_ORDER.filter((r) => rolesPresent.has(r)).map((role) => (
          <View key={role} style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: ROLE_COLORS[role] }]}
            />
            <Text style={styles.legendLabel}>
              {role}
              {ROLE_HINTS[role] ? ` \u00B7 ${ROLE_HINTS[role]}` : ""}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    fontFamily: "monospace",
  },
});
