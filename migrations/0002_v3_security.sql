PRAGMA foreign_keys = OFF;

ALTER TABLE pending_actions RENAME TO pending_actions_v2_legacy;
CREATE TABLE pending_actions (
  id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, session_id TEXT,
  action_type TEXT NOT NULL, tool_name TEXT NOT NULL, payload_json TEXT NOT NULL,
  display_title TEXT NOT NULL, display_description TEXT NOT NULL, affected_resource TEXT,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low','medium','high','blocked')),
  requires_confirmation INTEGER NOT NULL DEFAULT 1, requires_biometric INTEGER NOT NULL DEFAULT 0,
  policy_decision_json TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('pending','awaiting_confirmation','awaiting_biometric','verified','executing','completed','rejected','blocked','failed','expired','cancelled')),
  expires_at TEXT NOT NULL, confirmed_at TEXT, biometric_verified_at TEXT, executed_at TEXT, cancelled_at TEXT,
  result_json TEXT, execution_token_hash TEXT, execution_token_expires_at TEXT, created_at TEXT NOT NULL
);
INSERT INTO pending_actions (id,customer_id,action_type,tool_name,payload_json,display_title,display_description,risk_level,requires_confirmation,requires_biometric,policy_decision_json,status,expires_at,created_at)
SELECT id,customer_id,action_type,'legacy',COALESCE(action_details,'{}'),action_type,action_type,'medium',1,0,'{"decision":"legacy"}',CASE status WHEN 'confirmed' THEN 'verified' ELSE status END,expires_at,created_at FROM pending_actions_v2_legacy;
DROP TABLE pending_actions_v2_legacy;
CREATE INDEX idx_pending_actions_customer_status ON pending_actions(customer_id,status);

ALTER TABLE audit_logs RENAME TO audit_logs_v2_legacy;
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY, timestamp TEXT NOT NULL, customer_id TEXT, session_id TEXT,
  event_type TEXT NOT NULL, user_request TEXT, ai_intent TEXT, tool_name TEXT, action_type TEXT,
  policy_result TEXT, guardrails_triggered TEXT, pending_action_id TEXT, confirmation_status TEXT,
  webauthn_credential_id TEXT, biometric_verified INTEGER NOT NULL DEFAULT 0, execution_result TEXT,
  metadata_json TEXT, request_id TEXT, ip_hash TEXT, user_agent TEXT, created_at TEXT NOT NULL
);
INSERT INTO audit_logs (id,timestamp,customer_id,session_id,event_type,user_request,ai_intent,tool_name,guardrails_triggered,confirmation_status,biometric_verified,execution_result,created_at)
SELECT id,timestamp,customer_id,voice_session_id,'legacy_audit',user_request,agent_reasoning_summary,tool_called,guardrail_triggered,CASE WHEN requires_confirmation=1 THEN 'required' ELSE 'not_required' END,COALESCE(requires_biometric,0),result,timestamp FROM audit_logs_v2_legacy;
DROP TABLE audit_logs_v2_legacy;
CREATE INDEX idx_audit_logs_customer_timestamp ON audit_logs(customer_id,timestamp DESC);

CREATE TABLE webauthn_credentials (
  id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL, counter INTEGER NOT NULL DEFAULT 0, transports TEXT,
  device_type TEXT, backed_up INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, last_used_at TEXT,
  FOREIGN KEY(customer_id) REFERENCES customers(id)
);
CREATE INDEX idx_webauthn_credentials_customer ON webauthn_credentials(customer_id);
CREATE TABLE webauthn_challenges (
  id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, pending_action_id TEXT,
  challenge TEXT NOT NULL, type TEXT NOT NULL, expires_at TEXT NOT NULL, consumed_at TEXT, created_at TEXT NOT NULL
);
CREATE INDEX idx_webauthn_challenges_customer_type ON webauthn_challenges(customer_id,type);
CREATE TABLE action_rate_limits (customer_id TEXT NOT NULL, endpoint TEXT NOT NULL, window_start TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(customer_id,endpoint));
PRAGMA foreign_keys = ON;
