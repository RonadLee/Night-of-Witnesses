'use client';

import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  }, []);

  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('now-theme', next);
    setTheme(next);
  }

  return (
    <button type="button" className="border border-[var(--line)] px-3 py-2 text-sm" onClick={toggle} aria-pressed={theme === 'light'}>
      {theme === 'light' ? 'Dark mode' : 'Light mode'}
    </button>
  );
}
