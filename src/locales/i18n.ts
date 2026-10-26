import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import { I18nManager } from 'react-native';

import ar from './ar.json';
import en from './en.json';

const LANGUAGE_KEY = 'user_selected_language';

export const resources = {
  ar: { translation: ar },
  en: { translation: en },
} as const;

export type SupportedLanguage = 'ar' | 'en';

export async function getPersistedLanguage(): Promise<SupportedLanguage> {
  try {
    const saved = await SecureStore.getItemAsync(LANGUAGE_KEY);
    if (saved === 'ar' || saved === 'en') {
      return saved;
    }
  } catch {
    // Fall back to default Arabic
  }
  return 'ar';
}

export async function persistLanguage(lang: SupportedLanguage): Promise<void> {
  try {
    await SecureStore.setItemAsync(LANGUAGE_KEY, lang);
  } catch {
    // Ignore storage errors
  }
}

// Initialize synchronously with default Arabic
i18n.use(initReactI18next).init({
  resources,
  lng: 'ar',
  fallbackLng: 'ar',
  interpolation: {
    escapeValue: false,
  },
  compatibilityJSON: 'v4',
});

// Configure RTL default
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

// Restore saved language preference asynchronously
getPersistedLanguage().then((saved) => {
  if (saved && saved !== i18n.language) {
    i18n.changeLanguage(saved);
  }
});

export default i18n;
