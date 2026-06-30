import { DocsContent } from './types';

import { docsEn } from './en';
import { docsFr } from './fr';
import { docsEs } from './es';
import { docsDe } from './de';
import { docsPt } from './pt';
import { docsIt } from './it';
import { docsNl } from './nl';
import { docsPl } from './pl';
import { docsCs } from './cs';
import { docsRo } from './ro';
import { docsRu } from './ru';
import { docsSw } from './sw';
import { docsAf } from './af';
import { docsAm } from './am';
import { docsZu } from './zu';
import { docsZhHans } from './zh-Hans';

// Map of locale code → docs content.
const DOCS_BY_LANG: Record<string, DocsContent> = {
  en: docsEn,
  fr: docsFr,
  es: docsEs,
  de: docsDe,
  pt: docsPt,
  it: docsIt,
  nl: docsNl,
  pl: docsPl,
  cs: docsCs,
  ro: docsRo,
  ru: docsRu,
  sw: docsSw,
  af: docsAf,
  am: docsAm,
  zu: docsZu,
  'zh-Hans': docsZhHans,
};

/**
 * Resolve the docs content for an i18next language string.
 * Handles region suffixes (e.g. "pt-BR" → "pt") and Chinese script
 * variants ("zh", "zh-CN", "zh-Hans-*" → Simplified). Falls back to
 * English for any unknown language.
 */
export const getDocsContent = (language: string): DocsContent => {
  if (!language) return docsEn;

  const lang = language.replace('_', '-');
  const lower = lang.toLowerCase();

  // Chinese: any zh / zh-CN / zh-Hans / zh-SG variant → Simplified.
  if (lower.startsWith('zh')) {
    return DOCS_BY_LANG['zh-Hans'];
  }

  // Exact match first (covers region-specific keys).
  if (DOCS_BY_LANG[lang]) return DOCS_BY_LANG[lang];

  // Then base language (part before the first hyphen).
  const base = lower.split('-')[0];
  return DOCS_BY_LANG[base] ?? docsEn;
};
