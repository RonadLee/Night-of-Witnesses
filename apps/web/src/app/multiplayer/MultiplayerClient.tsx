'use client';

import { useEffect, useRef, useState } from 'react';
import { Client, Room } from 'colyseus.js';
import type { Action, PlayerMatchView, TableAction, TablePlayerView, TableSettings } from '@now/game-types';
import { GameTable } from '@/components/GameTable';
import { BoilerTable } from '@/components/multiplayer/BoilerTable';
import { LobbyScreen } from '@/components/multiplayer/LobbyScreen';
import { ThemeToggle } from '@/components/multiplayer/ThemeToggle';
import type { ConnectionState, LobbyState } from '@/components/multiplayer/types';
import { gameServerHttpUrl, gameServerUrl } from '@/lib/colyseus';

interface StoredSession {
  playerId: string;
  token: string;
  code: string;
  name: string;
}

type Envelope =
  | { mode: 'boiler'; view: TablePlayerView; serverNow: number }
  | { mode: 'classic'; view: PlayerMatchView; serverNow: number }
  | { mode: null; view: null; serverNow: number };

const SESSION_KEY = 'now_mp_session';
const ID_KEY = 'now_player_id';

function loadId(): string {
  const existing = localStorage.getItem(ID_KEY);
  if (existing && /^p_[a-zA-Z0-9]{6,24}$/.test(existing)) return existing;
  const id = `p_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  localStorage.setItem(ID_KEY, id);
  return id;
}

function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function MultiplayerClient({ initialCode }: { initialCode: string }) {
  const [name, setName] = useState('Guest');
  const [joinCode, setJoinCode] = useState(initialCode);
  const [spectate, setSpectate] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [envelope, setEnvelope] = useState<Envelope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('offline');
  const roomRef = useRef<Room | null>(null);
  const idRef = useRef('');
  const nameRef = useRef(name);
  const codeRef = useRef(initialCode);
  const sessionRef = useRef<StoredSession | null>(null);
  const leaveRef = useRef(false);
  const reconnectTimer = useRef<number | null>(null);
  const attemptRef = useRef(0);
  const generation = useRef(0);

  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  useEffect(() => {
    codeRef.current = joinCode.trim().toUpperCase();
  }, [joinCode]);

  function remember(msg: { playerId: string; token: string; code: string }) {
    const next = { playerId: msg.playerId, token: msg.token, code: msg.code, name: nameRef.current };
    sessionRef.current = next;
    idRef.current = msg.playerId;
    setPlayerId(msg.playerId);
    localStorage.setItem(ID_KEY, msg.playerId);
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    const url = new URL(window.location.href);
    url.searchParams.set('room', msg.code);
    window.history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}`);
  }

  function bind(room: Room) {
    const gen = ++generation.current;
    roomRef.current = room;
    leaveRef.current = false;
    attemptRef.current = 0;
    room.onMessage('session', remember);
    room.onMessage('lobby', (msg: LobbyState) => {
      setLobby(msg);
      setConnection('live');
    });
    room.onMessage('view', (msg: Envelope) => setEnvelope(msg));
    room.onMessage('error', (msg: { message: string }) => setError(msg.message));
    room.onLeave(() => {
      if (generation.current !== gen || leaveRef.current) {
        if (leaveRef.current) setConnection('offline');
        return;
      }
      setConnection('reconnecting');
      void reconnect();
    });
    room.send('ping_view');
  }

  async function openSocket(kind: 'create' | 'join' | 'restore', spectating = false) {
    const previous = roomRef.current;
    if (previous) {
      generation.current += 1;
      previous.leave();
    }
    const client = new Client(gameServerUrl());
    const playerIdValue = idRef.current || loadId();
    idRef.current = playerIdValue;
    const payload = {
      name: nameRef.current,
      playerId: playerIdValue,
      token: sessionRef.current?.token || undefined,
      code: sessionRef.current?.code || codeRef.current,
      spectate: spectating,
    };
    const room =
      kind === 'create'
        ? await client.create('game', payload)
        : kind === 'restore'
          ? await client.create('game', { ...payload, restore: true })
          : await client.join('game', payload);
    bind(room);
  }

  async function reconnect() {
    if (leaveRef.current || !sessionRef.current?.token) {
      setConnection('offline');
      return;
    }
    const attempt = attemptRef.current + 1;
    attemptRef.current = attempt;
    if (attempt > 5) {
      setConnection('offline');
      setError('Could not reconnect. Join the room again with the same name.');
      return;
    }
    if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
    await new Promise((resolve) => {
      reconnectTimer.current = window.setTimeout(resolve, Math.min(8000, 400 * 2 ** attempt));
    });
    if (leaveRef.current) return;
    try {
      await openSocket('join');
    } catch {
      try {
        const code = sessionRef.current?.code;
        if (!code) throw new Error('missing room');
        const response = await fetch(`${gameServerHttpUrl()}/rooms/${code}`);
        const body = (await response.json()) as { recoverable?: boolean };
        if (body.recoverable) {
          await openSocket('restore');
          return;
        }
      } catch {
        /* keep trying */
      }
      void reconnect();
    }
  }

  useEffect(() => {
    const id = loadId();
    idRef.current = id;
    setPlayerId(id);
    const saved = loadSession();
    if (saved?.name) setName(saved.name);
    sessionRef.current = saved;
    if (saved && initialCode && saved.code === initialCode) {
      void openSocket('join').catch(() => setConnection('offline'));
    }
    return () => {
      leaveRef.current = true;
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
      void roomRef.current?.leave();
    };
    // Mount once. initialCode is fixed for this page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  async function createRoom() {
    sessionRef.current = null;
    setConnection('connecting');
    setError(null);
    try {
      await openSocket('create');
    } catch (reason) {
      setConnection('offline');
      setError(reason instanceof Error ? reason.message : 'Could not create a room');
    }
  }

  async function joinRoom() {
    const code = joinCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,8}$/.test(code)) {
      setError('Enter a room ID of 4 to 8 letters or numbers.');
      return;
    }
    const previous = sessionRef.current;
    sessionRef.current =
      previous?.code === code
        ? { ...previous, name }
        : { playerId: idRef.current, token: '', name, code };
    codeRef.current = code;
    setConnection('connecting');
    setError(null);
    try {
      await openSocket('join', spectate);
    } catch (reason) {
      try {
        const response = await fetch(`${gameServerHttpUrl()}/rooms/${code}`);
        const body = (await response.json()) as { recoverable?: boolean };
        if (body.recoverable && sessionRef.current?.token) {
          await openSocket('restore', spectate);
          return;
        }
      } catch {
        /* reported below */
      }
      setConnection('offline');
      setError(reason instanceof Error ? reason.message : 'Could not join that room');
    }
  }

  function leave() {
    leaveRef.current = true;
    void roomRef.current?.leave();
    roomRef.current = null;
    sessionRef.current = null;
    localStorage.removeItem(SESSION_KEY);
    setLobby(null);
    setEnvelope(null);
    setConnection('offline');
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState(null, '', url.pathname);
  }

  if (envelope?.mode === 'boiler' && envelope.view && playerId) {
    return (
      <BoilerTable
        view={envelope.view}
        serverNow={envelope.serverNow}
        selfId={playerId}
        connection={connection}
        error={error}
        onAction={(action: TableAction) => roomRef.current?.send('action', action)}
        onCommand={(type) => roomRef.current?.send('command', { type })}
        onTyping={(typing) => roomRef.current?.send('typing', { typing })}
        onLeave={leave}
      />
    );
  }

  if (envelope?.mode === 'classic' && envelope.view && playerId) {
    const phase = envelope.view.public.phase;
    const isHost = lobby?.hostPlayerId === playerId;
    return (
      <div>
        <div className="mp-top mx-auto w-full max-w-3xl px-4 pt-4">
          <span className="text-sm text-[var(--fog)]">{connection === 'live' ? 'Connected' : 'Reconnecting'}</span>
          <ThemeToggle />
          <button type="button" className="border border-[var(--line)] px-3 py-2 text-sm" onClick={leave}>
            Leave
          </button>
        </div>
        <GameTable
          view={envelope.view}
          selfId={playerId}
          statusMessage={error}
          onAction={(action: Action) => roomRef.current?.send('action', action)}
        />
        {isHost && phase === 'result' && (
          <div className="mx-auto flex max-w-3xl flex-wrap gap-2 px-4 pb-8">
            {envelope.view.public.round < envelope.view.public.maxRounds && (
              <button type="button" className="border border-[var(--line)] px-4 py-3" onClick={() => roomRef.current?.send('command', { type: 'next_round' })}>
                Next round
              </button>
            )}
            <button type="button" className="border border-[var(--line)] px-4 py-3" onClick={() => roomRef.current?.send('command', { type: 'return_lobby' })}>
              Return to lobby
            </button>
            <button type="button" className="border border-[var(--line)] px-4 py-3" onClick={() => roomRef.current?.send('command', { type: 'end_game' })}>
              End game
            </button>
          </div>
        )}
      </div>
    );
  }

  if (lobby && playerId && !lobby.started) {
    return (
      <LobbyScreen
        lobby={lobby}
        selfId={playerId}
        connection={connection}
        error={error}
        onReady={(ready) => roomRef.current?.send('ready', { ready })}
        onStart={() => roomRef.current?.send('start')}
        onSettings={(patch: Partial<TableSettings>) => roomRef.current?.send('settings', patch)}
        onLeave={leave}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-4xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>
          Multiplayer
        </h1>
        <ThemeToggle />
      </div>
      <p className="text-[var(--fog)]">
        Open a room, share the room ID, and sit down when everyone is ready. The game server keeps the rules.
      </p>
      <label className="grid gap-2 text-sm">
        Display name
        <input className="bg-[var(--bg-mist)] px-3 py-3" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
      </label>
      <button type="button" className="bg-[var(--ember)] px-6 py-4 font-semibold text-[#1a0f0a]" onClick={() => void createRoom()}>
        Create room
      </button>
      <div className="grid gap-3 border-t border-[var(--line)] pt-6">
        <label className="grid gap-2 text-sm">
          Room ID
          <input
            className="bg-[var(--bg-mist)] px-3 py-3 uppercase tracking-[0.2em]"
            value={joinCode}
            maxLength={8}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={spectate} onChange={(e) => setSpectate(e.target.checked)} />
          Join as a spectator
        </label>
        <button type="button" className="border border-[var(--fog)] px-6 py-4 font-semibold" onClick={() => void joinRoom()}>
          Join room
        </button>
      </div>
      {(connection === 'connecting' || connection === 'reconnecting') && (
        <p className="text-sm text-[var(--fog)]">{connection === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
