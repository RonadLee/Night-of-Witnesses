# Solo Mode — Testing & Performance Report

Date: 2026-10-12  
Branch: `cursor/solo-mode-enhancement-fe08`  
Context7: used React docs via `https://context7.com/websites/react_dev/llms.txt` (Context7 MCP server not available in this environment).

## Deliverables checklist

| Requirement | Status |
| --- | --- |
| Shared `MatchLobby` + circular `GameTable` for Solo and Multiplayer | Done |
| Solo lobby (AI count, difficulty, deck, timers, pass dir, rounds, special cards) | Done |
| AI roster (avatar, nickname, personality, difficulty) | Done |
| Drag/tap card pass + confirm dialog (same as MP) | Done |
| AI card passing + live feed | Done |
| Human pass confirm modal + drag/tap cards | Done |
| Description / discussion / voting timers | Done |
| AI discussion + voting by personality/difficulty | Done |
| Suspicion memory + reasoning summary | Done |
| Results + long-term stats | Done |
| Campaign leagues + unlocks | Done |
| Dark / light theme | Done |
| Autosave / manual save / resume / history | Done |
| Multiplayer code preserved | Done (shared components only) |

## Functional tests

| Case | Result |
| --- | --- |
| Engine unit suite (`pnpm test`) | Pass (see CI run) |
| AI roster uniqueness | Pass |
| Solo AI full round via `runBots` | Pass |
| Playwright: home + solo round | Pass (updated for lobby) |
| Privacy: kept roles not on public players until result | Pass |
| Multiplayer imports still typecheck | Pass |

## Performance notes

- AI decisions are pure functions (`chooseAiAction`) — O(players × sightings) per action, fine for ≤8 AI.
- Solo UI paces bots with `tick` every ~400ms (not a busy loop).
- Autosave writes compact JSON to `localStorage` after each state change.
- Stress: 1 human + 8 AI completes under unit-test `runBots` without hang (guard 600).

## Reliability

| Case | Behavior |
| --- | --- |
| Refresh mid-game | Resume via `Resume last game` (autosave) |
| Result reached | Autosave cleared; stats/history recorded once |
| Manual Save | Lobby button + in-table Save |

## Known limitations

1. Pass target is rules-fixed (chain); confirm modal shows dropdown disabled.
2. Campaign rounds >1 do not yet auto-start a second engine match (config stored; scoring accumulates per finished match).
3. Pass feed reveals **passed card types** (per product request); **kept identities** remain private until result.
4. AI chat is template-based (not LLM) for speed, privacy, and cost.
5. Context7 MCP was unavailable; docs fetched over HTTP instead.
6. Multiplayer live socket path was not expanded this turn (intentionally paused).

## How to verify locally

```bash
pnpm install
pnpm test
pnpm --filter @now/web test:e2e
pnpm dev:web
# Open /solo → configure lobby → Start night
```
