/* ══════════════════════════════════════════
   SQLite Database — Competition Host Tool
   ══════════════════════════════════════════ */
const Database = require('better-sqlite3');
const path     = require('path');

const db = new Database(path.join(__dirname, 'competition.db'));

// Performance & safety pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ───────────────────────────────────────────────────────────────────
db.exec(`
  -- Users: anyone can create an account
  CREATE TABLE IF NOT EXISTS users (
    id                   TEXT    PRIMARY KEY,
    name                 TEXT    NOT NULL,
    email                TEXT    UNIQUE NOT NULL,
    magic_token          TEXT,
    magic_token_expires  INTEGER,
    created_at           INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- Events / competitions
  CREATE TABLE IF NOT EXISTS events (
    id               TEXT    PRIMARY KEY,
    name             TEXT    NOT NULL,
    hosting_team     TEXT    NOT NULL,
    description      TEXT    NOT NULL DEFAULT '',
    event_date       TEXT    NOT NULL DEFAULT '',
    location         TEXT    NOT NULL DEFAULT '',
    owner_id         TEXT    NOT NULL REFERENCES users(id),
    invite_code      TEXT    UNIQUE NOT NULL,
    team_count       INTEGER NOT NULL DEFAULT 0,
    match_count      INTEGER NOT NULL DEFAULT 0,
    schedule_data    TEXT    NOT NULL DEFAULT '[]',
    queue_data       TEXT    NOT NULL DEFAULT '[]',
    volunteers_data  TEXT    NOT NULL DEFAULT '[]',
    map_image        TEXT,
    map_pins         TEXT    NOT NULL DEFAULT '[]',
    leaderboard_data TEXT    NOT NULL DEFAULT '[]',
    packing_data     TEXT    NOT NULL DEFAULT '[]',
    banners_data     TEXT    NOT NULL DEFAULT '[]',
    created_at       INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- Memberships / invitations
  CREATE TABLE IF NOT EXISTS event_members (
    id             TEXT    PRIMARY KEY,
    event_id       TEXT    NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    invited_email  TEXT    NOT NULL,
    user_id        TEXT    REFERENCES users(id),
    role           TEXT    NOT NULL DEFAULT 'member',
    status         TEXT    NOT NULL DEFAULT 'pending',
    invited_at     INTEGER NOT NULL DEFAULT (unixepoch()),
    accepted_at    INTEGER
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_users_email      ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_token      ON users(magic_token);
  CREATE INDEX IF NOT EXISTS idx_events_owner     ON events(owner_id);
  CREATE INDEX IF NOT EXISTS idx_events_invite    ON events(invite_code);
  CREATE INDEX IF NOT EXISTS idx_members_event    ON event_members(event_id);
  CREATE INDEX IF NOT EXISTS idx_members_user     ON event_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_members_email    ON event_members(invited_email);
`);

module.exports = db;
