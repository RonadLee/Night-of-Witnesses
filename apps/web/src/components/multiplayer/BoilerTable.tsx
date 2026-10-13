'use client';

import { CARD_CATALOG, type BoilerRole, type TableAction, type TablePlayerView } from '@now/game-types';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ConnectionPill } from './LobbyScreen';
import { ThemeToggle } from './ThemeToggle';
import type { ConnectionState } from './types';

const EMOJIS = ['👍', '👎', '😂', '🔥', '👀', '💀', '❓', '✅'];

export function BoilerTable({
  view,
  serverNow,
  selfId,
  connection,
  error,
  onAction,
  onCommand,
  onTyping,
  onLeave,
}: {
  view: TablePlayerView;
  serverNow: number;
  selfId: string;
  connection: ConnectionState;
  error: string | null;
  onAction: (action: TableAction) => void;
  onCommand: (type: 'next_round' | 'return_lobby' | 'end_game') => void;
  onTyping: (typing: boolean) => void;
  onLeave: () => void;
}) {
  const { public: pub, private: priv } = view;
  const legal = useMemo(() => new Set(priv.legalActions), [priv.legalActions]);
  const [tab, setTab] = useState<'activity' | 'chat'>('activity');
  const [detail, setDetail] = useState<BoilerRole | null>(null);
  const [pendingPass, setPendingPass] = useState<0 | 1 | null>(null);
  const [draft, setDraft] = useState(priv.draft);
  const [chat, setChat] = useState('');
  const [now, setNow] = useState(Date.now());
  const [warning, setWarning] = useState('');
  const warned = useRef<number | null>(null);
  const clock = useRef({ serverNow: 0, offset: 0 });
  if (clock.current.serverNow !== serverNow) {
    clock.current = { serverNow, offset: serverNow - Date.now() };
  }

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setDetail(null);
      setPendingPass(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const rawRemaining = pub.phaseEndsAt == null ? null : Math.max(0, pub.phaseEndsAt - (now + clock.current.offset));
  const remaining = rawRemaining == null ? null : Math.min(rawRemaining, phaseBudget(pub));
  useEffect(() => {
    if (remaining == null) return;
    if (remaining <= 10_000 && remaining > 0 && warned.current !== pub.phaseEndsAt) {
      warned.current = pub.phaseEndsAt;
      setWarning('Less than 10 seconds remain.');
    }
  }, [remaining, pub.phaseEndsAt]);

  const names = useMemo(() => new Map(pub.players.map((p) => [p.id, p.name])), [pub.players]);
  const nameOf = (id: string | null) => (id ? (names.get(id) ?? 'Player') : 'the unseated pile');

  const draftTimer = useRef<number | null>(null);
  const draftDirty = useRef(false);
  function saveDraft(text: string) {
    draftDirty.current = true;
    setDraft(text);
    if (!legal.has('save_draft')) return;
    if (draftTimer.current) window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(() => {
      onAction({ type: 'save_draft', text });
      draftDirty.current = false;
    }, 400);
  }

  useEffect(() => {
    if (!draftDirty.current) setDraft(priv.draft);
  }, [priv.draft]);

  return (
    <div className="mp-shell">
      <header className="mp-top">
        <div>
          <p className="text-xs tracking-[0.18em] text-[var(--fog-dim)] uppercase">
            Round {pub.round}/{pub.maxRounds}
            {pub.anonymousVoting ? ' · Anonymous vote' : ''}
          </p>
          <h1 className="text-3xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>
            {phaseTitle(pub.phase)}
          </h1>
        </div>
        <div className="mp-row">
          <ConnectionPill connection={connection} />
          <ThemeToggle />
          <button type="button" className="border border-[var(--line)] px-3 py-2 text-sm" onClick={onLeave}>
            Leave
          </button>
        </div>
      </header>

      <div className="mp-layout">
        <section className="mp-felt" aria-label="Players around the table">
          {pub.players.map((player, index) => (
            <article
              key={player.id}
              className={`mp-seat ${player.isCurrent ? 'current' : ''} ${player.connected ? '' : 'offline'}`}
              style={seatStyle(index, pub.players.length)}
            >
              <p className="flex items-center gap-2 text-sm font-semibold">
                <span className={`mp-dot ${player.typing ? 'talk' : player.connected ? 'on' : ''}`} aria-hidden />
                {player.name}
                {player.id === selfId ? ' (you)' : ''}
              </p>
              <p className="text-xs text-[var(--fog)]">
                {player.connected ? 'Online' : 'Offline'}
                {player.isCurrent ? ' · Turn' : ''}
                {player.typing ? ' · Speaking' : ''}
                {pub.phase === 'voting' ? (player.hasVoted ? ' · Voted' : player.canVote ? ' · Waiting' : ' · No vote') : ''}
                {pub.revealedRoles?.[player.id] ? ` · ${CARD_CATALOG[pub.revealedRoles[player.id]!].name}` : ''}
              </p>
            </article>
          ))}
          <div className="mp-center">
            <p className={`mp-timer ${remaining != null && remaining <= 10_000 ? 'warn' : ''}`}>
              {remaining == null ? '—' : formatRemaining(remaining)}
            </p>
            <p className="text-sm text-[var(--fog)]">{pub.players.filter((p) => p.connected).length} online</p>
          </div>
        </section>

        <aside className="mp-feed">
          <div className="mp-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'activity'} onClick={() => setTab('activity')}>
              Activity
            </button>
            <button type="button" role="tab" aria-selected={tab === 'chat'} onClick={() => setTab('chat')}>
              Discussion
            </button>
          </div>
          {tab === 'activity' ? (
            <div className="mp-log" aria-live="polite">
              {pub.activity.map((event) => (
                <p key={event.id} className="text-sm text-[var(--fog)]">
                  {event.text}
                </p>
              ))}
            </div>
          ) : (
            <div className="mp-log">
              {pub.descriptions.map((item) => (
                <p key={item.playerId} className="text-sm">
                  <strong>{nameOf(item.playerId)} described:</strong> {item.text || '(silence)'}
                </p>
              ))}
              {pub.chat.map((message) => (
                <article key={message.id} className="rounded-xl border border-[var(--line)] px-2 py-2 text-sm">
                  <p>
                    <strong>{nameOf(message.fromPlayerId)}</strong> {message.text}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {EMOJIS.map((emoji) => {
                      const count = message.reactions.filter((r) => r.emoji === emoji).length;
                      if (!legal.has('react') && count === 0) return null;
                      return (
                        <button
                          key={emoji}
                          type="button"
                          className="border border-[var(--line)] px-1 text-xs"
                          disabled={!legal.has('react')}
                          onClick={() => onAction({ type: 'react', messageId: message.id, emoji })}
                        >
                          {emoji}
                          {count > 0 ? ` ${count}` : ''}
                        </button>
                      );
                    })}
                  </div>
                </article>
              ))}
              {pub.players.some((p) => p.typing && p.id !== selfId) && (
                <p className="text-xs text-[var(--fog-dim)]">
                  {pub.players
                    .filter((p) => p.typing && p.id !== selfId)
                    .map((p) => p.name)
                    .join(', ')}{' '}
                  typing…
                </p>
              )}
            </div>
          )}
        </aside>
      </div>

      <p className="sr-only" aria-live="polite">
        {warning}
      </p>
      {error && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      {priv.spectator && <p className="text-sm text-[var(--fog)]">You are spectating this table.</p>}

      <section className="mp-dock" aria-label="Your cards and actions">
        {priv.role && (
          <p>
            Your role: <strong>{CARD_CATALOG[priv.role].name}</strong>
            <button type="button" className="ml-2 text-sm underline" onClick={() => setDetail(priv.role)}>
              Read card
            </button>
          </p>
        )}
        {priv.departedGuests && priv.role === 'butler' && !pub.departedGuests && (
          <p className="text-sm text-[var(--fog)]">
            Guests who left first: {priv.departedGuests.map((role) => CARD_CATALOG[role].name).join(', ')}. Only you can see this.
          </p>
        )}
        {pub.departedGuests && (
          <p className="text-sm">
            Guests who left: {pub.departedGuests.map((role) => CARD_CATALOG[role].name).join(', ')}
          </p>
        )}

        {priv.hand.length > 0 && (
          <>
            <div className="mp-cards">
              {priv.hand.map((role, index) => (
                <button
                  key={`${role}-${index}`}
                  type="button"
                  className={`mp-card ${pendingPass === index ? 'selected' : ''}`}
                  draggable={legal.has('confirm_pass')}
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/plain', String(index));
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                  onClick={() => setDetail(role)}
                >
                  <img src={CARD_CATALOG[role].image} alt="" />
                  <span className="block px-2 py-2 text-sm font-semibold">{CARD_CATALOG[role].name}</span>
                </button>
              ))}
            </div>
            {legal.has('confirm_pass') && (
              <div
                className="rounded-2xl border border-dashed border-[var(--fog)] px-3 py-4 text-sm"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const index = Number(event.dataTransfer.getData('text/plain'));
                  if (index === 0 || index === 1) setPendingPass(index);
                }}
              >
                Drag a card here, or choose one below.
                <div className="mt-2 flex flex-wrap gap-2">
                  {priv.hand.map((role, index) => (
                    <button key={`${role}-pass`} type="button" className="border border-[var(--line)] px-3 py-2" onClick={() => setPendingPass(index as 0 | 1)}>
                      Pass {CARD_CATALOG[role].name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {legal.has('submit_description') && (
          <label className="grid gap-2 text-sm">
            Your description
            <textarea
              className="min-h-24 bg-[var(--bg-mist)] px-3 py-2"
              maxLength={500}
              value={draft}
              onChange={(event) => saveDraft(event.target.value)}
            />
            <button
              type="button"
              className="bg-[var(--ember)] px-4 py-3 font-semibold text-[#1a0f0a]"
              onClick={() => onAction({ type: 'submit_description', text: draft })}
            >
              Submit description
            </button>
          </label>
        )}

        {legal.has('chat') && (
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const text = chat.trim();
              if (!text) return;
              onAction({ type: 'chat', text });
              setChat('');
              onTyping(false);
            }}
          >
            <label className="sr-only" htmlFor="table-chat">
              Message
            </label>
            <input
              id="table-chat"
              className="flex-1 bg-[var(--bg-mist)] px-3 py-2"
              value={chat}
              maxLength={280}
              onChange={(event) => {
                setChat(event.target.value);
                onTyping(event.target.value.trim().length > 0);
              }}
              onBlur={() => onTyping(false)}
            />
            <button type="submit" className="border border-[var(--line)] px-4">
              Send
            </button>
          </form>
        )}

        {legal.has('butler_reveal') && (
          <button type="button" className="border border-[var(--line)] px-4 py-3" onClick={() => onAction({ type: 'butler_reveal' })}>
            Reveal the Butler
          </button>
        )}
        {legal.has('detective_lock') && (
          <div className="flex flex-wrap gap-2">
            {pub.players.map((player) => (
              <button
                key={player.id}
                type="button"
                className="border border-[var(--line)] px-3 py-2 text-sm"
                onClick={() => onAction({ type: 'detective_lock', targetPlayerId: player.id })}
              >
                Send {player.name} to the Boiler Room
              </button>
            ))}
          </div>
        )}
        {legal.has('cast_vote') && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Vote">
            {pub.players.map((player) => (
              <button
                key={player.id}
                type="button"
                className="bg-[var(--ember)] px-3 py-2 text-sm font-semibold text-[#1a0f0a]"
                onClick={() => onAction({ type: 'cast_vote', targetPlayerId: player.id })}
              >
                Vote {player.name}
              </button>
            ))}
          </div>
        )}
        {pub.phase === 'voting' && priv.myVote && <p className="text-sm">Your vote is locked in.</p>}

        {(pub.phase === 'result' || pub.phase === 'ended') && <ResultBlock view={view} nameOf={nameOf} />}

        {priv.hostCommands.length > 0 && (
          <div className="mp-row">
            {priv.hostCommands.map((command) => (
              <button key={command} type="button" className="border border-[var(--line)] px-4 py-3" onClick={() => onCommand(command)}>
                {command === 'next_round' ? 'Next round' : command === 'return_lobby' ? 'Return to lobby' : 'End game'}
              </button>
            ))}
          </div>
        )}
      </section>

      {detail && (
        <div className="mp-dialog" role="presentation" onClick={() => setDetail(null)}>
          <article role="dialog" aria-modal="true" aria-labelledby="card-title" onClick={(event) => event.stopPropagation()}>
            <img src={CARD_CATALOG[detail].image} alt="" className="mb-3 h-40 w-full rounded-xl object-cover object-top" />
            <h2 id="card-title" className="text-2xl font-bold">
              {CARD_CATALOG[detail].name} · {CARD_CATALOG[detail].nameZh}
            </h2>
            <p className="mt-2">{CARD_CATALOG[detail].summary}</p>
            <p className="mt-2 text-sm text-[var(--fog)]">{CARD_CATALOG[detail].summaryZh}</p>
            <button type="button" className="mt-4 border border-[var(--line)] px-4 py-2" onClick={() => setDetail(null)}>
              Close
            </button>
          </article>
        </div>
      )}

      {pendingPass !== null && priv.hand[pendingPass] && priv.passTarget && (
        <div className="mp-dialog" role="presentation">
          <article role="dialog" aria-modal="true" aria-labelledby="pass-title">
            <h2 id="pass-title" className="text-2xl font-bold">
              Confirm pass
            </h2>
            <p className="mt-3">
              Selected card: <strong>{CARD_CATALOG[priv.hand[pendingPass]!].name}</strong>
            </p>
            <label className="mt-3 grid gap-1 text-sm">
              Pass to
              <select className="bg-[var(--bg-mist)] px-3 py-2" value={priv.passTarget.playerId ?? 'unseated'} disabled>
                <option value={priv.passTarget.playerId ?? 'unseated'}>
                  {priv.passTarget.name}
                  {priv.passTarget.available ? '' : ' (unavailable)'}
                </option>
              </select>
            </label>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="bg-[var(--ember)] px-4 py-3 font-semibold text-[#1a0f0a] disabled:opacity-40"
                disabled={!priv.passTarget.available}
                onClick={() => {
                  onAction({
                    type: 'confirm_pass',
                    passIndex: pendingPass,
                    targetPlayerId: priv.passTarget?.playerId ?? 'unseated',
                    nonce: `pass-${pub.passes.length}-${pendingPass}`,
                  });
                  setPendingPass(null);
                }}
              >
                Confirm pass
              </button>
              <button type="button" className="border border-[var(--line)] px-4 py-3" onClick={() => setPendingPass(null)}>
                Cancel
              </button>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}

function ResultBlock({
  view,
  nameOf,
}: {
  view: TablePlayerView;
  nameOf: (id: string | null) => string;
}) {
  const pub = view.public;
  const headline =
    pub.winner === 'bomber'
      ? 'The Bomber wins alone'
      : pub.winner === 'guests'
        ? 'The guests win'
        : pub.winner === 'murderers'
          ? 'The Murderer wins'
          : 'Round closed';
  return (
    <div className="grid gap-3">
      <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
        {headline}
      </h2>
      <p>
        Boiler Room: {pub.lockedPlayerId ? nameOf(pub.lockedPlayerId) : 'nobody entered'}
        {pub.unseatedCard ? ` · Unseated card: ${CARD_CATALOG[pub.unseatedCard].name}` : ''}
      </p>
      {pub.abilityNotes.map((note) => (
        <p key={note} className="text-sm">
          {note}
        </p>
      ))}
      <div>
        <h3 className="font-semibold">Votes</h3>
        <ul className="text-sm">
          {Object.entries(pub.voteTotals ?? {}).map(([id, count]) => (
            <li key={id}>
              {nameOf(id)}: {count}
            </li>
          ))}
          {pub.voteTotals && Object.keys(pub.voteTotals).length === 0 && <li>No ballots counted.</li>}
        </ul>
        {pub.voteBreakdown && (
          <ul className="mt-2 text-sm text-[var(--fog)]">
            {pub.voteBreakdown.map((ballot) => (
              <li key={ballot.voterId}>
                {nameOf(ballot.voterId)} → {nameOf(ballot.targetId)} ({ballot.invalidated ? 'invalid' : `${ballot.weight}`})
              </li>
            ))}
          </ul>
        )}
        {pub.anonymousVoting && <p className="text-sm text-[var(--fog)]">Ballots were anonymous. Totals are shown without voter names.</p>}
      </div>
      <div>
        <h3 className="font-semibold">Card passes</h3>
        <ul className="text-sm text-[var(--fog)]">
          {pub.passes.map((pass, index) => (
            <li key={`${pass.at}-${index}`}>
              {CARD_CATALOG[pass.card].name} passed from {nameOf(pass.fromPlayerId)} to {nameOf(pass.toPlayerId)}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="font-semibold">Descriptions</h3>
        <ul className="text-sm">
          {pub.descriptions.map((item) => (
            <li key={item.playerId}>
              <strong>{nameOf(item.playerId)}:</strong> {item.text || '(silence)'}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="font-semibold">Scores</h3>
        <ul className="text-sm">
          {pub.players.map((player) => (
            <li key={player.id}>
              {player.name}: {pub.scores[player.id] ?? 0}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function phaseTitle(phase: string): string {
  switch (phase) {
    case 'passing':
      return 'Pass a card';
    case 'description':
      return 'Individual description';
    case 'discussion':
      return 'Group discussion';
    case 'voting':
      return 'Vote';
    case 'result':
      return 'Result';
    case 'ended':
      return 'Game over';
    default:
      return phase;
  }
}

function phaseBudget(pub: TablePlayerView['public']): number {
  if (pub.phase === 'passing') return pub.passTurnMs;
  if (pub.phase === 'description') return pub.settings.descriptionSeconds * 1000;
  if (pub.phase === 'discussion') return pub.settings.discussionSeconds * 1000;
  if (pub.phase === 'voting') return pub.settings.votingSeconds * 1000;
  return Number.POSITIVE_INFINITY;
}

function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function seatStyle(index: number, count: number): CSSProperties {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  return {
    left: `${50 + Math.cos(angle) * 38}%`,
    top: `${50 + Math.sin(angle) * 36}%`,
  };
}
