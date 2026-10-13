'use client';

import type { PlayerMatchView, WinnerSide } from '@now/game-types';
import { roleLabel, roleLabelZh } from '@/lib/roleLabels';
import { RoleCardArt } from '@/components/game/RoleCardArt';
import { useI18n } from '@/i18n';

interface Props {
  view: PlayerMatchView;
  onAgain: () => void;
  onLobby: () => void;
}

export function ResultPanel({ view, onAgain, onLobby }: Props) {
  const { t, locale } = useI18n();
  const pub = view.public;
  const roomId = pub.privateRoomPlayerId ?? pub.lockedPlayerId;
  const roomName = roomId ? (pub.players.find((p) => p.id === roomId)?.name ?? roomId) : '—';
  const winnerTitle =
    pub.winnerSide && pub.winnerSide in t.winners
      ? t.winners[pub.winnerSide as keyof typeof t.winners]
      : t.winners.ended;

  return (
    <section className="animate-rise border border-[var(--ember)] bg-[var(--panel)] px-4 py-5">
      <h3 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
        {winnerTitle}
      </h3>
      <p className="mt-2 text-[var(--fog)]">
        {t.game.privateRoom} {t.game.occupant}: <strong>{roomName}</strong>
      </p>

      {pub.winningRoleIds.length > 0 && (
        <p className="mt-2 text-sm text-[var(--fog)]">
          {t.game.winningRoles}:{' '}
          {pub.winningRoleIds.map((r) => `${roleLabel(r, locale)} / ${roleLabelZh(r)}`).join(', ')}
        </p>
      )}

      {pub.revealedRoles && (
        <div className="mt-4">
          <h4 className="text-xs tracking-[0.14em] text-[var(--fog-dim)] uppercase">
            {t.game.fullReveal}
          </h4>
          <ul className="mt-2 flex flex-wrap gap-3">
            {pub.players.map((p) => {
              const role = pub.revealedRoles![p.id];
              if (!role) return null;
              return (
                <li key={p.id} className="flex flex-col items-center gap-1 text-center text-sm">
                  <RoleCardArt role={role} size="sm" />
                  <span>
                    {p.name}
                    {p.isLocked ? ' · Private Room' : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {pub.voteTallies && (
        <div className="mt-4">
          <h4 className="text-xs tracking-[0.14em] text-[var(--fog-dim)] uppercase">
            {t.game.voteDist}
          </h4>
          <ul className="mt-1 space-y-1 text-sm text-[var(--fog)]">
            {Object.entries(pub.voteTallies).map(([id, n]) => (
              <li key={id}>
                {pub.players.find((p) => p.id === id)?.name ?? id}: {n} ticket(s)
              </li>
            ))}
          </ul>
        </div>
      )}

      {pub.ticketBreakdown && pub.ticketBreakdown.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs tracking-[0.14em] text-[var(--fog-dim)] uppercase">
            {t.game.ticketCalc}
          </h4>
          <ul className="mt-1 space-y-1 text-sm text-[var(--fog)]">
            {pub.ticketBreakdown.map((t) => {
              const name = pub.players.find((p) => p.id === t.playerId)?.name ?? t.playerId;
              return (
                <li key={t.playerId}>
                  {name}: base {t.baseTickets}
                  {t.merchantBonus ? ` + Merchant ${t.merchantBonus}` : ''}
                  {t.lawyerPenalty ? ` − Lawyer ${t.lawyerPenalty}` : ''}
                  {' = '}
                  <strong>{t.finalTickets}</strong>
                  {t.butlerWhitened ? ' (Butler: White Guest)' : ''}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {pub.abilityReveals.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs tracking-[0.14em] text-[var(--fog-dim)] uppercase">
            {t.game.abilityActions}
          </h4>
          <ul className="mt-1 space-y-1 text-sm text-[var(--fog)]">
            {pub.abilityReveals.map((r, i) => (
              <li key={i}>{r.summary}</li>
            ))}
          </ul>
        </div>
      )}

      {pub.passHistory.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs tracking-[0.14em] text-[var(--fog-dim)] uppercase">
            {t.game.passHistory}
          </h4>
          <ul className="mt-2 space-y-3">
            {pub.passHistory.map((h, i) => {
              const from = pub.players.find((p) => p.id === h.fromPlayerId)?.name ?? h.fromPlayerId;
              const to =
                h.toPlayerId === 'guest_room'
                  ? 'Guest Room'
                  : (pub.players.find((p) => p.id === h.toPlayerId)?.name ?? h.toPlayerId);
              const bluff = h.actualRole && h.actualRole !== h.claimedRole;
              return (
                <li
                  key={i}
                  className="border border-[var(--line)] bg-[var(--bg-mist)] px-3 py-3 text-sm"
                >
                  <p className="font-semibold">
                    {from} → {to}
                    {bluff ? (
                      <span className="ml-2 text-[var(--ember-hot)]">{t.game.bluff}</span>
                    ) : (
                      <span className="ml-2 text-[var(--fog-dim)]">{t.game.truth}</span>
                    )}
                  </p>
                  <div className="mt-2 flex flex-wrap items-end gap-4">
                    <div>
                      <p className="mb-1 text-xs text-[var(--fog-dim)] uppercase">{t.game.claimed}</p>
                      <RoleCardArt role={h.claimedRole} size="sm" />
                    </div>
                    {h.actualRole && (
                      <div>
                        <p className="mb-1 text-xs text-[var(--fog-dim)] uppercase">
                          {t.game.actuallyPassed}
                        </p>
                        <RoleCardArt role={h.actualRole} size="sm" />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {pub.chat.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs tracking-[0.14em] text-[var(--fog-dim)] uppercase">
            {t.game.discussionTimeline}
          </h4>
          <ul className="mt-1 max-h-28 space-y-1 overflow-y-auto text-sm text-[var(--fog)]">
            {pub.chat.map((c, i) => (
              <li key={i}>
                <strong>{pub.players.find((p) => p.id === c.fromPlayerId)?.name}</strong>: {c.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pub.aiReasoning.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs tracking-[0.14em] text-[var(--fog-dim)] uppercase">
            {t.game.aiReasoning}
          </h4>
          <ul className="mt-1 space-y-1 text-sm text-[var(--fog)]">
            {pub.aiReasoning.map((r) => (
              <li key={r.playerId}>{r.summary}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          className="bg-[var(--ember)] px-4 py-3 font-semibold text-[#1a0f0a]"
          onClick={onAgain}
        >
          {t.game.playAgain}
        </button>
        <button type="button" className="border border-[var(--fog)] px-4 py-3" onClick={onLobby}>
          {t.game.backToLobby}
        </button>
      </div>
    </section>
  );
}
