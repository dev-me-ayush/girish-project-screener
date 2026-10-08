/**
 * Reconcile stored breakout alerts against end-to-end 1m candle truth.
 *
 * For each symbol with alerts in the session:
 *  1. walks the FULL day of 1m candles chronologically, recording every
 *     genuine INSIDE -> UP / INSIDE -> LOW transition (candle-close basis),
 *  2. fixes a wrong Trigger #1 poll-time stamp to the true first-breach
 *     candle (gap-opens resolve to 09:15:00),
 *  3. deletes PHANTOM alerts: stored breach rows beyond the genuine event
 *     count (e.g. re-fires stamped during a deploy restart while price
 *     never pulled back inside). Genuine #2+ rows keep their live stamps.
 *
 * Run (dry-run report):
 *   node --env-file=.env.local scripts/reconcile-alerts.mjs [--symbols=A,B] [--limit=N]
 * Apply:
 *   node --env-file=.env.local scripts/reconcile-alerts.mjs --apply [--symbols=...]
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

const rawArgs = process.argv.slice(2);
const args = {};
for (let i = 0; i < rawArgs.length; i++) {
  const m = rawArgs[i].match(/^--([^=]+)(=(.*))?$/);
  if (!m) continue;
  if (m[3] !== undefined) args[m[1]] = m[3];
  else if (i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith("--")) args[m[1]] = rawArgs[++i];
  else args[m[1]] = true;
}
const APPLY = args.apply === true || args.apply === "true";
const LIMIT = Math.min(Math.max(Number(args.limit || 2000), 1), 3000);
const ONLY = String(args.symbols || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

function istToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}
const session = String(args.session || istToday());

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
      await new Promise((r) => setTimeout(r, 600 * 2 ** a));
      continue;
    }
    if (!res.ok) throw new Error(`Upstox ${res.status}`);
    return res.json();
  }
}

let symbols;
if (ONLY.length > 0) {
  symbols = ONLY;
} else {
  const rows = await sql`
    SELECT DISTINCT symbol FROM scanner_alerts
    WHERE session_date = ${session}::DATE ORDER BY symbol ASC LIMIT ${LIMIT}
  `;
  symbols = rows.map((r) => String(r.symbol));
}
console.log(`session=${session} mode=${APPLY ? "APPLY" : "REPORT"} symbols=${symbols.length}`);

// Bulk-load all levels for the session once.
const lvRows = await sql`
  SELECT symbol, instrument_key, ac38_2, dc38_2 FROM daily_reference_levels
  WHERE session_date = ${session}::DATE
`;
const lvMap = new Map(lvRows.map((r) => [String(r.symbol), r]));

const summary = { ok: 0, fixed1: 0, phantomsRemoved: 0, noLevels: 0, noCandles: 0, failed: 0 };
for (const symbol of symbols) {
  try {
    const stored = await sql`
      SELECT id, level_name, level_price, trigger_price, breach_count, breakout_time
      FROM scanner_alerts WHERE symbol = ${symbol} AND session_date = ${session}::DATE
      ORDER BY breach_count ASC
    `;
    if (stored.length === 0) continue;
    const lv = lvMap.get(symbol);
    if (!lv || !(Number(lv.ac38_2) > 0)) {
      summary.noLevels++;
      console.log(`  NO-LEVELS  ${symbol} (${stored.length} stored)`);
      continue;
    }
    const ac = Number(lv.ac38_2), dc = Number(lv.dc38_2);
    const json = await upstoxGet(
      `${BASE}/historical-candle/intraday/${encodeURIComponent(String(lv.instrument_key))}/1minute`
    );
    const raw = json.data?.candles || [];
    if (raw.length === 0) {
      summary.noCandles++;
      console.log(`  NO-CANDLES  ${symbol} (${stored.length} stored)`);
      continue;
    }
    // End-to-end chronological walk.
    const events = [];
    let state = "INSIDE";
    for (const c of [...raw].reverse()) {
      const close = Number(c[4]);
      const dir = close > ac ? "UP" : close < dc ? "LOW" : "INSIDE";
      if (dir !== "INSIDE" && state !== dir) events.push({ time: fmtIST(c[0]), direction: dir, close });
      if (dir !== state) state = dir === "INSIDE" ? "INSIDE" : dir;
    }

    const first = stored[0];
    const wantDir = String(first.level_name).startsWith("AC") ? "UP" : "LOW";
    const trueFirst = events.find((e) => e.direction === wantDir);
    const genuineTotal = events.length;

    const toMin = (t) => {
      const [h, m, s] = String(t).split(":").map(Number);
      return h * 60 + m + s / 60;
    };
    const nearGenuine = (stamp, windowMin = 5) =>
      events.some((e) => Math.abs(toMin(e.time) - toMin(stamp)) <= windowMin);

    // R1 (#1 late fix, conservative): only move a stored #1 EARLIER, and
    // only when it is more than 2 min late vs the first genuine close.
    // A stored #1 earlier than the first close is a legit intra-candle
    // LTP catch (e.g. JLHL) and must NOT be "corrected" forward.
    const r1 =
      trueFirst && toMin(String(first.breakout_time)) - toMin(trueFirst.time) > 2 ? trueFirst : null;
    // R2 (phantom delete, conservative): a breach>1 row is a phantom only
    // when NO genuine close-event sits within +/-5 min of its stamp.
    // Poll-lagged detections of real re-crosses (e.g. JLHL #3 @10:53 vs
    // genuine 10:52) are kept.
    const phantoms = stored.filter((r, i) => i > 0 && !nearGenuine(String(r.breakout_time), 5));
    // Missing genuine re-crosses the engine never caught: leave as-is, never fabricate.

    if (phantoms.length === 0 && !r1) {
      summary.ok++;
      if (symbols.length <= 40) console.log(`  OK  ${symbol}: ${stored.length} stored, ${genuineTotal} genuine`);
    } else {
      const tag = APPLY ? "APPLIED" : "WOULD-APPLY";
      const actions = [];
      if (r1) {
        if (APPLY) {
          await sql`UPDATE scanner_alerts SET breakout_time = ${r1.time}, trigger_price = ${r1.close} WHERE id = ${first.id}`;
          summary.fixed1++;
          actions.push(`#1 ${first.breakout_time}->${r1.time}`);
        } else {
          summary.fixed1++;
          actions.push(`#1 ${first.breakout_time}->${r1.time} @${r1.close}`);
        }
      }
      if (phantoms.length > 0) {
        if (APPLY) {
          for (const p of phantoms) await sql`DELETE FROM scanner_alerts WHERE id = ${p.id}`;
          summary.phantomsRemoved += phantoms.length;
          actions.push(`deleted phantom #${phantoms.map((p) => p.breach_count).join(",#")} (${phantoms.map((p) => p.breakout_time).join(",")})`);
        } else {
          summary.phantomsRemoved += phantoms.length;
          actions.push(`phantom #${phantoms.map((p) => p.breach_count).join(",#")} @${phantoms.map((p) => p.breakout_time).join(",")}`);
        }
      }
      if (stored.length < genuineTotal) actions.push(`engine missed ${genuineTotal - stored.length} genuine re-cross(es), left as-is`);
      console.log(`  ${tag}  ${symbol}: stored=${stored.length} genuine=${genuineTotal} :: ${actions.join(" ; ")}`);
    }
  } catch (err) {
    summary.failed++;
    console.log(`  FAILED  ${symbol}: ${err.message}`);
  }
  await new Promise((r) => setTimeout(r, 350));
}
console.log("summary:", JSON.stringify(summary));
process.exit(0);
