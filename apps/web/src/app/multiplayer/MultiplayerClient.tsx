'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Client, Room } from 'colyseus.js';
import type { Action, PlayerMatchView } from '@now/game-types';
import { MAX_PLAYERS, MIN_PLAYERS } from '@now/game-types';
import { GameTable } from '@/components/GameTable';
import { MatchLobby, type LobbySeat } from '@/components/match/MatchLobby';
import {
  clearMultiplayerCreds,
  gameServerHttpUrl,
  gameServerUrl,
  loadMultiplayerCreds,
  saveMultiplayerCreds,
  type MultiplayerCreds,
} from '@/lib/colyseus';

interface LobbyState {
  code: string;
  hostPlayerId: string | null;
  seats: Array<{
    playerId: string;
    name: string;
    seatIndex: number;
    connected: boolean;
  }>;
  started: boolean;
  minPlayers: number;
  maxPlayers: number;
}

interface WelcomeMsg {
  playerId: string;
  reconnectToken: string;
  code: string;
}

function randomRoomCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 6)
    .toUpperCase();
}

export function MultiplayerClient() {
  const [name, setName] = useState('Guest');
  const [joinCode, setJoinCode] = useState('');
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [view, setView] = useState<PlayerMatchView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const roomRef = useRef<Room | null>(null);
  const credsRef = useRef<MultiplayerCreds | null>(null);

  useEffect(() => {
    credsRef.current = loadMultiplayerCreds();
    return () => {
      roomRef.current?.leave();
    };
  }, []);

  useEffect(() => {
    if (!view || view.public.phase === 'result') return;
    const id = window.setInterval(() => setNow(Date.now()), 400);
    return () => window.clearInterval(id);
  }, [view?.public.phase]);

  const attachRoom = useCallback((room: Room) => {
    roomRef.current = room;
    room.onMessage('welcome', (msg: WelcomeMsg) => {
      const next: MultiplayerCreds = {
        playerId: msg.playerId,
        reconnectToken: msg.reconnectToken,
        roomId: room.roomId,
        code: msg.code,
      };
      credsRef.current = next;
      saveMultiplayerCreds(next);
      setPlayerId(msg.playerId);
    });
    room.onMessage('lobby', (msg: LobbyState) => setLobby(msg));
    room.onMessage('view', (msg: PlayerMatchView) => setView(msg));
    room.onMessage('error', (msg: { message: string }) => setError(msg.message));
    room.onMessage('match_aborted', (msg: { reason: string }) => {
      setError(msg.reason);
      setView(null);
    });
    room.onLeave(() => {
      setError('Disconnected from room');
    });
  }, []);

  async function createRoom() {
    setError(null);
    try {
      const client = new Client(gameServerUrl());
      const room = await client.create('game', {
        name: name.trim().slice(0, 24) || 'Guest',
        code: randomRoomCode(),
      });
      attachRoom(room);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create room');
    }
  }

  async function joinRoom() {
    setError(null);
    try {
      const code = joinCode.trim().toUpperCase();
      if (!code) {
        setError('Enter a room code');
        return;
      }

      const resolveRes = await fetch(`${gameServerHttpUrl()}/rooms/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!resolveRes.ok) {
        setError(resolveRes.status === 404 ? 'No room found with that code' : 'Unable to resolve room');
        return;
      }
      const { roomId } = (await resolveRes.json()) as { roomId: string };

      const client = new Client(gameServerUrl());
      const prior = credsRef.current;
      const room = await client.joinById(roomId, {
        name: name.trim().slice(0, 24) || 'Guest',
        ...(prior?.roomId === roomId
          ? { playerId: prior.playerId, reconnectToken: prior.reconnectToken }
          : {}),
      });
      attachRoom(room);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join room');
    }
  }

  function startMatch() {
    roomRef.current?.send('start');
  }

  function onAction(action: Action) {
    roomRef.current?.send('action', action);
  }

  function leaveSetup() {
    clearMultiplayerCreds();
    credsRef.current = null;
    setPlayerId(null);
    setLobby(null);
    setView(null);
  }

  if (view && playerId) {
    return (
      <GameTable
        view={view}
        selfId={playerId}
        onAction={onAction}
        statusMessage={error}
        now={now}
      />
    );
  }

  if (lobby && playerId) {
    const isHost = lobby.hostPlayerId === playerId;
    const seats: LobbySeat[] = lobby.seats.map((s, i) => ({
      id: s.playerId,
      name: s.name,
      seatIndex: s.seatIndex,
      avatarId: `avatar-${(i % 8) + 1}`,
      isHost: s.playerId === lobby.hostPlayerId,
      connected: s.connected,
      isSelf: s.playerId === playerId,
      subtitle: s.connected ? 'Connected' : 'Reconnecting',
    }));

    return (
      <MatchLobby
        modeLabel="Multiplayer"
        roomCode={lobby.code}
        seats={seats}
        minPlayers={lobby.minPlayers}
        maxPlayers={lobby.maxPlayers}
        canStart={isHost}
        startLabel="Start match"
        onStart={startMatch}
        waitingMessage={isHost ? null : 'Waiting for host to start…'}
        error={error}
      />
    );
  }

  return (
    <MatchLobby
      modeLabel="Multiplayer"
      seats={[
        {
          id: 'local',
          name: name || 'Guest',
          seatIndex: 0,
          avatarId: 'avatar-you',
          isSelf: true,
          isHost: true,
          subtitle: 'Ready to create or join',
        },
      ]}
      minPlayers={MIN_PLAYERS}
      maxPlayers={MAX_PLAYERS}
      canStart={false}
      onStart={() => undefined}
      waitingMessage="Create or join a room to fill the table."
      error={error}
      setupSlot={
        <div className="grid gap-3 border border-[var(--line)] bg-[var(--panel)] p-4">
          <label className="flex flex-col gap-1 text-sm text-[var(--fog)]">
            Display name
            <input
              className="field"
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={createRoom}
            className="bg-[var(--ember)] px-6 py-4 font-semibold text-[#1a0f0a]"
          >
            Create room
          </button>
          <label className="flex flex-col gap-1 text-sm text-[var(--fog)]">
            Room code
            <input
              className="field uppercase tracking-[0.2em]"
              value={joinCode}
              maxLength={8}
              onChange={(e) => setJoinCode(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={joinRoom}
            className="border border-[var(--fog)] px-6 py-4 font-semibold"
          >
            Join room
          </button>
          {credsRef.current && (
            <button type="button" className="text-xs text-[var(--fog-dim)] underline" onClick={leaveSetup}>
              Clear saved reconnect credentials
            </button>
          )}
        </div>
      }
    />
  );
}
