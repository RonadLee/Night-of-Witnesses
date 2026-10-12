import { randomBytes } from 'node:crypto';
import {
  applyAction,
  applyTableAction,
  cleanName,
  cleanPlayerId,
  cleanText,
  createMatch,
  createTableMatch,
  getTableView,
  getView,
  mergeSettings,
  nudgeTable,
  sanitizeSettings,
  setConnected,
  setHost,
  setTyping,
  tick,
  tickTable,
  DEFAULT_TABLE_SETTINGS,
  type MatchState,
  type TableState,
} from '@now/game-engine';
import {
  MIN_PLAYERS,
  type Action,
  type MatchVariant,
  type RoleId,
  type TableAction,
  type TableSettings,
} from '@now/game-types';
import { log } from './log';
import { GameStore } from './store';

const CLASSIC_ROLES = new Set<RoleId>([
  'murderer',
  'accomplice',
  'doctor',
  'detective',
  'spy',
  'priest',
  'lawyer',
  'journalist',
  'engineer',
  'psychologist',
  'merchant',
]);

export const RECONNECT_MS = 60_000;
const SPECTATOR_CAP = 6;

export interface Seat {
  playerId: string;
  name: string;
  seatIndex: number;
  connected: boolean;
  ready: boolean;
  spectator: boolean;
  disconnectAt: number | null;
  token: string;
  connectionId: string | null;
}

export interface LobbyEvent {
  at: number;
  text: string;
}

export interface RoomSnapshot {
  code: string;
  hostPlayerId: string | null;
  settings: TableSettings;
  status: 'lobby' | 'live' | 'ended';
  mode: 'boiler' | 'classic' | null;
  table: TableState | null;
  classic: MatchState | null;
  seats: Seat[];
  lobbyLog: LobbyEvent[];
  campaignScores: Record<string, number>;
  updatedAt: number;
}

export interface JoinInput {
  playerId?: unknown;
  name?: unknown;
  token?: unknown;
  spectate?: unknown;
  connectionId: string;
  now: number;
}

function token(): string {
  return randomBytes(24).toString('hex');
}

