'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';

export function ThemeToggle() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const stored = localStorage.getItem('now_theme') as 'dark' | 'light' | null;
    const next = stored ?? 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem('now_theme', next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="border border-[var(--line)] px-3 py-1.5 text-xs tracking-wide uppercase"
      aria-label={t.theme.lightMode}
    >
      {theme === 'dark' ? t.theme.lightMode : t.theme.darkMode}
    </button>
  );
}
