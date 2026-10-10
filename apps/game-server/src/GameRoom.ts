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

interface Seat {
  playerId: string;
  name: string;
  sessionId: string | null;
  seatIndex: number;
  connected: boolean;
  disconnectDeadline: number | null;
}

interface JoinOptions {
  name?: string;
  playerId?: string;
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
    this.roomCode = options.code ?? this.roomId.slice(0, 6).toUpperCase();
    this.variant = options.variant ?? {};
    this.setMetadata({ code: this.roomCode });
    this.setSimulationInterval((dt) => this.pump(dt), 1000);

    this.onMessage('start', (client) => this.handleStart(client));
    this.onMessage('action', (client, message: Action) => this.handleAction(client, message));
    this.onMessage('ping_view', (client) => this.sendView(client));
  }

  onJoin(client: Client, options: JoinOptions) {
    const name = (options.name ?? 'Guest').trim().slice(0, 24) || 'Guest';
    const requestedId = options.playerId;

    // Reconnect to existing seat
    if (requestedId) {
      const seat = this.seats.find((s) => s.playerId === requestedId);
      if (seat && !seat.connected) {
        seat.sessionId = client.sessionId;
        seat.connected = true;
        seat.disconnectDeadline = null;
        client.userData = { playerId: seat.playerId };
        this.broadcastLobby();
        this.sendView(client);
        return;
      }
    }

    if (this.match) {
      throw new Error('Match already started');
    }
    if (this.seats.length >= MAX_PLAYERS) {
      throw new Error('Room full');
    }

    const playerId = requestedId ?? `p_${client.sessionId}`;
    const seat: Seat = {
      playerId,
      name,
      sessionId: client.sessionId,
      seatIndex: this.seats.length,
      connected: true,
      disconnectDeadline: null,
    };
    this.seats.push(seat);
    if (!this.hostPlayerId) this.hostPlayerId = playerId;
    client.userData = { playerId };
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
      // Remove from lobby immediately
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

    // Drop timed-out reconnects mid-match
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
      players: this.seats.map((s) => ({
        id: s.playerId,
        name: s.name,
        isBot: false,
        seatIndex: s.seatIndex,
      })),
      variant: this.variant,
    });
    this.pushAllViews();
    this.broadcast('started', { ok: true });
  }

  private handleAction(client: Client, action: Action) {
    if (!this.match) {
      client.send('error', { message: 'Match not started' });
      return;
    }
    const playerId = client.userData?.playerId as string;
    const result = applyAction(this.match, playerId, action);
    if (!result.ok) {
      client.send('error', { message: result.error });
      return;
    }
    this.match = result.state;
    this.pushAllViews();
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
