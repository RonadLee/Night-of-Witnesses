'use client';

import { useEffect, useState } from 'react';
import type { RoleId } from '@now/game-types';
import { roleImage, roleLabel } from '@/lib/roleLabels';

interface Props {
  animation: {
    fromPlayerId: string;
    toPlayerId: string | 'guest_room';
    claimedRole: RoleId;
    at: number;
  } | null;
  fromName: string;
  toName: string;
}

/** Brief claimed-card flight between seats (shared Solo + Multiplayer). */
export function PassFlyAnimation({ animation, fromName, toName }: Props) {
  const [visible, setVisible] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (!animation) return;
    setKey(animation.at);
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 1600);
    return () => window.clearTimeout(t);
  }, [animation]);

  if (!animation || !visible) return null;

  return (
    <div
      key={key}
      className="pass-fly pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
      aria-hidden
    >
      <div className="pass-fly-inner flex flex-col items-center gap-1">
        <span className="text-xs tracking-wide text-[var(--fog)] uppercase">{fromName}</span>
        <span className="pass-fly-arrow text-[var(--ember-hot)]">↓</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={roleImage(animation.claimedRole)}
          alt={roleLabel(animation.claimedRole)}
          className="pass-fly-card h-28 w-auto rounded border border-[var(--ember)] shadow-2xl"
        />
        <span className="text-xs font-semibold text-[var(--paper)]">
          {roleLabel(animation.claimedRole)}
        </span>
        <span className="pass-fly-arrow text-[var(--ember-hot)]">↓</span>
        <span className="text-xs tracking-wide text-[var(--fog)] uppercase">{toName}</span>
      </div>
    </div>
  );
}
