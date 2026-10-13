export type Locale = 'en' | 'zh-TW';

export const LOCALES: Locale[] = ['en', 'zh-TW'];

export const LOCALE_STORAGE_KEY = 'now_locale';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  'zh-TW': '繁體中文',
};

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'zh-TW';
}
