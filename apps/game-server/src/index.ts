import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GameRoom } from './GameRoom';
import { resolveRoomId } from './roomRegistry';

const port = Number(process.env.PORT ?? 2567);
const isProd = process.env.NODE_ENV === 'production';
const corsOrigins = process.env.CORS_ORIGIN?.split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (isProd && (!corsOrigins || corsOrigins.length === 0)) {
  console.error('CORS_ORIGIN must be set in production');
  process.exit(1);
}

const app = express();
app.use(
  cors({
    origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : true,
  }),
);
app.use(express.json({ limit: '4kb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

/** Resolve private room codes without enabling public realtime listing. */
const resolveHits = new Map<string, { count: number; resetAt: number }>();
app.post('/rooms/resolve', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const bucket = resolveHits.get(ip) ?? { count: 0, resetAt: now + 60_000 };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + 60_000;
  }
  bucket.count += 1;
  resolveHits.set(ip, bucket);
  if (bucket.count > 60) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  const code = typeof req.body?.code === 'string' ? req.body.code : '';
  const roomId = resolveRoomId(code);
  if (!roomId) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  res.json({ roomId });
});

const server = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server }),
});

// Public listing disabled — join via /rooms/resolve + joinById
gameServer.define('game', GameRoom);

gameServer.listen(port);
console.log(`Night of Witnesses game server on :${port}`);
