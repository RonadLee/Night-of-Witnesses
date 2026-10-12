import express, { type Express } from 'express';
import cors from 'cors';
import { cleanRoomCode } from '@now/game-engine';
import { isLive } from './registry';
import { store as defaultStore, type GameStore } from './storeInstance';

export function createApp(deps?: { store?: GameStore; live?: (code: string) => boolean }): Express {
  const store = deps?.store ?? defaultStore;
  const live = deps?.live ?? isLive;
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '20kb' }));
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(',').map((item) => item.trim()).filter(Boolean) ?? true,
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'night-of-witnesses-game-server' });
  });

  app.get('/rooms/:code', (req, res) => {
    const code = cleanRoomCode(req.params.code);
    if (!code) {
      res.status(400).json({ error: 'Invalid room code' });
      return;
    }
    let recoverable = false;
    let status: string | null = null;
    try {
      const row = store.loadRoom(code);
      status = row?.status ?? null;
      recoverable = !live(code) && (status === 'lobby' || status === 'live');
    } catch {
      res.status(409).json({ live: live(code), recoverable: false, status: 'corrupt' });
      return;
    }
    res.json({ live: live(code), recoverable, status });
  });

  return app;
}
