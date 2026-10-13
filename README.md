# Night of Witnesses

A browser social-deduction game (4–9 players) with **Solo** (vs bots) and **Multiplayer** (live rooms). The authoritative rules live in `packages/game-engine`; clients only receive `getView(state, playerId)`.

## Stack

| Piece | Tech |
| --- | --- |
| Web UI | Next.js 15 + Tailwind CSS 4 |
| Rules | `@now/game-engine` (TypeScript + Vitest) |
| Solo AI | Personalities + difficulty + suspicion memory |
| Multiplayer | Colyseus WebSocket rooms |
| Hosting | Vercel (web) + Railway/Fly/Docker (game server) |

See [docs/GAME_SPEC.md](docs/GAME_SPEC.md) for frozen rules and [docs/SOLO_TESTING_REPORT.md](docs/SOLO_TESTING_REPORT.md) for Solo Mode QA.

## Prerequisites

- Node.js 20+ (22 recommended)
- [pnpm](https://pnpm.io/) 9+

## Setup

```bash
pnpm install
```

## Develop

```bash
# Terminal A — website
pnpm dev:web

# Terminal B — multiplayer server
pnpm dev:server
```

- Web: http://localhost:3000  
- Game server health: http://localhost:2567/health  

Optional: set `NEXT_PUBLIC_GAME_SERVER_URL=ws://localhost:2567` in `apps/web/.env.local`.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm test` | Engine unit tests |
| `pnpm typecheck` | TypeScript across packages |
| `pnpm --filter @now/web test:e2e` | Playwright smoke (solo round) |
| `pnpm build` | Build all workspaces |

## Cursor tips (first-time)

Install recommended extensions (ESLint, Prettier, Tailwind IntelliSense). Keep prompts narrow: one phase or one package per Agent turn. Do not paste `node_modules` into chat.

## Deploy

1. **Web:** Import the GitHub repo in Vercel; root or `apps/web` with pnpm workspaces. Set `NEXT_PUBLIC_GAME_SERVER_URL` to your public `wss://` game server.
2. **Game server:** Deploy `apps/game-server` with the provided Dockerfile (Railway/Fly). Set `CORS_ORIGIN` to your Vercel URL. Confirm `/health`.
3. Friends test: open DevTools → Network on two browsers; confirm another player’s role never appears in `view` payloads.

## Project layout

```
apps/web                 Next.js UI (Solo + Multiplayer)
apps/game-server         Colyseus authoritative rooms
packages/game-engine     Phases, actions, bots, tests
packages/game-types      Shared types
docs/GAME_SPEC.md        Frozen rules
```
