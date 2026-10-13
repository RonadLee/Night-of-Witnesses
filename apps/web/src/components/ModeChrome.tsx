'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useI18n } from '@/i18n';

export function ModeChrome({
  children,
  eyebrow,
}: {
  children: ReactNode;
  eyebrow?: string;
}) {
  const { t } = useI18n();
  return (
    <main className="min-h-screen">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 pt-6">
        <Link href="/" className="text-sm text-[var(--fog)] hover:text-[var(--ember-hot)]">
          {t.nav.backHome}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/library" className="text-xs text-[var(--fog-dim)] hover:text-[var(--ember-hot)]">
            {t.nav.library}
          </Link>
          <p className="text-xs tracking-[0.16em] text-[var(--fog-dim)] uppercase">
            {eyebrow ?? t.game.sharedTable}
          </p>
        </div>
      </div>
      {children}
    </main>
  );
}
