'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export function InGameMenu() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        className="border border-[var(--line)] px-3 py-1.5 text-xs tracking-wide uppercase"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {t.nav.inGameMenu}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 border border-[var(--line)] bg-[var(--bg-mist)] p-3 shadow-xl">
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <Link href="/" className="block hover:text-[var(--ember-hot)]" onClick={() => setOpen(false)}>
                {t.nav.home}
              </Link>
            </li>
            <li>
              <Link
                href="/library"
                className="block hover:text-[var(--ember-hot)]"
                onClick={() => setOpen(false)}
              >
                {t.nav.library}
              </Link>
            </li>
            <li>
              <Link
                href="/settings"
                className="block hover:text-[var(--ember-hot)]"
                onClick={() => setOpen(false)}
              >
                {t.nav.settings}
              </Link>
            </li>
          </ul>
          <div className="mt-3 border-t border-[var(--line)] pt-3">
            <LanguageSwitcher variant="stack" showTitle />
          </div>
        </div>
      )}
    </div>
  );
}
