'use client';

import type { Action, PlayerMatchView, RoleId } from '@now/game-types';
import { roleLabel } from '@/lib/roleLabels';

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
}

export function GameTable({ view, selfId, onAction, statusMessage }: GameTableProps) {
  const { public: pub, private: priv } = view;
  const legal = new Set(priv.legalActions);
  const others = pub.players.filter((p) => p.id !== selfId);

  const timerLabel =
    pub.phaseEndsAt != null
      ? formatRemaining(pub.phaseEndsAt - Date.now())
      : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
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
          {timerLabel && <p className="text-lg font-semibold text-[var(--ember-hot)]">{timerLabel}</p>}
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

      <section className="grid gap-3 sm:grid-cols-2">
        {pub.players.map((p) => (
          <div
            key={p.id}
            className="border border-[var(--line)] bg-[var(--panel)] px-4 py-3"
            style={{
              outline:
                pub.currentPlayerId === p.id ? '1px solid var(--ember)' : undefined,
            }}
          >
            <p className="font-semibold">
              {p.name}
              {p.id === selfId ? ' (you)' : ''}
              {p.isBot ? ' · bot' : ''}
            </p>
            <p className="text-xs text-[var(--fog-dim)]">
              Seat {p.seatIndex + 1}
              {p.isSilenced ? ' · silenced' : ''}
              {p.hasVoted ? ' · voted' : ''}
              {p.isLocked ? ' · LOCKED' : ''}
            </p>
          </div>
        ))}
      </section>

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
            Sightings
          </h3>
          <ul className="space-y-2 text-sm">
            {pub.sightings.map((s, i) => (
              <li key={i} className="border-l-2 border-[var(--ember)] pl-3 text-[var(--fog)]">
                {nameOf(pub, s.fromPlayerId)} saw the {roleLabel(s.claimedRole)} card pass through{' '}
                {nameOf(pub, s.claimedThroughPlayerId)}
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
        <section className="border border-[var(--ember)] bg-[var(--panel)] px-4 py-5">
          <h3 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            {pub.winnerSide === 'witnesses' ? 'Witnesses win' : 'Murderer side wins'}
          </h3>
          <p className="mt-2 text-[var(--fog)]">
            Locked in the Boiler Room:{' '}
            {pub.lockedPlayerId ? nameOf(pub, pub.lockedPlayerId) : 'nobody'}
          </p>
        </section>
      )}

      <section className="flex flex-col gap-3">
        {legal.has('keep_card') && priv.hand.length === 2 && (
          <div className="flex flex-col gap-2 sm:flex-row">
            {([0, 1] as const).map((idx) => (
              <button
                key={idx}
                type="button"
                className="flex-1 bg-[var(--ember)] px-4 py-3 font-semibold text-[#1a0f0a]"
                onClick={() => onAction({ type: 'keep_card', keepIndex: idx })}
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
            onSubmit={(claimedRole, claimedThroughPlayerId) =>
              onAction({ type: 'announce_sighting', claimedRole, claimedThroughPlayerId })
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

        {legal.has('chat') && (
          <ChatBox onSend={(text) => onAction({ type: 'chat', text })} />
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

        {legal.has('cast_vote') && (
          <TargetButtons
            label="Vote to lock in Boiler Room"
            players={pub.players}
            onPick={(id) => onAction({ type: 'cast_vote', targetPlayerId: id })}
          />
        )}
      </section>
    </div>
  );
}

function phaseTitle(phase: string): string {
  switch (phase) {
    case 'role_assignment':
      return 'Role Assignment';
    case 'information':
      return 'Information Exchange';
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
  onSubmit: (role: RoleId, through: string) => void;
}) {
  return (
    <form
      className="flex flex-col gap-2 border border-[var(--line)] p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onSubmit(fd.get('role') as RoleId, String(fd.get('through')));
      }}
    >
      <p className="text-sm text-[var(--fog)]">Announce a sighting (truth or lie):</p>
      <select name="role" className="bg-[var(--bg-mist)] px-3 py-2" defaultValue={roles[0]}>
        {roles.map((r) => (
          <option key={r} value={r}>
            {roleLabel(r)}
          </option>
        ))}
      </select>
      <select
        name="through"
        className="bg-[var(--bg-mist)] px-3 py-2"
        defaultValue={players[0]?.id}
      >
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
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
            className="border border-[var(--fog)] px-3 py-2 text-sm hover:border-[var(--ember)]"
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
