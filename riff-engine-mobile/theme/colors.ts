export const colors = {
  // Background
  background: '#0B0B0F',
  backgroundSecondary: '#121218',

  // Accent
  accent: '#2D6BFF',
  accentLight: '#4D85FF',
  accentDark: '#1D4BB8',

  // Card / Glass
  card: 'rgba(255, 255, 255, 0.08)',
  cardBorder: 'rgba(255, 255, 255, 0.1)',
  cardHover: 'rgba(255, 255, 255, 0.12)',

  // Text
  textPrimary: 'rgba(255, 255, 255, 0.9)',
  textSecondary: 'rgba(255, 255, 255, 0.7)',
  textMuted: 'rgba(255, 255, 255, 0.4)',
  textDisabled: 'rgba(255, 255, 255, 0.25)',

  // Chips
  chipActive: 'rgba(45, 107, 255, 0.25)',
  chipActiveBorder: 'rgba(45, 107, 255, 0.5)',
  chipInactive: 'rgba(255, 255, 255, 0.06)',
  chipInactiveBorder: 'rgba(255, 255, 255, 0.08)',

  // Status
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',

  // Surface / Border
  surface: '#1A1A24',
  border: 'rgba(255, 255, 255, 0.12)',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
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
    fontSize: 32,
    fontWeight: '900' as const,
    lineHeight: 40,
  },
  h2: {
    fontSize: 24,
    fontWeight: '800' as const,
    lineHeight: 32,
  },
  h3: {
    fontSize: 18,
    fontWeight: '700' as const,
    lineHeight: 24,
  },
  body: {
    fontSize: 16,
    fontWeight: '500' as const,
    lineHeight: 22,
  },
  caption: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 18,
  },
  small: {
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 16,
  },
  mono: {
    fontSize: 12,
    fontWeight: '400' as const,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
};
