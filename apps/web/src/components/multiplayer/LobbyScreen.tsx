'use client';

import { SPECIAL_ROLES, type SpecialRole, type TableSettings } from '@now/game-types';
import { useEffect, useState } from 'react';
import { ThemeToggle } from './ThemeToggle';
import type { ConnectionState, LobbyState } from './types';

const SPECIAL_LABELS: Record<SpecialRole, string> = {
  bomber: 'Bomber',
  accomplice: 'Accomplice',
  butler: 'Butler',
  detective: 'Detective',
  merchant: 'Merchant',
  lawyer: 'Lawyer',
};

export function LobbyScreen({
  lobby,
  selfId,
  connection,
  error,
  onReady,
  onStart,
  onSettings,
  onLeave,
}: {
  lobby: LobbyState;
  selfId: string;
  connection: ConnectionState;
  error: string | null;
  onReady: (ready: boolean) => void;
  onStart: () => void;
  onSettings: (patch: Partial<TableSettings>) => void;
  onLeave: () => void;
}) {
  const me = lobby.seats.find((s) => s.playerId === selfId);
  const isHost = lobby.hostPlayerId === selfId;
  const [copied, setCopied] = useState('');

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
    } catch {
      setCopied('Copy failed');
    }
  }

  const invite =
    typeof window === 'undefined' ? '' : `${window.location.origin}/multiplayer?room=${lobby.code}`;

  return (
    <div className="mp-shell">
      <header className="mp-top">
        <div>
          <p className="text-xs tracking-[0.18em] text-[var(--fog-dim)] uppercase">Waiting room</p>
          <h1 className="text-4xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>
            Room {lobby.code}
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
        <section className="mp-panel p-4" aria-labelledby="players-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <h2 id="players-heading" className="text-xl font-bold">
              {lobby.playerCount} players
              {lobby.spectatorCount > 0 ? ` · ${lobby.spectatorCount} watching` : ''}
            </h2>
            <p className="text-sm text-[var(--fog)]">
              {lobby.minPlayers}–{lobby.maxPlayers} seated
            </p>
          </div>
          <ul className="space-y-2">
            {lobby.seats.map((seat) => (
              <li key={seat.playerId} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] px-3 py-3">
                <span>
                  <span className={`mp-dot ${seat.connected ? 'on' : ''}`} aria-hidden />{' '}
                  <strong>{seat.name}</strong>
                  {seat.playerId === selfId ? ' (you)' : ''}
                  {seat.playerId === lobby.hostPlayerId ? ' · Host' : ''}
                  {seat.spectator ? ' · Spectator' : ''}
                </span>
                <span className="text-sm text-[var(--fog)]">
                  {seat.spectator ? 'Watching' : seat.connected ? (seat.ready ? 'Ready' : 'Not ready') : 'Offline'}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="border border-[var(--line)] px-3 py-2 text-sm" onClick={() => copy(lobby.code, 'Code copied')}>
              Copy room ID
            </button>
            <button type="button" className="border border-[var(--line)] px-3 py-2 text-sm" onClick={() => copy(invite, 'Invite copied')}>
              Copy invite link
            </button>
            {copied && <span className="self-center text-sm text-[var(--fog)]">{copied}</span>}
          </div>
          {lobby.log.length > 0 && (
            <ul className="mt-4 max-h-36 space-y-1 overflow-auto text-sm text-[var(--fog)]" aria-label="Room events">
              {lobby.log.slice(-8).map((entry) => (
                <li key={`${entry.at}-${entry.text}`}>{entry.text}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="mp-panel p-4" aria-labelledby="rules-heading">
          <h2 id="rules-heading" className="text-xl font-bold">
            Table rules
          </h2>
          <p className="mt-1 text-sm text-[var(--fog)]">
            {isHost ? 'Changes reach everyone in the room immediately.' : 'The host controls these rules.'}
          </p>
          <SettingsForm settings={lobby.settings} locked={!isHost} onSettings={onSettings} />
          {lobby.settings.deckType === 'classic' && (
            <p className="mt-3 text-sm text-[var(--fog)]">
              Classic Witnesses keeps the original pass, sighting, and vote rules. Description length and the 10-second vote clock apply to the Boiler Room deck.
            </p>
          )}
        </section>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-[var(--danger)] px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <div className="mp-row">
        {!me?.spectator && (
          <button
            type="button"
            className="bg-[var(--ember)] px-5 py-3 font-semibold text-[#1a0f0a]"
            onClick={() => onReady(!me?.ready)}
          >
            {me?.ready ? 'Not ready' : 'Ready'}
          </button>
        )}
        {isHost && (
          <button
            type="button"
            className="border border-[var(--ember)] px-5 py-3 font-semibold disabled:opacity-40"
            disabled={!lobby.canStart}
            onClick={onStart}
          >
            Start game
          </button>
        )}
        {!isHost && <p className="self-center text-sm text-[var(--fog)]">Waiting for the host to start.</p>}
        {isHost && lobby.startHint && <p className="self-center text-sm text-[var(--fog)]">{lobby.startHint}</p>}
      </div>
    </div>
  );
}

function SettingsForm({
  settings,
  locked,
  onSettings,
}: {
  settings: TableSettings;
  locked: boolean;
  onSettings: (patch: Partial<TableSettings>) => void;
}) {
  return (
    <fieldset disabled={locked} className="mt-4 grid gap-3 disabled:opacity-70">
      <label className="grid gap-1 text-sm">
        Maximum players
        <select
          className="bg-[var(--bg-mist)] px-3 py-2"
          value={settings.maxPlayers}
          onChange={(e) => onSettings({ maxPlayers: Number(e.target.value) })}
        >
          {[4, 5, 6, 7, 8, 9].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Card deck
        <select
          className="bg-[var(--bg-mist)] px-3 py-2"
          value={settings.deckType}
          onChange={(e) => onSettings({ deckType: e.target.value as TableSettings['deckType'] })}
        >
          <option value="boiler">Boiler Room cards</option>
          <option value="classic">Classic Witnesses</option>
        </select>
      </label>
      <NumberField label="Individual description (seconds)" value={settings.descriptionSeconds} min={10} max={180} onCommit={(value) => onSettings({ descriptionSeconds: value })} />
      <NumberField label="Group discussion (seconds)" value={settings.discussionSeconds} min={30} max={600} onCommit={(value) => onSettings({ discussionSeconds: value })} />
      <NumberField label="Voting (seconds)" value={settings.votingSeconds} min={5} max={120} onCommit={(value) => onSettings({ votingSeconds: value })} />
      <NumberField label="Rounds" value={settings.rounds} min={1} max={5} onCommit={(value) => onSettings({ rounds: value })} />
      <label className="grid gap-1 text-sm">
        Pass direction
        <select
          className="bg-[var(--bg-mist)] px-3 py-2"
          value={settings.passDirection}
          onChange={(e) => onSettings({ passDirection: e.target.value as TableSettings['passDirection'] })}
        >
          <option value="clockwise">Clockwise</option>
          <option value="counter-clockwise">Counter-clockwise</option>
          <option value="random">Random</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={settings.specialCards} onChange={(e) => onSettings({ specialCards: e.target.checked })} />
        Special cards
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.customCardSet}
          disabled={!settings.specialCards}
          onChange={(e) => onSettings({ customCardSet: e.target.checked })}
        />
        Custom card set
      </label>
      {settings.customCardSet && settings.specialCards && (
        <div className="mp-row" role="group" aria-label="Special cards in the deck">
          {SPECIAL_ROLES.map((role) => {
            const on = settings.enabledSpecials.includes(role);
            return (
              <button
                key={role}
                type="button"
                aria-pressed={on}
                className="border border-[var(--line)] px-3 py-2 text-sm"
                onClick={() => {
                  const enabledSpecials = on
                    ? settings.enabledSpecials.filter((item) => item !== role)
                    : [...settings.enabledSpecials, role];
                  onSettings({ enabledSpecials });
                }}
              >
                {SPECIAL_LABELS[role]}
              </button>
            );
          })}
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={settings.allowSpectators} onChange={(e) => onSettings({ allowSpectators: e.target.checked })} />
        Allow spectators
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={settings.anonymousVoting} onChange={(e) => onSettings({ anonymousVoting: e.target.checked })} />
        Anonymous voting
      </label>
    </fieldset>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <input
        className="bg-[var(--bg-mist)] px-3 py-2"
        inputMode="numeric"
        min={min}
        max={max}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onCommit(Number(text))}
      />
    </label>
  );
}

export function ConnectionPill({ connection }: { connection: ConnectionState }) {
  const label =
    connection === 'live' ? 'Connected' : connection === 'reconnecting' ? 'Reconnecting' : connection === 'offline' ? 'Offline' : 'Connecting';
  return (
    <span className="inline-flex items-center gap-2 text-sm text-[var(--fog)]">
      <span className={`mp-dot ${connection === 'live' ? 'on' : connection === 'reconnecting' ? 'talk' : ''}`} aria-hidden />
      {label}
    </span>
  );
}
