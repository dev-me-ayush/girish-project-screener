<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Primary Database: Neon Postgres

This project uses **Neon Serverless Postgres** as its primary database.

- **Neon Project ID**: `purple-cake-38903617`
- **Default Branch**: `production`
- **Local Context**: `.neon`
- **Configuration Policy**: `neon.ts`

### Environment Variables

Environment variables are managed locally in `.env.local` and `.env` (synced via `neon env pull`):

- `DATABASE_URL`: Connection string with pooling (`-pooler`) for application serverless queries.
- `DATABASE_URL_UNPOOLED`: Direct connection string without pooling, reserved for DDL, migrations, and schema operations.
- `NEON_PROJECT_ID`: Active project ID (`purple-cake-38903617`).
- `NEON_BRANCH`: Target branch (`production`).

### Agent Directives for Database Operations

1. **Direct Neon Management via Skills & MCP**:
   - The project is equipped with the official Neon Agent Skills located in `.agents/skills/` (`neon`, `neon-postgres`, `neon-postgres-branches`, `neon-ai-gateway`, `neon-auth`, `neon-functions`, `neon-object-storage`, `neon-postgres-egress-optimizer`).
   - Use Neon MCP tools (`Neon/run_sql`, `Neon/describe_table_schema`, `Neon/get_database_tables`, etc.) or the official CLI (`neon`) directly to inspect the database, run SQL statements, and manage database tables and migrations.
   - Do not invent custom database drivers or connect to secondary databases; all tables, auth records, and application data belong in Neon.

2. **Application Driver & Data Access**:
   - Application queries use `@neondatabase/serverless` through the singleton SQL client exported at `lib/db.ts`:
     ```ts
     import { sql } from "@/lib/db";
     ```
   - Always use tagged template literals (`sql`SELECT ... WHERE id = ${id}``) for parameterized query execution to avoid SQL injection.

3. **Current Tables**:
   - `users`: User identity records (`id UUID PRIMARY KEY`, `email VARCHAR UNIQUE`, `password_hash TEXT`, `created_at`, `updated_at`).
   - `screener_stocks`: Screener equities catalog (`id SERIAL PRIMARY KEY`, `symbol VARCHAR UNIQUE`, `name`, `price NUMERIC`, `change`, `rsi NUMERIC`, `volume`, `market_cap`, `is_up BOOLEAN`, `created_at`).

4. **Testing Database Changes**:
   - Test end-to-end database connectivity and query operations with:
     ```powershell
     node --env-file=.env.local scripts/test-neon.mjs
     ```

## Verification

Do not run the production build (`pnpm build` / `npm run build`) as part of normal work. It is slow, and on a project this size it rarely tells us more than the two checks below.

Verify changes with:

- `pnpm typecheck` — `tsc --noEmit`
- `pnpm lint` — ESLint

Run the production build only when the change is genuinely large or systemic: a framework or build configuration change, a dependency or upgrade, a routing or rendering-mode change that could alter what gets prerendered, or a release. If you are unsure whether a change qualifies, it does not — ask first.

Say plainly which checks you ran and which you skipped, and anything that therefore went unverified.
