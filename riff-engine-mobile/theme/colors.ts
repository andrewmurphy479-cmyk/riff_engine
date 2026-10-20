import { analog } from './analog';

export const colors = {
  // Background
  background: analog.paper,
  backgroundSecondary: analog.inset,

  // Accent
  accent: analog.oxblood,
  accentLight: '#8D4052',
  accentDark: '#54202E',

  // Reading surfaces
  card: analog.inset,
  cardBorder: analog.line,
  cardHover: analog.selected,
  // Clear paper beneath notation and explanations.
  cardSolid: analog.paper,

  // Text
  textPrimary: analog.ink,
  textSecondary: analog.muted,
  textMuted: analog.muted,
  textDisabled: '#9D9283',

  // Chips
  chipActive: analog.selected,
  chipActiveBorder: analog.oxblood,
  chipInactive: analog.inset,
  chipInactiveBorder: analog.line,

  // Status
  success: analog.success,
  warning: '#795117',
  error: '#A02F35',

  // Save/remove affordances share the brand color; failures use error.
  heart: analog.oxblood,
  heartBg: analog.selected,
  heartBorder: '#CC9CA6',

  // Surface / Border
  surface: analog.inset,
  border: analog.line,

  // Misc
  white: analog.paper,
  black: '#000000',
  transparent: 'transparent',
};

export interface ChordColorSet {
  bg: string;      // 12% opacity
  border: string;  // 35% opacity
  accent: string;  // full color
  text: string;    // readable on paper
}

function makeChordColorSet(hex: string): ChordColorSet {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return {
    bg: `rgba(${r}, ${g}, ${b}, 0.12)`,
    border: `rgba(${r}, ${g}, ${b}, 0.35)`,
    accent: hex,
    text: hex,
  };
}

export const chordAccentColors: Record<string, ChordColorSet> = {
  Em: makeChordColorSet('#343B80'),  // slate blue
  C:  makeChordColorSet('#725A1F'),  // warm gold
  G:  makeChordColorSet('#38614C'),  // forest green
  D:  makeChordColorSet('#9A4826'),  // sunset coral
  Am: makeChordColorSet('#484E82'),  // indigo
  A:  makeChordColorSet('#795117'),  // amber
  E:  makeChordColorSet('#722C3D'),  // crimson
  Dm: makeChordColorSet('#6C4582'),  // deep purple
  F:  makeChordColorSet('#326B62'),  // teal
  B7: makeChordColorSet('#795117'),  // dark amber
  A7: makeChordColorSet('#9A4826'),  // vivid orange
  E7: makeChordColorSet('#722C3D'),  // deep red
  D7: makeChordColorSet('#9A4826'),  // deep orange-red
  G7: makeChordColorSet('#38614C'),  // dark green
  Bm: makeChordColorSet('#6C4582'),  // deep violet
  Cadd9: makeChordColorSet('#326B62'), // cyan
};

export const chordColors = {
  major: makeChordColorSet('#725A1F'),
  minor: makeChordColorSet(analog.indigo),
  dom7: makeChordColorSet('#9A4826'),
  selectedGlow: analog.oxblood,
  modalBackground: analog.paper,
};

export function getChordColors(chordId: string, quality?: 'major' | 'minor' | 'dom7'): ChordColorSet {
  if (chordAccentColors[chordId]) return chordAccentColors[chordId];
  if (quality) return chordColors[quality];
  return chordColors.major;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 36,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 18,
  full: 9999,
};

export const typography = {
  h1: {
    fontFamily: analog.headingFont,
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 36,
  },
  h2: {
    fontFamily: analog.headingFont,
    fontSize: 22,
    fontWeight: '700' as const,
    lineHeight: 28,
  },
  h3: {
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 22,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 17,
  },
  small: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 15,
  },
  mono: {
    fontSize: 12,
    fontWeight: '400' as const,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
};
