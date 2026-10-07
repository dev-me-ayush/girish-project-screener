import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Missing DATABASE_URL in environment.");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function migrate() {
  console.log("=== scanner_alerts level_name backfill ===");

  // Column written by both alert writers but missing from earlier migrations.
  await sql`
    ALTER TABLE scanner_alerts
      ADD COLUMN IF NOT EXISTS level_name VARCHAR(20);
  `;
  console.log("  ✓ level_name column ensured.");

  // Backfill legacy rows that only set level_type.
  const backfilled = await sql`
    UPDATE scanner_alerts
    SET level_name = level_type
    WHERE level_name IS NULL AND level_type IS NOT NULL
    RETURNING id;
  `;
  console.log(`  ✓ backfilled ${backfilled.length} legacy rows.`);

  // Dedupe: earlier engine revisions could insert the same event twice
  // (tick re-polls). Keep the earliest row per idempotency key.
  const dupes = await sql`
    DELETE FROM scanner_alerts a
    USING scanner_alerts b
    WHERE a.id > b.id
      AND a.symbol = b.symbol
      AND a.session_date IS NOT DISTINCT FROM b.session_date
      AND a.breakout_time IS NOT DISTINCT FROM b.breakout_time
      AND a.level_name IS NOT DISTINCT FROM b.level_name
    RETURNING a.id;
  `;
  console.log(`  ✓ removed ${dupes.length} duplicate rows.`);

  // Idempotency key so retries/restarts cannot double-insert the same event.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_alerts_symbol_session_time
    ON scanner_alerts (symbol, session_date, breakout_time, level_name);
  `;
  console.log("  ✓ unique index uq_alerts_symbol_session_time ensured.");

  console.log("=== Migration complete ===");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
