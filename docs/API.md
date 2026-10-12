# Multiplayer API

The browser talks to the game server over Colyseus WebSockets. A small HTTP surface is used for health checks and room lookup. There is no third-party API.

## HTTP

| Method | Path | Response |
| --- | --- | --- |
| `GET` | `/health` | `{ "ok": true, "service": "night-of-witnesses-game-server" }` |
| `GET` | `/rooms/:code` | `{ "live": boolean, "recoverable": boolean, "status": "lobby" \| "live" \| "ended" \| null }` |

`GET /rooms/:code` does not return player names, roles, or tokens. A tampered snapshot responds with `409` and `"status": "corrupt"`. An unusable code responds with `400`.

## Socket room

Room name: `game`.

Join filters on the room code (`filterBy(['code'])`). Create always opens a new room. The server assigns the code and tells the creator.

### Client → server

| Message | Body | Who |
| --- | --- | --- |
| `settings` | Partial table settings | Host, lobby only |
| `ready` | `{ ready: boolean }` | Seated players |
| `start` | none | Host, when everyone is ready and the table has 4–max players |
| `action` | A Boiler Room action or a classic v1 action | Seated player, server rebuilds the object |
| `command` | `{ type: "next_round" \| "return_lobby" \| "end_game" }` | Host |
| `typing` | `{ typing: boolean }` | Current describer or discussion |
| `ping_view` | none | Asks for a fresh lobby, view, and session |

Boiler Room actions: `confirm_pass`, `save_draft`, `submit_description`, `chat`, `react`, `butler_reveal`, `detective_lock`, `cast_vote`, `next_round`, `return_lobby`, `end_game`.

Classic actions are the existing solo actions (`keep_card`, sightings, abilities, `chat`, `cast_vote`, …). The server drops unknown fields, including any client-supplied role.

### Server → client

| Message | Body |
| --- | --- |
| `session` | `{ playerId, token, code, rejoined }` sent only to that socket |
| `lobby` | Seats, ready flags, host, settings, counts, start hint, room log. No tokens |
| `view` | `{ mode: "boiler" \| "classic" \| null, view, serverNow }` |
| `typing` | `{ playerId, typing }` |
| `error` | `{ message }` |

`view` for Boiler Room is `getTableView`. Another player's hand, role, draft, and (when anonymous) ballot names are not included. Classic views still come from `getView`.

## Join options

```json
{ "name": "Ada", "playerId": "p_ada123456", "token": "…", "code": "AB12CD", "spectate": false, "restore": false }
```

- `playerId` must match `p_` plus 6–24 letters or digits.
- A seat that already exists requires the matching session token.
- `restore: true` on create reloads the last good snapshot after a server restart. The token must belong to that room.
- Spectators are refused unless the host enabled them. They receive the public table and cannot act.

## Defaults

| Setting | Default | Range |
| --- | --- | --- |
| Players | 4–9 | Minimum stays 4 |
| Description | 30 seconds | 10–180 |
| Discussion | 120 seconds | 30–600 |
| Voting | 10 seconds | 5–120 |
| Rounds | 1 | 1–5 |
| Pass direction | Clockwise | Clockwise, counter-clockwise, random |
| Special cards | On | Host can disable or pick a custom set |
| Spectators | Off | |
| Anonymous voting | Off | |
| Pass turn timer | 45 seconds | Fixed, so an idle seat cannot stall the table |
