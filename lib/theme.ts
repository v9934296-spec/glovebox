/**
 * Glovebox design tokens — dark-first, automotive amber accent.
 * All UI colors/spacing/type come from here; no hex literals in screens.
 */
export const palette = {
  bg: {
    app: '#0D0F12',
    surface: '#16191E',
    surfaceRaised: '#1E2229',
  },
  border: {
    subtle: '#262B33',
    default: '#333A45',
  },
  text: {
    primary: '#F2F4F7',
    secondary: '#A8B0BC',
    tertiary: '#6B7280',
    onAccent: '#14100A',
  },
  accent: {
    primary: '#F5A524',
    primaryPressed: '#D98F16',
  },
  status: {
    ok: '#34D399',
    dueSoon: '#FBBF24',
    overdue: '#F87171',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  screenPadding: 16,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

export const typography = {
  h1: { size: 28, weight: '700', lineHeight: 34 },
  h2: { size: 22, weight: '700', lineHeight: 28 },
  h3: { size: 18, weight: '600', lineHeight: 24 },
  body: { size: 15, weight: '400', lineHeight: 21 },
  bodyEmphasis: { size: 15, weight: '600', lineHeight: 21 },
  caption: { size: 13, weight: '400', lineHeight: 18 },
  overline: { size: 11, weight: '600', lineHeight: 14, letterSpacing: 1.2 },
} as const;

export type FontWeightString = '400' | '500' | '600' | '700';
