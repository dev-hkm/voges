-- Schema for GoTyme P3 Hackathon Demo: "In-app Financial Concierge"
-- Cloudflare D1 / SQLite 100% Compatible

PRAGMA foreign_keys = ON;

-- 1. CUSTOMERS
CREATE TABLE customers (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    birthday TEXT NOT NULL,          -- YYYY-MM-DD
    nationality TEXT NOT NULL,
    residency TEXT NOT NULL,
    occupation TEXT NOT NULL,
    monthly_income REAL NOT NULL,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'VIP')),
    kyc_status TEXT NOT NULL CHECK (kyc_status IN ('verified', 'pending', 'rejected', 'expired')),
    account_status TEXT NOT NULL CHECK (account_status IN ('active', 'frozen', 'limited', 'closed')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_kyc ON customers(kyc_status);

-- 2. ACCOUNTS
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'crypto', 'gold')),
    balance REAL NOT NULL DEFAULT 0.0,
    available_balance REAL NOT NULL DEFAULT 0.0,
    currency TEXT NOT NULL CHECK (currency IN ('PHP', 'USD', 'BTC', 'ETH', 'PAXG')),
    interest_rate REAL NOT NULL DEFAULT 0.0,
    status TEXT NOT NULL CHECK (status IN ('active', 'frozen', 'closed')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX idx_accounts_customer ON accounts(customer_id);

-- 3. CARDS
CREATE TABLE cards (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('virtual', 'physical')),
    tier TEXT NOT NULL CHECK (tier IN ('debit', 'premium')),
    card_number_masked TEXT NOT NULL,
    card_number_encrypted TEXT NOT NULL,
    expiry_date TEXT NOT NULL, -- MM/YY
    status TEXT NOT NULL CHECK (status IN ('active', 'locked', 'expired', 'stolen', 'destroyed')),
    online_payment_enabled INTEGER NOT NULL CHECK (online_payment_enabled IN (0, 1)) DEFAULT 1,
    international_payment_enabled INTEGER NOT NULL CHECK (international_payment_enabled IN (0, 1)) DEFAULT 1,
    contactless_enabled INTEGER NOT NULL CHECK (contactless_enabled IN (0, 1)) DEFAULT 1,
    daily_limit REAL NOT NULL DEFAULT 50000.0,
    monthly_limit REAL NOT NULL DEFAULT 150000.0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX idx_cards_customer ON cards(customer_id);
CREATE INDEX idx_cards_account ON cards(account_id);

-- 4. TRANSACTIONS
CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    card_id TEXT, -- Can be NULL for transfers/salary/interest
    type TEXT NOT NULL CHECK (type IN ('purchase', 'deposit', 'withdrawal', 'transfer', 'interest', 'refund')),
    category TEXT NOT NULL, -- e.g., 'Coffee', 'Grab', 'GrabFood', 'ATM', 'Salary'
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    merchant_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'pending', 'declined', 'refund', 'reversed')),
    decline_reason TEXT CHECK (decline_reason IN (
        'online_payment_disabled', 'international_disabled', 'insufficient_funds', 
        'daily_limit', 'monthly_limit', 'expired_card', 'locked_card', 
        'kyc_required', 'suspicious_activity', 'fraud_detected'
    )),
    reference_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE SET NULL
);

CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_created ON transactions(created_at);

-- 5. BENEFICIARIES
CREATE TABLE beneficiaries (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    name TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    nickname TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX idx_beneficiaries_customer ON beneficiaries(customer_id);

-- 6. SUPPORT_TICKETS
CREATE TABLE support_tickets (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX idx_support_tickets_customer ON support_tickets(customer_id);

-- 7. KYC_DOCUMENTS
CREATE TABLE kyc_documents (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('passport', 'national_id', 'drivers_license', 'utility_bill')),
    document_number TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('approved', 'pending_review', 'rejected')),
    rejection_reason TEXT,
    submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX idx_kyc_documents_customer ON kyc_documents(customer_id);

-- 8. PRODUCTS
CREATE TABLE products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    terms TEXT
);

