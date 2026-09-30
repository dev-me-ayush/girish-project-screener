import { neon } from "@neondatabase/serverless";
import process from "node:process";

const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function migrate() {
  console.log("Starting Neon database migration for Scanner & Watchlist system...");

  // 1. Create watchlists table
  await sql`
    CREATE TABLE IF NOT EXISTS watchlists (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_email VARCHAR(255) NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  console.log("✓ Table 'watchlists' verified/created.");

  // 2. Create watchlist_items table
  await sql`
    CREATE TABLE IF NOT EXISTS watchlist_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      watchlist_id UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
      symbol VARCHAR(50) NOT NULL,
      instrument_key VARCHAR(100) NOT NULL,
      instrument_type VARCHAR(20) NOT NULL,
      strike_price NUMERIC,
      option_type VARCHAR(5),
      expiry_date DATE,
      is_expired BOOLEAN DEFAULT FALSE,
      added_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  await sql`
    ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS is_expired BOOLEAN DEFAULT FALSE;
  `;
  console.log("✓ Table 'watchlist_items' verified/created.");

  // 3. Create scanner_alerts table
  await sql`
    CREATE TABLE IF NOT EXISTS scanner_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      watchlist_id UUID REFERENCES watchlists(id) ON DELETE CASCADE,
      symbol VARCHAR(50) NOT NULL,
      instrument_key VARCHAR(100) NOT NULL,
      timeframe VARCHAR(10) NOT NULL,
      level_type VARCHAR(20) NOT NULL,
      level_price NUMERIC NOT NULL,
      trigger_price NUMERIC NOT NULL,
      direction VARCHAR(10) NOT NULL,
      open_interest BIGINT,
      triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  console.log("✓ Table 'scanner_alerts' verified/created.");

  // Tables verified
  console.log("Migration complete! Database schema is ready.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
