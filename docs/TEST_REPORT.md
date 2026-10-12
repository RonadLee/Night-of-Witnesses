# Test report

Run on 2026-10-12 with Node.js 22.14.

## Functional

`pnpm test` — 43 tests, all passing.

| Suite | Tests | What it covers |
| --- | --- | --- |
| `packages/game-engine/src/engine.test.ts` | 16 | Existing solo rules, unchanged |
| `packages/game-engine/src/table/table.test.ts` | 19 | Deck build, pass target checks, duplicate pass and nonce replay, disconnect during a pass, description draft and timeout, chat rate limit, Butler reveal, Detective lock, Merchant weight 2, Lawyer invalidation, Bomber solo win, Murderer escape, vote timeout, anonymous ballots, hidden hands |
| `apps/game-server/src/roomModel.test.ts` | 8 | Host settings, ready gate, stolen session token, reconnect, lobby expiry, live seat retention, host transfer, spectators, full room, forged role field, classic engine path, snapshot restore, tampered checksum, HTTP room lookup without leaking seats |

`node scripts/mp-smoke.mjs` against a live server: four Colyseus clients joined one room, readied, started, and passed a card. The second client’s private hand was empty. The activity line was `Detective passed from Ada to Player 2.`

## Performance

The engine test “plays nine seats of chat and votes quickly” runs a 9-player pass, 40 chat messages, and a vote in under 500 ms. The game server test round-trips a full snapshot through SQLite in the same run.

## Security

Covered in the suites above:

- A second connection cannot take a seat without the session token.
- A client-supplied `role` on a pass or keep is ignored.
- Views omit other players’ hands and, until the result, their roles.
- Anonymous results omit voter names.
- Chat and reactions are rate limited. Text is trimmed, length-capped, and stripped of control characters.
- A snapshot with a bad SHA-256 is refused and `GET /rooms/:code` returns 409.

## Reliability

- JSON round-trip of a table keeps the same fingerprint until a role is edited.
- Restore marks every seat disconnected and requires the original token to sit back down.
- Lobby seats drop after 60 seconds offline. Live seats stay so a refresh can reclaim them.
- The smoke client receives repeated lobby and view messages after the initial handshake.

## Not automated here

Chrome (Playwright, headless) against the dev servers: host created a room, three guests joined from the invite URL on a 390×844 viewport, all four readied, the host started, and the current player confirmed a card pass. The activity feed showed `Murderer passed from Ada to Bo`, the turn highlight moved, and both dark and light lobby themes rendered. Desktop and mobile table layouts rendered without page errors.

There is no load test beyond nine local seats, and no chaos test that kills the process mid-write. A crash that corrupts the SQLite page would fail the checksum and refuse restore rather than deal a broken deck.
