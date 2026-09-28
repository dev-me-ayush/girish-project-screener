import { neon } from "@neondatabase/serverless";

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://placeholder:placeholder@ep-placeholder.us-east-1.aws.neon.tech/neondb?sslmode=require";

export const sql = neon(databaseUrl);

