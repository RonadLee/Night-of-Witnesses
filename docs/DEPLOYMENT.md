# Deployment

Local play needs Node.js 22 and pnpm 9. No accounts or API keys.

```bash
pnpm install
pnpm dev:web      # http://localhost:3000
pnpm dev:server   # http://localhost:2567/health
```

Copy `apps/web/.env.example` to `apps/web/.env.local` and `apps/game-server/.env.example` to `apps/game-server/.env` only if you need to change the defaults.

## Production shape

1. Build the web app and host it as a Next.js app. Set `NEXT_PUBLIC_GAME_SERVER_URL` to the public `wss://` game server before building.
2. Run `apps/game-server` from the Dockerfile. Mount a persistent disk at `/data` and set `DATA_DIR=/data`. Set `CORS_ORIGIN` to the website origin.
3. Put TLS in front of the game server so browsers on HTTPS can open the socket. The process itself speaks plain WebSocket behind that proxy.
4. Check `GET /health`, create a room, and confirm in devtools that another player's `view` payload has an empty hand.

The game server is one Node process. Rooms live in that process and are written to SQLite after each accepted action. Restarting the process drops the live sockets. A player who still has their session token can reopen the invite link; the client calls `GET /rooms/:code` and, when `recoverable` is true, creates the room again from the snapshot.

Do not scale the game server horizontally without a shared presence adapter. Two processes would not see each other's rooms. One process plus the SQLite volume is the supported setup, and it avoids any external database.

## Useful checks

```bash
pnpm test
pnpm typecheck
node scripts/mp-smoke.mjs   # game server already running
```
