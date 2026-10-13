import { randomBytes } from 'crypto';
import { Room, Client } from '@colyseus/core';
import {
  applyAction,
  createMatch,
  getView,
  tick,
  type MatchState,
} from '@now/game-engine';
import type { Action, MatchVariant, PlayerMatchView } from '@now/game-types';
import { MAX_PLAYERS, MIN_PLAYERS } from '@now/game-types';
import { registerRoom, unregisterRoom } from './roomRegistry';
import { validateAction } from './validateAction';

interface Seat {
  playerId: string;
  name: string;
  sessionId: string | null;
  seatIndex: number;
  connected: boolean;
  disconnectDeadline: number | null;
  /** Secret required to reclaim this seat after disconnect. Never broadcast. */
  reconnectToken: string;
}

interface JoinOptions {
  name?: string;
  playerId?: string;
  reconnectToken?: string;
}

function newToken(): string {
  return randomBytes(24).toString('base64url');
}

function newPlayerId(): string {
  return `p_${randomBytes(9).toString('base64url')}`;
}

const ALLOWED_VARIANT_KEYS = new Set([
  'deckType',
  'rounds',
  'descriptionSeconds',
  'discussionSeconds',
  'votingSeconds',
  'passDirection',
  'speech',
  'seed',
]);

function sanitizeVariant(input: Partial<MatchVariant> | undefined): Partial<MatchVariant> {
  if (!input || typeof input !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (!ALLOWED_VARIANT_KEYS.has(k)) continue;
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) continue;
      if (k === 'rounds') out[k] = Math.min(9, Math.max(1, Math.floor(v)));
      else if (k.endsWith('Seconds')) out[k] = Math.min(600, Math.max(5, Math.floor(v)));
      else if (k === 'seed') out[k] = Math.floor(v);
      else out[k] = v;
    } else if (typeof v === 'string' && v.length <= 32) {
      out[k] = v;
    } else if (typeof v === 'boolean') {
      out[k] = v;
    }
  }
  return out as Partial<MatchVariant>;
}

export class GameRoom extends Room {
  maxClients = MAX_PLAYERS;
  private seats: Seat[] = [];
  private hostPlayerId: string | null = null;
  private match: MatchState | null = null;
  private views: Map<string, PlayerMatchView> = new Map();
  private roomCode = '';
  private variant: Partial<MatchVariant> = {};
  private reconnectMs = 60_000;

  onCreate(options: { code?: string; variant?: Partial<MatchVariant> }) {
    const requested = typeof options.code === 'string' ? options.code : '';
    this.roomCode = registerRoom(requested || this.roomId.slice(0, 6), this.roomId);
    this.variant = sanitizeVariant(options.variant);
    // Do not publish join codes via realtime listing metadata
    this.setMetadata({ listed: false });
    this.setSimulationInterval((dt) => this.pump(dt), 1000);

    this.onMessage('start', (client) => this.handleStart(client));
    this.onMessage('action', (client, message: unknown) => this.handleAction(client, message));
    this.onMessage('ping_view', (client) => this.sendView(client));
  }

  onDispose() {
    unregisterRoom(this.roomId);
  }

  onJoin(client: Client, options: JoinOptions) {
    const name = (options.name ?? 'Guest').trim().slice(0, 24) || 'Guest';
    const requestedId = typeof options.playerId === 'string' ? options.playerId.slice(0, 64) : undefined;
    const token =
      typeof options.reconnectToken === 'string' ? options.reconnectToken.slice(0, 128) : undefined;

    // Reconnect only with matching secret token
    if (requestedId && token) {
      const seat = this.seats.find((s) => s.playerId === requestedId);
      if (seat && !seat.connected && seat.reconnectToken === token) {
        seat.sessionId = client.sessionId;
        seat.connected = true;
        seat.disconnectDeadline = null;
        client.userData = { playerId: seat.playerId };
        client.send('welcome', {
          playerId: seat.playerId,
          reconnectToken: seat.reconnectToken,
          code: this.roomCode,
        });
        this.broadcastLobby();
        this.sendView(client);
        return;
      }
      if (seat) {
        throw new Error('Unable to reclaim seat');
      }
    }

    // Reject hijack of an already-connected seat id
    if (requestedId && this.seats.some((s) => s.playerId === requestedId)) {
      throw new Error('Player already seated');
    }

    if (this.match) {
      throw new Error('Match already started');
    }
    if (this.seats.length >= MAX_PLAYERS) {
      throw new Error('Room full');
    }

    // Server issues identity — ignore client-chosen ids for new seats
    const playerId = newPlayerId();
    const reconnectToken = newToken();
    const seat: Seat = {
      playerId,
      name,
      sessionId: client.sessionId,
      seatIndex: this.seats.length,
      connected: true,
      disconnectDeadline: null,
      reconnectToken,
    };
    this.seats.push(seat);
    if (!this.hostPlayerId) this.hostPlayerId = playerId;
    client.userData = { playerId };
    client.send('welcome', {
      playerId,
      reconnectToken,
      code: this.roomCode,
    });
    this.broadcastLobby();
  }

