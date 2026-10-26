/**
 * Brand name constant: Single unbroken phrase with Unicode bidi isolates
 * Used inside the app in one single Text node without wrapping or splitting.
 */
export const STORE_NAME = '\u2068ميزو ستور - Mezo Store\u2069';

export interface ThemeColors {
  bg: string;
  surface: string;
  shadowDark: string;
  shadowLight: string;
  text: string;
  textMuted: string;
  accent: string;
  onAccent: string;
  danger: string;
  success: string;
  goldGradient: readonly [string, string];
  logoutGradient: readonly [string, string];
  logoutText: string;
  bar: string;
  cardBg: string;
  inputBg: string;
  border: string;
}

export const LightColors: ThemeColors = {
  bg: '#E4E6EA',
  surface: '#E9EBEF',
  shadowDark: '#BEC2C9',
  shadowLight: '#FFFFFF',
  text: '#2A2D33',
  textMuted: '#7A7F88',
  accent: '#A9833F', // Gold
  onAccent: '#FFFFFF',
  danger: '#B5533F',
  success: '#4F8A62',
  goldGradient: ['#D4B87A', '#B8975A'],
  logoutGradient: ['#B01E1E', '#7A0A0A'],
  logoutText: '#FFFFFF',
  bar: '#E9EBEF',
  cardBg: '#E9EBEF',
  inputBg: '#E4E6EA',
  border: 'rgba(0, 0, 0, 0.05)',
};

export const DarkColors: ThemeColors = {
  bg: '#1E2024',
  surface: '#25282D',
  shadowDark: '#14161A',
  shadowLight: '#2F333A',
  text: '#E8E9EB',
  textMuted: '#8B8F96',
  accent: '#C9A96A', // Gold
  onAccent: '#1E2024',
  danger: '#D17B6A',
  success: '#8FB59A',
  goldGradient: ['#D4B87A', '#B8975A'],
  logoutGradient: ['#B01E1E', '#7A0A0A'],
  logoutText: '#FFFFFF',
  bar: '#25282D',
  cardBg: '#25282D',
  inputBg: '#1E2024',
  border: 'rgba(255, 255, 255, 0.05)',
};

export const Typography = {
  fontFamily: {
    regular: 'Tajawal-Regular',
    medium: 'Tajawal-Medium',
    bold: 'Tajawal-Bold',
    latinRegular: 'Inter',
    latinMedium: 'Inter',
    latinBold: 'Inter',
  },
  heroNumber: 38,
  cardTitle: 15,
  body: 15,
  caption: 13,
  small: 11,
};