-- 9. PRODUCT_DOCUMENTS (Knowledge Base)
CREATE TABLE product_documents (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    category TEXT NOT NULL, -- e.g., 'FAQ', 'T&C', 'Guide'
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX idx_prod_docs_category ON product_documents(category);

-- 10. BANK_FEATURES
CREATE TABLE bank_features (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    is_enabled INTEGER NOT NULL CHECK (is_enabled IN (0, 1)) DEFAULT 1,
    description TEXT
);

-- 11. ALLOWED_TOOLS (AI Agent Capabilites)
CREATE TABLE allowed_tools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
    requires_confirmation INTEGER NOT NULL CHECK (requires_confirmation IN (0, 1)) DEFAULT 0,
    requires_biometric INTEGER NOT NULL CHECK (requires_biometric IN (0, 1)) DEFAULT 0,
    audit_required INTEGER NOT NULL CHECK (audit_required IN (0, 1)) DEFAULT 1
);

-- 12. TOOL_PERMISSIONS
CREATE TABLE tool_permissions (
    id TEXT PRIMARY KEY,
    tool_id TEXT NOT NULL,
    role_or_tier TEXT NOT NULL CHECK (role_or_tier IN ('low_risk_user', 'vip_user', 'admin_override')),
    FOREIGN KEY (tool_id) REFERENCES allowed_tools(id) ON DELETE CASCADE
);

-- 13. GUARDRAILS
CREATE TABLE guardrails (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    rule_description TEXT NOT NULL,
    enforcement_level TEXT NOT NULL CHECK (enforcement_level IN ('block', 'warn', 'escalate')),
    is_active INTEGER NOT NULL CHECK (is_active IN (0, 1)) DEFAULT 1
);

-- 14. PENDING_ACTIONS (Confirmation Queue)
CREATE TABLE pending_actions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    action_type TEXT NOT NULL, -- e.g., 'Enable Online Payment', 'Freeze Card'
    action_details TEXT,        -- JSON payloads representation
    status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled', 'expired')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX idx_pending_actions_customer ON pending_actions(customer_id);

-- 15. VOICE_SESSIONS
CREATE TABLE voice_sessions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TEXT,
    duration_seconds INTEGER,
    device TEXT,
    language TEXT NOT NULL DEFAULT 'en-US',
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX idx_voice_sessions_customer ON voice_sessions(customer_id);

-- 16. CONVERSATION_HISTORY (Log of dialogue)
CREATE TABLE conversation_history (
    id TEXT PRIMARY KEY,
    voice_session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    message TEXT NOT NULL,
    tool_called TEXT,
    timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (voice_session_id) REFERENCES voice_sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_conversation_history_session ON conversation_history(voice_session_id);

-- 17. AUDIT_LOGS (Secure system trail)
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    customer_id TEXT,
    voice_session_id TEXT,
    user_request TEXT NOT NULL,
    agent_reasoning_summary TEXT,
    tool_called TEXT,
    guardrail_triggered TEXT,
    requires_confirmation INTEGER CHECK (requires_confirmation IN (0, 1)),
    requires_biometric INTEGER CHECK (requires_biometric IN (0, 1)),
    result TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (voice_session_id) REFERENCES voice_sessions(id) ON DELETE SET NULL,
    FOREIGN KEY (tool_called) REFERENCES allowed_tools(name) ON DELETE SET NULL,
    FOREIGN KEY (guardrail_triggered) REFERENCES guardrails(code) ON DELETE SET NULL
);

CREATE INDEX idx_audit_logs_customer ON audit_logs(customer_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);

-- 18. DEMO_SCENARIOS
CREATE TABLE demo_scenarios (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    setup_instructions TEXT
);

-- 19. SYSTEM_SETTINGS
CREATE TABLE system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT
);
