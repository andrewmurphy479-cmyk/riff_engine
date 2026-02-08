import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import Svg, {
  Rect,
  Line,
  Circle,
  Text as SvgText,
  G,
  Path,
} from 'react-native-svg';
import { TabEvent, GuitarString, RiffLayer } from '../engine/types';
import { FretboardNote, FRETBOARD_STRINGS } from '../engine/theory';
import { colors } from '../theme/colors';

// ── Layout constants ──
const STRING_GAP = 40;
const FRET_HEIGHT = 44;
const LEFT_MARGIN = 36;   // fret numbers
const TOP_MARGIN = 40;    // room for headstock + string labels
const RIGHT_MARGIN = 12;
const BOTTOM_MARGIN = 16;
const STRING_COUNT = 6;

// Fret marker positions (standard guitar dots)
const FRET_MARKERS = [3, 5, 7, 9];
const DOUBLE_MARKER = 12;

// Layer colors matching TabDisplay
const LAYER_COLORS: Record<RiffLayer, string> = {
  melody: '#5AAFA8',
  bass: '#C8B95A',
  fills: '#C47070',
};

const DEFAULT_NOTE_COLOR = 'rgba(220, 218, 210, 0.75)';

// String labels (low E on left, high e on right)
const STRING_LABELS: string[] = ['E', 'A', 'D', 'G', 'B', 'e'];

// Realistic string rendering — graduated thickness and color
const STRING_STYLES = [
  { width: 2.4, color: 'rgba(180,170,155,0.7)' },   // Low E (wound)
  { width: 2.0, color: 'rgba(180,170,155,0.65)' },   // A
  { width: 1.6, color: 'rgba(190,180,165,0.6)' },    // D
  { width: 1.2, color: 'rgba(210,205,195,0.55)' },   // G
  { width: 0.9, color: 'rgba(220,215,205,0.7)' },    // B (plain)
  { width: 0.8, color: 'rgba(220,215,205,0.7)' },    // e (plain)
];

// Wood grain line positions (irregular spacing for realism)
const GRAIN_OFFSETS = [0.12, 0.28, 0.47, 0.68, 0.85];

interface FretboardExplorerProps {
  events: TabEvent[];
  chord: string;
  scaleNotes: FretboardNote[];
  maxFret: number;
  showScale: boolean;
  showNoteNames: boolean;
}

