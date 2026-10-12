import { Client, Room } from '@colyseus/core';
import { log } from './log';
import { claimCode, makeCode, releaseCode } from './registry';
import { RoomModel } from './roomModel';
import { store } from './storeInstance';

interface JoinOptions {
  name?: unknown;
  playerId?: unknown;
  token?: unknown;
  spectate?: unknown;
  code?: unknown;
  restore?: unknown;
}

export class GameRoom extends Room {
  maxClients = 16;
  private model!: RoomModel;
  private typingAt = new Map<string, number>();

  onCreate(options: JoinOptions) {
    const requested = typeof options.code === 'string' ? options.code.trim().toUpperCase() : '';
    const code = options.restore ? requested : makeCode();
    if (!/^[A-Z0-9]{4,8}$/.test(code) || !claimCode(code)) {
      throw new Error('Room code is unavailable');
    }
    this.model = new RoomModel(store, code);
    if (options.restore && !this.model.restore(Date.now())) {
      releaseCode(code);
      throw new Error('This room cannot be restored');
    }
    this.setMetadata({ code: this.model.code });
    Object.assign(this.listing, { code: this.model.code });
    this.setSimulationInterval(() => this.pump(), 1000);
    this.onMessage('settings', (client, message) => this.guard(client, () => this.model.updateSettings(this.pid(client), message, Date.now())));
    this.onMessage('ready', (client, message: { ready?: boolean }) =>
      this.guard(client, () => this.model.setReady(this.pid(client), message?.ready === true, Date.now())),
    );
    this.onMessage('start', (client) => this.guard(client, () => this.model.start(this.pid(client), Date.now())));
    this.onMessage('action', (client, message) => this.guard(client, () => this.model.action(this.pid(client), message, Date.now())));
    this.onMessage('command', (client, message: { type?: unknown }) =>
      this.guard(client, () => this.model.command(this.pid(client), message?.type, Date.now())),
    );
    this.onMessage('typing', (client, message: { typing?: boolean }) => this.onTyping(client, message?.typing === true));
    this.onMessage('ping_view', (client) => this.sendState(client));
    log('info', 'room.create', { code: this.model.code, restore: Boolean(options.restore) });
  }

  onJoin(client: Client, options: JoinOptions) {
    const result = this.model.join({
      playerId: options.playerId,
      name: options.name,
      token: options.token,
      spectate: options.spectate,
      connectionId: client.sessionId,
      now: Date.now(),
    });
    if (!result.ok) {
      const others = this.clients.filter((c) => c.sessionId !== client.sessionId);
      if (others.length === 0) void this.disconnect();
      throw new Error(result.error);
    }
    client.userData = { playerId: result.playerId };
    client.send('session', {
      playerId: result.playerId,
      token: result.token,
      code: this.model.code,
      rejoined: result.rejoined,
    });
    this.pushAll();
  }

  onLeave(client: Client) {
    const playerId = this.pid(client);
    if (!playerId) return;
    this.model.disconnect(playerId, client.sessionId, Date.now());
    this.pushAll();
  }

  onDispose() {
    releaseCode(this.model.code);
    log('info', 'room.dispose', { code: this.model.code });
  }

  private onTyping(client: Client, typing: boolean) {
    const playerId = this.pid(client);
    if (!playerId) return;
    const now = Date.now();
    const last = this.typingAt.get(playerId) ?? 0;
    if (now - last < 250 && typing) return;
    this.typingAt.set(playerId, now);
    this.model.typing(playerId, typing);
    this.broadcast('typing', { playerId, typing });
  }

  private guard(client: Client, run: () => string | null) {
    try {
      const error = run();
      if (error) client.send('error', { message: error });
      this.pushAll();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong';
      log('error', 'room.message', { code: this.model.code, message });
      client.send('error', { message: 'The server could not apply that action' });
    }
  }

  private pump() {
    const empty = this.model.tick(Date.now());
    if (empty) {
      void this.disconnect();
      return;
    }
    this.pushAll();
  }

  private pushAll() {
    const lobby = this.model.lobbyPayload();
    const serverNow = Date.now();
    for (const client of this.clients) {
      const playerId = this.pid(client);
      if (!playerId) continue;
      client.send('lobby', lobby);
      client.send('view', { ...this.model.viewFor(playerId), serverNow });
      this.sendSession(client, playerId);
    }
  }

  private sendState(client: Client) {
    const playerId = this.pid(client);
    if (!playerId) return;
    client.send('lobby', this.model.lobbyPayload());
    client.send('view', { ...this.model.viewFor(playerId), serverNow: Date.now() });
    this.sendSession(client, playerId);
  }

  private sendSession(client: Client, playerId: string) {
    const seat = this.model.seats.find((item) => item.playerId === playerId);
    if (!seat) return;
    client.send('session', {
      playerId,
      token: seat.token,
      code: this.model.code,
      rejoined: false,
    });
  }

  private pid(client: Client): string {
    return (client.userData?.playerId as string | undefined) ?? '';
  }
}
