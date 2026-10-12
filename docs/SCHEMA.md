# Database schema

The game server stores one SQLite file at `$DATA_DIR/now.sqlite` (default `apps/game-server/data/now.sqlite`). The schema is created on startup.

```sql
CREATE TABLE rooms (
  code TEXT PRIMARY KEY,
  status TEXT NOT NULL,          -- lobby | live | ended
  payload TEXT NOT NULL,         -- canonical JSON snapshot
  checksum TEXT NOT NULL,        -- SHA-256 of payload
  updated_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  room_code TEXT NOT NULL,
  name TEXT NOT NULL,
  spectator INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_code TEXT NOT NULL,
  player_id TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  at INTEGER NOT NULL
);

CREATE INDEX audit_room ON audit_log(room_code, id);
```

`rooms.payload` is the authoritative snapshot: seats, host, settings, and either the Boiler Room table state or the classic match state. A load recomputes the SHA-256 and refuses the row if it does not match `checksum`. Anonymous ballots are omitted from client views, but the snapshot keeps them so the audit trail can reconstruct the round.

The Boiler Room state also carries a non-cryptographic fingerprint (`checksumState`) used by unit tests. The SHA-256 column is what restore trusts.
