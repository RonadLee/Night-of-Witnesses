# Night of Witnesses — Game Spec (official roles)

Frozen rules for the **shared** authoritative engine used by Solo and Multiplayer.

Solo Mode differs only by replacing human seats with AI — same cards, abilities, win conditions, UI, and scoring.

## Seats

- Minimum **4**, maximum **9** players.
- Lobby cannot start outside that range.

## Official roles

| RoleId         | EN / ZH        | Win / ability summary                                                                 |
| -------------- | -------------- | ------------------------------------------------------------------------------------- |
| `murderer`     | Murderer / 殺人魔 | Wins if **not** sent to Private Room (爆鎖室). Card: avoid Private Room.             |
| `accomplice`   | Accomplice / 共犯 | Wins with Murderer.                                                                   |
| `bomber`       | Bomber / 炸彈客   | Wins **alone** if Bomber enters Private Room (voids all other victories).             |
| `butler`       | Butler / 管家     | Secretly view 2 Guests. If Murderer enters Private Room, those guests score as White. |
| `detective`    | Detective / 偵探  | Immediately send one player to Private Room; resolve win/loss (+ ability chain).      |
| `merchant`     | Merchant / 富商   | Starts with **2 tickets**. If Murderer enters, reveal + gain **+2** tickets.          |
| `lawyer`       | Lawyer / 律師     | Mark one player: if Murderer enters, reveal and that player loses **1** ticket.       |
| `guest_yellow` | Yellow Guest   | Win if Murderer enters Private Room.                                                  |
| `guest_blue`   | Blue Guest     | Win if Murderer enters Private Room.                                                  |
| `guest_red`    | Red Guest      | Win if Murderer enters Private Room.                                                  |

**Terminology:** Private Room = 爆鎖室 (card art may also say 鍋爐室 / Boiler Room — same destination).

**Murderer win note:** Official Murderer card text is “avoid Private Room / win if you did not enter.” Guest cards win when Murderer **does** enter. Engine follows that coherent ruling (not an inverted “Murderer wins by entering”).

## Deck composition

Total cards always = `playerCount + 1` (one leftover → Guest Room).

Standard build (approximate; always trimmed/filled with colored guests):

- 1× Murderer (2× in `double_murderer`)
- Accomplice at **6+** players (not with double murderer)
- Bomber when `specialCards` and **5+** players
- Core specials: Detective, Butler, Merchant, Lawyer
- Fill with Yellow / Blue / Red Guests

## Phase 1 — Card passing

Same pass-chain as before: keep one of two cards; pass the other; leftover → Guest Room.

## Phase 2 — Description + abilities

Each seat announces a sighting, then may:

- **Butler** `use_butler` — two Guest targets (private peek + silent whitening flags)
- **Detective** `use_detective` — send target to Private Room **immediately** (ends round)
- **Lawyer** `use_lawyer` — store ticket invalidation target (private)
- **Merchant** — passive tickets (no action)
- `skip_ability`

Detective may also fire during **discussion** (role reveal + sudden Private Room).

### Detective resolution

1. Send target to Private Room.
2. If target is Murderer → publicly reveal one Guest; Guest side wins.
3. Else → execute target’s special ability (Butler/Lawyer/…), chain depth capped, then resolve Private Room outcome for that target.

## Phase 3 — Discussion

Timed open chat (or gestures). Timer / `end_discussion` → voting.

## Phase 4 — Voting → Private Room

- Secret ballot for who enters the Private Room.
- Vote weight = base tickets (Merchant = 2).
- Majority locks that player into Private Room.
- Ties: one revote; still tied → random among tied.

### Win resolution

1. If Private Room occupant is **Bomber** → `winnerSide = bomber` (solo).
2. Else if occupant is **Murderer** → `winnerSide = guest_side`.
3. Else → `winnerSide = murderer_side` (Murderer + Accomplice).

### Ticket scoring modifiers (when Murderer entered)

- Merchant: +2 tickets + self reveal
- Lawyer target: −1 ticket + Lawyer reveal
- Butler whitened guests: flagged as White Guest in breakdown (silent; targets never notified)

## Privacy

- Clients only receive `getView(state, playerId)`.
- Butler peeks and Lawyer marks are private-to-actor until result reveals.
- Whitening flags never notify targets mid-round.

## Extreme variants

```ts
{ discussionSeconds, descriptionSeconds, votingSeconds, speech, murdererCount: 1 | 2, rounds, deckType, specialCards }
```
