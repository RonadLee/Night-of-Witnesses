import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GameRoom } from './GameRoom';

const port = Number(process.env.PORT ?? 2567);
const app = express();
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
  }),
);
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'night-of-witnesses-game-server' });
});

const server = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server }),
});

gameServer.define('game', GameRoom).enableRealtimeListing();

gameServer.listen(port);
console.log(`Night of Witnesses game server on :${port}`);
