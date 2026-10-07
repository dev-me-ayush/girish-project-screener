import { neon } from "@neondatabase/serverless";
import { scryptSync, randomBytes } from "node:crypto";

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is missing.");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function main() {
  const email = process.env.SEED_USER_EMAIL || "girishsir@my.app.com";
  const password = process.env.SEED_USER_PASSWORD;
  if (!password) {
    console.error("SEED_USER_PASSWORD is required (refusing to seed a hardcoded password).");
    process.exit(1);
  }
  const passwordHash = hashPassword(password);

  await sql`
    INSERT INTO users (email, password_hash, name)
    VALUES (${email}, ${passwordHash}, 'Girish Sir')
    ON CONFLICT (email) DO UPDATE
    SET password_hash = ${passwordHash}, updated_at = NOW()
  `;

  const rows = await sql`SELECT id, email, name, created_at FROM users WHERE email = ${email}`;
  console.log("Configured authorized user:", rows[0]);
}

main().catch((err) => {
  console.error("Failed to seed user:", err);
  process.exit(1);
});
