'use client';

import { useMemo, useState } from 'react';
import type { Action, PlayerMatchView, RoleId } from '@now/game-types';
import { roleLabel } from '@/lib/roleLabels';
import { CircularTable } from '@/components/match/CircularTable';
import { MatchChat } from '@/components/match/MatchChat';
import { MatchTimer } from '@/components/match/MatchTimer';
import { PassConfirmModal } from '@/components/game/PassConfirmModal';
import { ResultPanel } from '@/components/game/ResultPanel';

const V1_ROLES: RoleId[] = [
  'murderer',
  'accomplice',
  'doctor',
  'detective',
  'spy',
  'priest',
];

interface GameTableProps {
  view: PlayerMatchView;
  selfId: string;
  onAction: (action: Action) => void;
  statusMessage?: string | null;
  onPlayAgain?: () => void;
  onBackLobby?: () => void;
  now?: number;
}

export function GameTable({
  view,
  selfId,
  onAction,
  statusMessage,
  onPlayAgain,
  onBackLobby,
  now = Date.now(),
}: GameTableProps) {
  const { public: pub, private: priv } = view;
  const legal = new Set(priv.legalActions);
  const others = pub.players.filter((p) => p.id !== selfId);
  const [passCardIndex, setPassCardIndex] = useState<0 | 1 | null>(null);
  const [passToId, setPassToId] = useState<string | null>(null);
  const [dragOverSeatId, setDragOverSeatId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<0 | 1 | null>(null);

  const chainTarget = useMemo(() => {
    if (pub.phase !== 'role_assignment' || !pub.currentPlayerId) return null;
    const cur = pub.players.find((p) => p.id === pub.currentPlayerId);
    if (!cur) return null;
    const dir = pub.variant.passDirection === 'counterclockwise' ? -1 : 1;
    const nextIdx = (cur.seatIndex + dir + pub.players.length) % pub.players.length;
    const next = pub.players.find((p) => p.seatIndex === nextIdx);
    const selecting = pub.players.filter(
      (p) => p.status === 'Selecting card' || p.id === cur.id,
    );
    if (selecting.length <= 1 && priv.hand.length === 2) {
      return { id: 'guest_room', name: 'Guest Room' };
    }
    return next ? { id: next.id, name: next.name } : { id: 'guest_room', name: 'Guest Room' };
  }, [pub, priv.hand.length]);

  const dropEnabled = legal.has('keep_card') && priv.hand.length === 2;
  const voteEnabled = legal.has('cast_vote');

  function openPassConfirm(passIndex: 0 | 1, toId?: string) {
    setPassCardIndex(passIndex);
    setPassToId(toId ?? chainTarget?.id ?? others[0]?.id ?? 'guest_room');
  }

  function confirmPass(reason: string, toId: string) {
    if (passCardIndex === null) return;
    // Passing card at passCardIndex means we keep the other
    const keepIndex = (1 - passCardIndex) as 0 | 1;
    onAction({
      type: 'keep_card',
      keepIndex,
      passReason: reason || `Pass to ${toId}`,
    });
    setPassCardIndex(null);
    setPassToId(null);
    setSelectedCard(null);
  }

  function onSeatClick(seatPlayerId: string) {
    if (voteEnabled) {
      onAction({ type: 'cast_vote', targetPlayerId: seatPlayerId });
      return;
    }
    if (dropEnabled && selectedCard !== null && seatPlayerId !== selfId) {
      openPassConfirm(selectedCard, seatPlayerId);
    }
  }

  const passToName =
    passToId === 'guest_room'
      ? 'Guest Room'
      : pub.players.find((p) => p.id === passToId)?.name ?? chainTarget?.name ?? 'Player';

  return (
    <div className="match-shell mx-auto flex w-full max-w-5xl flex-col gap-4 px-3 py-4 md:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] pb-3">
        <div>
          <p className="text-xs tracking-[0.18em] text-[var(--fog-dim)] uppercase">
            Night of Witnesses
          </p>
          <h2
            className="text-2xl font-bold md:text-3xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {phaseTitle(pub.phase)}
          </h2>
          <p className="text-sm text-[var(--fog)]">
            Round {pub.round}/{pub.maxRounds}
          </p>
        </div>
        <MatchTimer
          phaseEndsAt={pub.phaseEndsAt}
          now={now}
          phaseLabel={phaseTitle(pub.phase)}
        />
      </header>

      {statusMessage && (
        <p className="border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--fog)]">
          {statusMessage}
        </p>
      )}

      <CircularTable
        players={pub.players}
        selfId={selfId}
        currentPlayerId={pub.currentPlayerId}
        dropEnabled={dropEnabled}
        voteEnabled={voteEnabled}
        dragOverSeatId={dragOverSeatId}
        onSeatDragOver={setDragOverSeatId}
        onSeatDrop={(id) => {
          if (selectedCard !== null) openPassConfirm(selectedCard, id);
        }}
        onSeatClick={onSeatClick}
      />

      {dropEnabled && priv.hand.length === 2 && (
        <section className="match-hand" aria-label="Your hand">
          <p className="mb-2 text-sm text-[var(--fog)]">
            Drag a card onto a seat to pass it, or tap a card then tap a seat. You keep the other
            card.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {([0, 1] as const).map((idx) => (
              <button
                key={idx}
                type="button"
                draggable
                onDragStart={(e) => {
                  setSelectedCard(idx);
                  e.dataTransfer.setData('text/pass-index', String(idx));
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => setDragOverSeatId(null)}
                onClick={() => setSelectedCard(idx)}
                className={`card-tile flex-1 px-4 py-5 font-semibold transition ${
                  selectedCard === idx
                    ? 'bg-[var(--ember-hot)] text-[#1a0f0a] ring-2 ring-[var(--paper)]'
                    : 'bg-[var(--ember)] text-[#1a0f0a] hover:bg-[var(--ember-hot)]'
                }`}
              >
                {roleLabel(priv.hand[idx]!)}
                <span className="mt-1 block text-xs font-normal opacity-80">Pass this card</span>
              </button>
            ))}
          </div>
          {selectedCard !== null && chainTarget && (
            <button
              type="button"
              className="mt-2 border border-[var(--fog)] px-4 py-3 text-sm"
              onClick={() => openPassConfirm(selectedCard, chainTarget.id)}
            >
              Pass to {chainTarget.name} (chain)
            </button>
          )}
        </section>
      )}

      <section className="border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
        <p className="text-xs tracking-[0.16em] text-[var(--fog-dim)] uppercase">Your secrets</p>
        <p className="mt-1 text-lg">
          Role: <strong>{roleLabel(priv.role)}</strong>
        </p>
        {priv.doctorResult && (
          <p className="mt-1 text-sm">
            Doctor: {priv.doctorResult.isMurderer ? 'IS Murderer' : 'NOT Murderer'} (
            {nameOf(pub, priv.doctorResult.targetPlayerId)})
          </p>
        )}
        {priv.detectiveReveal && (
          <p className="mt-1 text-sm">
            Detective: {nameOf(pub, priv.detectiveReveal.targetPlayerId)} passed{' '}
            {roleLabel(priv.detectiveReveal.passedCard)}
          </p>
        )}
        {priv.guestRoomCard && (
          <p className="mt-1 text-sm">Guest Room peek: {roleLabel(priv.guestRoomCard)}</p>
        )}
      </section>

      {pub.sightings.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm tracking-[0.14em] text-[var(--fog-dim)] uppercase">
            Descriptions
          </h3>
          <ul className="space-y-2 text-sm">
            {pub.sightings.map((s, i) => (
              <li key={i} className="border-l-2 border-[var(--ember)] pl-3 text-[var(--fog)]">
                {s.text ??
                  `${nameOf(pub, s.fromPlayerId)} saw ${roleLabel(s.claimedRole)} through ${nameOf(pub, s.claimedThroughPlayerId)}`}
              </li>
            ))}
          </ul>
        </section>
      )}

      <MatchChat
        view={view}
        selfId={selfId}
        canChat={legal.has('chat')}
        onSend={(text) => onAction({ type: 'chat', text })}
      />

      {pub.phase === 'result' && (
        <ResultPanel
          view={view}
          onAgain={onPlayAgain ?? (() => undefined)}
          onLobby={onBackLobby ?? (() => undefined)}
        />
      )}

      <section className="flex flex-col gap-3">
        {legal.has('announce_sighting') && (
          <SightingForm
            roles={V1_ROLES}
            players={others}
            onSubmit={(claimedRole, claimedThroughPlayerId, text) =>
              onAction({
                type: 'announce_sighting',
                claimedRole,
                claimedThroughPlayerId,
                text,
              })
            }
          />
        )}
        {legal.has('use_doctor') && (
          <TargetButtons
            label="Doctor: examine (or click a seat)"
            players={others}
            onPick={(id) => onAction({ type: 'use_doctor', targetPlayerId: id })}
          />
        )}
        {legal.has('use_detective') && (
          <TargetButtons
            label="Detective: reveal passed card"
            players={others}
            onPick={(id) => onAction({ type: 'use_detective', targetPlayerId: id })}
          />
        )}
        {legal.has('use_spy') && (
          <button
            type="button"
            className="border border-[var(--fog)] px-4 py-3"
            onClick={() => onAction({ type: 'use_spy' })}
          >
            Spy: peek Guest Room
          </button>
        )}
        {legal.has('use_priest') && (
          <TargetButtons
            label="Priest: silence"
            players={others}
            onPick={(id) => onAction({ type: 'use_priest', targetPlayerId: id })}
          />
        )}
        {legal.has('skip_ability') && (
          <button
            type="button"
            className="border border-[var(--line)] px-4 py-3 text-[var(--fog)]"
            onClick={() => onAction({ type: 'skip_ability' })}
          >
            Skip ability
          </button>
        )}
        {legal.has('end_discussion') && (
          <button
            type="button"
            className="bg-[var(--ember)] px-4 py-3 font-semibold text-[#1a0f0a]"
            onClick={() => onAction({ type: 'end_discussion' })}
          >
            End discussion / go to vote
          </button>
        )}
        {voteEnabled && (
          <p className="text-sm text-[var(--fog)]">Click any seat at the table to cast your vote.</p>
        )}
      </section>

      {passCardIndex !== null && priv.hand[passCardIndex] && (
        <PassConfirmModal
          card={priv.hand[passCardIndex]!}
          passToName={passToName}
          passToId={passToId ?? chainTarget?.id ?? 'guest_room'}
          players={[
            ...pub.players.map((p) => ({ id: p.id, name: p.name })),
            { id: 'guest_room', name: 'Guest Room' },
          ]}
          onConfirm={confirmPass}
          onCancel={() => {
            setPassCardIndex(null);
            setPassToId(null);
          }}
          allowSelectPassTo
        />
      )}
    </div>
  );
}

function phaseTitle(phase: string): string {
  switch (phase) {
    case 'role_assignment':
      return 'Card Passing';
    case 'information':
      return 'Description Phase';
    case 'discussion':
      return 'Group Discussion';
    case 'voting':
      return 'Voting Phase';
    case 'result':
      return 'Result Phase';
    default:
      return phase;
  }
}

function nameOf(pub: PlayerMatchView['public'], id: string): string {
  return pub.players.find((p) => p.id === id)?.name ?? id;
}

function SightingForm({
  roles,
  players,
  onSubmit,
}: {
  roles: RoleId[];
  players: Array<{ id: string; name: string }>;
  onSubmit: (role: RoleId, through: string, text: string) => void;
}) {
  return (
    <form
      className="flex flex-col gap-2 border border-[var(--line)] p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const role = fd.get('role') as RoleId;
        const through = String(fd.get('through'));
        const custom = String(fd.get('text') ?? '').trim();
        const throughName = players.find((p) => p.id === through)?.name ?? through;
        onSubmit(
          role,
          through,
          custom || `I saw the ${roleLabel(role)} card pass through ${throughName}`,
        );
      }}
    >
      <p className="text-sm text-[var(--fog)]">Write your description (truth or lie):</p>
      <select name="role" className="field" defaultValue={roles[0]}>
        {roles.map((r) => (
          <option key={r} value={r}>
            {roleLabel(r)}
          </option>
        ))}
      </select>
      <select name="through" className="field" defaultValue={players[0]?.id}>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <textarea
        name="text"
        rows={2}
        maxLength={200}
        className="field"
        placeholder="Optional custom wording…"
      />
      <button type="submit" className="bg-[var(--ember)] px-4 py-3 font-semibold text-[#1a0f0a]">
        Announce sighting
      </button>
    </form>
  );
}

function TargetButtons({
  label,
  players,
  onPick,
}: {
  label: string;
  players: Array<{ id: string; name: string }>;
  onPick: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-[var(--fog)]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {players.map((p) => (
          <button
            key={p.id}
            type="button"
            className="border border-[var(--fog)] px-3 py-2 text-sm transition hover:border-[var(--ember)]"
            onClick={() => onPick(p.id)}
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}
