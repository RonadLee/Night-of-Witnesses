import http from 'http';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GameRoom } from './GameRoom';
import { createApp } from './http';
import { log } from './log';

const port = Number(process.env.PORT ?? 2567);
const app = createApp();
const server = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server }),
});

gameServer.define('game', GameRoom).filterBy(['code']);

gameServer
  .listen(port)
  .then(() => log('info', 'server.listen', { port }))
  .catch((error: unknown) => {
    log('error', 'server.listen_failed', { message: error instanceof Error ? error.message : 'listen failed' });
    process.exit(1);
  });
