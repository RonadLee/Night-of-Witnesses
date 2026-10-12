'use client';

import type { PlayerMatchView } from '@now/game-types';
import { roleLabel } from '@/lib/roleLabels';

interface Props {
  view: PlayerMatchView;
  onAgain: () => void;
  onLobby: () => void;
}

export function ResultPanel({ view, onAgain, onLobby }: Props) {
  const pub = view.public;
  return (
    <section className="animate-rise border border-[var(--ember)] bg-[var(--panel)] px-4 py-5">
      <h3 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
        {pub.winnerSide === 'witnesses' ? 'Witnesses win' : 'Murderer side wins'}
      </h3>
      <p className="mt-2 text-[var(--fog)]">
        Locked in the Boiler Room:{' '}
        {pub.lockedPlayerId
          ? pub.players.find((p) => p.id === pub.lockedPlayerId)?.name
          : 'nobody'}
      </p>

      {pub.revealedRoles && (
        <div className="mt-4">
          <h4 className="text-xs tracking-[0.14em] text-[var(--fog-dim)] uppercase">
            Murderer reveal
          </h4>
          <ul className="mt-1 space-y-1 text-sm">
            {pub.players.map((p) => (
              <li key={p.id}>
                {p.name}: <strong>{roleLabel(pub.revealedRoles![p.id])}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pub.voteTallies && (
        <div className="mt-4">
          <h4 className="text-xs tracking-[0.14em] text-[var(--fog-dim)] uppercase">
            Voting result
          </h4>
          <ul className="mt-1 space-y-1 text-sm text-[var(--fog)]">
            {Object.entries(pub.voteTallies).map(([id, n]) => (
              <li key={id}>
                {pub.players.find((p) => p.id === id)?.name ?? id}: {n} vote(s)
              </li>
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

      {pub.chat.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs tracking-[0.14em] text-[var(--fog-dim)] uppercase">
            Discussion summary
          </h4>
          <ul className="mt-1 max-h-28 space-y-1 overflow-y-auto text-sm text-[var(--fog)]">
            {pub.chat.slice(-8).map((c, i) => (
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
