import { useTranslation } from 'react-i18next';
import {
  SUPPORTED_LANGUAGES,
  LANG_AUTO,
  setLanguagePreference,
  getLanguagePreference,
} from '../i18n';

export default function LanguageSetting() {
  const { t } = useTranslation();
  // Read the preference directly each render so external changes stay in sync.
  const pref = getLanguagePreference();

  const onChange = (value: string) => {
    // Persists the choice AND calls i18n.changeLanguage internally,
    // which re-renders this component via the useTranslation subscription.
    setLanguagePreference(value as typeof pref);
  };

  return (
    <div className="space-y-2">
      <label htmlFor="language-select" className="block text-sm font-medium text-slate-200">
        {t('settings.language', 'Language')}
      </label>
      <select
        id="language-select"
        value={pref}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100"
      >
        <option value={LANG_AUTO}>
          {t('settings.languageAuto', 'Auto (device language)')}
        </option>
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
      <p className="text-xs text-slate-400">
        {t(
          'settings.languageHint',
          'Auto follows your device language and falls back to English if unsupported.'
        )}
      </p>
    </div>
  );
}
