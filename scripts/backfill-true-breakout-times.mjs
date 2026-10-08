/**
 * Backfill TRUE breakout times from end-to-end 1m candle history.
 *
 * For each tested symbol this batch:
 *  1. loads the stored Trigger #1 alert (breach_count = 1) for the session,
 *  2. loads its PDH/PDL/AC/DC reference levels,
 *  3. fetches the FULL day of 1m intraday candles and walks them
 *     chronologically end-to-end (09:15 -> now), recording every
 *     INSIDE -> UP / INSIDE -> LOW transition with its candle timestamp,
 *  4. compares the stored poll-time stamp against the true first-breach
 *     candle (gap-opens resolve to the 09:15:00 opening candle),
 *  5. reports OLD vs TRUE; with --apply, replaces the stale poll-time
 *     stamp (removes the old backfill) and sets trigger_price to the true
 *     candle close.
 *
 * Run (dry-run report):
 *   node --env-file=.env.local scripts/backfill-true-breakout-times.mjs --symbols=ACE,HSCL,HINDZINC --limit=20
 * Apply corrections:
 *   node --env-file=.env.local scripts/backfill-true-breakout-times.mjs --symbols=... --apply
 */
import { neon } from "@neondatabase/serverless";
import process from "node:process";

const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}
const sql = neon(databaseUrl);

const token = process.env.UPSTOX_ACCESS_TOKEN;
const headers = { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
const BASE = "https://api.upstox.com/v2";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(=(.*))?$/);
    return [m[1], m[3] ?? true];
  })
);
const APPLY = args.apply === true || args.apply === "true";
const LIMIT = Math.min(Math.max(Number(args.limit || 20), 1), 200);
const ONLY_SYMBOLS = String(args.symbols || "")
  .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

function istToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}
const session = String(args.session || istoday());
function istoday() { return istToday(); }

function fmtIST(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(d);
  const m = {};
  for (const x of p) m[x.type] = x.value;
  return `${m.hour === "24" ? "00" : m.hour}:${m.minute}:${m.second}`;
}

async function upstoxGet(url, retries = 2) {
  for (let a = 0; a <= retries; a++) {
    const res = await fetch(url, { headers });
    if (res.status === 429 && a < retries) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** a));
      continue;
    }
    if (!res.ok) throw new Error(`Upstox ${res.status}`);
    return res.json();
  }
}

function walkTimeline(candlesChrono, ac, dc) {
  const events = [];
  let state = "INSIDE";
  for (const c of candlesChrono) {
    const dir = c.close > ac ? "UP" : c.close < dc ? "LOW" : "INSIDE";
    if (dir !== "INSIDE" && state !== dir) {
      events.push({ time: fmtIST(c.timestamp), direction: dir, close: c.close });
    }
    if (dir !== state) state = dir === "INSIDE" ? "INSIDE" : dir;
  }
  return events;
}

// Pick test symbols: explicit list, else worst-stamped Trigger #1 rows (latest poll times first).
let alerts;
if (ONLY_SYMBOLS.length > 0) {
  alerts = [];
  for (const s of ONLY_SYMBOLS) {
    const rows = await sql`
      SELECT id, symbol, instrument_key, level_name, level_price, trigger_price, breach_count, breakout_time
      FROM scanner_alerts
      WHERE session_date = ${session}::DATE AND symbol = ${s}
      ORDER BY breach_count ASC LIMIT 1
    `;
    if (rows.length > 0) alerts.push(rows[0]);
    else console.log(`  SKIP ${s}: no alert stored for session ${session}`);
  }
} else {
  alerts = await sql`
    SELECT id, symbol, instrument_key, level_name, level_price, trigger_price, breach_count, breakout_time
    FROM scanner_alerts
    WHERE session_date = ${session}::DATE AND breach_count = 1
    ORDER BY breakout_time DESC LIMIT ${LIMIT}
  `;
}
console.log(`session=${session} mode=${APPLY ? "APPLY" : "REPORT"} symbols=${alerts.length}`);

const summary = { match: 0, corrected: 0, noCandles: 0, noBreach: 0, noLevels: 0, failed: 0 };
for (const a of alerts) {
  const symbol = String(a.symbol);
  try {
    const lvRows = await sql`
      SELECT pdh, pdl, ac38_2, dc38_2 FROM daily_reference_levels
      WHERE symbol = ${symbol} AND session_date = ${session}::DATE LIMIT 1
    `;
    if (lvRows.length === 0 || !(Number(lvRows[0].ac38_2) > 0)) {
      summary.noLevels++;
      console.log(`  NO-LEVELS  ${symbol}: stored=${a.breakout_time} (levels missing)`);
      continue;
    }
    const ac = Number(lvRows[0].ac38_2), dc = Number(lvRows[0].dc38_2);
    const wantDir = String(a.level_name).startsWith("AC") ? "UP" : "LOW";
    const levelPx = wantDir === "UP" ? ac : dc;

    const json = await upstoxGet(
      `${BASE}/historical-candle/intraday/${encodeURIComponent(String(a.instrument_key))}/1minute`
    );
    const raw = json.data?.candles || [];
    if (raw.length === 0) {
      summary.noCandles++;
      console.log(`  NO-CANDLES  ${symbol}: stored=${a.breakout_time} (intraday empty)`);
      continue;
    }
    const chrono = [...raw].reverse().map((c) => ({ timestamp: c[0], close: Number(c[4]) }));
    const timeline = walkTimeline(chrono, ac, dc);
    const first = timeline.find((e) => e.direction === wantDir);
    const tl = timeline.map((e) => `${e.time}${e.direction === "UP" ? "↑" : "↓"}`).join(" ");
    if (!first) {
      summary.noBreach++;
      console.log(`  NO-BREACH  ${symbol} ${a.level_name}@${a.level_price}: stored=${a.breakout_time} timeline=[${tl}]`);
      continue;
    }
    const stored = String(a.breakout_time);
    if (stored === first.time) {
      summary.match++;
      console.log(`  MATCH  ${symbol} ${wantDir} level=${levelPx} time=${stored} candles=${raw.length} timeline=[${tl}]`);
    } else {
      if (APPLY) {
        try {
          await sql`
            UPDATE scanner_alerts SET breakout_time = ${first.time}, trigger_price = ${first.close}
            WHERE id = ${a.id}
          `;
          summary.corrected++;
          console.log(`  CORRECTED  ${symbol} ${wantDir} level=${levelPx}: ${stored} -> ${first.time} @${first.close} timeline=[${tl}]`);
        } catch (err) {
          if (String(err.message || err).includes("duplicate") || err.code === "23505") {
            await sql`DELETE FROM scanner_alerts WHERE id = ${a.id}`;
            summary.corrected++;
            console.log(`  DEDUPED  ${symbol}: removed stale ${stored}, kept ${first.time}`);
          } else throw err;
        }
      } else {
        summary.corrected++;
        console.log(`  WOULD-CORRECT  ${symbol} ${wantDir} level=${levelPx}: ${stored} -> ${first.time} @${first.close} timeline=[${tl}]`);
      }
    }
  } catch (err) {
    summary.failed++;
    console.log(`  FAILED  ${symbol}: ${err.message}`);
  }
  await new Promise((r) => setTimeout(r, 300));
}
console.log("summary:", JSON.stringify(summary));
process.exit(0);
