import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import ja from './locales/ja.json';
import zh from './locales/zh.json';

// Detect user's preferred language
const detectUserLocale = (): string => {
  // Check localStorage first
  const storedLocale = localStorage.getItem('i18nextLng');
  if (storedLocale) {
    return storedLocale;
  }

  // Check browser language
  const browserLang = navigator.language;
  const langCode = browserLang.split('-')[0];

  // Map browser language to supported languages
  const supportedLanguages = ['en', 'es', 'fr', 'de', 'ja', 'zh'];
  if (supportedLanguages.includes(langCode)) {
    return langCode;
  }

  // Default to English
  return 'en';
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
      de: { translation: de },
      ja: { translation: ja },
      zh: { translation: zh },
    },
    lng: detectUserLocale(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
