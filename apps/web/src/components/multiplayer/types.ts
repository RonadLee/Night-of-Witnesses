import type { TableSettings } from '@now/game-types';

export interface LobbySeat {
  playerId: string;
  name: string;
  seatIndex: number;
  connected: boolean;
  ready: boolean;
  spectator: boolean;
}

export interface LobbyState {
  code: string;
  hostPlayerId: string | null;
  status: 'lobby' | 'live' | 'ended';
  mode: 'boiler' | 'classic' | null;
  started: boolean;
  settings: TableSettings;
  minPlayers: number;
  maxPlayers: number;
  playerCount: number;
  spectatorCount: number;
  scores: Record<string, number>;
  log: Array<{ at: number; text: string }>;
  canStart: boolean;
  startHint: string | null;
  seats: LobbySeat[];
}

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline';
