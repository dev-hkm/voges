PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS session_summaries (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL,
  title TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  primary_intent TEXT,
  summary TEXT,
  tools_called_json TEXT NOT NULL DEFAULT '[]',
  visual_cards_json TEXT NOT NULL DEFAULT '[]',
  actions_json TEXT NOT NULL DEFAULT '[]',
  final_outcome TEXT,
  biometric_verified INTEGER NOT NULL DEFAULT 0,
  security_result TEXT,
  archived_at TEXT,
  deleted_from_history INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_summaries_customer_created
  ON session_summaries(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_summaries_customer_archived
  ON session_summaries(customer_id, deleted_from_history, archived_at, updated_at DESC);

CREATE TABLE IF NOT EXISTS session_visual_cards (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  card_type TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES voice_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_visual_cards_session_created
  ON session_visual_cards(session_id, created_at DESC);

PRAGMA foreign_keys = ON;
