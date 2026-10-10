'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Client, Room } from 'colyseus.js';
import type { Action, PlayerMatchView } from '@now/game-types';
import { GameTable } from '@/components/GameTable';
import { gameServerUrl } from '@/lib/colyseus';

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

function loadPlayerId(): string {
  const key = 'now_player_id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = `p_${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(key, id);
  return id;
}

export function MultiplayerClient() {
  const [name, setName] = useState('Guest');
  const [joinCode, setJoinCode] = useState('');
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [view, setView] = useState<PlayerMatchView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    setPlayerId(loadPlayerId());
    return () => {
      roomRef.current?.leave();
    };
  }, []);

  const attachRoom = useCallback((room: Room, pid: string) => {
    roomRef.current = room;
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
    setPlayerId(pid);
  }, []);

  async function createRoom() {
    if (!playerId) return;
    setError(null);
    try {
      const client = new Client(gameServerUrl());
      const room = await client.create('game', {
        name,
        playerId,
        code: Math.random().toString(36).slice(2, 8).toUpperCase(),
      });
      attachRoom(room, playerId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create room');
    }
  }

  async function joinRoom() {
    if (!playerId) return;
    setError(null);
    try {
      const client = new Client(gameServerUrl());
      // Join by filtering metadata code via room listing, or joinOrCreate with code
      const rooms = await client.getAvailableRooms('game');
      const match = rooms.find(
        (r) => String(r.metadata?.code ?? '').toUpperCase() === joinCode.trim().toUpperCase(),
      );
      if (!match) {
        setError('No room found with that code');
        return;
      }
      const room = await client.joinById(match.roomId, { name, playerId });
      attachRoom(room, playerId);
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

  if (view && playerId) {
    return (
      <GameTable view={view} selfId={playerId} onAction={onAction} statusMessage={error} />
    );
  }

  if (lobby && playerId) {
    const isHost = lobby.hostPlayerId === playerId;
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-5 px-4 py-12">
        <h1 className="text-4xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>
          Lobby
        </h1>
        <p className="text-2xl tracking-[0.2em] text-[var(--ember-hot)]">{lobby.code}</p>
        <ul className="space-y-2">
          {lobby.seats.map((s) => (
            <li key={s.playerId} className="border border-[var(--line)] px-3 py-2">
              {s.name}
              {s.playerId === lobby.hostPlayerId ? ' · host' : ''}
              {!s.connected ? ' · reconnecting…' : ''}
            </li>
          ))}
        </ul>
        <p className="text-sm text-[var(--fog)]">
          {lobby.seats.length}/{lobby.maxPlayers} seated · need at least {lobby.minPlayers}
        </p>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        {isHost && (
          <button
            type="button"
            className="bg-[var(--ember)] px-6 py-4 font-semibold text-[#1a0f0a] disabled:opacity-40"
            disabled={lobby.seats.length < lobby.minPlayers}
            onClick={startMatch}
          >
            Start match
          </button>
        )}
        {!isHost && <p className="text-[var(--fog-dim)]">Waiting for host to start…</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-16">
      <h1 className="text-4xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>
        Multiplayer
      </h1>
      <p className="text-[var(--fog)]">
        Create a room code for friends, or join one. Requires the game server running on port 2567.
      </p>
      <label className="flex flex-col gap-2 text-sm">
        Display name
        <input
          className="bg-[var(--bg-mist)] px-3 py-3"
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
      <div className="flex flex-col gap-2 border-t border-[var(--line)] pt-6">
        <label className="flex flex-col gap-2 text-sm">
          Room code
          <input
            className="bg-[var(--bg-mist)] px-3 py-3 uppercase tracking-[0.2em]"
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
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
    </div>
  );
}
