import { neon } from "@neondatabase/serverless";
import process from "node:process";

const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function runMigration() {
  console.log("Applying Watchlist & Scanner schema migrations in Neon PostgreSQL...");

  await sql`
    ALTER TABLE watchlists 
    ADD COLUMN IF NOT EXISTS is_scanning_active BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS last_scanned_at TIMESTAMPTZ;
  `;
  console.log("✓ Added is_scanning_active and last_scanned_at to watchlists");

  await sql`
    ALTER TABLE watchlist_items 
    ADD COLUMN IF NOT EXISTS timeframe VARCHAR(10) DEFAULT '1m',
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
  `;
  console.log("✓ Added timeframe and is_active to watchlist_items");

  await sql`
    CREATE INDEX IF NOT EXISTS idx_watchlist_items_timeframe 
    ON watchlist_items(watchlist_id, timeframe);
  `;
  console.log("✓ Created index idx_watchlist_items_timeframe");

  console.log("All migrations executed successfully.");
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
