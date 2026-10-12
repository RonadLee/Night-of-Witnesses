# Boiler Room deck

Used when the host leaves the deck on **Boiler Room cards**. Solo, and a multiplayer room set to **Classic Witnesses**, keep the frozen rules in `docs/GAME_SPEC.md`.

The printed cards are the source for this deck. A few English lines in the original request described the Murderer as winning by entering the Boiler Room. The card says the opposite, and the Accomplice card agrees with it, so the engine follows the print.

## Win conditions

- **Murderer** — wins by staying out of the Boiler Room.
- **Accomplice** — the Murderer's assistant. Wins when the Murderer stays out.
- **Bomber** — if the Bomber is the one sent in, the Bomber wins alone and every other victory is void.
- **Butler, Detective, Merchant, Lawyer, and Guests** (red, blue, yellow) — win when the Murderer enters the Boiler Room.

Resolution order: Bomber entry first, then Murderer entry (guests win), otherwise the Murderer side wins. An empty ballot sends nobody in, so the Murderer wins.

## Deal and passing

The deck has one more card than there are players, so the last pass is set aside. Each turn a player holds two cards, chooses one, and confirms the only legal recipient:

- Clockwise and counter-clockwise follow the seat order.
- Random shuffles the order once, from the match seed.
- The client cannot choose a different player. A disconnected recipient rejects a manual pass. When the 45 second turn timer ends, the server passes the second card anyway so the table continues.
- The activity feed names the card that moved. The kept card stays secret until the result.

Special cards fill in this order after the Murderer: Bomber, Accomplice (6+ players), Butler, Detective, Merchant, Lawyer. At least one guest card remains. Turning specials off leaves the Murderer and guests. A custom set uses only the checked specials.

Two extra guest cards are set aside as the guests who leave first. They are not dealt. Only a player holding or keeping the Butler can see them, until the Butler reveals or the result is shown.

## Phases

1. **Passing** — one player at a time.
2. **Individual description** — 30 seconds by default. Only the active player can write. Drafts are saved on the server. Time expiry submits the draft, including an empty one.
3. **Group discussion** — 2 minutes by default. Everyone can chat. Six messages per 10 seconds, and the same text cannot be repeated within 3 seconds. Emoji reactions are limited to a fixed set. The Butler may reveal, show the two departed guests, and lose their vote. The Detective may reveal and send one player straight to the result.
4. **Voting** — 10 seconds by default. One vote each. The Butler who revealed cannot vote. Disconnected players do not block the count. A tie revotes once, then a seeded pick breaks it.
5. **Result** — votes, winner, roles, passes, descriptions, and scores. The host can start the next round, return to the lobby, or end the game.

## Scoring

- Guests win: each guest-aligned player scores 2. The Murderer, Accomplice, and Bomber score 0.
- Murderer wins: Murderer and Accomplice score 3.
- Bomber wins alone: the Bomber scores 5 and nobody else scores that round.

## Merchant and Lawyer

After ballots open, both are named.

- The Merchant's ballot counts as 2.
- The player the Lawyer voted for has their own ballot invalidated.

Anonymous voting still publishes those two ability notes, because the cards say those players are revealed. Other voter names stay off the client view. The server snapshot keeps the full ballots for the audit log.
