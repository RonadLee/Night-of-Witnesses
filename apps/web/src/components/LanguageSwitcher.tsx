'use client';

import { LOCALE_LABELS, LOCALES, useI18n, type Locale } from '@/i18n';

interface Props {
  variant?: 'inline' | 'stack';
  showTitle?: boolean;
}

export function LanguageSwitcher({ variant = 'inline', showTitle = false }: Props) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className={`relative z-20 ${
        variant === 'stack' ? 'flex flex-col gap-2' : 'flex flex-wrap items-center gap-2'
      }`}
    >
      {showTitle && (
        <p className="text-xs tracking-[0.14em] text-[var(--fog-dim)] uppercase">{t.language.title}</p>
      )}
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.language.title}>
        {LOCALES.map((code) => {
          const selected = locale === code;
          return (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={selected}
              data-locale={code}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setLocale(code as Locale);
              }}
              className={`relative z-20 cursor-pointer border px-3 py-1.5 text-sm transition ${
                selected
                  ? 'border-[var(--ember)] bg-[var(--ember)] text-[#1a0f0a]'
                  : 'border-[var(--line)] text-[var(--fog)] hover:border-[var(--ember)]'
              }`}
            >
              {code === 'en' ? t.language.english : t.language.zhTW}
              <span className="sr-only"> ({LOCALE_LABELS[code]})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
