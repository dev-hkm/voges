import sqlite3

def main():
    db_path = "d:\\Downloads\\tmp\\mockBankingDatabase.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 1. Check foreign keys
    print("Checking foreign key integrity...")
    cursor.execute("PRAGMA foreign_key_check;")
    violations = cursor.fetchall()
    if violations:
        print("WARNING: Foreign key violations found!")
        for v in violations:
            print(v)
    else:
        print("PASS: No foreign key violations.")
        
    # 2. Get list of tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [t[0] for t in cursor.fetchall()]
    print(f"\nFound {len(tables)} tables:")
    for t in sorted(tables):
        print(f"  - {t}")
        
    expected_tables = [
        "customers", "accounts", "cards", "transactions", "beneficiaries",
        "support_tickets", "kyc_documents", "product_documents", "products",
        "bank_features", "allowed_tools", "tool_permissions", "guardrails",
        "pending_actions", "audit_logs", "demo_scenarios", "voice_sessions",
        "conversation_history", "system_settings"
    ]
    
    missing_tables = [t for t in expected_tables if t not in tables]
    if missing_tables:
        print(f"FAIL: Missing tables: {missing_tables}")
    else:
        print("PASS: All 19 expected tables are present.")
        
    # 3. Check counts
    print("\nChecking row counts:")
    checks = [
        ("customers", 10),
        ("transactions", 100),
        ("audit_logs", 100),
        ("guardrails", 30),
        ("allowed_tools", 25)
    ]
    for table, min_count in checks:
        cursor.execute(f"SELECT COUNT(*) FROM {table};")
        count = cursor.fetchone()[0]
        if count >= min_count:
            print(f"  - {table}: {count} rows (PASS, >= {min_count})")
        else:
            print(f"  - {table}: {count} rows (FAIL, < {min_count})")
            
    # 4. Test some query scenarios
    print("\nTesting sample queries:")
    
    # Find declined transactions and reasons
    cursor.execute("""
        SELECT c.full_name, t.category, t.amount, t.decline_reason 
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        JOIN customers c ON a.customer_id = c.id
        WHERE t.status = 'declined'
        LIMIT 5;
    """)
    print("Declined transactions sample:")
    for row in cursor.fetchall():
        print(f"  {row[0]} - {row[1]} ({row[2]} PHP): Declined due to {row[3]}")
        
    # Find audit logs with guardrail triggers
    cursor.execute("""
        SELECT a.timestamp, c.full_name, a.user_request, a.guardrail_triggered, a.result
        FROM audit_logs a
        JOIN customers c ON a.customer_id = c.id
        WHERE a.guardrail_triggered IS NOT NULL
        LIMIT 5;
    """)
    print("\nAudit logs with guardrail triggers sample:")
    for row in cursor.fetchall():
        print(f"  {row[0]} | {row[1]}: '{row[2]}' -> Triggered {row[3]} -> Result: {row[4]}")
        
    conn.close()

if __name__ == "__main__":
    main()