function classicVariant(settings: TableSettings): MatchVariant {
  return {
    discussionSeconds: settings.discussionSeconds >= 200 ? 300 : 120,
    speech: 'voice-or-text',
    murdererCount: 1,
    rounds: settings.rounds >= 3 ? 3 : 1,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export class RoomModel {
  code: string;
  hostPlayerId: string | null = null;
  settings: TableSettings = sanitizeSettings(DEFAULT_TABLE_SETTINGS);
  status: RoomSnapshot['status'] = 'lobby';
  mode: RoomSnapshot['mode'] = null;
  table: TableState | null = null;
  classic: MatchState | null = null;
  seats: Seat[] = [];
  lobbyLog: LobbyEvent[] = [];
  campaignScores: Record<string, number> = {};
  private classicChatAt = new Map<string, number[]>();

  constructor(
    private readonly store: GameStore,
    code: string,
  ) {
    this.code = code.toUpperCase();
  }

  restore(now: number): boolean {
    let loaded: { payload: RoomSnapshot } | null = null;
    try {
      const row = this.store.loadRoom<RoomSnapshot>(this.code);
      if (!row || (row.status !== 'lobby' && row.status !== 'live')) return false;
      loaded = { payload: row.payload };
    } catch (error) {
      log('error', 'room.restore_rejected', { code: this.code, message: error instanceof Error ? error.message : 'bad snapshot' });
      return false;
    }
    const snap = loaded.payload;
    if (snap.code !== this.code) return false;
    this.hostPlayerId = snap.hostPlayerId;
    this.settings = sanitizeSettings(snap.settings);
    this.status = snap.status;
    this.mode = snap.mode;
    this.table = snap.table;
    this.classic = snap.classic;
    this.seats = snap.seats.map((seat) => ({ ...seat, connected: false, connectionId: null, disconnectAt: now }));
    this.lobbyLog = snap.lobbyLog ?? [];
    this.campaignScores = snap.campaignScores ?? {};
    this.note(now, 'The room was restored from its last saved state.');
    this.store.audit(this.code, null, 'restore', this.status, now);
    this.persist(now);
    return true;
  }

  join(input: JoinInput): { ok: true; playerId: string; token: string; rejoined: boolean } | { ok: false; error: string } {
    const name = cleanName(input.name);
    const requestedId = cleanPlayerId(input.playerId);
    const givenToken = typeof input.token === 'string' ? input.token : '';
    const spectate = input.spectate === true;

    if (givenToken) {
      const session = this.store.getSession(givenToken);
      if (!session || session.roomCode !== this.code) {
        this.store.audit(this.code, requestedId, 'join_rejected', 'bad token', input.now);
        return { ok: false, error: 'Session rejected' };
      }
      if (requestedId && requestedId !== session.playerId) {
        this.store.audit(this.code, requestedId, 'join_rejected', 'token mismatch', input.now);
        return { ok: false, error: 'Session rejected' };
      }
      const seat = this.seats.find((s) => s.playerId === session.playerId);
      if (!seat || seat.token !== givenToken) {
        this.store.audit(this.code, session.playerId, 'join_rejected', 'stale seat', input.now);
        return { ok: false, error: 'Session rejected' };
      }
      seat.connected = true;
      seat.disconnectAt = null;
      seat.connectionId = input.connectionId;
      seat.name = name || seat.name;
      this.afterPresence(input.now);
      this.store.touchSession(seat.token, input.now);
      this.note(input.now, `${seat.name} reconnected.`);
      this.store.audit(this.code, seat.playerId, 'reconnect', seat.spectator ? 'spectator' : 'player', input.now);
      this.persist(input.now);
      return { ok: true, playerId: seat.playerId, token: seat.token, rejoined: true };
    }

    if (requestedId && this.seats.some((s) => s.playerId === requestedId)) {
      this.store.audit(this.code, requestedId, 'join_rejected', 'missing token', input.now);
      return { ok: false, error: 'Session rejected' };
    }

    if (this.status !== 'lobby' && !spectate) {
      return { ok: false, error: 'This match has already started' };
    }
    if (spectate && !this.settings.allowSpectators) {
      return { ok: false, error: 'Spectators are turned off for this room' };
    }
    const players = this.seats.filter((s) => !s.spectator);
    const spectators = this.seats.filter((s) => s.spectator);
    if (!spectate && players.length >= this.settings.maxPlayers) {
      return { ok: false, error: 'This room is full' };
    }
    if (spectate && spectators.length >= SPECTATOR_CAP) {
      return { ok: false, error: 'The spectator seats are full' };
    }

    const playerId = requestedId ?? `p_${randomBytes(6).toString('hex')}`;
    const seat: Seat = {
      playerId,
      name,
      seatIndex: this.seats.length,
      connected: true,
      ready: false,
      spectator: spectate,
      disconnectAt: null,
      token: token(),
      connectionId: input.connectionId,
    };
    this.seats.push(seat);
    if (this.status === 'lobby') this.reindex();
    if (!this.hostPlayerId && !spectate) this.hostPlayerId = playerId;
    this.store.saveSession({
      token: seat.token,
      playerId,
      roomCode: this.code,
      name,
      spectator: spectate,
      at: input.now,
    });
    this.note(input.now, spectate ? `${name} joined as a spectator.` : `${name} joined the room.`);
    this.store.audit(this.code, playerId, 'join', spectate ? 'spectator' : 'player', input.now);
    this.persist(input.now);
    return { ok: true, playerId, token: seat.token, rejoined: false };
  }

  disconnect(playerId: string, connectionId: string, now: number) {
    const seat = this.seats.find((s) => s.playerId === playerId);
    if (!seat || seat.connectionId !== connectionId) return;
    seat.connected = false;
    seat.connectionId = null;
    seat.disconnectAt = now;
    seat.ready = false;
    this.afterPresence(now);
    this.note(now, `${seat.name} disconnected.`);
    this.store.audit(this.code, playerId, 'disconnect', this.status, now);
    this.persist(now);
  }

  expire(now: number): boolean {
    if (this.status === 'lobby') {
      const before = this.seats.length;
      this.seats = this.seats.filter((s) => s.connected || (s.disconnectAt ?? now) + RECONNECT_MS > now);
      if (this.seats.length !== before) {
        this.reindex();
        if (this.hostPlayerId && !this.seats.some((s) => s.playerId === this.hostPlayerId && !s.spectator)) {
          this.hostPlayerId = this.seats.find((s) => !s.spectator)?.playerId ?? null;
        }
        this.persist(now);
      }
      return this.seats.length === 0;
    }
    this.transferHost(now);
    return false;
  }

  setReady(playerId: string, ready: boolean, now: number): string | null {
    const seat = this.playerSeat(playerId);
    if (!seat) return 'You are not seated';
    if (seat.spectator) return 'Spectators do not ready up';
    if (this.status !== 'lobby') return 'The match has already started';
    seat.ready = ready;
    this.note(now, `${seat.name} is ${ready ? 'ready' : 'not ready'}.`);
    this.persist(now);
    return null;
  }

  updateSettings(playerId: string, patch: unknown, now: number): string | null {
    if (playerId !== this.hostPlayerId) return 'Only the host can change settings';
    if (this.status !== 'lobby') return 'Settings lock when the match starts';
    const next = mergeSettings(this.settings, patch);
    if (this.seats.filter((s) => !s.spectator).length > next.maxPlayers) {
      return 'Too many players are seated for that limit';
    }
    this.settings = next;
    for (const seat of this.seats) seat.ready = false;
    this.note(now, 'The host updated the table rules.');
    this.store.audit(this.code, playerId, 'settings', this.settings.deckType, now);
    this.persist(now);
    return null;
  }

  start(playerId: string, now: number): string | null {
    if (playerId !== this.hostPlayerId) return 'Only the host can start';
    if (this.status !== 'lobby' || this.table || this.classic) return 'The match has already started';
    const players = this.seats.filter((s) => !s.spectator);
    if (players.length < MIN_PLAYERS) return `Need at least ${MIN_PLAYERS} players`;
    if (players.length > this.settings.maxPlayers) return 'The table is over the player limit';
    if (players.some((s) => !s.connected || !s.ready)) return 'Every player must be connected and ready';

    players.forEach((s, index) => {
      s.seatIndex = index;
    });
    const seated = players.map((s) => ({
      id: s.playerId,
      name: s.name,
      seatIndex: s.seatIndex,
      isBot: false,
      connected: true,
    }));
    if (this.settings.deckType === 'classic') {
      this.classic = createMatch({
        players: seated.map((s) => ({ id: s.id, name: s.name, seatIndex: s.seatIndex, isBot: false })),
        variant: classicVariant(this.settings),
        seed: now,
        now,
      });
      for (const [id, score] of Object.entries(this.campaignScores)) {
        if (this.classic.scores[id] !== undefined) this.classic.scores[id] = score;
      }
      this.classic.round = 1;
      this.mode = 'classic';
    } else {
      this.table = createTableMatch({
        players: seated,
        settings: this.settings,
        hostPlayerId: playerId,
        seed: now,
        now,
        scores: this.campaignScores,
      });
      this.mode = 'boiler';
    }
    this.status = 'live';
    this.note(now, 'The match has started.');
    this.store.audit(this.code, playerId, 'start', this.mode, now);
    log('info', 'match.start', { code: this.code, mode: this.mode, players: players.length });
    this.persist(now);
    return null;
  }

  action(playerId: string, raw: unknown, now: number): string | null {
    const seat = this.playerSeat(playerId);
    if (!seat || seat.spectator) return 'You cannot do that from this seat';
    if (this.mode === 'boiler' && this.table) {
      const action = parseTableAction(raw);
      if (!action) return 'That action is not valid';
      const result = applyTableAction(this.table, playerId, action, now);
      if (!result.ok) {
        this.store.audit(this.code, playerId, 'action_rejected', `${action.type}: ${result.error}`, now);
        return result.error;
      }
      this.table = result.state;
      this.store.audit(this.code, playerId, action.type, 'ok', now);
      if (result.effect === 'return_lobby') this.returnToLobby(now);
      if (result.effect === 'end_game') this.status = 'ended';
      this.persist(now);
      return null;
    }
    if (this.mode === 'classic' && this.classic) {
      const action = parseClassicAction(raw);
      if (!action) return 'That action is not valid';
      if (action.type === 'chat' && !this.allowClassicChat(playerId, now)) {
        return 'You are sending messages too quickly';
      }
      const result = applyAction(this.classic, playerId, action, now);
      if (!result.ok) {
        this.store.audit(this.code, playerId, 'action_rejected', `${action.type}: ${result.error}`, now);
        return result.error;
      }
      this.classic = result.state;
      this.store.audit(this.code, playerId, action.type, 'ok', now);
      this.persist(now);
      return null;
    }
    return 'The match has not started';
  }

  command(playerId: string, type: unknown, now: number): string | null {
    if (type !== 'next_round' && type !== 'return_lobby' && type !== 'end_game') {
      return 'Unknown command';
    }
    if (playerId !== this.hostPlayerId) return 'Only the host can do that';
    if (this.mode === 'boiler') return this.action(playerId, { type }, now);
    if (!this.classic || this.classic.phase !== 'result') return 'Finish the round first';
    if (type === 'next_round') {
      if (this.classic.round >= this.classic.variant.rounds) return 'That was the last round';
      const scores = { ...this.classic.scores };
      const round = this.classic.round + 1;
      const players = this.classic.players.map((p) => ({
        id: p.id,
        name: p.name,
        isBot: false,
        seatIndex: p.seatIndex,
      }));
      this.classic = createMatch({
        players,
        variant: this.classic.variant,
        seed: now + round,
        now,
      });
      this.classic.round = round;
      for (const [id, score] of Object.entries(scores)) this.classic.scores[id] = score;
      this.persist(now);
      return null;
    }
    if (type === 'end_game') {
      this.status = 'ended';
      this.campaignScores = { ...this.classic.scores };
      this.note(now, 'The host ended the game.');
      this.persist(now);
      return null;
    }
    this.campaignScores = { ...this.classic.scores };
    this.returnToLobby(now);
    return null;
  }

  typing(playerId: string, typing: boolean) {
    const seat = this.playerSeat(playerId);
    if (!seat || !this.table) return;
    this.table = setTyping(this.table, playerId, typing);
  }

  tick(now: number): boolean {
    const empty = this.expire(now);
    if (empty) return true;
    let changed = false;
    if (this.table) {
      const ticked = tickTable(this.table, now);
      const nudged = nudgeTable(ticked, now);
      if (nudged !== this.table) {
        this.table = nudged;
        changed = true;
      }
    }
    if (this.classic) {
      const ticked = tick(this.classic, now);
      if (ticked !== this.classic) {
        this.classic = ticked;
        changed = true;
      }
    }
    if (changed) this.persist(now);
    return false;
  }

  lobbyPayload() {
    const players = this.seats.filter((s) => !s.spectator);
    const ready = players.length >= MIN_PLAYERS && players.every((s) => s.connected && s.ready);
    let startHint: string | null = null;
    if (players.length < MIN_PLAYERS) startHint = `Need at least ${MIN_PLAYERS} players`;
    else if (players.some((s) => !s.connected)) startHint = 'Wait for disconnected players, or give them a minute to drop';
    else if (players.some((s) => !s.ready)) startHint = 'Waiting for every player to ready up';
    return {
      code: this.code,
      hostPlayerId: this.hostPlayerId,
      status: this.status,
      mode: this.mode,
      started: this.status !== 'lobby',
      settings: this.settings,
      minPlayers: MIN_PLAYERS,
      maxPlayers: this.settings.maxPlayers,
      playerCount: players.length,
      spectatorCount: this.seats.filter((s) => s.spectator).length,
      scores: this.campaignScores,
      log: this.lobbyLog,
      canStart: this.status === 'lobby' && ready && players.length <= this.settings.maxPlayers,
      startHint,
      seats: this.seats.map((s) => ({
        playerId: s.playerId,
        name: s.name,
        seatIndex: s.seatIndex,
        connected: s.connected,
        ready: s.ready,
        spectator: s.spectator,
      })),
    };
  }

  viewFor(playerId: string) {
    const seat = this.seats.find((s) => s.playerId === playerId);
    if (this.table) {
      return { mode: 'boiler' as const, view: getTableView(this.table, seat?.spectator ? null : playerId) };
    }
    if (this.classic) {
      return { mode: 'classic' as const, view: getView(this.classic, seat?.spectator ? 'spectator' : playerId) };
    }
    return { mode: null, view: null };
  }

  private returnToLobby(now: number) {
    if (this.table) this.campaignScores = { ...this.table.scores };
    if (this.classic) this.campaignScores = { ...this.classic.scores };
    this.table = null;
    this.classic = null;
    this.mode = null;
    this.status = 'lobby';
    for (const seat of this.seats) seat.ready = false;
    this.note(now, 'The table returned to the lobby.');
    this.persist(now);
  }

  private transferHost(now: number) {
    const host = this.seats.find((s) => s.playerId === this.hostPlayerId);
    if (host?.connected) return;
    if (host && (host.disconnectAt ?? now) + RECONNECT_MS > now) return;
    const next = this.seats.find((s) => s.connected && !s.spectator && s.playerId !== this.hostPlayerId);
    if (!next) return;
    this.hostPlayerId = next.playerId;
    if (this.table) this.table = setHost(this.table, next.playerId);
    this.note(now, `${next.name} is now the host.`);
    this.persist(now);
  }

  private afterPresence(now: number) {
    this.syncPresence();
    if (this.table) this.table = nudgeTable(this.table, now);
  }

  private syncPresence() {
    if (!this.table) return;
    let next = this.table;
    for (const seat of this.seats) {
      if (seat.spectator) continue;
      next = setConnected(next, seat.playerId, seat.connected);
    }
    this.table = next;
  }

  private playerSeat(playerId: string): Seat | undefined {
    return this.seats.find((s) => s.playerId === playerId && !s.spectator);
  }

  private reindex() {
    this.seats.forEach((seat, index) => {
      seat.seatIndex = index;
    });
  }

  private note(at: number, text: string) {
    this.lobbyLog.push({ at, text });
    if (this.lobbyLog.length > 80) this.lobbyLog.splice(0, this.lobbyLog.length - 80);
  }

  private allowClassicChat(playerId: string, now: number): boolean {
    const recent = (this.classicChatAt.get(playerId) ?? []).filter((t) => now - t < 10_000);
    if (recent.length >= 6) return false;
    recent.push(now);
    this.classicChatAt.set(playerId, recent);
    return true;
  }

  private persist(now: number) {
    const snapshot: RoomSnapshot = {
      code: this.code,
      hostPlayerId: this.hostPlayerId,
      settings: this.settings,
      status: this.status,
      mode: this.mode,
      table: this.table,
      classic: this.classic,
      seats: this.seats,
      lobbyLog: this.lobbyLog,
      campaignScores: this.campaignScores,
      updatedAt: now,
    };
    this.store.saveRoom(this.code, this.status, snapshot, now);
  }
}

function str(value: unknown, max: number): string | null {
  const text = cleanText(value, max);
  return text || null;
}

export function parseTableAction(raw: unknown): TableAction | null {
  const src = asRecord(raw);
  if (!src || typeof src.type !== 'string') return null;
  const nonce = typeof src.nonce === 'string' ? src.nonce.slice(0, 64) : undefined;
  switch (src.type) {
    case 'confirm_pass':
      if (src.passIndex !== 0 && src.passIndex !== 1) return null;
      if (typeof src.targetPlayerId !== 'string') return null;
      return { type: 'confirm_pass', passIndex: src.passIndex, targetPlayerId: src.targetPlayerId.slice(0, 40), nonce };
    case 'save_draft':
    case 'submit_description':
      return { type: src.type, text: cleanText(src.text, 500), nonce };
    case 'chat':
      return { type: 'chat', text: cleanText(src.text, 280), nonce };
    case 'react':
      if (typeof src.messageId !== 'string' || typeof src.emoji !== 'string') return null;
      return { type: 'react', messageId: src.messageId.slice(0, 40), emoji: src.emoji, nonce };
    case 'butler_reveal':
    case 'next_round':
    case 'return_lobby':
    case 'end_game':
      return { type: src.type, nonce };
    case 'detective_lock':
    case 'cast_vote':
      if (typeof src.targetPlayerId !== 'string') return null;
      return { type: src.type, targetPlayerId: src.targetPlayerId.slice(0, 40), nonce };
    default:
      return null;
  }
}

export function parseClassicAction(raw: unknown): Action | null {
  const src = asRecord(raw);
  if (!src || typeof src.type !== 'string') return null;
  switch (src.type) {
    case 'keep_card':
      if (src.keepIndex !== 0 && src.keepIndex !== 1) return null;
      return { type: 'keep_card', keepIndex: src.keepIndex };
    case 'announce_sighting':
      if (typeof src.claimedRole !== 'string' || !CLASSIC_ROLES.has(src.claimedRole as RoleId)) return null;
      if (typeof src.claimedThroughPlayerId !== 'string') return null;
      return {
        type: 'announce_sighting',
        claimedRole: src.claimedRole as RoleId,
        claimedThroughPlayerId: src.claimedThroughPlayerId.slice(0, 40),
      };
    case 'use_doctor':
    case 'use_detective':
    case 'use_priest':
      if (typeof src.targetPlayerId !== 'string') return null;
      return { type: src.type, targetPlayerId: src.targetPlayerId };
    case 'use_spy':
    case 'skip_ability':
    case 'end_discussion':
      return { type: src.type };
    case 'chat': {
      const text = str(src.text, 280);
      if (!text) return null;
      return { type: 'chat', text };
    }
    case 'gesture':
      if (typeof src.gestureId !== 'string') return null;
      return { type: 'gesture', gestureId: cleanText(src.gestureId, 24) };
    case 'cast_vote':
      if (typeof src.targetPlayerId !== 'string') return null;
      return { type: 'cast_vote', targetPlayerId: src.targetPlayerId };
    default:
      return null;
  }
}
