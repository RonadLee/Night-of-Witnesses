'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { isLocale, LOCALE_STORAGE_KEY, type Locale } from './locales';
import { getMessages, type MessageTree } from './messages';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: MessageTree;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    const next = isLocale(stored) ? stored : 'en';
    setLocaleState(next);
    document.documentElement.lang = next === 'zh-TW' ? 'zh-Hant' : 'en';
    setReady(true);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
    document.documentElement.lang = next === 'zh-TW' ? 'zh-Hant' : 'en';
  }, []);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: getMessages(locale),
    }),
    [locale, setLocale],
  );

  // Avoid flash of wrong language after hydrate
  if (!ready) {
    return (
      <I18nContext.Provider value={{ locale: 'en', setLocale, t: getMessages('en') }}>
        {children}
      </I18nContext.Provider>
    );
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export function useT(): MessageTree {
  return useI18n().t;
}
