import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { stableStringify } from '@now/game-engine';

export function digest(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

export class GameStore {
  readonly db: DatabaseSync;

  constructor(filename: string) {
    if (filename !== ':memory:') {
      fs.mkdirSync(path.dirname(filename), { recursive: true });
    }
    this.db = new DatabaseSync(filename);
    if (filename !== ':memory:') this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        code TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        checksum TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        player_id TEXT NOT NULL,
        room_code TEXT NOT NULL,
        name TEXT NOT NULL,
        spectator INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        last_seen INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_code TEXT NOT NULL,
        player_id TEXT,
        action TEXT NOT NULL,
        detail TEXT,
        at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS audit_room ON audit_log(room_code, id);
    `);
  }

  saveRoom(code: string, status: string, payload: unknown, at: number) {
    const body = stableStringify(payload);
    const checksum = createHash('sha256').update(body).digest('hex');
    this.db
      .prepare(
        `INSERT INTO rooms (code, status, payload, checksum, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET
           status = excluded.status,
           payload = excluded.payload,
           checksum = excluded.checksum,
           updated_at = excluded.updated_at`,
      )
      .run(code, status, body, checksum, at);
  }

  loadRoom<T>(code: string): { status: string; payload: T; updatedAt: number } | null {
    const row = this.db
      .prepare('SELECT status, payload, checksum, updated_at FROM rooms WHERE code = ?')
      .get(code) as
      | { status: string; payload: string; checksum: string; updated_at: number }
      | undefined;
    if (!row) return null;
    const checksum = createHash('sha256').update(row.payload).digest('hex');
    if (checksum !== row.checksum) {
      throw new Error('Room snapshot failed its integrity check');
    }
    return { status: row.status, payload: JSON.parse(row.payload) as T, updatedAt: row.updated_at };
  }

  hasRecoverable(code: string): boolean {
    try {
      const row = this.loadRoom(code);
      return row?.status === 'lobby' || row?.status === 'live';
    } catch {
      return false;
    }
  }

  saveSession(input: {
    token: string;
    playerId: string;
    roomCode: string;
    name: string;
    spectator: boolean;
    at: number;
  }) {
    this.db
      .prepare(
        `INSERT INTO sessions (token, player_id, room_code, name, spectator, created_at, last_seen)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(token) DO UPDATE SET last_seen = excluded.last_seen, name = excluded.name`,
      )
      .run(
        input.token,
        input.playerId,
        input.roomCode,
        input.name,
        input.spectator ? 1 : 0,
        input.at,
        input.at,
      );
  }

  getSession(token: string): { playerId: string; roomCode: string; name: string; spectator: boolean } | null {
    const row = this.db
      .prepare('SELECT player_id, room_code, name, spectator FROM sessions WHERE token = ?')
      .get(token) as
      | { player_id: string; room_code: string; name: string; spectator: number }
      | undefined;
    if (!row) return null;
    return {
      playerId: row.player_id,
      roomCode: row.room_code,
      name: row.name,
      spectator: row.spectator === 1,
    };
  }

  touchSession(token: string, at: number) {
    this.db.prepare('UPDATE sessions SET last_seen = ? WHERE token = ?').run(at, token);
  }

  audit(roomCode: string, playerId: string | null, action: string, detail: string, at: number) {
    this.db
      .prepare('INSERT INTO audit_log (room_code, player_id, action, detail, at) VALUES (?, ?, ?, ?, ?)')
      .run(roomCode, playerId, action, detail.slice(0, 500), at);
  }

  listAudit(roomCode: string, limit = 50): Array<{ action: string; playerId: string | null; detail: string; at: number }> {
    const rows = this.db
      .prepare(
        'SELECT action, player_id, detail, at FROM audit_log WHERE room_code = ? ORDER BY id DESC LIMIT ?',
      )
      .all(roomCode, limit) as Array<{ action: string; player_id: string | null; detail: string; at: number }>;
    return rows.map((row) => ({
      action: row.action,
      playerId: row.player_id,
      detail: row.detail,
      at: row.at,
    }));
  }

  close() {
    this.db.close();
  }
}

export function defaultDbPath(): string {
  const dir = process.env.DATA_DIR ?? path.join(process.cwd(), 'data');
  return path.join(dir, 'now.sqlite');
}
