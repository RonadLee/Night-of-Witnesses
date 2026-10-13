'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { RoleId } from '@now/game-types';
import { pickLocaleText, ROLE_LIBRARY, useI18n } from '@/i18n';
import { RoleCardArt } from '@/components/game/RoleCardArt';
import { AppNav } from '@/components/AppNav';

interface Props {
  roleId: string;
}

export function RoleDetailClient({ roleId }: Props) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [touchX, setTouchX] = useState<number | null>(null);

  const index = ROLE_LIBRARY.findIndex((r) => r.id === roleId);
  const role = index >= 0 ? ROLE_LIBRARY[index] : null;
  const prev = index > 0 ? ROLE_LIBRARY[index - 1] : ROLE_LIBRARY[ROLE_LIBRARY.length - 1];
  const next = index >= 0 && index < ROLE_LIBRARY.length - 1 ? ROLE_LIBRARY[index + 1] : ROLE_LIBRARY[0];

  const related = useMemo(() => {
    if (!role) return [];
    return ROLE_LIBRARY.filter((r) => r.id !== role.id).slice(0, 3);
  }, [role]);

  if (!role) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <p>{t.errors.notFound}</p>
        <Link href="/library" className="mt-4 inline-block text-[var(--ember-hot)]">
          {t.library.backLibrary}
        </Link>
      </main>
    );
  }

  function go(id: RoleId) {
    router.push(`/library/roles/${id}`);
  }

  return (
    <main
      className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8"
      onTouchStart={(e) => setTouchX(e.changedTouches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        if (touchX == null || !prev || !next) return;
        const x = e.changedTouches[0]?.clientX ?? touchX;
        const dx = x - touchX;
        if (dx > 60) go(prev.id);
        else if (dx < -60) go(next.id);
        setTouchX(null);
      }}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/library" className="text-sm text-[var(--fog)] hover:text-[var(--ember-hot)]">
          {t.library.backLibrary}
        </Link>
        <AppNav compact />
      </div>

      <article className="animate-rise border border-[var(--line)] bg-[var(--panel)] p-5">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <RoleCardArt role={role.id} size="lg" />
          <div className="flex-1">
            <h1 className="text-3xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>
              {pickLocaleText(role.name, locale)}
            </h1>
            <p className="mt-1 text-[var(--fog)]">
              {locale === 'en' ? role.name['zh-TW'] : role.name.en}
            </p>
            <p className="mt-3 text-sm text-[var(--fog-dim)]">{pickLocaleText(role.roleType, locale)}</p>
          </div>
        </div>

        <DetailBlock title={t.library.ability} body={pickLocaleText(role.ability, locale)} />
        <DetailBlock title={t.library.winCondition} body={pickLocaleText(role.win, locale)} />
        <DetailBlock title={t.library.triggers} body={pickLocaleText(role.triggers, locale)} />
        <DetailBlock title={t.library.specialRules} body={pickLocaleText(role.special, locale)} />
        <DetailBlock title={t.library.strategy} body={pickLocaleText(role.strategy, locale)} />

        <div className="mt-6">
          <h2 className="text-xs tracking-[0.14em] text-[var(--fog-dim)] uppercase">
            {t.library.examples}
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--fog)]">
            {(locale === 'zh-TW' ? role.examples['zh-TW'] : role.examples.en).map((ex) => (
              <li key={ex}>{ex}</li>
            ))}
          </ul>
        </div>
      </article>

      <div className="mt-6 flex justify-between gap-3">
        <button
          type="button"
          className="border border-[var(--line)] px-4 py-2 text-sm"
          onClick={() => go(prev!.id)}
        >
          ← {t.library.prev}: {pickLocaleText(prev!.name, locale)}
        </button>
        <button
          type="button"
          className="border border-[var(--line)] px-4 py-2 text-sm"
          onClick={() => go(next!.id)}
        >
          {t.library.next}: {pickLocaleText(next!.name, locale)} →
        </button>
      </div>

      <section className="mt-10 mb-16">
        <h2 className="text-xs tracking-[0.14em] text-[var(--fog-dim)] uppercase">
          {t.library.related}
        </h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {related.map((r) => (
            <Link key={r.id} href={`/library/roles/${r.id}`} className="hover:opacity-90">
              <RoleCardArt role={r.id} size="sm" preview={false} />
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function DetailBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-5 border-t border-[var(--line)] pt-4">
      <h2 className="text-xs tracking-[0.14em] text-[var(--fog-dim)] uppercase">{title}</h2>
      <p className="mt-2 text-[var(--fog)]">{body}</p>
    </div>
  );
}
