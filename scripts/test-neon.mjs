import { neon } from "@neondatabase/serverless";
import { scryptSync, timingSafeEqual } from "node:crypto";

function verifyPassword(password, storedHash) {
  try {
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = scryptSync(password, salt, 64);
    if (keyBuffer.length !== derivedKey.length) return false;
    return timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function run() {
  console.log("1. Checking connection to Neon...");
  const info = await sql`SELECT current_database(), current_user, version()`;
  console.log("   Connected to database:", info[0].current_database, "as user:", info[0].current_user);

  console.log("2. Verifying existing tables in public schema...");
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
  console.log("   Tables found:", tables.map((t) => t.table_name).join(", "));

  console.log("3. Querying screener_stocks...");
  const stocks = await sql`SELECT symbol, name, price, change, rsi FROM screener_stocks ORDER BY id ASC`;
  console.log(`   Found ${stocks.length} stocks:`, stocks.map((s) => s.symbol).join(", "));

  console.log("4. Testing authorized user login authentication (girishsir@my.app.com)...");
  const authUsers = await sql`SELECT id, email, password_hash FROM users WHERE email = ${'girishsir@my.app.com'} LIMIT 1`;
  if (authUsers.length === 0) {
    throw new Error("Designated user girishsir@my.app.com not found!");
  }
  const validPass = verifyPassword("Girish@1112", authUsers[0].password_hash);
  if (!validPass) {
    throw new Error("Password verification failed for Girish@1112");
  }
  console.log("   Valid credentials (girishsir@my.app.com + Girish@1112) -> AUTH SUCCESS");

  console.log("5. Testing invalid password rejection...");
  const invalidPass = verifyPassword("WrongPassword123", authUsers[0].password_hash);
  if (invalidPass) {
    throw new Error("Invalid password should not have passed!");
  }
  console.log("   Invalid credentials -> REJECTED (SUCCESS)");

  console.log("6. Testing unknown user rejection (no registration)...");
  const unknownUser = await sql`SELECT id FROM users WHERE email = ${'random@my.app.com'} LIMIT 1`;
  if (unknownUser.length !== 0) {
    throw new Error("Unknown user unexpectedly exists!");
  }
  console.log("   Unknown user -> REJECTED (SUCCESS)");

  console.log("All Neon database and authentication checks verified successfully end-to-end!");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
