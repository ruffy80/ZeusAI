
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import translationEN from './locales/en/translation.json';
import translationRO from './locales/ro/translation.json';
import translationES from './locales/es/translation.json';
import translationFR from './locales/fr/translation.json';
import translationDE from './locales/de/translation.json';
import translationZH from './locales/zh/translation.json';
import translationJA from './locales/ja/translation.json';

const resources = {
  en: { translation: translationEN },
  ro: { translation: translationRO },
  es: { translation: translationES },
  fr: { translation: translationFR },
  de: { translation: translationDE },
  zh: { translation: translationZH },
  ja: { translation: translationJA },
};

i18n.use(LanguageDetector).use(initReactI18next).init({
  resources, fallbackLng: 'en', interpolation: { escapeValue: false },
  detection: { order: ['localStorage', 'navigator', 'cookie'], caches: ['localStorage'] },
});
export default i18n;
