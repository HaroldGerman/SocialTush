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
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceSecondary: '#f1f5f9',
  border: '#e2e8f0',
  borderLight: '#cbd5e1',
  primary: '#0f766e',
  primaryHover: '#0d9488',
  accent: '#0d9488',
  accentLight: '#14b8a6',
  emerald: '#10b981',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#64748b',
  danger: '#ef4444',
  dangerLight: '#f87171',
  like: '#ef4444',
  isDark: false,
};

export const darkTheme: ThemeColors = {
  background: '#090d16',
  surface: '#0f172a',
  surfaceSecondary: '#1e293b',
  border: '#1e293b',
  borderLight: '#334155',
  primary: '#0f766e',
  primaryHover: '#0d9488',
  accent: '#14b8a6',
  accentLight: '#2dd4bf',
  emerald: '#10b981',
  textPrimary: '#ffffff',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  danger: '#ef4444',
  dangerLight: '#f87171',
  like: '#ef4444',
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
