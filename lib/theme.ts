/**
 * Glovebox design tokens — dark-mode OnFlow automotive palette.
 * All UI colors/spacing/type come from here; no hex literals in screens.
 */
export const palette = {
  bg: {
    app: '#080A0C',
    raised: '#0D0F12',
    surface: '#111417',
    surfaceRaised: '#171A1E',
    hero: '#12151A',
  },
  border: {
    subtle: '#22272D',
    default: '#22272D',
  },
  text: {
    primary: '#F7F7F7',
    secondary: '#A7ADB5',
    tertiary: '#747B84',
    onAccent: '#080A0C',
  },
  accent: {
    primary: '#54FF00',
    primaryPressed: '#46D400',
    soft: 'rgba(84, 255, 0, 0.12)',
    danger: '#FF0044',
    dangerPressed: '#CC0036',
  },
  status: {
    ok: '#54FF00',
    dueSoon: '#FBBF24',
    overdue: '#FF0044',
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
  xl: 16,
  hero: 18,
  pill: 999,
} as const;

export const typography = {
  display: { size: 32, weight: '700', lineHeight: 38 },
  plate: { size: 20, weight: '600', lineHeight: 26 },
  hero: { size: 26, weight: '700', lineHeight: 32 },
  h1: { size: 24, weight: '700', lineHeight: 30 },
  h2: { size: 22, weight: '700', lineHeight: 28 },
  h3: { size: 18, weight: '600', lineHeight: 24 },
  metric: { size: 26, weight: '700', lineHeight: 32 },
  body: { size: 15, weight: '400', lineHeight: 21 },
  bodyEmphasis: { size: 15, weight: '600', lineHeight: 21 },
  caption: { size: 13, weight: '400', lineHeight: 18 },
  meta: { size: 12, weight: '400', lineHeight: 16 },
  overline: { size: 11, weight: '600', lineHeight: 14, letterSpacing: 1.2 },
} as const;

export type FontWeightString = '400' | '500' | '600' | '700';
