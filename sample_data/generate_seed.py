import json
import random
import datetime

# Helper to format SQL values
def sql_val(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, (int, float)):
        return str(v)
    # Escape single quotes
    escaped = str(v).replace("'", "''")
    return f"'{escaped}'"

def main():
    sql = []
    sql.append("-- Seed data for GoTyme P3 Hackathon Demo")
    sql.append("-- SQLite D1 Compatible\n")
    
    # 1. SYSTEM_SETTINGS
    system_settings = [
        ("bank_name", "GoTyme Bank", "Commercial bank name"),
        ("environment", "hackathon_demo", "Current environment context"),
        ("ai_model_version", "magent-voice-v2.5-prod", "Active AI banking voice model"),
        ("max_daily_transfer_limit_php", "250000.00", "Global default limit for transfers"),
        ("otp_expiry_seconds", "180", "Expiry time for one-time verification codes")
    ]
    for k, v, d in system_settings:
        sql.append(f"INSERT INTO system_settings (key, value, description) VALUES ({sql_val(k)}, {sql_val(v)}, {sql_val(d)});")
    sql.append("")

    # 2. PRODUCTS
    products = [
        ("prod_checking", "GoTyme Everyday Account", "High-yield checking account for everyday payments.", "No minimum balance, free transfers, linked debit card."),
        ("prod_savings", "GoTyme Go Save", "Multi-goal savings account with up to 5% interest rate.", "Interest credited monthly, up to 5 active saving goals."),
        ("prod_crypto", "GoTyme Crypto Wallet", "In-app crypto trading wallet for major coins.", "Instant buying/selling, powered by regulated exchange partner."),
        ("prod_gold", "GoTyme Gold Account", "PAXG tokenized physical gold investment account.", "Backed by physical gold reserves, instant conversion to PHP.")
    ]
    for pid, name, desc, terms in products:
        sql.append(f"INSERT INTO products (id, name, description, terms) VALUES ({sql_val(pid)}, {sql_val(name)}, {sql_val(desc)}, {sql_val(terms)});")
    sql.append("")

    # 3. PRODUCT_DOCUMENTS (Knowledge Base FAQs)
    faqs = [
        ("doc_001", "prod_checking", "FAQ", "How do I fund my GoTyme Everyday Account?", "You can fund your account via OTC deposits at GoTyme kiosks, Robinsons retail outlets, 7-Eleven, or via instapay/PESONet bank transfers using your GoTyme account number."),
        ("doc_002", "prod_checking", "FAQ", "How do I enable online payment on my debit card?", "Open the card settings in your GoTyme app, tap 'Online Payments', and toggle it ON. This will allow transactions on Netflix, Grab, Steam, and other web merchants."),
        ("doc_003", "prod_checking", "FAQ", "Why was my card transaction declined?", "Common reasons include: 1) Online or international payments are toggled OFF in your settings. 2) Insufficient funds. 3) You reached your daily or monthly transaction limits. 4) The card is locked, expired, or stolen. The voice concierge can tell you the exact reason if you ask."),
        ("doc_004", "prod_savings", "FAQ", "How does interest on Go Save work?", "Go Save offers up to 5% annual interest. Interest is computed daily on your balance and credited to your account on the 1st of every month."),
        ("doc_005", "prod_crypto", "FAQ", "What are the crypto wallet trading limits?", "Standard users can buy up to 50,000 PHP worth of crypto daily. High risk or unverified users must undergo supplemental KYC to buy crypto."),
        ("doc_006", "prod_gold", "FAQ", "Is the gold account safe?", "Yes, the GoTyme Gold account uses PAX Gold (PAXG), where each token is backed by one fine troy ounce of physical gold stored in professional London vaults. You own the gold."),
        ("doc_007", "prod_checking", "FAQ", "How do I temporarily freeze my card?", "If you misplace your physical card, you can immediately lock it in card settings by toggling the freeze card option. You can unfreeze it instantly when found."),
        ("doc_008", "prod_checking", "FAQ", "What should I do if my card is stolen?", "If your card is stolen, freeze it immediately. Then, request a replacement card in the app or call support. Do not attempt to unfreeze a stolen card."),
        ("doc_009", "prod_checking", "FAQ", "How long does a card replacement take?", "Virtual cards are generated instantly. A physical debit card can be printed instantly at any GoTyme kiosk located in Robinsons supermarkets and malls."),
        ("doc_010", "prod_savings", "FAQ", "Can I set up recurring transfers to my savings?", "Yes, you can configure auto-save tasks. Choose the frequency (daily, weekly, monthly) and the amount to automatically move money from your Everyday account to your Go Save goal."),
        ("doc_011", "prod_checking", "FAQ", "What is the daily ATM withdrawal limit?", "The default daily ATM withdrawal limit is 20,000 PHP. You can increase or decrease this limit in your card security settings up to 50,000 PHP."),
        ("doc_012", "prod_checking", "FAQ", "Are international transactions allowed on my card?", "Yes, but you must enable the 'International Payments' toggle in your card settings first to allow transactions outside of the Philippines."),
        ("doc_013", "prod_checking", "FAQ", "What are the fees for sending money?", "Bank transfers via InstaPay cost 8 PHP per transfer. Transferring money between GoTyme users is completely free, and transfers via PESONet are free but take 1 business day."),
        ("doc_014", "prod_checking", "FAQ", "How do I upgrade my KYC level?", "To fully verify your account, navigate to the verification page in your app profile, upload a valid government ID (Passport, National ID, or UMID), and complete the face verification scan.")
    ]
    for fid, pid, cat, q, a in faqs:
        sql.append(f"INSERT INTO product_documents (id, product_id, category, question, answer) VALUES ({sql_val(fid)}, {sql_val(pid)}, {sql_val(cat)}, {sql_val(q)}, {sql_val(a)});")
    sql.append("")

    # 4. BANK_FEATURES
    features = [
        ("feat_savings", "Savings Goals", 1, "High-yield interest savings goals"),
        ("feat_gold", "Gold Trading", 1, "PAXG token physical gold trading"),
        ("feat_crypto", "Crypto Wallet", 1, "Buy and sell digital assets"),
        ("feat_international", "International Payments", 1, "Use debit card outside the Philippines"),
        ("feat_virtual_card", "Virtual Cards", 1, "Generate instant virtual debit cards"),
        ("feat_freeze_card", "Freeze Card Settings", 1, "Lock/unlock cards on demand"),
        ("feat_card_replacement", "Card Replacement", 1, "Order physical replacement cards"),
        ("feat_recurring_transfer", "Recurring Auto-Save", 1, "Automated transfers to goals"),
        ("feat_bnpl", "GoTyme Buy Now Pay Later", 0, "Split purchases into installments (Currently under beta)"),
        ("feat_loans", "GoTyme Personal Loans", 0, "Fast cash personal loans (Currently under internal review)")
    ]
    for fid, name, enabled, desc in features:
        sql.append(f"INSERT INTO bank_features (id, name, is_enabled, description) VALUES ({sql_val(fid)}, {sql_val(name)}, {sql_val(enabled)}, {sql_val(desc)});")
    sql.append("")

    # 5. ALLOWED_TOOLS
    tools = [
        ("t_01", "getCustomerProfile", "Retrieve customer metadata, KYC tier and account statuses", "low", 0, 0, 1),
        ("t_02", "getBalance", "Check the balance and currency details of all wallets", "low", 0, 0, 1),
        ("t_03", "getRecentTransactions", "Fetch transaction history for a given account", "low", 0, 0, 1),
        ("t_04", "getCardStatus", "Retrieve debit card lock status and configurations", "low", 0, 0, 1),
        ("t_05", "getKycStatus", "Check KYC approval, document review or expiry status", "low", 0, 0, 1),
        ("t_06", "getCardLimits", "Retrieve daily and monthly transaction limits of cards", "low", 0, 0, 1),
        ("t_07", "enableOnlinePayment", "Enable e-commerce transactions on physical/virtual card", "medium", 1, 0, 1),
        ("t_08", "disableOnlinePayment", "Disable online payment options for safety", "medium", 1, 0, 1),
        ("t_09", "enableInternationalPayment", "Allow card transactions outside the Philippines", "medium", 1, 0, 1),
        ("t_10", "disableInternationalPayment", "Block card transactions outside the Philippines", "medium", 1, 0, 1),
        ("t_11", "freezeCard", "Temporarily lock physical or virtual card from all actions", "medium", 1, 0, 1),
        ("t_12", "unfreezeCard", "Unlock physical or virtual card back to active state", "high", 1, 1, 1),
        ("t_13", "replaceCard", "Mark card as destroyed/stolen and queue replacement", "high", 1, 1, 1),
        ("t_14", "createSupportTicket", "File an official dispute or support ticket on customer behalf", "medium", 0, 0, 1),
        ("t_15", "generateFundingInstruction", "Provide bank accounts details for funding the checking wallet", "low", 0, 0, 1),
        ("t_16", "toggleSavings", "Activate or deactivate specific saving goals", "medium", 1, 0, 1),
        ("t_17", "getInterestRate", "Fetch current annual percentage rates of saving products", "low", 0, 0, 1),
        ("t_18", "checkFraudScore", "Assess user transaction risk score prior to sensitive requests", "medium", 0, 0, 1),
        ("t_19", "escalateToHumanAgent", "Transfer active session to human support queue immediately", "low", 0, 0, 1),
        ("t_20", "transferFundsInternal", "Move money between Checking and Savings internal accounts", "medium", 1, 0, 1),
        ("t_21", "buyGold", "Purchase PAXG gold tokens from Everyday balance", "high", 1, 1, 1),
        ("t_22", "sellGold", "Sell PAXG gold tokens back into checking account balance", "high", 1, 1, 1),
        ("t_23", "updateCardLimits", "Adjust daily or monthly card spending caps", "high", 1, 1, 1),
        ("t_24", "verifyBiometricConfirm", "Acknowledge biometrics success for high risk tools", "low", 0, 0, 1),
        ("t_25", "getFAQAnswers", "Query the knowledge base database using user keywords", "low", 0, 0, 1)
    ]
    for tid, name, desc, risk, req_conf, req_bio, audit in tools:
        sql.append(f"INSERT INTO allowed_tools (id, name, description, risk_level, requires_confirmation, requires_biometric, audit_required) VALUES ({sql_val(tid)}, {sql_val(name)}, {sql_val(desc)}, {sql_val(risk)}, {sql_val(req_conf)}, {sql_val(req_bio)}, {sql_val(audit)});")
    sql.append("")

    # 6. TOOL_PERMISSIONS
    permissions = [
        ("p_01", "t_01", "low_risk_user"),
        ("p_02", "t_02", "low_risk_user"),
        ("p_03", "t_03", "low_risk_user"),
        ("p_04", "t_04", "low_risk_user"),
        ("p_05", "t_05", "low_risk_user"),
        ("p_06", "t_06", "low_risk_user"),
        ("p_07", "t_07", "low_risk_user"),
        ("p_08", "t_08", "low_risk_user"),
        ("p_09", "t_09", "low_risk_user"),
        ("p_10", "t_10", "low_risk_user"),
        ("p_11", "t_11", "low_risk_user"),
        ("p_12", "t_12", "vip_user"),
        ("p_13", "t_12", "low_risk_user"),
        ("p_14", "t_13", "low_risk_user"),
        ("p_15", "t_14", "low_risk_user"),
        ("p_16", "t_15", "low_risk_user"),
        ("p_17", "t_16", "low_risk_user"),
        ("p_18", "t_17", "low_risk_user"),
        ("p_19", "t_19", "low_risk_user"),
        ("p_20", "t_20", "low_risk_user"),
        ("p_21", "t_21", "low_risk_user"),
        ("p_22", "t_22", "low_risk_user"),
        ("p_23", "t_23", "vip_user")
    ]
    for permid, tid, role in permissions:
        sql.append(f"INSERT INTO tool_permissions (id, tool_id, role_or_tier) VALUES ({sql_val(permid)}, {sql_val(tid)}, {sql_val(role)});")
    sql.append("")

    # 7. GUARDRAILS
    guardrails = [
        ("g_01", "GR_MASK_CARD", "Never reveal the full 16-digit card number in speech or response. Mask all but the last 4 digits.", "block", 1),
        ("g_02", "GR_BLOCK_EXTERNAL_TRANSFER", "The voice agent is strictly forbidden from initiating transfers to external bank accounts.", "block", 1),
        ("g_03", "GR_BLOCK_EMAIL_CHANGE", "Voice agents cannot modify the customer's registered email address.", "block", 1),
        ("g_04", "GR_BLOCK_PHONE_CHANGE", "Voice agents cannot modify the customer's registered phone number.", "block", 1),
        ("g_05", "GR_BLOCK_KYC_CHANGE", "AI Agent is unauthorized to approve or modify KYC documents and tiers directly.", "block", 1),
        ("g_06", "GR_NO_INVEST_ADVICE", "Do not give investment recommendations on gold or crypto. Offer only informational FAQs.", "warn", 1),
        ("g_07", "GR_MASK_OTP", "Never read out or request OTP passwords from the customer over the voice channel.", "block", 1),
        ("g_08", "GR_MASK_CVV", "Never read or output the card verification value (CVV) in logs or conversations.", "block", 1),
        ("g_09", "GR_REQ_BIOMETRIC_HIGH_RISK", "All high-risk actions (card replacement, unfreezing, limit changes) require step-up biometric approval.", "block", 1),
        ("g_10", "GR_FROZEN_ACCOUNT_BLOCK", "If the account status is 'frozen', block all transaction updates, unfreezes, or gold/crypto buys.", "block", 1),
        ("g_11", "GR_HIGH_RISK_CUST_ESCALATE", "High-risk users attempting sensitive actions must be instantly transferred to human agents.", "escalate", 1),
        ("g_12", "GR_LOW_CONFIDENCE_ESCALATE", "If the NLU confidence for critical card/account actions drops below 0.85, transfer to human.", "escalate", 1),
        ("g_13", "GR_KYC_EXPIRED_LIMIT", "If KYC is expired, reject all card payments and savings interest accruals.", "block", 1),
        ("g_14", "GR_BLOCK_GOLD_IF_KYC_PENDING", "Do not allow Gold buying if the customer's KYC status is not 'verified'.", "block", 1),
        ("g_15", "GR_BLOCK_CRYPTO_IF_KYC_PENDING", "Do not allow Crypto trading if customer KYC status is not 'verified'.", "block", 1),
        ("g_16", "GR_SUSPICIOUS_LIMIT_DECREASE", "If a transaction is flagged suspicious, restrict daily transfer limits to 5000 PHP.", "warn", 1),
        ("g_17", "GR_PIN_EXCLUDE", "Never ask the user for their ATM PIN or Web login PIN.", "block", 1),
        ("g_18", "GR_FORCE_CONFIRM_LOCK", "Card freeze requests must be explicitly confirmed with a Yes/No response.", "warn", 1),
        ("g_19", "GR_FORCE_CONFIRM_LIMIT", "Card limit modification requests require explicit user confirmation.", "warn", 1),
        ("g_20", "GR_REJECT_UNVERIFIED_GOLD", "Block gold transaction if customer nationality is from restricted jurisdictions.", "block", 1),
        ("g_21", "GR_BLOCK_VIRTUAL_PHYSICAL_SWAP", "Do not allow virtual cards to be converted directly into physical ones without biometric ID.", "block", 1),
        ("g_22", "GR_LIMIT_EXCEEDED_ALERT", "Notify the customer immediately if the requested amount exceeds daily limits.", "warn", 1),
        ("g_23", "GR_STOLEN_CARD_NO_UNFREEZE", "If a card is marked 'stolen', block any request to unfreeze it.", "block", 1),
        ("g_24", "GR_EXPIRED_CARD_NO_ONLINE", "Reject online purchases if the card's expiry date has passed.", "block", 1),
        ("g_25", "GR_VIP_SPECIAL_ROUTING", "VIP customers are routed to dedicated senior support queues in case of escalation.", "escalate", 1),
        ("g_26", "GR_MAX_RETRY_LOCK", "After 3 failed verification attempts, temporarily lock the voice session.", "block", 1),
        ("g_27", "GR_COMPLIANCE_SIGN_OFF", "Changes in account interest rates require compliance validation.", "block", 1),
        ("g_28", "GR_NO_P2P_FOREIGN", "Do not allow P2P transfers to customers registered outside the Philippines.", "block", 1),
        ("g_29", "GR_BLOCK_CARD_DESTRUCTION", "Only the owner can request card replacement.", "block", 1),
        ("g_30", "GR_AUDIT_ALL_BIOMETRICS", "Any biometric confirmation token must be recorded in the audit logs table.", "warn", 1)
    ]
    for gid, code, desc, level, active in guardrails:
        sql.append(f"INSERT INTO guardrails (id, code, rule_description, enforcement_level, is_active) VALUES ({sql_val(gid)}, {sql_val(code)}, {sql_val(desc)}, {sql_val(level)}, {sql_val(active)});")
    sql.append("")

    # 8. DEMO_SCENARIOS
    scenarios = [
        ("scn_01", "Netflix Transaction Declined", "Customer calls to ask why their Netflix subscription failed. The agent discovers online payment is disabled on their card.", "1. Find card for cust_001. 2. Verify online_payment_enabled = 0. 3. Explain and offer to enable it."),
        ("scn_02", "Amazon Declined - Daily Limit", "VIP customer attempts a purchase on Amazon but gets declined due to hitting the daily limit.", "1. Find transactions for cust_006. 2. Locate declined Amazon transaction (daily_limit). 3. Offer to update daily limit (requires biometric)."),
        ("scn_03", "KYC Pending Verification", "Customer check why they cannot open a Gold Savings goal. The agent flags that their uploaded passport is still under review.", "1. Query kyc_status for cust_002. 2. Check kyc_documents status (pending_review)."),
        ("scn_04", "Savings Goal Interest Check", "Customer asks for their interest rates on their active savings account goals.", "1. Retrieve accounts for cust_007. 2. Get interest rate for savings account type (5.0%)."),
        ("scn_05", "Unfreeze Frozen Account Block", "A high-risk customer with a frozen account status tries to unfreeze their debit card. The agent must decline and escalate.", "1. Inspect account_status for cust_004 (frozen). 2. Trigger frozen block guardrail. 3. Escalate session."),
        ("scn_06", "Stolen Card Replacement Request", "Customer reports they lost their physical card at a grocery store and wants it replaced.", "1. Lock card for cust_001 (stolen). 2. Create pending card replacement. 3. Ask for biometric confirmation.")
    ]
    for sid, name, desc, setup in scenarios:
        sql.append(f"INSERT INTO demo_scenarios (id, name, description, setup_instructions) VALUES ({sql_val(sid)}, {sql_val(name)}, {sql_val(desc)}, {sql_val(setup)});")
    sql.append("")

    # 9. CUSTOMERS
    cust_data = [
        ("cust_001", "John Doe", "john.doe.fake@mail.com", "+639171234567", "1990-05-15", "Filipino", "Philippines", "Software Engineer", 75000.0, "low", "verified", "active", "2025-01-10 08:30:00"),
        ("cust_002", "Jane Smith", "jane.smith.fake@mail.com", "+639189876543", "1995-10-22", "Filipino", "Philippines", "Online Merchant", 45000.0, "medium", "pending", "active", "2025-02-14 11:20:00"),
        ("cust_003", "Bob Johnson", "bob.johnson.fake@mail.com", "+639195551122", "1985-03-08", "American", "Philippines", "Freelance Writer", 30000.0, "high", "rejected", "closed", "2025-03-01 15:45:00"),
        ("cust_004", "Alice Brown", "alice.brown.fake@mail.com", "+639207778899", "1992-07-19", "Filipino", "Philippines", "Unemployed", 5000.0, "high", "verified", "frozen", "2025-01-20 09:15:00"),
        ("cust_005", "Charlie Green", "charlie.green.fake@mail.com", "+639213334455", "1988-12-03", "Filipino", "Philippines", "Sales Agent", 28000.0, "medium", "verified", "limited", "2025-04-10 14:00:00"),
        ("cust_006", "David Wright", "david.wright.fake@mail.com", "+639221112233", "1978-01-30", "British", "Philippines", "VP Engineering", 350000.0, "VIP", "verified", "active", "2025-01-05 10:00:00"),
        ("cust_007", "Eva Martinez", "eva.martinez.fake@mail.com", "+639234445566", "1993-09-12", "Filipino", "Philippines", "BPO Manager", 55000.0, "low", "verified", "active", "2025-02-28 16:30:00"),
        ("cust_008", "Frank Miller", "frank.miller.fake@mail.com", "+639246667788", "1982-11-25", "Filipino", "Philippines", "Crypto Trader", 120000.0, "high", "verified", "active", "2025-03-15 13:10:00"),
        ("cust_009", "Grace Taylor", "grace.taylor.fake@mail.com", "+639258889900", "1989-04-05", "Filipino", "Philippines", "Doctor", 250000.0, "VIP", "verified", "active", "2025-01-15 17:20:00"),
        ("cust_010", "Henry Wilson", "henry.wilson.fake@mail.com", "+639260001122", "1997-06-18", "Filipino", "Philippines", "Student", 8000.0, "low", "pending", "active", "2025-05-01 10:50:00")
    ]
    for row in cust_data:
        sql.append(f"INSERT INTO customers (id, full_name, email, phone, birthday, nationality, residency, occupation, monthly_income, risk_level, kyc_status, account_status, created_at) VALUES ({','.join(sql_val(x) for x in row)});")
    sql.append("")

    # 10. KYC_DOCUMENTS
    kyc_docs = [
        ("kyc_doc_001", "cust_001", "passport", "P88992211A", "approved", None, "2025-01-10 08:45:00"),
        ("kyc_doc_002", "cust_002", "national_id", "ID-11223344", "pending_review", None, "2025-02-14 11:30:00"),
        ("kyc_doc_003", "cust_003", "drivers_license", "DL-998877", "rejected", "Document image was too blurry.", "2025-03-01 16:00:00"),
        ("kyc_doc_004", "cust_004", "national_id", "ID-77889900", "approved", None, "2025-01-20 09:30:00"),
        ("kyc_doc_005", "cust_005", "passport", "P12345678B", "approved", None, "2025-04-10 14:15:00"),
        ("kyc_doc_006", "cust_006", "passport", "P00099988C", "approved", None, "2025-01-05 10:15:00"),
        ("kyc_doc_007", "cust_007", "national_id", "ID-55667788", "approved", None, "2025-02-28 16:45:00"),
        ("kyc_doc_008", "cust_008", "passport", "P44332211D", "approved", None, "2025-03-15 13:25:00"),
        ("kyc_doc_009", "cust_009", "national_id", "ID-99001122", "approved", None, "2025-01-15 17:35:00"),
        ("kyc_doc_010", "cust_010", "national_id", "ID-88442211", "pending_review", None, "2025-05-01 11:00:00")
    ]
    for row in kyc_docs:
        sql.append(f"INSERT INTO kyc_documents (id, customer_id, document_type, document_number, status, rejection_reason, submitted_at) VALUES ({','.join(sql_val(x) for x in row)});")
    sql.append("")

    # 11. ACCOUNTS
    # We will generate checking (Everyday) and savings (Go Save) for everyone.
    # Gold and Crypto for verified users.
    accounts = []
    account_map = {} # customer_id -> list of account dicts
    acc_idx = 1
    
    # Pre-defined mock balances for consistency
    balances_setup = {
        "cust_001": {"checking": 12500.50, "savings": 45000.00, "crypto": 200.0, "gold": 1.25},
        "cust_002": {"checking": 450.00, "savings": 0.0, "crypto": 0.0, "gold": 0.0},
        "cust_003": {"checking": 0.00, "savings": 0.0, "crypto": 0.0, "gold": 0.0},
        "cust_004": {"checking": 8900.00, "savings": 12000.00, "crypto": 0.0, "gold": 0.0},
        "cust_005": {"checking": 2500.00, "savings": 5000.00, "crypto": 0.0, "gold": 0.0},
        "cust_006": {"checking": 150000.00, "savings": 800000.00, "crypto": 2.5, "gold": 15.00},
        "cust_007": {"checking": 35400.75, "savings": 120000.00, "crypto": 0.0, "gold": 0.0},
        "cust_008": {"checking": 4500.25, "savings": 15000.00, "crypto": 1.15, "gold": 0.0},
        "cust_009": {"checking": 98000.00, "savings": 500000.00, "crypto": 0.5, "gold": 5.80},
        "cust_010": {"checking": 120.00, "savings": 0.0, "crypto": 0.0, "gold": 0.0}
    }
    
    for cid, name, email, phone, bday, nat, res, occ, income, risk, kyc, acc_status, cr_at in cust_data:
        account_map[cid] = []
        status = "closed" if acc_status == "closed" else ("frozen" if acc_status == "frozen" else "active")
        
        # Checking account
        aid = f"acc_{acc_idx:03d}"
        bal = balances_setup[cid]["checking"]
        accounts.append((aid, cid, "checking", bal, bal, "PHP", 0.0, status, cr_at))
        account_map[cid].append({"id": aid, "type": "checking", "currency": "PHP"})
        acc_idx += 1
        
        # Savings account
        aid = f"acc_{acc_idx:03d}"
        bal = balances_setup[cid]["savings"]
        rate = 5.0 if risk == "VIP" else 4.0
        accounts.append((aid, cid, "savings", bal, bal, "PHP", rate, status, cr_at))
        account_map[cid].append({"id": aid, "type": "savings", "currency": "PHP"})
        acc_idx += 1
        
        # Crypto wallet (BTC)
        if kyc == "verified" and acc_status != "closed":
            aid = f"acc_{acc_idx:03d}"
            bal = balances_setup[cid]["crypto"]
            accounts.append((aid, cid, "crypto", bal, bal, "USD", 0.0, status, cr_at))
            account_map[cid].append({"id": aid, "type": "crypto", "currency": "USD"})
            acc_idx += 1
            
        # Gold wallet (PAXG)
        if kyc == "verified" and acc_status != "closed":
            aid = f"acc_{acc_idx:03d}"
            bal = balances_setup[cid]["gold"]
            accounts.append((aid, cid, "gold", bal, bal, "PAXG", 0.0, status, cr_at))
            account_map[cid].append({"id": aid, "type": "gold", "currency": "PAXG"})
            acc_idx += 1

    for row in accounts:
        sql.append(f"INSERT INTO accounts (id, customer_id, type, balance, available_balance, currency, interest_rate, status, created_at) VALUES ({','.join(sql_val(x) for x in row)});")
    sql.append("")

    # 12. CARDS
    # We create cards linked to Checking accounts for active/frozen/limited users.
    cards = []
    card_idx = 1
    
    # mapping customer_id -> cards list
    cust_cards = {}
    
    card_configs = [
        ("cust_001", "physical", "debit", "active", 1, 1, 1, 50000.0, 150000.0),
        ("cust_001", "virtual", "debit", "active", 0, 1, 0, 20000.0, 50000.0), # online payment disabled for demo scenario
        ("cust_002", "physical", "debit", "active", 1, 0, 1, 30000.0, 100000.0),
        ("cust_004", "physical", "debit", "locked", 1, 1, 1, 50000.0, 150000.0),
        ("cust_005", "physical", "debit", "active", 1, 1, 1, 10000.0, 30000.0),
        ("cust_006", "physical", "premium", "active", 1, 1, 1, 200000.0, 500000.0),
        ("cust_006", "virtual", "debit", "locked", 1, 1, 0, 50000.0, 100000.0),
        ("cust_007", "physical", "debit", "active", 1, 1, 1, 50000.0, 150000.0),
        ("cust_007", "virtual", "debit", "active", 1, 1, 0, 20000.0, 50000.0),
        ("cust_008", "physical", "debit", "active", 1, 1, 1, 100000.0, 300000.0),
        ("cust_009", "physical", "premium", "active", 1, 1, 1, 250000.0, 750000.0),
        ("cust_009", "virtual", "debit", "expired", 1, 1, 0, 50000.0, 100000.0)
    ]
    
    for cid, ctype, tier, status, online, international, contactless, daily, monthly in card_configs:
        card_id = f"card_{card_idx:03d}"
        # find checking account
        chk_acc = [acc for acc in account_map[cid] if acc["type"] == "checking"][0]["id"]
        
        last4 = f"{random.randint(1000, 9999)}"
        masked = f"4111 11** **** {last4}"
        encrypted = f"enc_card_token_{random.randint(100000000, 999999999)}"
        expiry = "12/29" if status != "expired" else "05/25"
        
        cards.append((card_id, chk_acc, cid, ctype, tier, masked, encrypted, expiry, status, online, international, contactless, daily, monthly, "2025-01-15 09:00:00"))
        
        if cid not in cust_cards:
            cust_cards[cid] = []
        cust_cards[cid].append({"id": card_id, "type": ctype, "status": status, "online": online, "intl": international, "daily": daily})
        card_idx += 1

    for row in cards:
        sql.append(f"INSERT INTO cards (id, account_id, customer_id, type, tier, card_number_masked, card_number_encrypted, expiry_date, status, online_payment_enabled, international_payment_enabled, contactless_enabled, daily_limit, monthly_limit, created_at) VALUES ({','.join(sql_val(x) for x in row)});")
    sql.append("")

    # 13. BENEFICIARIES
    benefs = [
        ("ben_001", "cust_001", "Alice Smith", "GCash", "09179998877", "Alice GCash", "2025-02-01 10:00:00"),
        ("ben_002", "cust_001", "Bob Doe", "BDO", "1098765432", "Dad BDO", "2025-02-05 14:00:00"),
        ("ben_003", "cust_006", "Wealth Mgmt Inc", "GoTyme Savings", "acc_012", "My VIP Savings", "2025-01-06 08:00:00"),
        ("ben_004", "cust_007", "Landlord Pedro", "BPI", "0022334455", "Rent Account", "2025-03-01 09:00:00"),
        ("ben_005", "cust_009", "Premium Gold broker", "Gold Custody", "acc_025", "Gold Supplier", "2025-02-15 11:00:00")
    ]
    for row in benefs:
        sql.append(f"INSERT INTO beneficiaries (id, customer_id, name, bank_name, account_number, nickname, created_at) VALUES ({','.join(sql_val(x) for x in row)});")
    sql.append("")

    # 14. SUPPORT_TICKETS
    tickets = [
        ("tkt_001", "cust_001", "Netflix Transaction Declined Enquiry", "Customer asked why Netflix was declined. Explained online payments are off.", "resolved", "low", "2025-06-10 10:30:00"),
        ("tkt_002", "cust_002", "KYC Document Review Delayed", "Customer called regarding pending national ID verification.", "open", "medium", "2025-07-01 14:20:00"),
        ("tkt_003", "cust_004", "Unfreeze Request - Rejected", "Account frozen by anti-fraud department. Refused unfreeze via voice.", "closed", "high", "2025-05-15 09:00:00"),
        ("tkt_004", "cust_006", "Limit Increase - Amazon Purchase", "Requested daily limit increase to 200,000 PHP.", "resolved", "medium", "2025-06-25 18:30:00"),
        ("tkt_005", "cust_008", "Disputed Grab Charge", "Reported suspicious charge of 1200 PHP on Grab. Investigating.", "in_progress", "high", "2025-07-08 12:00:00")
    ]
    for row in tickets:
        sql.append(f"INSERT INTO support_tickets (id, customer_id, subject, description, status, priority, created_at) VALUES ({','.join(sql_val(x) for x in row)});")
    sql.append("")

    # 15. TRANSACTIONS
    # We must generate at least 100 transactions. Let's make it 120.
    # They should range across months, categories, and customers, with logical statuses/reasons.
    categories = [
        ("Coffee", ["Starbucks", "Coffee Bean", "Single Origin", "% Arabica"]),
        ("Netflix", ["Netflix"]),
        ("Spotify", ["Spotify"]),
        ("Amazon", ["Amazon US", "Amazon Prime"]),
        ("Apple", ["Apple Services", "App Store"]),
        ("Steam", ["Steam Games"]),
        ("Grab", ["Grab Ride", "GrabCar"]),
        ("Food", ["GrabFood", "Foodpanda", "McDonalds", "Jollibee"]),
        ("ATM", ["BDO ATM", "BPI ATM", "Metrobank ATM"]),
        ("Transfer", ["Send Money to Savings", "Received from Boss", "Send to Alice GCash"]),
        ("Salary", ["GoTyme Payroll Deposit"]),
        ("Savings", ["Interest Credited"]),
        ("Crypto", ["Buy BTC", "Sell BTC"]),
        ("Gold", ["Buy PAXG", "Sell PAXG"])
    ]
    
    tx_status_reasons = [
        ("success", None),
        ("success", None),
        ("success", None),
        ("success", None),
        ("success", None),
        ("success", None),
        ("success", None),
        ("success", None),
        ("success", None),
        ("success", None),
        ("success", None), # 11 out of 16 are success
        ("declined", "insufficient_funds"),
        ("declined", "online_payment_disabled"),
        ("declined", "international_disabled"),
        ("declined", "daily_limit"),
        ("declined", "locked_card")
    ]
    
    tx_idx = 1
    # We want to ensure specific demo transactions exist
    demo_txs = [
        # cust_001 Netflix declined due to online payment disabled
        ("tx_demo_01", "cust_001", "Netflix", 549.00, "Netflix", "declined", "online_payment_disabled", "card_002", "2026-07-09 20:15:00"),
        # cust_006 Amazon declined due to daily limit exceeded
        ("tx_demo_02", "cust_006", "Amazon", 250000.00, "Amazon US", "declined", "daily_limit", "card_006", "2026-07-09 18:30:00"),
        # cust_004 Locked card transaction attempt
        ("tx_demo_03", "cust_004", "Coffee", 180.00, "Starbucks", "declined", "locked_card", "card_004", "2026-07-08 10:00:00"),
        # cust_002 gold purchase declined due to KYC required (KYC pending)
        ("tx_demo_04", "cust_002", "Gold", 5000.00, "Buy PAXG", "declined", "kyc_required", None, "2026-07-09 22:00:00"),
        # cust_007 international payment declined
        ("tx_demo_05", "cust_007", "Amazon", 15000.00, "Amazon UK", "declined", "international_disabled", "card_009", "2026-07-09 14:00:00"),
        # cust_001 successful coffee purchase
        ("tx_demo_06", "cust_001", "Coffee", 220.00, "% Arabica", "success", None, "card_001", "2026-07-09 09:12:00"),
        # cust_006 successful salary deposit
        ("tx_demo_07", "cust_006", "Salary", 350000.00, "GoTyme Payroll Deposit", "success", None, None, "2026-06-30 08:00:00"),
        # cust_007 interest credited
        ("tx_demo_08", "cust_007", "Savings", 400.00, "Interest Credited", "success", None, None, "2026-07-01 00:00:00")
    ]
    
    for tx_id, cid, cat, amt, merc, status, reason, card_id, dt in demo_txs:
        # find matching checking account for purchases/deposits, savings account for savings
        acc_type = "savings" if cat == "Savings" else "checking"
        accs = [a for a in account_map[cid] if a["type"] == acc_type]
        acc_id = accs[0]["id"] if accs else account_map[cid][0]["id"]
        
        # Determine currency
        curr = "PHP"
        if cat == "Crypto":
            curr = "USD"
        elif cat == "Gold":
            curr = "PAXG"
            
        sql.append(f"INSERT INTO transactions (id, account_id, card_id, type, category, amount, currency, merchant_name, status, decline_reason, reference_id, created_at) VALUES ({sql_val(tx_id)}, {sql_val(acc_id)}, {sql_val(card_id)}, 'purchase', {sql_val(cat)}, {sql_val(amt)}, {sql_val(curr)}, {sql_val(merc)}, {sql_val(status)}, {sql_val(reason)}, NULL, {sql_val(dt)});")

    # Now auto generate remaining to get to 125 total transactions
    # Seed date base:
    base_date = datetime.datetime(2026, 6, 1)
    
    customers_list = [c[0] for c in cust_data]
    
    # We want at least 117 auto transactions
    for i in range(117):
        tx_id = f"tx_{tx_idx:03d}"
        tx_idx += 1
        
        # Pick customer
        cid = random.choice(customers_list)
        
        # Filter for accounts
        c_accs = account_map[cid]
        acc_obj = random.choice(c_accs)
        acc_id = acc_obj["id"]
        acc_type = acc_obj["type"]
        curr = acc_obj["currency"]
        
        # Pick category
        cat_choices = categories
        # Filter categories based on account type
        if acc_type == "savings":
            cat_choices = [("Savings", ["Interest Credited"]), ("Transfer", ["Send Money to Savings"])]
        elif acc_type == "crypto":
            cat_choices = [("Crypto", ["Buy BTC", "Sell BTC"])]
        elif acc_type == "gold":
            cat_choices = [("Gold", ["Buy PAXG", "Sell PAXG"])]
        else:
            # Checking
            cat_choices = [c for c in categories if c[0] not in ("Savings", "Crypto", "Gold")]
            
        cat, merchants = random.choice(cat_choices)
        merchant = random.choice(merchants)
        
        # Amount
        if cat == "Salary":
            amount = random.randint(15000, 100000)
            tx_type = "deposit"
        elif cat == "Savings" or merchant == "Received from Boss":
            amount = random.randint(10, 500)
            tx_type = "deposit"
        elif merchant.startswith("Send"):
            amount = random.randint(100, 5000)
            tx_type = "transfer"
        else:
            amount = random.randint(50, 2000)
            tx_type = "purchase"
            
        # Card matching
        card_id = None
        if tx_type == "purchase" and cid in cust_cards:
            card_obj = random.choice(cust_cards[cid])
            card_id = card_obj["id"]
            
        # Status
        status, reason = random.choice(tx_status_reasons)
        
        # Consistency overrides
        if status == "declined" and tx_type == "deposit":
            status = "success"
            reason = None
            
        if status == "declined":
            if not reason:
                reason = "insufficient_funds"
            # Override card limits or toggles if reason is specific
            if reason == "online_payment_disabled" and card_id:
                # Force online disabled on card
                pass
        
        dt_str = (base_date + datetime.timedelta(days=random.randint(0, 38), hours=random.randint(0, 23), minutes=random.randint(0, 59))).strftime("%Y-%m-%d %H:%M:%S")
        
        sql.append(f"INSERT INTO transactions (id, account_id, card_id, type, category, amount, currency, merchant_name, status, decline_reason, reference_id, created_at) VALUES ({sql_val(tx_id)}, {sql_val(acc_id)}, {sql_val(card_id)}, {sql_val(tx_type)}, {sql_val(cat)}, {sql_val(amount)}, {sql_val(curr)}, {sql_val(merchant)}, {sql_val(status)}, {sql_val(reason)}, NULL, {sql_val(dt_str)});")
        
    sql.append("")

    # 16. PENDING_ACTIONS
    pending_actions = [
        ("act_001", "cust_001", "Enable Online Payment", '{"card_id":"card_002","online_payment_enabled":1}', "pending", "2026-07-09 23:25:00", "2026-07-09 23:35:00"),
        ("act_002", "cust_006", "Update Card Limits", '{"card_id":"card_006","daily_limit":250000.0}', "confirmed", "2026-07-09 18:32:00", "2026-07-09 18:42:00"),
        ("act_007", "cust_001", "Freeze Card", '{"card_id":"card_001"}', "cancelled", "2026-07-09 10:00:00", "2026-07-09 10:10:00"),
        ("act_004", "cust_007", "Enable International Payment", '{"card_id":"card_009","international_payment_enabled":1}', "pending", "2026-07-09 23:34:00", "2026-07-09 23:44:00"),
        ("act_005", "cust_001", "Replace Card", '{"card_id":"card_001","reason":"stolen"}', "pending", "2026-07-09 23:30:00", "2026-07-09 23:40:00"),
        ("act_006", "cust_006", "Open Gold Wallet", '{"currency":"PAXG"}', "expired", "2026-07-08 12:00:00", "2026-07-08 12:10:00")
    ]
    for row in pending_actions:
        sql.append(f"INSERT INTO pending_actions (id, customer_id, action_type, action_details, status, created_at, expires_at) VALUES ({','.join(sql_val(x) for x in row)});")
    sql.append("")

    # 17. VOICE_SESSIONS
    voice_sessions = [
        ("sess_001", "cust_001", "2026-07-09 20:16:00", "2026-07-09 20:20:00", 240, "Apple iPhone 15 Pro", "en-US"),
        ("sess_002", "cust_006", "2026-07-09 18:31:00", "2026-07-09 18:35:00", 240, "Samsung Galaxy S24", "en-US"),
        ("sess_003", "cust_004", "2026-07-08 10:01:00", "2026-07-08 10:03:00", 120, "Google Pixel 8", "en-US"),
        ("sess_004", "cust_002", "2026-07-09 22:01:00", "2026-07-09 22:04:00", 180, "Xiaomi Redmi Note 13", "en-US"),
        ("sess_005", "cust_007", "2026-07-09 14:01:00", "2026-07-09 14:05:00", 240, "Apple iPhone 13", "en-US"),
        ("sess_006", "cust_001", "2026-07-09 23:26:00", "2026-07-09 23:32:00", 360, "Apple iPhone 15 Pro", "en-US")
    ]
    for row in voice_sessions:
        sql.append(f"INSERT INTO voice_sessions (id, customer_id, started_at, ended_at, duration_seconds, device, language) VALUES ({','.join(sql_val(x) for x in row)});")
    sql.append("")

    # 18. CONVERSATION_HISTORY
    convo_history = [
        ("ch_001", "sess_001", "user", "Hi, I tried to pay for Netflix with my card just now, but it got declined. Can you help?", None, "2026-07-09 20:16:10"),
        ("ch_002", "sess_001", "assistant", "Hello! Let me check that for you. I see a declined transaction of 549 PHP at Netflix. It was declined because Online Payments are disabled on your virtual card. Would you like me to enable Online Payments for you?", "getRecentTransactions", "2026-07-09 20:16:40"),
        ("ch_003", "sess_001", "user", "Yes please, enable it.", None, "2026-07-09 20:17:00"),
        ("ch_004", "sess_001", "assistant", "Sure! I have generated a request to enable Online Payments on your virtual card ending in 1234. Please confirm this action.", "enableOnlinePayment", "2026-07-09 20:17:25"),
        
        ("ch_005", "sess_006", "user", "Hey, I lost my physical card. I need to lock it and get a replacement.", None, "2026-07-09 23:26:15"),
        ("ch_006", "sess_006", "assistant", "I am sorry to hear that. I will freeze your physical card right away for security. I can also request a replacement physical card which you can print at any GoTyme kiosk. Shall we proceed with freezing and replacing your card?", "freezeCard", "2026-07-09 23:26:45"),
        ("ch_007", "sess_006", "user", "Yes, go ahead.", None, "2026-07-09 23:27:00"),
        ("ch_008", "sess_006", "assistant", "I've locked your card. Now, I need you to verify with your fingerprint on the phone popup to approve the replacement.", "replaceCard", "2026-07-09 23:27:30")
    ]
    for row in convo_history:
        sql.append(f"INSERT INTO conversation_history (id, voice_session_id, role, message, tool_called, timestamp) VALUES ({','.join(sql_val(x) for x in row)});")
    sql.append("")

    # 19. AUDIT_LOGS
    # We must generate at least 100 logs. Let's make it 105 logs.
    # We will map standard voice logs containing tool calls, guardrail triggers, and outcomes.
    audit_logs = []
    
    # 5 demo logs
    demo_audits = [
        ("aud_demo_01", "2026-07-09 20:16:30", "cust_001", "sess_001", "Netflix declined query", "Query declined Netflix transaction for card ending 1234", "getRecentTransactions", None, 0, 0, "Success: identified online_payment_disabled"),
        ("aud_demo_02", "2026-07-09 20:17:25", "cust_001", "sess_001", "Enable online payment request", "Create pending action to enable card online payment", "enableOnlinePayment", None, 1, 0, "Success: pending confirmation act_001 created"),
        ("aud_demo_03", "2026-07-09 18:32:00", "cust_006", "sess_002", "Amazon limit increase request", "Update daily transaction limit to 200000 PHP due to decline", "updateCardLimits", "GR_REQ_BIOMETRIC_HIGH_RISK", 1, 1, "Success: daily_limit updated on card_006"),
        ("aud_demo_04", "2026-07-08 10:02:00", "cust_004", "sess_003", "Card unfreeze attempt", "Frozen customer attempts card unfreeze", "unfreezeCard", "GR_FROZEN_ACCOUNT_BLOCK", 0, 0, "Blocked: Account frozen. Tool execution denied."),
        ("aud_demo_05", "2026-07-09 22:02:00", "cust_002", "sess_004", "Buy gold PAXG", "Pending KYC user attempts gold purchase", "buyGold", "GR_BLOCK_GOLD_IF_KYC_PENDING", 0, 0, "Blocked: KYC pending review. Transaction restricted.")
    ]
    for row in demo_audits:
        audit_logs.append(row)
        
    # Auto generate remaining 100 audits
    user_requests = [
        "Check account balance",
        "Explain last card decline",
        "Lock my virtual card",
        "Enable international shopping",
        "How do I fund my account?",
        "Open a savings goal",
        "What is the savings rate?",
        "Buy gold",
        "How safe is my gold wallet?",
        "Replace card",
        "Transfer money to my savings goal",
        "Check KYC status"
    ]
    
    agent_reasonings = [
        "Checking balance info on Everyday checkings and Go Save.",
        "Querying transactions to identify most recent decline reason.",
        "Triggering freezeCard on card_001 to secure account.",
        "Updating international payment permissions for card.",
        "Querying FAQ documents for funding instructions.",
        "Initiating internal checking-to-savings transfer to goal.",
        "Retrieving checking/savings interest rate details.",
        "Checking KYC and executing buyGold tool with biometric verification.",
        "Querying FAQ documents for gold security questions.",
        "Flagging stolen physical card and prompting replacement.",
        "Updating target savings goal configuration.",
        "Checking KYC document status in kyc_documents table."
    ]
    
    tool_mappings = [
        ("getBalance", None, 0, 0),
        ("getRecentTransactions", None, 0, 0),
        ("freezeCard", "GR_FORCE_CONFIRM_LOCK", 1, 0),
        ("enableInternationalPayment", None, 1, 0),
        ("getFAQAnswers", None, 0, 0),
        ("transferFundsInternal", None, 1, 0),
        ("getInterestRate", None, 0, 0),
        ("buyGold", "GR_REQ_BIOMETRIC_HIGH_RISK", 1, 1),
        ("getFAQAnswers", None, 0, 0),
        ("replaceCard", "GR_REQ_BIOMETRIC_HIGH_RISK", 1, 1),
        ("transferFundsInternal", None, 1, 0),
        ("getKycStatus", None, 0, 0)
    ]
    
    base_date = datetime.datetime(2026, 6, 10)
    for i in range(100):
        log_id = f"aud_{i+1:03d}"
        
        # Pick random customer
        cid = random.choice(customers_list)
        
        # Pick voice session
        sess_id = f"sess_{random.randint(1, 6):03d}"
        
        # Pick random query
        idx = random.randint(0, len(user_requests)-1)
        req = user_requests[idx]
        reasoning = agent_reasonings[idx]
        tool, guardrail, req_conf, req_bio = tool_mappings[idx]
        
        # Result string
        result = "Success: action completed successfully"
        if guardrail:
            result = f"Enforced: {guardrail} checked"
            
        dt_str = (base_date + datetime.timedelta(days=random.randint(0, 28), hours=random.randint(0, 23), minutes=random.randint(0, 59))).strftime("%Y-%m-%d %H:%M:%S")
        
        audit_logs.append((log_id, dt_str, cid, sess_id, req, reasoning, tool, guardrail, req_conf, req_bio, result))
        
    for row in audit_logs:
        sql.append(f"INSERT INTO audit_logs (id, timestamp, customer_id, voice_session_id, user_request, agent_reasoning_summary, tool_called, guardrail_triggered, requires_confirmation, requires_biometric, result) VALUES ({','.join(sql_val(x) for x in row)});")
        
    # Write to seed.sql
    output_path = "d:\\Downloads\\tmp\\seed.sql"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(sql))
    print(f"Successfully generated seed.sql with {len(audit_logs)} audit logs and {len(accounts)} accounts.")

if __name__ == "__main__":
    main()
