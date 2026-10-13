'use client';

import { useEffect, useId, useState } from 'react';
import type { RoleId } from '@now/game-types';
import { roleImage, roleLabel, roleLabelZh } from '@/lib/roleLabels';
import { useI18n } from '@/i18n';

type Size = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_CLASS: Record<Size, string> = {
  xs: 'w-10',
  sm: 'w-16',
  md: 'w-24',
  lg: 'w-36',
};

interface RoleCardArtProps {
  role: RoleId;
  size?: Size;
  showLabel?: boolean;
  /** Enable hover (desktop) / tap (mobile) full preview */
  preview?: boolean;
  /** Accessible label suffix for hand pass tiles */
  passLabel?: boolean;
  /** Render as a non-interactive figure (safe inside Links) */
  decorative?: boolean;
  className?: string;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onClick?: () => void;
  selected?: boolean;
  loading?: 'eager' | 'lazy';
}

export function RoleCardArt({
  role,
  size = 'sm',
  showLabel = true,
  preview = true,
  passLabel = false,
  decorative = false,
  className = '',
  draggable,
  onDragStart,
  onDragEnd,
  onClick,
  selected,
  loading = 'lazy',
}: RoleCardArtProps) {
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const src = roleImage(role);
  const label = roleLabel(role, locale);
  const otherLabel = locale === 'en' ? roleLabelZh(role) : roleLabel(role, 'en');
  const passText = t.game.passThisCard;
  const interactive = !decorative && (preview || Boolean(onClick) || passLabel || draggable);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const shellClass = `role-card-art group relative text-left ${SIZE_CLASS[size]} ${
    selected ? 'ring-2 ring-[var(--ember-hot)]' : ''
  } ${className}`;
  const aria = passLabel ? `${passText}: ${label}` : `${label} / ${otherLabel}`;

  const body = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={decorative ? '' : label}
        loading={loading}
        decoding="async"
        className="role-card-art-img w-full rounded-sm border border-[var(--line)] object-cover shadow-md transition group-hover:brightness-110"
        draggable={false}
      />
      {showLabel && (
        <span className="mt-1 block text-center text-[0.7rem] font-semibold leading-tight text-[var(--paper)]">
          {label}
        </span>
      )}
      {passLabel && (
        <span className="mt-0.5 block text-center text-[0.65rem] text-[var(--fog-dim)]">
          {passText}
        </span>
      )}
      {preview && interactive && (
        <span className="pointer-events-none absolute left-1/2 top-0 z-20 hidden w-40 -translate-x-1/2 -translate-y-[105%] rounded border border-[var(--line)] bg-[var(--bg-mist)] p-1 shadow-xl md:group-hover:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="w-full rounded-sm object-cover" />
          <span className="mt-1 block text-center text-xs">
            {label} · {otherLabel}
          </span>
        </span>
      )}
    </>
  );

  return (
    <>
      {interactive ? (
        <button
          type="button"
          draggable={draggable}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onClick={() => {
            onClick?.();
            if (preview) setOpen(true);
          }}
          className={shellClass}
          aria-label={aria}
        >
          {body}
        </button>
      ) : (
        <div className={shellClass} aria-hidden={decorative || undefined}>
          {body}
        </div>
      )}

      {open && preview && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={() => setOpen(false)}
        >
          <div
            className="max-w-sm animate-rise border border-[var(--line)] bg-[var(--bg-mist)] p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p id={titleId} className="mb-2 text-center text-sm text-[var(--fog)]">
              {label} · {otherLabel}
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={label} className="mx-auto max-h-[70vh] w-auto rounded object-contain" />
            <button
              type="button"
              className="mt-3 w-full border border-[var(--line)] px-3 py-2 text-sm"
              onClick={() => setOpen(false)}
            >
              {t.game.close}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
