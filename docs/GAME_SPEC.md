# Night of Witnesses — Game Spec (v1)

Frozen rules for the authoritative engine. UI must not invent alternate outcomes.

## Seats

- Minimum **4**, maximum **9** players.
- Lobby cannot start outside that range.

## Deck composition (standard mode)

| Players | Murderer | Accomplice | Witness professions | Extra (Guest leftover) |
| ------- | -------- | ---------- | ------------------- | ---------------------- |
| 4       | 1        | 0          | 3                   | 1                      |
| 5       | 1        | 0          | 4                   | 1                      |
| 6       | 1        | 1          | 4                   | 1                      |
| 7       | 1        | 1          | 5                   | 1                      |
| 8       | 1        | 1          | 6                   | 1                      |
| 9       | 1        | 1          | 7                   | 1                      |

Total cards always = `playerCount + 1` so one card remains for the Guest Room after the pass chain.

**v1 Witness pool (implemented):** Doctor, Detective, Spy, Priest (cycled to fill seats).

**Deferred (not in v1 engine abilities):** Lawyer, Journalist, Engineer, Psychologist, Merchant.

In **Double Murderer** extreme mode (`murdererCount: 2`): two Murderer cards, zero Accomplices; Witness count adjusts so totals still equal `playerCount + 1`.

## Phase 1 — Role assignment (pass chain)

1. Shuffle the deck with a seeded RNG.
2. Deal one “start” card to player 0’s hand from the deck.
3. For each player seat `i` clockwise:
   - Draw one card from the deck into their hand (now 2 cards: received + drawn).
   - Player chooses **keepIndex** `0` or `1`.
   - The other card is passed to the next player (or to Guest Room after the last seat).
4. Final leftover card becomes **Guest Room** (neutral, hidden).
5. Each player’s kept card is their secret role for the round.

## Phase 2 — Information exchange

- Each player, in seat order, must announce one structured sighting:
  - `"I saw the {role} card pass through {player}"`
  - Content may be true or false (Murderer/Accomplice may fabricate).
- Optional once-per-round abilities (v1):
  - **Doctor:** Confirm whether a target is **not** the Murderer (yes/no: `isMurderer`).
  - **Detective:** Force reveal of the card that player **passed** during Phase 1 (if none, reveal kept role as fallback is **not** allowed — if no pass recorded, ability fails closed).
  - **Spy:** Peek Guest Room card privately. If it is Murderer, force immediate showdown (Murderers win if Murderer is in Guest Room — witnesses failed to seat the killer; treat as Murderer side win for scoring clarity: Guest Room Murderer means no seated Murderer was locked; **ruling:** Spy reveal of Guest Room Murderer ends round with **murderers win** only if a seated player is Murderer and was not locked; if Guest Room holds Murderer, there is still a seated Murderer from deck rules… Actually deck has exactly `murdererCount` Murderer cards. If Guest Room is Murderer, one Murderer is not seated. **Ruling:** Spy finding Murderer in Guest Room triggers showdown announcement; round continues to vote unless variant says otherwise. v1: announce peek privately; public flag `guestRoomPeeked` without revealing card to others.
  - **Priest:** Silence one player for discussion (they cannot chat). If the silenced player is later locked and is Murderer, Priest’s vote counts double (implemented as +1 extra ballot weight for Priest when they vote for that Murderer).

Players may `skip_ability` after or instead of using an ability (sighting is still required).

## Phase 3 — Discussion

- Default **300 seconds** (Time Pressure: **120**).
- Players may accuse/defend via text chat (or gestures in Silent Witness mode).
- Host or timer can move to voting (`end_discussion` / tick expiry).

## Phase 4 — Voting

- Secret ballot: each living (all) player casts one vote for who enters the Boiler Room.
- **Majority** of cast votes decides the locked player.
- If locked player’s role is **Murderer** → Witnesses win.
- Otherwise → Murderer + Accomplices win **immediately**.
- **Ties:** no lock; automatic **one revote**. If still tied, pick uniformly at random among tied candidates.

## Scoring (optional 3-round Extreme)

- Witness win: +2 each Witness-aligned player.
- Murderer win: +3 each Murderer-aligned player (Murderer + Accomplice).
- Highest score after configured rounds = overall winner (UI only until persistence exists).

## Privacy

- Clients receive only `getView(state, playerId)`.
- Never send other players’ roles, the raw deck, or Guest Room card except to Spy via private view.

## Extreme variants (flags only)

```ts
{ discussionSeconds: 300 | 120, speech: 'voice-or-text' | 'gestures-only', murdererCount: 1 | 2, rounds: 1 | 3 }
```
