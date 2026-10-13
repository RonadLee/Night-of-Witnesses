'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { AppNav } from '@/components/AppNav';

export function SettingsClient() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const stored = (localStorage.getItem('now_theme') as 'dark' | 'light' | null) ?? 'dark';
    setTheme(stored);
    document.documentElement.dataset.theme = stored;
  }, []);

  function setThemeValue(next: 'dark' | 'light') {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem('now_theme', next);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="text-sm text-[var(--fog)] hover:text-[var(--ember-hot)]">
          {t.nav.backHome}
        </Link>
        <AppNav compact showLanguage={false} />
      </div>

      <h1 className="text-4xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>
        {t.settings.title}
      </h1>

      <section className="mt-8 border border-[var(--line)] bg-[var(--panel)] p-5">
        <h2 className="text-xs tracking-[0.14em] text-[var(--fog-dim)] uppercase">
          {t.settings.language}
        </h2>
        <p className="mt-2 text-sm text-[var(--fog)]">{t.settings.languageHint}</p>
        <div className="mt-4">
          <LanguageSwitcher variant="stack" />
        </div>
      </section>

      <section className="mt-6 border border-[var(--line)] bg-[var(--panel)] p-5">
        <h2 className="text-xs tracking-[0.14em] text-[var(--fog-dim)] uppercase">
          {t.settings.theme}
        </h2>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className={`border px-4 py-2 text-sm ${
              theme === 'dark' ? 'border-[var(--ember)] bg-[var(--ember)] text-[#1a0f0a]' : 'border-[var(--line)]'
            }`}
            onClick={() => setThemeValue('dark')}
          >
            {t.settings.themeDark}
          </button>
          <button
            type="button"
            className={`border px-4 py-2 text-sm ${
              theme === 'light' ? 'border-[var(--ember)] bg-[var(--ember)] text-[#1a0f0a]' : 'border-[var(--line)]'
            }`}
            onClick={() => setThemeValue('light')}
          >
            {t.settings.themeLight}
          </button>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/library" className="border border-[var(--fog)] px-4 py-3 text-sm">
          {t.nav.library}
        </Link>
        <Link
          href="/solo"
          className="bg-[var(--ember)] px-4 py-3 text-sm font-semibold text-[#1a0f0a]"
        >
          {t.nav.solo}
        </Link>
      </div>
    </main>
  );
}
