import { createServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './http';
import { RoomModel } from './roomModel';
import { GameStore } from './store';

const IDS = ['p_aaaaaa', 'p_bbbbbb', 'p_cccccc', 'p_dddddd', 'p_eeeeee'] as const;

function boot() {
  const db = new GameStore(':memory:');
  const room = new RoomModel(db, 'ROOM12');
  return { db, room };
}

function joinAll(room: RoomModel, count = 4, now = 1_000) {
  return IDS.slice(0, count).map((playerId, index) => {
    const result = room.join({
      playerId,
      name: `Player ${index + 1}`,
      connectionId: `c-${playerId}`,
      now: now + index,
    });
    if (!result.ok) throw new Error(result.error);
    return result;
  });
}

function readyAndStart(room: RoomModel, count = 4) {
  const joined = joinAll(room, count);
  for (const seat of joined) {
    expect(room.setReady(seat.playerId, true, 2_000)).toBeNull();
  }
  expect(room.start(IDS[0], 3_000)).toBeNull();
  return joined;
}

describe('lobby and sessions', () => {
  it('lets the host configure rules, blocks a short table, and starts when everyone is ready', () => {
    const { room } = boot();
    const [host, other] = joinAll(room, 2);
    expect(room.updateSettings(other!.playerId, { discussionSeconds: 90 }, 10)).toMatch(/host/i);
    expect(room.updateSettings(host!.playerId, { discussionSeconds: 90, anonymousVoting: true }, 11)).toBeNull();
    expect(room.lobbyPayload().settings.discussionSeconds).toBe(90);
    expect(room.lobbyPayload().settings.anonymousVoting).toBe(true);
    expect(room.start(host!.playerId, 12)).toMatch(/at least 4/);
    for (const playerId of [IDS[2], IDS[3]]) {
      const joined = room.join({ playerId, name: playerId, connectionId: `c-${playerId}`, now: 12 });
      expect(joined.ok).toBe(true);
    }
    expect(room.start(other!.playerId, 13)).toMatch(/host/i);
    for (const id of IDS.slice(0, 4)) expect(room.setReady(id, true, 14)).toBeNull();
    expect(room.start(host!.playerId, 15)).toBeNull();
    expect(room.viewFor(host!.playerId).mode).toBe('boiler');
    expect(room.lobbyPayload().playerCount).toBe(4);
  });

  it('rejects a stolen seat and restores the same seat with the session token', () => {
    const { room } = boot();
    const [host] = joinAll(room, 1);
    const stolen = room.join({
      playerId: host!.playerId,
      name: 'Thief',
      token: 'not-the-token',
      connectionId: 'evil',
      now: 50,
    });
    expect(stolen.ok).toBe(false);
    const missing = room.join({
      playerId: host!.playerId,
      name: 'Thief',
      connectionId: 'evil-2',
      now: 51,
    });
    expect(missing.ok).toBe(false);
    room.disconnect(host!.playerId, 'c-p_aaaaaa', 52);
    const back = room.join({
      playerId: host!.playerId,
      name: 'Player 1',
      token: host!.token,
      connectionId: 'c-new',
      now: 53,
    });
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.rejoined).toBe(true);
    expect(room.seats).toHaveLength(1);
    expect(room.seats[0]!.connected).toBe(true);
  });

  it('drops a lobby seat after the reconnect window and keeps a live seat', () => {
    const { room } = boot();
    readyAndStart(room);
    room.disconnect(IDS[0], 'c-p_aaaaaa', 5_000);
    room.expire(5_000 + 61_000);
    expect(room.seats.some((s) => s.playerId === IDS[0])).toBe(true);
    expect(room.hostPlayerId).not.toBe(IDS[0]);

    const lobby = boot();
    joinAll(lobby.room, 1);
    lobby.room.disconnect(IDS[0], 'c-p_aaaaaa', 10);
    expect(lobby.room.expire(10 + 61_000)).toBe(true);
    expect(lobby.room.seats).toHaveLength(0);
  });

  it('refuses spectators until the host allows them and refuses an overfilled table', () => {
    const { room } = boot();
    joinAll(room, 1);
    const blocked = room.join({
      playerId: 'p_ffffff',
      name: 'Watcher',
      spectate: true,
      connectionId: 'spec',
      now: 20,
    });
    expect(blocked.ok).toBe(false);
    expect(room.updateSettings(IDS[0], { allowSpectators: true, maxPlayers: 4 }, 21)).toBeNull();
    const allowed = room.join({
      playerId: 'p_ffffff',
      name: 'Watcher',
      spectate: true,
      connectionId: 'spec',
      now: 22,
    });
    expect(allowed.ok).toBe(true);
    for (const playerId of IDS.slice(1, 4)) {
      const joined = room.join({ playerId, name: playerId, connectionId: `c-${playerId}`, now: 23 });
      expect(joined.ok).toBe(true);
    }
    const extra = room.join({ playerId: 'p_gggggg', name: 'Extra', connectionId: 'x', now: 30 });
    expect(extra.ok).toBe(false);
  });
});

