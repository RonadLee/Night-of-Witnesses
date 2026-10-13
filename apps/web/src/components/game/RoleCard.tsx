'use client';

import type { RoleId } from '@now/game-types';
import { ROLE_IMAGES, ROLE_LABELS, ROLE_LABELS_ZH } from '@/lib/roleLabels';

interface Props {
  role: RoleId;
  compact?: boolean;
}

export function RoleCard({ role, compact }: Props) {
  return (
    <figure
      className={`role-card overflow-hidden border border-[var(--line)] bg-[var(--panel)] ${
        compact ? 'max-w-[140px]' : 'max-w-[220px]'
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ROLE_IMAGES[role]}
        alt={`${ROLE_LABELS[role]} / ${ROLE_LABELS_ZH[role]}`}
        className="h-auto w-full object-cover"
      />
      {!compact && (
        <figcaption className="px-2 py-2 text-center text-xs text-[var(--fog)]">
          {ROLE_LABELS[role]} · {ROLE_LABELS_ZH[role]}
        </figcaption>
      )}
    </figure>
  );
}
