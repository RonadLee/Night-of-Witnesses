'use client';

import type { PublicPlayerView } from '@now/game-types';
import { AVATAR_COLORS, avatarInitials } from '@/lib/solo/avatars';

interface Props {
  player: PublicPlayerView;
  isSelf: boolean;
  isCurrent: boolean;
}

export function PlayerSeatCard({ player, isSelf, isCurrent }: Props) {
  const color = AVATAR_COLORS[player.avatarId] ?? '#5c7368';
  return (
    <article
      className={`seat-card border bg-[var(--panel)] px-3 py-3 transition ${
        isCurrent ? 'border-[var(--ember)] shadow-[0_0_0_1px_var(--ember)]' : 'border-[var(--line)]'
      }`}
      aria-current={isCurrent ? 'true' : undefined}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center text-sm font-bold text-[#0b1210]"
          style={{ background: color }}
          aria-hidden
        >
          {avatarInitials(player.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {player.name}
            {isSelf ? ' (you)' : ''}
          </p>
          <p className="truncate text-xs text-[var(--fog-dim)]">
            Seat {player.seatIndex + 1}
            {player.personality ? ` · ${player.personality}` : ''}
            {player.difficulty ? ` · ${player.difficulty}` : ''}
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] tracking-wide uppercase">
        <span className="border border-[var(--line)] px-2 py-0.5 text-[var(--fog)]">
          {player.status}
        </span>
        {player.hasVoted && (
          <span className="border border-[var(--ember)] px-2 py-0.5 text-[var(--ember-hot)]">
            Voted
          </span>
        )}
        {player.isSilenced && (
          <span className="border border-[var(--danger)] px-2 py-0.5 text-[var(--danger)]">
            Silenced
          </span>
        )}
        {player.isLocked && (
          <span className="bg-[var(--danger)] px-2 py-0.5 text-[#fff8f5]">Locked</span>
        )}
      </div>
      {player.currentAction && (
        <p className="mt-2 animate-pulse text-xs text-[var(--ember-hot)]">{player.currentAction}</p>
      )}
    </article>
  );
}
