import { useColorScheme } from 'react-native';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceSecondary: string;
  border: string;
  borderLight: string;
  primary: string;
  primaryHover: string;
  accent: string;
  accentLight: string;
  emerald: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  danger: string;
  dangerLight: string;
  like: string;
  isDark: boolean;
}

export const lightTheme: ThemeColors = {
  background: '#f7f6fb',
  surface: '#ffffff',
  surfaceSecondary: '#f3eff9',
  border: '#e7e3ef',
  borderLight: '#d8d0e8',
  primary: '#6d28d9',
  primaryHover: '#5b21b6',
  accent: '#f43f5e',
  accentLight: '#fb7185',
  emerald: '#10b981',
  textPrimary: '#1e1b2e',
  textSecondary: '#5f5872',
  textMuted: '#7c748d',
  danger: '#ef4444',
  dangerLight: '#f87171',
  like: '#f43f5e',
  isDark: false,
};

export const darkTheme: ThemeColors = {
  background: '#0d0b14',
  surface: '#15111f',
  surfaceSecondary: '#21192f',
  border: '#2b2139',
  borderLight: '#403351',
  primary: '#7c3aed',
  primaryHover: '#6d28d9',
  accent: '#fb7185',
  accentLight: '#fda4af',
  emerald: '#10b981',
  textPrimary: '#faf7ff',
  textSecondary: '#b8afc8',
  textMuted: '#8f879f',
  danger: '#ef4444',
  dangerLight: '#f87171',
  like: '#fb7185',
  isDark: true,
};

export const useAppTheme = (): { theme: ThemeColors; isDark: boolean } => {
  const systemColorScheme = useColorScheme();
  const isDark = systemColorScheme === 'dark';
  return {
    theme: isDark ? darkTheme : lightTheme,
    isDark,
  };
};

export const getThemeByScheme = (scheme: 'light' | 'dark' | null | undefined): ThemeColors => {
  return scheme === 'dark' ? darkTheme : lightTheme;
};

// Default export for backward compatibility
export const theme = darkTheme;
