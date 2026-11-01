-- 001: users, sign-in identities, sessions, labs and bookings.
CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per way a user can sign in: 'local' (password) or 'google'.
CREATE TABLE identities (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider    TEXT NOT NULL CHECK (provider IN ('local', 'google')),
  provider_id TEXT NOT NULL,
  UNIQUE (provider, provider_id)
);

-- Only a hash of the session token is stored, never the token itself.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE labs (
  id       INTEGER PRIMARY KEY,
  name     TEXT NOT NULL,
  room     TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0)
);

-- A booking is one lab, one date, one one-hour slot starting at start_hour.
CREATE TABLE bookings (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lab_id     INTEGER NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  start_hour INTEGER NOT NULL CHECK (start_hour BETWEEN 8 AND 19),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (lab_id, date, start_hour)
);
