import sqlite3
import os

def main():
    db_path = "d:\\Downloads\\tmp\\mockBankingDatabase.db"
    schema_path = "d:\\Downloads\\tmp\\schema.sql"
    seed_path = "d:\\Downloads\\tmp\\seed.sql"
    
    if os.path.exists(db_path):
        os.remove(db_path)
        print("Removed existing database file.")
        
    print("Connecting to database...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    print("Reading schema.sql...")
    with open(schema_path, "r", encoding="utf-8") as f:
        schema_sql = f.read()
        
    print("Executing schema.sql...")
    cursor.executescript(schema_sql)
    print("Schema executed successfully.")
    
    print("Reading seed.sql...")
    with open(seed_path, "r", encoding="utf-8") as f:
        seed_sql = f.read()
        
    print("Executing seed.sql...")
    cursor.executescript(seed_sql)
    print("Seed executed successfully.")
    
    conn.commit()
    conn.close()
    print("Database committed and closed.")

if __name__ == "__main__":
    main()
