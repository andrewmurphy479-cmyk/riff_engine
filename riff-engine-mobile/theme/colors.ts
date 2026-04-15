export const colors = {
  // Background
  background: '#0B0B0F',
  backgroundSecondary: '#121218',

  // Accent
  accent: '#4A7AFF',
  accentLight: '#6B94FF',
  accentDark: '#3558C4',

  // Card / Glass
  card: 'rgba(255, 255, 255, 0.06)',
  cardBorder: 'rgba(255, 255, 255, 0.06)',
  cardHover: 'rgba(255, 255, 255, 0.09)',

  // Text
  textPrimary: 'rgba(255, 255, 255, 0.87)',
  textSecondary: 'rgba(255, 255, 255, 0.55)',
  textMuted: 'rgba(255, 255, 255, 0.35)',
  textDisabled: 'rgba(255, 255, 255, 0.25)',

  // Chips
  chipActive: 'rgba(74, 122, 255, 0.18)',
  chipActiveBorder: 'rgba(74, 122, 255, 0.35)',
  chipInactive: 'rgba(255, 255, 255, 0.05)',
  chipInactiveBorder: 'rgba(255, 255, 255, 0.0)',

  // Status
  success: '#1A9A4A',
  warning: '#F59E0B',
  error: '#EF4444',

  // Surface / Border
  surface: '#1A1A24',
  border: 'rgba(255, 255, 255, 0.07)',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

export interface ChordColorSet {
  bg: string;      // 12% opacity
  border: string;  // 35% opacity
  accent: string;  // full color
  text: string;    // lighter tint
}

function makeChordColorSet(hex: string): ChordColorSet {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Lighter tint for text: blend 40% toward white
  const tr = Math.round(r + (255 - r) * 0.4);
  const tg = Math.round(g + (255 - g) * 0.4);
  const tb = Math.round(b + (255 - b) * 0.4);
  return {
    bg: `rgba(${r}, ${g}, ${b}, 0.12)`,
    border: `rgba(${r}, ${g}, ${b}, 0.35)`,
    accent: hex,
    text: `rgb(${tr}, ${tg}, ${tb})`,
  };
}

export const chordAccentColors: Record<string, ChordColorSet> = {
  Em: makeChordColorSet('#7B68EE'),  // slate blue
  C:  makeChordColorSet('#C8B560'),  // warm gold
  G:  makeChordColorSet('#4CAF50'),  // forest green
  D:  makeChordColorSet('#FF7043'),  // sunset coral
  Am: makeChordColorSet('#5C6BC0'),  // indigo
  A:  makeChordColorSet('#FFB300'),  // amber
  E:  makeChordColorSet('#E53935'),  // crimson
  Dm: makeChordColorSet('#7E57C2'),  // deep purple
  F:  makeChordColorSet('#26A69A'),  // teal
  B7: makeChordColorSet('#FF8F00'),  // dark amber
  A7: makeChordColorSet('#FF6D00'),  // vivid orange
  E7: makeChordColorSet('#D32F2F'),  // deep red
  D7: makeChordColorSet('#F4511E'),  // deep orange-red
  G7: makeChordColorSet('#2E7D32'),  // dark green
  Bm: makeChordColorSet('#6A1B9A'),  // deep violet
  Cadd9: makeChordColorSet('#00ACC1'), // cyan
};

export const chordColors = {
  major: {
    bg: 'rgba(217, 170, 59, 0.12)',
    border: 'rgba(217, 170, 59, 0.35)',
    accent: '#D9AA3B',
    text: '#E8C45A',
  },
  minor: {
    bg: 'rgba(100, 130, 210, 0.12)',
    border: 'rgba(100, 130, 210, 0.35)',
    accent: '#6482D2',
    text: '#8BA3E8',
  },
  dom7: {
    bg: 'rgba(230, 126, 50, 0.12)',
    border: 'rgba(230, 126, 50, 0.35)',
    accent: '#E67E32',
    text: '#F0A060',
  },
  selectedGlow: 'rgba(74, 122, 255, 0.4)',
  modalBackground: 'rgba(0, 0, 0, 0.92)',
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
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 36,
  },
  h2: {
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
