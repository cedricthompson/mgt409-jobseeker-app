// Chart Academy brand. See STYLE_GUIDE.md for usage rules.
// Contrast on white: red 5.1:1, blue 6.9:1, ink 18:1 (all pass WCAG AA for normal text).
export const colors = {
  red: '#D71F2D',      // Chart Academy red: wordmark, headings accents, alerts
  blue: '#3A56A6',     // Chart Academy blue: buttons, links, focus
  blueDark: '#2B4080', // pressed states
  ink: '#1A1A1A',      // body text
  muted: '#4A4A4A',    // secondary text (8.9:1)
  line: '#C9CFE0',     // borders and dividers
  tint: '#F2F4FA',     // light blue panels
  white: '#FFFFFF',
};

export const type = {
  title: { fontSize: 30, fontWeight: '700' as const, color: colors.ink },
  heading: { fontSize: 22, fontWeight: '700' as const, color: colors.ink },
  body: { fontSize: 18, lineHeight: 26, color: colors.ink },
  small: { fontSize: 16, lineHeight: 22, color: colors.muted },
};

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 };
export const radius = 10;
export const touch = 48; // minimum tap target in points
