import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Missing DATABASE_URL in environment.");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function migrate() {
  console.log("=== Starting Neon Schema Migration ===");

  // 1. Create daily_reference_levels
  console.log("1. Creating daily_reference_levels table...");
  await sql`
    CREATE TABLE IF NOT EXISTS daily_reference_levels (
      id SERIAL PRIMARY KEY,
      symbol VARCHAR(50) NOT NULL,
      instrument_key VARCHAR(100) NOT NULL,
      instrument_type VARCHAR(20) NOT NULL DEFAULT 'EQUITY',
      session_date DATE NOT NULL,
      pdh NUMERIC NOT NULL,
      pdl NUMERIC NOT NULL,
      pdc NUMERIC NOT NULL,
      range NUMERIC NOT NULL,
      delta NUMERIC NOT NULL,
      ac38_2 NUMERIC NOT NULL,
      dc38_2 NUMERIC NOT NULL,
      average NUMERIC NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT uq_daily_symbol_session UNIQUE (symbol, session_date)
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_daily_session ON daily_reference_levels(session_date);`;
  console.log("   ✓ daily_reference_levels created.");

  // 2. Create user_pinned_symbols (Single Personal Watchlist)
  console.log("2. Creating user_pinned_symbols table...");
  await sql`
    CREATE TABLE IF NOT EXISTS user_pinned_symbols (
      id SERIAL PRIMARY KEY,
      user_email VARCHAR(255) NOT NULL,
      symbol VARCHAR(50) NOT NULL,
      instrument_key VARCHAR(100) NOT NULL,
      instrument_type VARCHAR(20) NOT NULL DEFAULT 'EQUITY',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT uq_user_pinned_symbol UNIQUE (user_email, symbol)
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_pinned_user ON user_pinned_symbols(user_email);`;
  console.log("   ✓ user_pinned_symbols created.");

  // 3. Upgrade scanner_alerts with session_date, breach_count, and instrument_type
  console.log("3. Upgrading scanner_alerts schema...");
  await sql`
    ALTER TABLE scanner_alerts
      ADD COLUMN IF NOT EXISTS instrument_type VARCHAR(20) DEFAULT 'EQUITY',
      ADD COLUMN IF NOT EXISTS breach_count INT DEFAULT 1,
      ADD COLUMN IF NOT EXISTS session_date DATE DEFAULT CURRENT_DATE,
      ADD COLUMN IF NOT EXISTS breakout_time VARCHAR(25);
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_alerts_date ON scanner_alerts(session_date DESC, triggered_at DESC);`;
  console.log("   ✓ scanner_alerts upgraded.");

  console.log("\n=== Migration Completed Successfully! ===");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