  async onLeave(client: Client) {
    const playerId = client.userData?.playerId as string | undefined;
    if (!playerId) return;
    const seat = this.seats.find((s) => s.playerId === playerId);
    if (!seat) return;

    seat.connected = false;
    seat.sessionId = null;
    seat.disconnectDeadline = Date.now() + this.reconnectMs;

    if (!this.match) {
      this.seats = this.seats.filter((s) => s.playerId !== playerId);
      this.seats.forEach((s, i) => {
        s.seatIndex = i;
      });
      if (this.hostPlayerId === playerId) {
        this.hostPlayerId = this.seats[0]?.playerId ?? null;
      }
      this.broadcastLobby();
      if (this.seats.length === 0) {
        await this.disconnect();
      }
      return;
    }

    this.broadcastLobby();
  }

  private pump(_dt: number) {
    const now = Date.now();

    if (this.match) {
      const before = this.seats.length;
      this.seats = this.seats.filter(
        (s) => s.connected || (s.disconnectDeadline && s.disconnectDeadline > now),
      );
      if (this.seats.length < MIN_PLAYERS && before >= MIN_PLAYERS) {
        this.broadcast('match_aborted', { reason: 'Not enough players after disconnects' });
        this.match = null;
      } else if (this.match) {
        this.match = tick(this.match, now);
        this.pushAllViews();
      }
    }

    this.broadcastLobby();
  }

  private handleStart(client: Client) {
    const playerId = client.userData?.playerId as string;
    if (playerId !== this.hostPlayerId) {
      client.send('error', { message: 'Only host can start' });
      return;
    }
    if (this.seats.length < MIN_PLAYERS || this.seats.length > MAX_PLAYERS) {
      client.send('error', { message: `Need ${MIN_PLAYERS}-${MAX_PLAYERS} players` });
      return;
    }
    if (this.match) {
      client.send('error', { message: 'Already started' });
      return;
    }

    this.match = createMatch({
      players: this.seats.map((s, i) => ({
        id: s.playerId,
        name: s.name,
        isBot: false,
        seatIndex: s.seatIndex,
        avatarId: `avatar-${(i % 8) + 1}`,
      })),
      variant: this.variant,
    });
    this.pushAllViews();
    this.broadcast('started', { ok: true });
  }

  private handleAction(client: Client, raw: unknown) {
    if (!this.match) {
      client.send('error', { message: 'Match not started' });
      return;
    }
    const playerId = client.userData?.playerId as string;
    if (!playerId) {
      client.send('error', { message: 'Not seated' });
      return;
    }

    const validated = validateAction(raw);
    if (!validated.ok) {
      client.send('error', { message: validated.error });
      return;
    }

    try {
      const result = applyAction(this.match, playerId, validated.action as Action);
      if (!result.ok) {
        client.send('error', { message: result.error });
        return;
      }
      this.match = result.state;
      this.pushAllViews();
    } catch {
      client.send('error', { message: 'Action failed' });
    }
  }

  private pushAllViews() {
    if (!this.match) return;
    for (const seat of this.seats) {
      if (!seat.sessionId || !seat.connected) continue;
      const client = this.clients.find((c) => c.sessionId === seat.sessionId);
      if (client) this.sendView(client);
    }
  }

  private sendView(client: Client) {
    if (!this.match) return;
    const playerId = client.userData?.playerId as string;
    const view = getView(this.match, playerId);
    this.views.set(playerId, view);
    client.send('view', view);
  }

  private broadcastLobby() {
    this.broadcast('lobby', {
      code: this.roomCode,
      hostPlayerId: this.hostPlayerId,
      seats: this.seats.map((s) => ({
        playerId: s.playerId,
        name: s.name,
        seatIndex: s.seatIndex,
        connected: s.connected,
      })),
      started: Boolean(this.match),
      minPlayers: MIN_PLAYERS,
      maxPlayers: MAX_PLAYERS,
    });
  }
}
