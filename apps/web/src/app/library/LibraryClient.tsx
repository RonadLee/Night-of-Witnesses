'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FAQ,
  FLOW_PHASES,
  INTRO,
  pickLocaleText,
  ROLE_LIBRARY,
  RULES,
  searchLibrary,
  useI18n,
} from '@/i18n';
import { AppNav } from '@/components/AppNav';
import { RoleCardArt } from '@/components/game/RoleCardArt';
import type { RoleId } from '@now/game-types';

type Category = 'all' | 'intro' | 'rules' | 'flow' | 'roles' | 'abilities' | 'win' | 'faq';
type ViewMode = 'grid' | 'list';

export function LibraryClient() {
  const { locale, t } = useI18n();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const [view, setView] = useState<ViewMode>('grid');

  const results = useMemo(() => searchLibrary(query, locale), [query, locale]);

  const categories: Array<{ id: Category; label: string }> = [
    { id: 'all', label: t.library.categories.all },
    { id: 'intro', label: t.library.categories.intro },
    { id: 'rules', label: t.library.categories.rules },
    { id: 'flow', label: t.library.categories.flow },
    { id: 'roles', label: t.library.categories.roles },
    { id: 'abilities', label: t.library.categories.abilities },
    { id: 'win', label: t.library.categories.win },
    { id: 'faq', label: t.library.categories.faq },
  ];

  const show = (c: Category) => category === 'all' || category === c;
  const roles = query.trim() ? results.roles : ROLE_LIBRARY;
  const faq = query.trim() ? results.faq : FAQ;
  const searching = query.trim().length > 0;
  const hasAny =
    (show('intro') && (!searching || results.intro)) ||
    (show('rules') && (searching ? results.rules.length > 0 : true)) ||
    (show('flow') && !searching) ||
    ((show('roles') || show('abilities') || show('win')) && roles.length > 0) ||
    (show('faq') && faq.length > 0);

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 md:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="text-sm text-[var(--fog)] hover:text-[var(--ember-hot)]">
          {t.nav.backHome}
        </Link>
        <AppNav compact />
      </div>

      <header className="border-b border-[var(--line)] pb-4">
        <h1 className="text-4xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>
          {t.library.title}
        </h1>
        <p className="mt-2 max-w-2xl text-[var(--fog)]">{t.library.subtitle}</p>
      </header>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className="field flex-1"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.library.searchPlaceholder}
          aria-label={t.library.searchPlaceholder}
          autoComplete="off"
        />
        <div className="flex gap-2">
          <button
            type="button"
            className={`border px-3 py-2 text-sm ${view === 'grid' ? 'border-[var(--ember)]' : 'border-[var(--line)]'}`}
            onClick={() => setView('grid')}
          >
            {t.library.grid}
          </button>
          <button
            type="button"
            className={`border px-3 py-2 text-sm ${view === 'list' ? 'border-[var(--ember)]' : 'border-[var(--line)]'}`}
            onClick={() => setView('list')}
          >
            {t.library.list}
          </button>
        </div>
      </div>

      {searching && (
        <p className="mt-3 text-sm text-[var(--fog-dim)]" role="status" aria-live="polite">
          {t.library.searchHits
            .replace('{roles}', String(results.roles.length))
            .replace('{rules}', String(results.rules.length))
            .replace('{faq}', String(results.faq.length))}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`border px-3 py-1.5 text-xs tracking-wide ${
              category === c.id
                ? 'border-[var(--ember)] text-[var(--ember-hot)]'
                : 'border-[var(--line)] text-[var(--fog)]'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {!hasAny && (
        <p className="mt-10 text-center text-[var(--fog-dim)]">{t.library.noResults}</p>
      )}

      {show('intro') && (!searching || results.intro) && (
        <section className="mt-10 animate-rise">
          <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            {t.library.categories.intro}
          </h2>
          <p className="mt-3 max-w-3xl leading-relaxed text-[var(--fog)]">
            {searching ? results.intro || INTRO[locale] : INTRO[locale]}
          </p>
        </section>
      )}

      {show('rules') && (searching ? results.rules.length > 0 : true) && (
        <section className="mt-10">
          <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            {t.library.categories.rules}
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--fog)]">
            {(searching ? results.rules : RULES[locale]).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {show('flow') && !searching && (
        <section className="mt-10">
          <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            {t.library.categories.flow}
          </h2>
          <ol className="mt-4 space-y-0">
            {FLOW_PHASES.map((phase, i) => (
              <li key={phase.id} className="relative border border-[var(--line)] bg-[var(--panel)] p-4">
                {i < FLOW_PHASES.length - 1 && (
                  <div className="absolute -bottom-3 left-1/2 z-10 -translate-x-1/2 text-[var(--ember-hot)]">
                    ↓
                  </div>
                )}
                <h3 className="font-semibold text-[var(--paper)]">{pickLocaleText(phase.name, locale)}</h3>
                <dl className="mt-2 grid gap-2 text-sm text-[var(--fog)] sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase text-[var(--fog-dim)]">{t.library.purpose}</dt>
                    <dd>{pickLocaleText(phase.purpose, locale)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-[var(--fog-dim)]">{t.library.duration}</dt>
                    <dd>{pickLocaleText(phase.duration, locale)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-[var(--fog-dim)]">{t.library.actions}</dt>
                    <dd>{pickLocaleText(phase.actions, locale)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-[var(--fog-dim)]">{t.library.restrictions}</dt>
                    <dd>{pickLocaleText(phase.restrictions, locale)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
        </section>
      )}

      {(show('roles') || show('abilities') || show('win')) && roles.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            {t.library.categories.roles}
          </h2>
          <div
            className={
              view === 'grid'
                ? 'mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4'
                : 'mt-4 flex flex-col gap-3'
            }
          >
            {roles.map((role) => (
              <Link
                key={role.id}
                href={`/library/roles/${role.id}`}
                className={`group border border-[var(--line)] bg-[var(--panel)] p-3 transition hover:border-[var(--ember)] ${
                  view === 'list' ? 'flex items-center gap-4' : 'flex flex-col items-center text-center'
                }`}
              >
                <RoleCardArt
                  role={role.id as RoleId}
                  size={view === 'grid' ? 'md' : 'sm'}
                  preview={false}
                  decorative
                  showLabel={false}
                />
                <div className={view === 'list' ? 'min-w-0 flex-1 text-left' : 'mt-2'}>
                  <p className="font-semibold">
                    {pickLocaleText(role.name, locale)}
                    <span className="ml-1 text-xs text-[var(--fog-dim)]">
                      ({locale === 'en' ? role.name['zh-TW'] : role.name.en})
                    </span>
                  </p>
                  {(show('abilities') || category === 'all' || category === 'roles') && (
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--fog)]">
                      {pickLocaleText(role.ability, locale)}
                    </p>
                  )}
                  {(show('win') || category === 'win' || searching) && (
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--ember-hot)]">
                      <span className="text-[var(--fog-dim)]">{t.library.winCondition}: </span>
                      {pickLocaleText(role.win, locale)}
                    </p>
                  )}
                  <span className="mt-2 inline-block text-xs text-[var(--fog-dim)] group-hover:text-[var(--ember-hot)]">
                    {t.library.openDetails} →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {show('faq') && faq.length > 0 && (
        <section className="mt-10 mb-16">
          <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            {t.library.categories.faq}
          </h2>
          <ul className="mt-4 space-y-3">
            {faq.map((item) => (
              <li key={item.id} className="border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
                <p className="font-semibold">{pickLocaleText(item.q, locale)}</p>
                <p className="mt-1 text-sm text-[var(--fog)]">{pickLocaleText(item.a, locale)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