describe('match authority', () => {
  it('plays a boiler pass from the server and ignores forged role fields', () => {
    const { room } = boot();
    const [host] = readyAndStart(room);
    const view = room.viewFor(host!.playerId);
    expect(view.mode).toBe('boiler');
    if (view.mode !== 'boiler' || !view.view) return;
    const target = view.view.private.passTarget!;
    const before = JSON.stringify(view.view.private.hand);
    const error = room.action(
      host!.playerId,
      {
        type: 'confirm_pass',
        passIndex: 0,
        targetPlayerId: target.playerId ?? 'unseated',
        role: 'murderer',
        hand: ['murderer'],
      },
      4_000,
    );
    expect(error).toBeNull();
    const next = room.viewFor(host!.playerId);
    expect(next.mode).toBe('boiler');
    if (next.mode !== 'boiler' || !next.view) return;
    expect(JSON.stringify(next.view.private.hand)).not.toBe(before);
    expect(next.view.public.passes).toHaveLength(1);
    expect(next.view.public.revealedRoles).toBeNull();
  });

  it('keeps classic matches on the original engine', () => {
    const { room } = boot();
    joinAll(room, 4);
    expect(room.updateSettings(IDS[0], { deckType: 'classic' }, 10)).toBeNull();
    for (const id of IDS.slice(0, 4)) room.setReady(id, true, 11);
    expect(room.start(IDS[0], 12)).toBeNull();
    const view = room.viewFor(IDS[0]);
    expect(view.mode).toBe('classic');
    if (view.mode !== 'classic' || !view.view) return;
    expect(view.view.private.legalActions).toContain('keep_card');
    expect(room.action(IDS[1], { type: 'keep_card', keepIndex: 0 }, 13)).toMatch(/turn/i);
    expect(room.action(IDS[0], { type: 'keep_card', keepIndex: 0, role: 'murderer' }, 14)).toBeNull();
  });

  it('round-trips a snapshot and rejects a tampered row', () => {
    const { db, room } = boot();
    readyAndStart(room);
    const revived = new RoomModel(db, 'ROOM12');
    expect(revived.restore(9_000)).toBe(true);
    expect(revived.status).toBe('live');
    expect(revived.seats).toHaveLength(4);
    expect(revived.seats.every((s) => !s.connected)).toBe(true);
    db.db.prepare('UPDATE rooms SET payload = ? WHERE code = ?').run('{"broken":true}', 'ROOM12');
    expect(() => db.loadRoom('ROOM12')).toThrow(/integrity/);
    const again = new RoomModel(db, 'ROOM12');
    expect(again.restore(9_100)).toBe(false);
  });
});

describe('http lookup', () => {
  const servers: Array<ReturnType<typeof createServer>> = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
  });

  it('reports recoverable rooms without leaking seats', async () => {
    const db = new GameStore(':memory:');
    const room = new RoomModel(db, 'LOOK12');
    joinAll(room, 1);
    const app = createApp({ store: db, live: () => false });
    const server = createServer(app);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('no port');
    const ok = await fetch(`http://127.0.0.1:${address.port}/rooms/look12`);
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { recoverable: boolean; status: string; seats?: unknown };
    expect(body.recoverable).toBe(true);
    expect(body.status).toBe('lobby');
    expect(body.seats).toBeUndefined();
    const bad = await fetch(`http://127.0.0.1:${address.port}/rooms/no`);
    expect(bad.status).toBe(400);
    db.db.prepare('UPDATE rooms SET checksum = ? WHERE code = ?').run('deadbeef', 'LOOK12');
    const corrupt = await fetch(`http://127.0.0.1:${address.port}/rooms/LOOK12`);
    expect(corrupt.status).toBe(409);
    db.close();
  });
});
