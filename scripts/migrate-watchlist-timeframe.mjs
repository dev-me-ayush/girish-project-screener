import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function main() {
  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'watchlists';
  `;
  console.log("watchlists columns:", cols);

  // Check if timeframe column exists
  const hasTimeframe = cols.some((c) => c.column_name === "timeframe");
  if (!hasTimeframe) {
    console.log("Adding timeframe column to watchlists...");
    await sql`ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS timeframe VARCHAR(10) DEFAULT '1m' NOT NULL;`;
    console.log("timeframe column added successfully!");
  } else {
    console.log("timeframe column already exists in watchlists.");
  }
}

main().catch(console.error);
