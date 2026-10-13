'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function HomePage() {
  const { t } = useI18n();
  const brandLines = t.brandLine.split('\n');

  return (
    <main className="relative min-h-screen overflow-hidden px-6 py-8 md:px-12">
      <div
        aria-hidden
        className="ember-glow pointer-events-none absolute -left-24 top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(196,92,38,0.35),transparent_70%)]"
      />
      <div
        aria-hidden
        className="steam pointer-events-none absolute bottom-24 right-16 h-24 w-40 rounded-full bg-[radial-gradient(ellipse,rgba(232,239,233,0.2),transparent_70%)]"
      />

      <header className="animate-rise mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] pb-6">
        <p className="text-sm tracking-[0.2em] text-[var(--fog)] uppercase">{t.socialDeduction}</p>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-[var(--fog-dim)]">{t.playersRange}</p>
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <section className="mx-auto flex min-h-[70vh] max-w-5xl flex-col justify-center gap-8 py-16">
        <h1
          className="animate-rise text-5xl leading-[0.95] font-extrabold tracking-tight text-[var(--paper)] md:text-7xl lg:text-8xl"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {brandLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h1>
        <p
          className="animate-rise-delay max-w-xl text-lg text-[var(--fog)] md:text-xl"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {t.tagline}
        </p>
        <div className="animate-rise-delay flex flex-col gap-3 sm:max-w-md">
          <Link
            href="/solo"
            className="inline-flex items-center justify-center bg-[var(--ember)] px-8 py-4 text-base font-semibold text-[#1a0f0a] transition hover:bg-[var(--ember-hot)]"
          >
            {t.nav.solo}
          </Link>
          <Link
            href="/multiplayer"
            className="inline-flex items-center justify-center border border-[var(--fog)] px-8 py-4 text-base font-semibold text-[var(--paper)] transition hover:border-[var(--ember)] hover:text-[var(--ember-hot)]"
          >
            {t.nav.multiplayer}
          </Link>
          <Link
            href="/library"
            className="inline-flex items-center justify-center border border-[var(--line)] px-8 py-4 text-base font-semibold text-[var(--paper)] transition hover:border-[var(--ember)]"
          >
            {t.nav.library}
          </Link>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/settings"
              className="inline-flex flex-1 items-center justify-center border border-[var(--line)] px-6 py-3 text-sm text-[var(--fog)]"
            >
              {t.nav.settings}
            </Link>
            <div className="flex flex-1 items-center justify-center border border-[var(--line)] px-4 py-2">
              <LanguageSwitcher showTitle />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
