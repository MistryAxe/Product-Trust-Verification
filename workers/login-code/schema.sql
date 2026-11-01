-- One row per customer: the current sign-in code (stored scrambled, never in plain text)
-- plus the counters that stop guessing and email spam.
CREATE TABLE IF NOT EXISTS login_codes (
  uid          TEXT PRIMARY KEY,
  code_hash    TEXT    NOT NULL DEFAULT '',
  salt         TEXT    NOT NULL DEFAULT '',
  sent_at      INTEGER NOT NULL DEFAULT 0,
  expires_at   INTEGER NOT NULL DEFAULT 0,
  attempts     INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL DEFAULT 0,
  window_count INTEGER NOT NULL DEFAULT 0,
  verified_at  INTEGER NOT NULL DEFAULT 0
);
