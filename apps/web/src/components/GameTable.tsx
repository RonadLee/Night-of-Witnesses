'use client';

import { useMemo, useState } from 'react';
import type { Action, PlayerMatchView, RoleId } from '@now/game-types';
import { roleLabel } from '@/lib/roleLabels';
import { ActivityFeed } from '@/components/game/ActivityFeed';
import { PassConfirmModal } from '@/components/game/PassConfirmModal';
import { PlayerSeatCard } from '@/components/game/PlayerSeatCard';
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
  const [pendingKeep, setPendingKeep] = useState<0 | 1 | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const timerLabel =
    pub.phaseEndsAt != null ? formatRemaining(pub.phaseEndsAt - now) : null;

  const passTarget = useMemo(() => {
    if (pub.phase !== 'role_assignment' || !pub.currentPlayerId) return null;
    const cur = pub.players.find((p) => p.id === pub.currentPlayerId);
    if (!cur) return null;
    const dir = pub.variant.passDirection === 'counterclockwise' ? -1 : 1;
    const nextIdx = (cur.seatIndex + dir + pub.players.length) % pub.players.length;
    const next = pub.players.find((p) => p.seatIndex === nextIdx);
    // If everyone else already acted, guest room — approximate: if only one without role left it's current
    const unfinished = pub.players.filter((p) => p.status === 'Selecting card' || p.id === cur.id);
    if (unfinished.length <= 1 && priv.hand.length === 2) {
      return { id: 'guest_room', name: 'Guest Room' };
    }
    return next ? { id: next.id, name: next.name } : { id: 'guest_room', name: 'Guest Room' };
  }, [pub, priv.hand.length]);

  function confirmKeep(reason: string) {
    if (pendingKeep === null) return;
    onAction({ type: 'keep_card', keepIndex: pendingKeep, passReason: reason || undefined });
    setPendingKeep(null);
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] pb-4">
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
        </div>
        <div className="text-right text-sm text-[var(--fog)]">
          {timerLabel && (
            <p className="text-lg font-semibold text-[var(--ember-hot)]" aria-live="polite">
              {timerLabel}
            </p>
          )}
          <p>
            Round {pub.round}/{pub.maxRounds}
          </p>
        </div>
      </header>

      {statusMessage && (
        <p className="border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--fog)]">
          {statusMessage}
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pub.players.map((p) => (
          <PlayerSeatCard
            key={p.id}
            player={p}
            isSelf={p.id === selfId}
            isCurrent={pub.currentPlayerId === p.id}
          />
        ))}
      </section>

      <ActivityFeed events={pub.activity} />

      <section className="border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
        <p className="text-xs tracking-[0.16em] text-[var(--fog-dim)] uppercase">Your secrets</p>
        <p className="mt-1 text-lg">
          Role: <strong>{roleLabel(priv.role)}</strong>
        </p>
        {priv.hand.length > 0 && (
          <p className="mt-2 text-[var(--fog)]">
            Hand: {priv.hand.map((r) => roleLabel(r)).join(' · ')}
          </p>
        )}
        {priv.doctorResult && (
          <p className="mt-2 text-sm">
            Doctor result: {priv.doctorResult.isMurderer ? 'IS Murderer' : 'NOT Murderer'} (
            {nameOf(pub, priv.doctorResult.targetPlayerId)})
          </p>
        )}
        {priv.detectiveReveal && (
          <p className="mt-2 text-sm">
            Detective: {nameOf(pub, priv.detectiveReveal.targetPlayerId)} passed{' '}
            {roleLabel(priv.detectiveReveal.passedCard)}
          </p>
        )}
        {priv.guestRoomCard && (
          <p className="mt-2 text-sm">Guest Room peek: {roleLabel(priv.guestRoomCard)}</p>
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
                  `${nameOf(pub, s.fromPlayerId)} saw the ${roleLabel(s.claimedRole)} card pass through ${nameOf(pub, s.claimedThroughPlayerId)}`}
              </li>
            ))}
          </ul>
        </section>
      )}

      {pub.chat.length > 0 && (
        <section className="max-h-40 overflow-y-auto border border-[var(--line)] px-3 py-2 text-sm">
          {pub.chat.map((c, i) => (
            <p key={i} className="text-[var(--fog)]">
              <strong>{nameOf(pub, c.fromPlayerId)}</strong>: {c.text}
            </p>
          ))}
        </section>
      )}

      {pub.phase === 'result' && (
        <ResultPanel
          view={view}
          onAgain={onPlayAgain ?? (() => undefined)}
          onLobby={onBackLobby ?? (() => undefined)}
        />
      )}

      <section className="flex flex-col gap-3">
        {legal.has('keep_card') && priv.hand.length === 2 && (
          <div
            className={`flex flex-col gap-2 rounded-sm border border-dashed p-3 sm:flex-row ${
              dragOver ? 'border-[var(--ember)] bg-[var(--panel)]' : 'border-[var(--line)]'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const idx = Number(e.dataTransfer.getData('text/keep-index'));
              if (idx === 0 || idx === 1) setPendingKeep(idx);
            }}
          >
            <p className="w-full text-sm text-[var(--fog)] sm:basis-full">
              Tap or drag a card to keep it (the other is passed).
            </p>
            {([0, 1] as const).map((idx) => (
              <button
                key={idx}
                type="button"
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/keep-index', String(idx))}
                className="card-tile flex-1 bg-[var(--ember)] px-4 py-4 font-semibold text-[#1a0f0a] transition hover:bg-[var(--ember-hot)] active:scale-[0.98]"
                onClick={() => setPendingKeep(idx)}
              >
                Keep {roleLabel(priv.hand[idx]!)}
              </button>
            ))}
          </div>
        )}

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
            label="Doctor: examine"
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

        {legal.has('chat') && <ChatBox onSend={(text) => onAction({ type: 'chat', text })} />}
        {legal.has('end_discussion') && (
          <button
            type="button"
            className="bg-[var(--ember)] px-4 py-3 font-semibold text-[#1a0f0a]"
            onClick={() => onAction({ type: 'end_discussion' })}
          >
            End discussion / go to vote
          </button>
        )}

        {legal.has('cast_vote') && (
          <TargetButtons
            label="Vote to lock in Boiler Room"
            players={pub.players}
            onPick={(id) => onAction({ type: 'cast_vote', targetPlayerId: id })}
          />
        )}
      </section>

      {pendingKeep !== null && passTarget && priv.hand[pendingKeep] && (
        <PassConfirmModal
          card={priv.hand[1 - pendingKeep]!}
          passToName={passTarget.name}
          passToId={passTarget.id}
          players={pub.players}
          onConfirm={confirmKeep}
          onCancel={() => setPendingKeep(null)}
        />
      )}
    </div>
  );
}

function phaseTitle(phase: string): string {
  switch (phase) {
    case 'role_assignment':
      return 'Role Assignment';
    case 'information':
      return 'Description Phase';
    case 'discussion':
      return 'Open Discussion';
    case 'voting':
      return 'Secret Vote';
    case 'result':
      return 'Boiler Room';
    default:
      return phase;
  }
}

function nameOf(pub: PlayerMatchView['public'], id: string): string {
  return pub.players.find((p) => p.id === id)?.name ?? id;
}

function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
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
      <select name="role" className="bg-[var(--bg-mist)] px-3 py-2" defaultValue={roles[0]}>
        {roles.map((r) => (
          <option key={r} value={r}>
            {roleLabel(r)}
          </option>
        ))}
      </select>
      <select name="through" className="bg-[var(--bg-mist)] px-3 py-2" defaultValue={players[0]?.id}>
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
        className="bg-[var(--bg-mist)] px-3 py-2"
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

function ChatBox({ onSend }: { onSend: (text: string) => void }) {
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const text = String(fd.get('text') ?? '').trim();
        if (text) onSend(text);
        e.currentTarget.reset();
      }}
    >
      <input
        name="text"
        className="flex-1 bg-[var(--bg-mist)] px-3 py-2"
        placeholder="Say something…"
        maxLength={280}
      />
      <button type="submit" className="border border-[var(--line)] px-4">
        Send
      </button>
    </form>
  );
}