export function FretboardExplorer({
  events,
  chord,
  scaleNotes,
  maxFret,
  showScale,
  showNoteNames,
}: FretboardExplorerProps) {
  const fretCount = maxFret + 1; // frets 0..maxFret
  const boardWidth = (STRING_COUNT - 1) * STRING_GAP;
  const boardHeight = fretCount * FRET_HEIGHT;
  const svgWidth = LEFT_MARGIN + boardWidth + RIGHT_MARGIN;
  const svgHeight = TOP_MARGIN + boardHeight + BOTTOM_MARGIN;

  // Neck edges
  const neckLeft = LEFT_MARGIN - 10;
  const neckRight = LEFT_MARGIN + boardWidth + 10;
  const neckW = neckRight - neckLeft;

  // String index → X position
  const stringX = (idx: number) => LEFT_MARGIN + idx * STRING_GAP;
  // Fret → Y position (center of fret space)
  const fretY = (fret: number) => TOP_MARGIN + fret * FRET_HEIGHT + FRET_HEIGHT / 2;
  // Fret line Y (top of fret space)
  const fretLineY = (fret: number) => TOP_MARGIN + fret * FRET_HEIGHT;

  // Map GuitarString to string index
  const stringIndex = (s: GuitarString): number => FRETBOARD_STRINGS.indexOf(s);

  // Build a set of played note positions for quick lookup
  const playedNoteKey = (sIdx: number, fret: number) => `${sIdx}-${fret}`;
  const playedNotes = new Map<string, { fret: number; layer?: RiffLayer; noteName?: string }>();
  for (const ev of events) {
    const sIdx = stringIndex(ev.string);
    if (sIdx >= 0) {
      const key = playedNoteKey(sIdx, ev.fret);
      if (!playedNotes.has(key)) {
        playedNotes.set(key, { fret: ev.fret, layer: ev.layer });
      }
    }
  }

  // Build scale note lookup
  const scaleNoteKey = (sIdx: number, fret: number) => `${sIdx}-${fret}`;
  const scaleNoteMap = new Map<string, FretboardNote>();
  for (const n of scaleNotes) {
    const sIdx = stringIndex(n.string);
    if (sIdx >= 0) {
      scaleNoteMap.set(scaleNoteKey(sIdx, n.fret), n);
    }
  }


  return (
    <ScrollView style={styles.container} nestedScrollEnabled>
      <Svg width={svgWidth} height={svgHeight}>

        {/* ═══ 1. NECK BODY — rosewood background ═══ */}
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

        {/* ═══ 2. WOOD GRAIN — faint horizontal lines ═══ */}
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

        {/* ═══ 3. HEADSTOCK HINT — dark trapezoid above nut ═══ */}
        <Path
          d={`
            M ${neckLeft + 12} ${TOP_MARGIN}
            L ${neckLeft + 6} ${TOP_MARGIN - 18}
            L ${neckRight - 6} ${TOP_MARGIN - 18}
            L ${neckRight - 12} ${TOP_MARGIN}
            Z
          `}
          fill="#1A1008"
          stroke="#2A1B0E"
          strokeWidth={1}
        />
        {/* Tuning pegs — 6 tiny circles */}
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

        {/* ═══ 4. NUT — bone/ivory bar at fret 0 ═══ */}
        <Line
          x1={neckLeft + 2}
          y1={TOP_MARGIN}
          x2={neckRight - 2}
          y2={TOP_MARGIN}
          stroke="#D4C9A8"
          strokeWidth={4}
          strokeLinecap="round"
        />

        {/* ═══ 5. FRET WIRES — metallic silver with glow ═══ */}
        {Array.from({ length: fretCount }, (_, i) => {
          if (i === 0) return null; // nut already drawn
          const y = fretLineY(i);
          return (
            <G key={`fret-${i}`}>
              {/* Glow line (slightly offset, lower opacity) */}
              <Line
                x1={neckLeft + 2}
                y1={y + 0.5}
                x2={neckRight - 2}
                y2={y + 0.5}
                stroke="rgba(192,192,210,0.2)"
                strokeWidth={1.5}
              />
              {/* Main fret wire */}
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

        {/* ═══ 6. INLAY DOTS — pearl style ═══ */}
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
          <>
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
          </>
        )}

        {/* ═══ 7. STRINGS — graduated thickness and color ═══ */}
        {FRETBOARD_STRINGS.map((s, i) => {
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

        {/* ═══ 8. BODY CURVE HINT (when maxFret >= 12) ═══ */}
        {maxFret >= 12 && (
          <Path
            d={`
              M ${neckLeft} ${TOP_MARGIN + boardHeight}
              Q ${LEFT_MARGIN + boardWidth / 2} ${TOP_MARGIN + boardHeight + 10}
                ${neckRight} ${TOP_MARGIN + boardHeight}
            `}
            fill="none"
            stroke="rgba(90,70,50,0.4)"
            strokeWidth={1.5}
          />
        )}

        {/* String labels at top */}
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

        {/* Fret numbers on left */}
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

        {/* ═══ 9. SCALE OVERLAY — high contrast ═══ */}
        {showScale &&
          scaleNotes
            .filter((n) => n.fret <= maxFret)
            .map((n) => {
              const sIdx = stringIndex(n.string);
              if (sIdx < 0) return null;
              const key = `${sIdx}-${n.fret}`;
              // Don't draw scale dots under played notes
              if (playedNotes.has(key)) return null;

              const cx = stringX(sIdx);
              const cy = fretY(n.fret);

              let fill: string;
              let radius: number;
              let textColor: string;
              let textWeight: string;

              if (n.isRoot) {
                fill = colors.accent;
                radius = 8;
                textColor = 'rgba(255,255,255,0.9)';
                textWeight = '700';
              } else if (n.isChordTone) {
                fill = '#5AAFA8';
                radius = 6;
                textColor = 'rgba(255,255,255,0.85)';
                textWeight = '600';
              } else {
                fill = 'rgba(255,255,255,0.2)';
                radius = 5;
                textColor = 'rgba(255,255,255,0.55)';
                textWeight = '500';
              }

              return (
                <G key={`scale-${key}`}>
                  <Circle
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill={fill}
                    opacity={n.isRoot ? 0.7 : n.isChordTone ? 0.45 : 0.8}
                  />
                  {/* White ring on root notes */}
                  {n.isRoot && (
                    <Circle
                      cx={cx}
                      cy={cy}
                      r={radius}
                      fill="none"
                      stroke="rgba(255,255,255,0.5)"
                      strokeWidth={1}
                      opacity={0.7}
                    />
                  )}
                  {showNoteNames && (
                    <SvgText
                      x={cx}
                      y={cy + 3}
                      fill={textColor}
                      fontSize={7}
                      fontWeight={textWeight}
                      textAnchor="middle"
                    >
                      {n.noteName}
                    </SvgText>
                  )}
                </G>
              );
            })}

        {/* ═══ 10. PLAYED NOTES — with glow ═══ */}
        {Array.from(playedNotes.entries()).map(([key, note]) => {
          const [sIdxStr, fretStr] = key.split('-');
          const sIdx = parseInt(sIdxStr, 10);
          const fret = parseInt(fretStr, 10);
          if (fret > maxFret) return null;

          const cx = stringX(sIdx);
          const cy = fretY(fret);
          const fillColor = note.layer ? LAYER_COLORS[note.layer] : DEFAULT_NOTE_COLOR;

          // Get note name from scale map if available
          const scaleNote = scaleNoteMap.get(key);
          const label = showNoteNames && scaleNote ? scaleNote.noteName : String(fret);

          return (
            <G key={`played-${key}`}>
              {/* Glow ring behind */}
              <Circle cx={cx} cy={cy} r={16} fill={fillColor} opacity={0.12} />
              {/* Main dot */}
              <Circle cx={cx} cy={cy} r={11} fill={fillColor} opacity={0.7} />
              <SvgText
                x={cx}
                y={cy + 3.5}
                fill="rgba(255,255,255,0.85)"
                fontSize={9}
                fontWeight="600"
                textAnchor="middle"
              >
                {label}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 0,
  },
});
