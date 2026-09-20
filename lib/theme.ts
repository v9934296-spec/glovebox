/**
 * Glovebox tokens — shop-manual, not neon kit.
 * Warm paper on grease-black. Gold is the only accent.
 */
export const palette = {
  bg: {
    app: '#141311',
    raised: '#1A1916',
    surface: '#1F1D19',
    surfaceRaised: '#26241F',
    hero: '#1A1916',
  },
  border: {
    subtle: '#2E2C27',
    default: '#3A372F',
  },
  text: {
    primary: '#F3EDE3',
    secondary: '#B7AFA3',
    tertiary: '#7A746A',
    onAccent: '#141311',
  },
  accent: {
    primary: '#E8C56B',
    primaryPressed: '#C9A84A',
    soft: 'rgba(232, 197, 107, 0.12)',
    danger: '#D4523A',
    dangerPressed: '#B33E2A',
  },
  status: {
    ok: '#C4B48A',
    dueSoon: '#E8C56B',
    overdue: '#D4523A',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  section: 32,
  screenPadding: 20,
} as const;

export const radius = {
  sm: 4,
  label: 4,
  md: 6,
  lg: 8,
  xl: 10,
  hero: 10,
  pill: 999,
} as const;

export const typography = {
  display: { size: 28, weight: '600', lineHeight: 34 },
  plate: { size: 18, weight: '500', lineHeight: 24 },
  hero: { size: 22, weight: '600', lineHeight: 28 },
  h1: { size: 22, weight: '600', lineHeight: 28 },
  h2: { size: 18, weight: '600', lineHeight: 24 },
  h3: { size: 16, weight: '600', lineHeight: 22 },
  metric: { size: 24, weight: '600', lineHeight: 28 },
  body: { size: 16, weight: '400', lineHeight: 22 },
  bodyEmphasis: { size: 16, weight: '600', lineHeight: 22 },
  caption: { size: 13, weight: '400', lineHeight: 18 },
  meta: { size: 12, weight: '400', lineHeight: 16 },
  overline: { size: 12, weight: '500', lineHeight: 16, letterSpacing: 0.4 },
} as const;

export type FontWeightString = '400' | '500' | '600' | '700';