'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/i18n';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';

interface AppNavProps {
  compact?: boolean;
  showLanguage?: boolean;
}

export function AppNav({ compact = false, showLanguage = true }: AppNavProps) {
  const { t } = useI18n();
  const pathname = usePathname();

  const links = [
    { href: '/solo', label: t.nav.solo },
    { href: '/multiplayer', label: t.nav.multiplayer },
    { href: '/library', label: t.nav.library },
    { href: '/settings', label: t.nav.settings },
  ];

  return (
    <nav
      className={`flex flex-wrap items-center gap-2 ${compact ? 'justify-end' : 'justify-between'}`}
      aria-label="Primary"
    >
      {!compact && (
        <div className="flex flex-wrap gap-2">
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`border px-3 py-1.5 text-sm transition ${
                  active
                    ? 'border-[var(--ember)] text-[var(--ember-hot)]'
                    : 'border-[var(--line)] text-[var(--fog)] hover:border-[var(--ember)]'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {compact &&
          links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="border border-[var(--line)] px-2 py-1 text-xs text-[var(--fog)]"
            >
              {l.label}
            </Link>
          ))}
        {showLanguage && <LanguageSwitcher />}
        <ThemeToggle />
      </div>
    </nav>
  );
}
