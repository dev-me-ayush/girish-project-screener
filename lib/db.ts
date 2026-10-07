import { neon } from "@neondatabase/serverless";

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://placeholder:placeholder@ep-placeholder.us-east-1.aws.neon.tech/neondb?sslmode=require";

// Fail fast with a clear message when the app runs without a real database.
// The placeholder exists only so `pnpm build` can statically render routes.
if (
  databaseUrl.includes("ep-placeholder") &&
  process.env.NEXT_PHASE !== "phase-production-build"
) {
  throw new Error(
    "DATABASE_URL is not configured (placeholder detected). Set DATABASE_URL / DATABASE_URL_UNPOOLED via .env.local or Secrets Manager."
  );
}

export const sql = neon(databaseUrl);

