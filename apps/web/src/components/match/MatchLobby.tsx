'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { AVATAR_COLORS, avatarInitials } from '@/lib/solo/avatars';
import { useI18n } from '@/i18n';

export interface LobbySeat {
  id: string;
  name: string;
  seatIndex: number;
  avatarId?: string;
  subtitle?: string;
  isHost?: boolean;
  connected?: boolean;
  isSelf?: boolean;
}

interface MatchLobbyProps {
  modeLabel: 'Solo' | 'Multiplayer';
  roomCode?: string | null;
  seats: LobbySeat[];
  minPlayers: number;
  maxPlayers: number;
  canStart: boolean;
  startLabel?: string;
  onStart: () => void;
  waitingMessage?: string | null;
  error?: string | null;
  setupSlot?: ReactNode;
  footerSlot?: ReactNode;
}

export function MatchLobby({
  modeLabel,
  roomCode,
  seats,
  minPlayers,
  maxPlayers,
  canStart,
  startLabel,
  onStart,
  waitingMessage,
  error,
  setupSlot,
  footerSlot,
}: MatchLobbyProps) {
  const { t } = useI18n();
  const n = Math.max(seats.length, 1);
  const modeText = modeLabel === 'Solo' ? t.lobby.solo : t.lobby.multiplayer;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.18em] text-[var(--fog-dim)] uppercase">{modeText}</p>
          <h1 className="text-4xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>
            {t.lobby.title}
          </h1>
          {roomCode && (
            <p className="mt-2 text-2xl tracking-[0.2em] text-[var(--ember-hot)]">{roomCode}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/library"
            className="border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--fog)]"
          >
            {t.nav.library}
          </Link>
          <Link
            href="/settings"
            className="border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--fog)]"
          >
            {t.nav.settings}
          </Link>
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>

      <section className="lobby-table-preview" aria-label={t.lobby.seatingPreview}>
        <div className="lobby-table-felt" aria-hidden />
        {seats.map((s, i) => {
          const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
          const x = 50 + Math.cos(angle) * 38;
          const y = 50 + Math.sin(angle) * 38;
          const color = AVATAR_COLORS[s.avatarId ?? 'avatar-1'] ?? '#5c7368';
          return (
            <div
              key={s.id}
              className="lobby-seat-preview"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <div className="circular-seat-avatar" style={{ background: color }}>
                {avatarInitials(s.name)}
              </div>
              <p className="circular-seat-name">
                {s.name}
                {s.isSelf ? ` (${t.lobby.you})` : ''}
              </p>
              <p className="circular-seat-status">
                {s.isHost ? `${t.lobby.host} · ` : ''}
                {s.connected === false
                  ? '…'
                  : (s.subtitle ?? `${t.lobby.seats} ${s.seatIndex + 1}`)}
              </p>
            </div>
          );
        })}
      </section>

      <p className="text-sm text-[var(--fog)]">
        {seats.length}/{maxPlayers} · ≥ {minPlayers}
      </p>

      {setupSlot}

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      {canStart ? (
        <button
          type="button"
          className="bg-[var(--ember)] px-6 py-4 font-semibold text-[#1a0f0a] disabled:opacity-40"
          onClick={onStart}
          disabled={seats.length < minPlayers}
        >
          {startLabel ?? t.lobby.start}
        </button>
      ) : (
        waitingMessage && <p className="text-[var(--fog-dim)]">{waitingMessage}</p>
      )}

      {footerSlot}
    </div>
  );
}
