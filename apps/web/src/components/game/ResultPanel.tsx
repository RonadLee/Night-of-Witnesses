'use client';

import type { PlayerMatchView, WinnerSide } from '@now/game-types';
import { roleLabel, roleLabelZh } from '@/lib/roleLabels';

interface Props {
  view: PlayerMatchView;
  onAgain: () => void;
  onLobby: () => void;
}

function winnerTitle(side: WinnerSide): string {
  switch (side) {
    case 'guest_side':
      return 'Guest side wins';
    case 'murderer_side':
      return 'Murderer side wins';
    case 'bomber':
      return 'Bomber wins alone';
    case 'none':
      return 'No winner';
    default:
      return 'Round ended';
  }
}

export function ResultPanel({ view, onAgain, onLobby }: Props) {
  const pub = view.public;
  const roomId = pub.privateRoomPlayerId ?? pub.lockedPlayerId;
  const roomName = roomId ? (pub.players.find((p) => p.id === roomId)?.name ?? roomId) : 'nobody';

  return (
    <section className="animate-rise border border-[var(--ember)] bg-[var(--panel)] px-4 py-5">
      <h3 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
        {winnerTitle(pub.winnerSide)}
      </h3>
      <p className="mt-2 text-[var(--fog)]">
        Private Room (爆鎖室) occupant: <strong>{roomName}</strong>
      </p>

      {pub.winningRoleIds.length > 0 && (
        <p className="mt-2 text-sm text-[var(--fog)]">
          Winning roles:{' '}
          {pub.winningRoleIds.map((r) => `${roleLabel(r)} / ${roleLabelZh(r)}`).join(', ')}
        </p>
      )}

      {pub.revealedRoles && (
        <div className="mt-4">
          <h4 className="text-xs tracking-[0.14em] text-[var(--fog-dim)] uppercase">
            Full role reveal
          </h4>
          <ul className="mt-1 space-y-1 text-sm">
            {pub.players.map((p) => (
              <li key={p.id}>
                {p.name}:{' '}
                <strong>
                  {roleLabel(pub.revealedRoles![p.id]!)} / {roleLabelZh(pub.revealedRoles![p.id]!)}
                </strong>
                {p.isLocked ? ' — Private Room' : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pub.voteTallies && (
        <div className="mt-4">
          <h4 className="text-xs tracking-[0.14em] text-[var(--fog-dim)] uppercase">
            Vote distribution
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
            Ticket calculations
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
            Detective / ability actions
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
            Card passing history
          </h4>
          <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto text-sm text-[var(--fog)]">
            {pub.passHistory.map((h, i) => (
              <li key={i}>
                {pub.players.find((p) => p.id === h.fromPlayerId)?.name} →{' '}
                {h.toPlayerId === 'guest_room'
                  ? 'Guest Room'
                  : pub.players.find((p) => p.id === h.toPlayerId)?.name}{' '}
                ({roleLabel(h.role)})
              </li>
            ))}
          </ul>
        </div>
      )}

      {pub.aiReasoning.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs tracking-[0.14em] text-[var(--fog-dim)] uppercase">
            AI reasoning summary
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
          Play again
        </button>
        <button type="button" className="border border-[var(--fog)] px-4 py-3" onClick={onLobby}>
          Back to lobby
        </button>
      </div>
    </section>
  );
}
