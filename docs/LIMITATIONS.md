# Known limitations

- Solo mode is unchanged. Its roles, pass chain, and win condition are still the v1 rules in `docs/GAME_SPEC.md`.
- Classic multiplayer uses that same v1 engine. Its discussion clock snaps to 120 or 300 seconds, and its round count snaps to 1 or 3, because those are the only values the frozen variant type allows. Description length and the 10 second vote clock apply to the Boiler Room deck.
- The Boiler Room Murderer wins by staying out of the Boiler Room, matching the printed card rather than the inverted sentence in the request.
- Voice chat is not included. Discussion is text, with typing indicators and a small emoji set.
- There are no accounts. A seat is a display name plus a session token in `localStorage`. Anyone with that token can reclaim the seat until it expires.
- Anonymous votes are hidden from clients. The SQLite snapshot still stores who voted for whom, so a server operator can read them.
- The pass recipient is fixed by the direction setting. The confirm dialog shows that one legal player so a phone can pass without dragging.
- An idle pass is auto-resolved after 45 seconds. A disconnected recipient blocks a manual pass until that timer fires.
- Spectators can watch and cannot vote, pass, or chat.
- The game server is a single process. SQLite is local to its disk. A second replica will not share rooms.
- `node:sqlite` is still marked experimental in Node 22. The file format is SQLite and the checksum detects torn writes that fail the hash, not every crash mode.
- Card art is the reference print used for the rules. It is served as static images.
- The first socket messages can arrive before the browser registers handlers. The server repeats lobby, view, and session about once a second, so the table catches up without a refresh.
