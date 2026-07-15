CREATE TABLE IF NOT EXISTS realtime_access_limits (
  identity_hash TEXT PRIMARY KEY,
  reservation_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('reserved', 'issued')),
  reserved_at TEXT NOT NULL,
  token_issued_at TEXT,
  access_expires_at TEXT,
  blocked_at TEXT,
  last_seen_at TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_realtime_access_status
  ON realtime_access_limits(status, reserved_at);
