# External services

Multiplayer does **not** require API keys, accounts, or hosted third-party services to build or run.

| Service | Required? | What this project uses instead |
| --- | --- | --- |
| API keys | No | None |
| Cloud hosting | No for local play. Optional later for a public URL | Next.js on any Node host, game server via the Dockerfile |
| Database | No external database | Embedded SQLite (`node:sqlite`) in `DATA_DIR` |
| Authentication provider | No | Server-issued session tokens stored with the room |
| WebSocket / realtime host | No managed socket vendor | Colyseus on the game server process |
| File storage | No | Card art is static files in `apps/web/public/cards` |
| Email | No | Invite links are copied in the lobby |
| Push notifications | No | Not used |

`NEXT_PUBLIC_GAME_SERVER_URL` and `CORS_ORIGIN` are plain URLs, not secrets. Leave them at the localhost defaults for local play.

If you later put the site on Vercel and the game server on a VM, set those two URLs to the public addresses. You still do not need to create an account with a realtime vendor or a database host.
