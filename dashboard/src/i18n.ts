import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

// Single source of truth for the language list. Add/remove here only.
export const SUPPORTED_LANGUAGES = [
  // European
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'es', label: 'Español', dir: 'ltr' },
  { code: 'pt', label: 'Português', dir: 'ltr' },
  { code: 'de', label: 'Deutsch', dir: 'ltr' },
  { code: 'it', label: 'Italiano', dir: 'ltr' },
  { code: 'nl', label: 'Nederlands', dir: 'ltr' },
  { code: 'ru', label: 'Русский', dir: 'ltr' },
  { code: 'pl', label: 'Polski', dir: 'ltr' },
  { code: 'tr', label: 'Türkçe', dir: 'ltr' },
  // African
  { code: 'sw', label: 'Kiswahili', dir: 'ltr' },
  { code: 'ha', label: 'Hausa', dir: 'ltr' },
  { code: 'yo', label: 'Yorùbá', dir: 'ltr' },
  { code: 'am', label: 'አማርኛ', dir: 'ltr' },
  { code: 'om', label: 'Afaan Oromoo', dir: 'ltr' },
  { code: 'ig', label: 'Igbo', dir: 'ltr' },
  { code: 'zu', label: 'isiZulu', dir: 'ltr' },
  { code: 'sn', label: 'chiShona', dir: 'ltr' },
  { code: 'wo', label: 'Wolof', dir: 'ltr' },
  { code: 'ln', label: 'Lingála', dir: 'ltr' },
  // African + international, right-to-left
  { code: 'ar', label: 'العربية', dir: 'rtl' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

// Special value stored in Settings meaning "follow the device language".
export const LANG_AUTO = 'auto';

const supportedCodes = SUPPORTED_LANGUAGES.map((l) => l.code);

// If the user picked a fixed language in Settings, honor it; otherwise
// let the detector follow the system/browser language.
const savedPreference = localStorage.getItem('orion.lang'); // 'auto' | <code> | null

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: supportedCodes,
    nonExplicitSupportedLngs: true, // 'fr-CA' -> 'fr', 'pt-BR' -> 'pt'
    load: 'languageOnly',           // ignore region, match the flat file
    // If a fixed language was chosen, force it. Otherwise leave undefined
    // so the detector decides from the system.
    lng:
      savedPreference && savedPreference !== LANG_AUTO
        ? savedPreference
        : undefined,
    interpolation: { escapeValue: false },
    backend: {
      // Flat files: /public/locales/en.json, fr.json, ...
      loadPath: '/locales/{{lng}}.json',
    },
    detection: {
      // System/browser language first, then the html tag as a last resort.
      // We do NOT cache here because the fixed choice is handled via `lng`
      // above and the helper below; this keeps "auto" truly dynamic.
      order: ['navigator', 'htmlTag'],
      caches: [],
    },
    react: { useSuspense: true },
  });

// Keep <html lang> and dir in sync (required for Arabic RTL).
i18n.on('languageChanged', (lng) => {
  const base = lng.split('-')[0];
  const meta = SUPPORTED_LANGUAGES.find((l) => l.code === base);
  document.documentElement.lang = base;
  document.documentElement.dir = meta?.dir ?? 'ltr';
});

// Helper used by the Settings screen.
// pass LANG_AUTO to follow the device, or a language code to pin it.
export function setLanguagePreference(pref: typeof LANG_AUTO | LanguageCode) {
  localStorage.setItem('orion.lang', pref);
  if (pref === LANG_AUTO) {
    // Re-run detection against the current device language.
    const detected =
      (navigator.languages?.[0] || navigator.language || 'en').split('-')[0];
    const next = supportedCodes.includes(detected as LanguageCode)
      ? detected
      : 'en';
    i18n.changeLanguage(next);
  } else {
    i18n.changeLanguage(pref);
  }
}

// Returns the current preference for rendering the Settings UI.
export function getLanguagePreference(): typeof LANG_AUTO | LanguageCode {
  const saved = localStorage.getItem('orion.lang');
  if (saved === LANG_AUTO || (saved && supportedCodes.includes(saved as LanguageCode))) {
    return saved as typeof LANG_AUTO | LanguageCode;
  }
  return LANG_AUTO; // default behavior is auto-detect
}

export default i18n;
