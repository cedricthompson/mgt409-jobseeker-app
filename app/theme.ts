// Chart Academy brand. See STYLE_GUIDE.md for usage rules.
// Three looks the applicant can choose in Settings: light (default), dark, and high contrast,
// plus a text size. Every text color below passes WCAG AA on its background.
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

type Named<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

export type Look = 'light' | 'dark' | 'contrast';

const PALETTES = {
  // Contrast on white: red 5.1:1, blue 6.9:1, ink 18:1.
  light: {
    red: '#D71F2D',      // Chart Academy red: wordmark, heading accents, alerts
    blue: '#3A56A6',     // Chart Academy blue: buttons, links, focus
    blueDark: '#2B4080', // pressed states
    ink: '#1A1A1A',      // body text
    muted: '#4A4A4A',    // secondary text (8.9:1)
    line: '#C9CFE0',     // borders and dividers
    tint: '#F2F4FA',     // light blue panels
    bg: '#FFFFFF',       // page background
    surface: '#FFFFFF',  // cards
    onAccent: '#FFFFFF', // text on blue or red fills
    // Accents for the scorecard's areas (5:1 or better on white).
    teal: '#0F766E', purple: '#6D28D9', orange: '#B45309', green: '#15803D',
  },
  // On #121418: blue 5.7:1, red 5.5:1, ink 16.6:1, muted 10.1:1. Text on fills is dark (5.5:1 or better).
  dark: {
    red: '#F2545F', blue: '#6E8BE6', blueDark: '#5573CF', ink: '#F1F3F7', muted: '#B9C0CC',
    line: '#3A4152', tint: '#1C2028', bg: '#121418', surface: '#1C2028', onAccent: '#121418',
    teal: '#2DD4BF', purple: '#C4B5FD', orange: '#FDBA74', green: '#86EFAC',
  },
  // Darker brand colors and black text for low vision: blue 10.3:1, red 7.9:1 on white.
  contrast: {
    red: '#A3121E', blue: '#1C3A8C', blueDark: '#122966', ink: '#000000', muted: '#1A1A1A',
    line: '#4A4A4A', tint: '#EEF1F8', bg: '#FFFFFF', surface: '#FFFFFF', onAccent: '#FFFFFF',
    teal: '#0B5550', purple: '#4C1D95', orange: '#7C2D12', green: '#14532D',
  },
};

// `colors` is one shared object whose values change when the look changes, so screens that read
// colors.blue always get the current color. `white` stays white for photos and logos.
export const colors = { ...PALETTES.light, white: '#FFFFFF' };

const baseType = () => ({
  title: { fontSize: 30, fontWeight: '700' as const, color: colors.ink },
  heading: { fontSize: 22, fontWeight: '700' as const, color: colors.ink },
  body: { fontSize: 18, lineHeight: 26, color: colors.ink },
  small: { fontSize: 16, lineHeight: 22, color: colors.muted },
});

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 };
export const radius = 10;
export const touch = 48; // minimum tap target in points

let version = 0;
let scale = 1;
export const isDark = () => colors.bg === PALETTES.dark.bg;

// Applies the applicant's look and text size. Call before rendering; App re-renders all screens after.
export function applyTheme(look: Look = 'light', textScale = 1) {
  Object.assign(colors, PALETTES[look] ?? PALETTES.light);
  scale = textScale;
  version++;
}

// Every font size and line height in a style sheet, scaled by the chosen text size.
function scaleText<T>(sheet: T): T {
  if (scale === 1) return sheet;
  const out: Record<string, unknown> = {};
  for (const [k, s] of Object.entries(sheet as Record<string, Record<string, unknown>>)) {
    const v = { ...s };
    if (typeof v.fontSize === 'number') v.fontSize = Math.round(v.fontSize * scale);
    if (typeof v.lineHeight === 'number') v.lineHeight = Math.round(v.lineHeight * scale);
    // Round number badges (equal width, height, and line height) grow with their text.
    if (typeof v.height === 'number' && v.height === s.lineHeight) {
      if (v.width === v.height) v.width = v.lineHeight;
      if (v.borderRadius === v.height / 2) v.borderRadius = (v.lineHeight as number) / 2;
      v.height = v.lineHeight;
    }
    out[k] = v;
  }
  return out as T;
}

// Use instead of StyleSheet.create: the styles are rebuilt whenever the look or text size changes.
// const styles = themed(() => ({ safe: { backgroundColor: colors.bg } }));
// While a sheet is being built, `type` gives unscaled sizes, so `...type.body` inside a sheet is
// scaled once (with the rest of the sheet), not twice.
let building = 0;
export function themed<const T extends Named<T>>(make: () => T): T {
  let built = -1;
  let sheet = {} as T;
  return new Proxy({} as T, {
    get(_, key) {
      if (built !== version) {
        building++;
        try { sheet = StyleSheet.create(scaleText(make())); } finally { building--; }
        built = version;
      }
      return sheet[key as keyof T];
    },
  });
}

// Shared text styles. In screens, style={type.body} gives the current color and text size.
const scaledType = themed(baseType);
export const type = new Proxy({} as ReturnType<typeof baseType>, {
  get(_, key) {
    const k = key as keyof ReturnType<typeof baseType>;
    return building ? baseType()[k] : scaledType[k];
  },
});
