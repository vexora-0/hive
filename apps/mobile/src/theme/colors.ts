/**
 * Hive Color Palette
 *
 * A warm, playful palette designed for a preschool photo-sharing app.
 * Primary colors are bright and inviting; backgrounds are soft and easy on the eyes.
 */

export const colors = {
  // ── Primary ────────────────────────────────────────────────────────
  primary: {
    amber: '#F5A623',
    amberLight: '#FECE72',
    amberDark: '#D48B0F',
    blue: '#78C8F0',
    blueLight: '#A8DDF7',
    blueDark: '#4AADDF',
    mint: '#7DD9B0',
    mintLight: '#A8E8CC',
    mintDark: '#53C48E',
    lavender: '#C3A6F5',
    lavenderLight: '#DBC9FA',
    lavenderDark: '#A07CE8',
  },

  // ── Backgrounds ────────────────────────────────────────────────────
  background: {
    cream: '#FFF8EE',
    surface: '#FFFFFF',
    surfaceSecondary: '#F7F3ED',
    navyDark: '#0F1B2D',
    navyMedium: '#1A2A40',
  },

  // ── Grays ──────────────────────────────────────────────────────────
  gray: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#EEEEEE',
    300: '#E0E0E0',
    400: '#BDBDBD',
    500: '#9E9E9E',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
  },

  // ── Text ───────────────────────────────────────────────────────────
  text: {
    primary: '#1A1A2E',
    secondary: '#5A5A6E',
    tertiary: '#9E9E9E',
    inverse: '#FFFFFF',
    link: '#78C8F0',
    accent: '#F5A623',
  },

  // ── Semantic / Status ──────────────────────────────────────────────
  success: {
    main: '#4CAF50',
    light: '#C8E6C9',
    dark: '#2E7D32',
    background: '#E8F5E9',
  },

  warning: {
    main: '#FF9800',
    light: '#FFE0B2',
    dark: '#E65100',
    background: '#FFF3E0',
  },

  error: {
    main: '#EF5350',
    light: '#FFCDD2',
    dark: '#C62828',
    background: '#FFEBEE',
  },

  info: {
    main: '#78C8F0',
    light: '#B3E5FC',
    dark: '#0277BD',
    background: '#E1F5FE',
  },

  // ── Overlays & Borders ─────────────────────────────────────────────
  overlay: {
    light: 'rgba(255, 255, 255, 0.7)',
    medium: 'rgba(0, 0, 0, 0.4)',
    dark: 'rgba(0, 0, 0, 0.6)',
    scrim: 'rgba(15, 27, 45, 0.5)',
  },

  border: {
    light: '#F0EBE3',
    default: '#E0D8CC',
    dark: '#C4B9A8',
  },

  // ── Misc ───────────────────────────────────────────────────────────
  transparent: 'transparent',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export type Colors = typeof colors;
