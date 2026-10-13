'use client';

import { useMemo, useState } from 'react';
import type { Action, PlayerMatchView, RoleId } from '@now/game-types';
import { ALL_ROLE_IDS, roleLabel } from '@/lib/roleLabels';
import { CircularTable } from '@/components/match/CircularTable';
import { MatchChat } from '@/components/match/MatchChat';
import { MatchTimer } from '@/components/match/MatchTimer';
import { PassConfirmModal } from '@/components/game/PassConfirmModal';
import { PassFlyAnimation } from '@/components/game/PassFlyAnimation';
import { ResultPanel } from '@/components/game/ResultPanel';
import { RoleCardArt } from '@/components/game/RoleCardArt';
import { InGameMenu } from '@/components/InGameMenu';
import { useI18n } from '@/i18n';

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
  const { t } = useI18n();
  const { public: pub, private: priv } = view;
  const legal = new Set(priv.legalActions);
  const others = pub.players.filter((p) => p.id !== selfId);
  const phaseLabel =
    t.phases[pub.phase as keyof typeof t.phases] ?? pub.phase;
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

  function confirmPass(payload: { claimedRole: RoleId; reason: string; passToId: string }) {
    if (passCardIndex === null) return;
    // Passing card at passCardIndex means we keep the other
    const keepIndex = (1 - passCardIndex) as 0 | 1;
    onAction({
      type: 'keep_card',
      keepIndex,
      claimedRole: payload.claimedRole,
      passReason: payload.reason || `Pass to ${payload.passToId}`,
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
          <p className="text-xs tracking-[0.18em] text-[var(--fog-dim)] uppercase">{t.brand}</p>
          <h2
            className="text-2xl font-bold md:text-3xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {phaseLabel}
          </h2>
          <p className="text-sm text-[var(--fog)]">
            {t.game.round} {pub.round}/{pub.maxRounds}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <InGameMenu />
          <MatchTimer phaseEndsAt={pub.phaseEndsAt} now={now} phaseLabel={phaseLabel} />
        </div>
      </header>

      {statusMessage && (
        <p className="border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--fog)]">
          {statusMessage}
        </p>
      )}

      <div className="relative">
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
        <PassFlyAnimation
          animation={pub.lastPassAnimation}
          fromName={
            pub.lastPassAnimation
              ? nameOf(pub, pub.lastPassAnimation.fromPlayerId)
              : ''
          }
          toName={
            pub.lastPassAnimation
              ? pub.lastPassAnimation.toPlayerId === 'guest_room'
                ? 'Guest Room'
                : nameOf(pub, pub.lastPassAnimation.toPlayerId)
              : ''
          }
        />
      </div>

      {dropEnabled && priv.hand.length === 2 && (
        <section className="match-hand" aria-label="Your hand">
          <p className="mb-2 text-sm text-[var(--fog)]">{t.game.passHint}</p>
          <div className="flex flex-wrap justify-center gap-4">
            {([0, 1] as const).map((idx) => (
              <div key={idx} className="card-tile flex flex-col items-center gap-2">
                <RoleCardArt
                  role={priv.hand[idx]!}
                  size="lg"
                  selected={selectedCard === idx}
                  preview={false}
                  passLabel
                  draggable
                  onDragStart={(e) => {
                    setSelectedCard(idx);
                    e.dataTransfer.setData('text/pass-index', String(idx));
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => setDragOverSeatId(null)}
                  onClick={() => setSelectedCard(idx)}
                />
              </div>
            ))}
          </div>
          {selectedCard !== null && chainTarget && (
            <button
              type="button"
              className="mt-3 border border-[var(--fog)] px-4 py-3 text-sm"
              onClick={() => openPassConfirm(selectedCard, chainTarget.id)}
            >
              {t.game.passChain.replace('{name}', chainTarget.name)}
            </button>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3 border border-[var(--line)] bg-[var(--panel)] px-4 py-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <p className="text-xs tracking-[0.16em] text-[var(--fog-dim)] uppercase">
            {t.game.yourSecrets}
          </p>
          <p className="mt-1 text-lg">
            {t.game.role}: <strong>{priv.role ? roleLabel(priv.role) : '—'}</strong>
          </p>
          <p className="mt-1 text-sm text-[var(--fog)]">
            {t.game.tickets}: {priv.tickets}
          </p>
          {priv.butlerPeek && priv.butlerPeek.length > 0 && (
            <div className="mt-2 text-sm">
              <p className="text-[var(--fog-dim)]">Butler peek (private):</p>
              <ul className="mt-1 flex flex-wrap gap-2">
                {priv.butlerPeek.map((g) => (
                  <li key={g.playerId} className="flex items-center gap-2">
                    <span>{nameOf(pub, g.playerId)}</span>
                    <RoleCardArt role={g.role} size="xs" />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {priv.detectiveNote && (
            <p className="mt-1 text-sm text-[var(--ember-hot)]">{priv.detectiveNote}</p>
          )}
        </div>
        {priv.role && <RoleCardArt role={priv.role} size="md" />}
      </section>

      {pub.sightings.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm tracking-[0.14em] text-[var(--fog-dim)] uppercase">
            {t.game.descriptions}
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
            roles={ALL_ROLE_IDS}
            players={others}
            submitLabel={t.game.announceSighting}
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
        {legal.has('use_butler') && (
          <ButlerPicker
            players={others}
            onPick={(a, b) => onAction({ type: 'use_butler', targetA: a, targetB: b })}
          />
        )}
        {legal.has('use_detective') && (
          <TargetButtons
            label="Detective: send one player to the Private Room (爆鎖室)"
            players={others}
            onPick={(id) => onAction({ type: 'use_detective', targetPlayerId: id })}
          />
        )}
        {legal.has('use_lawyer') && (
          <TargetButtons
            label="Lawyer: invalidate one player's ticket (−1 at scoring)"
            players={others}
            onPick={(id) => onAction({ type: 'use_lawyer', targetPlayerId: id })}
          />
        )}
        {legal.has('skip_ability') && (
          <button
            type="button"
            className="border border-[var(--line)] px-4 py-3 text-[var(--fog)]"
            onClick={() => onAction({ type: 'skip_ability' })}
          >
            {t.game.skipAbility}
          </button>
        )}
        {legal.has('end_discussion') && (
          <button
            type="button"
            className="bg-[var(--ember)] px-4 py-3 font-semibold text-[#1a0f0a]"
            onClick={() => onAction({ type: 'end_discussion' })}
          >
            {t.game.endDiscussion}
          </button>
        )}
        {voteEnabled && <p className="text-sm text-[var(--fog)]">{t.game.voteHint}</p>}
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

function nameOf(pub: PlayerMatchView['public'], id: string): string {
  return pub.players.find((p) => p.id === id)?.name ?? id;
}

function SightingForm({
  roles,
  players,
  submitLabel,
  onSubmit,
}: {
  roles: RoleId[];
  players: Array<{ id: string; name: string }>;
  submitLabel: string;
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
        {submitLabel}
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

function ButlerPicker({
  players,
  onPick,
}: {
  players: Array<{ id: string; name: string }>;
  onPick: (a: string, b: string) => void;
}) {
  const [a, setA] = useState<string>(players[0]?.id ?? '');
  const [b, setB] = useState<string>(players[1]?.id ?? players[0]?.id ?? '');
  return (
    <div className="flex flex-col gap-2 border border-[var(--line)] p-3">
      <p className="text-sm text-[var(--fog)]">Butler: secretly view two Guests</p>
      <select className="field" value={a} onChange={(e) => setA(e.target.value)}>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select className="field" value={b} onChange={(e) => setB(e.target.value)}>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="bg-[var(--ember)] px-4 py-3 font-semibold text-[#1a0f0a]"
        disabled={!a || !b || a === b}
        onClick={() => onPick(a, b)}
      >
        Confirm Butler peek
      </button>
    </div>
  );
}
