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
