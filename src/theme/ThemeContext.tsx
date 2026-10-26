import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { LightColors, DarkColors, ThemeColors } from '@/constants/theme';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const THEME_STORE_KEY = 'user_selected_theme_mode';

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  colors: LightColors,
  isDark: false,
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Always default to 'light' regardless of system preference
  const [theme, setThemeState] = useState<ThemeMode>('light');

  useEffect(() => {
    async function loadTheme() {
      try {
        const saved = await SecureStore.getItemAsync(THEME_STORE_KEY);
        if (saved === 'dark' || saved === 'light') {
          setThemeState(saved);
        }
      } catch {
        // Fallback remains 'light'
      }
    }
    loadTheme();
  }, []);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    SecureStore.setItemAsync(THEME_STORE_KEY, mode).catch(() => {});
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const colors = useMemo(() => (theme === 'dark' ? DarkColors : LightColors), [theme]);
  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, colors, isDark, toggleTheme, setTheme }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme(): ThemeContextType {
  return useContext(ThemeContext);
}
