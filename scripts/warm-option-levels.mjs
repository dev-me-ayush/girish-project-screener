/**
 * Warm Option Reference Levels (one-off / ops batch).
 *
 * Resolves the same 52 ATM index-option contracts as
 * lib/scanner/options-resolver.ts (NIFTY ATM ±7, BANKNIFTY ATM ±5, nearest
 * expiry), fetches each contract's previous completed session PDH/PDL/PDC
 * from Upstox historical daily candles, computes client Fibonacci
 * AC/DC 38.2% levels, and persists them into daily_reference_levels for
 * today's IST session.
 *
 * Run: node --env-file=.env.local scripts/warm-option-levels.mjs
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

const UNDERLYINGS = [
  { key: "NSE_INDEX|Nifty 50", name: "NIFTY", radius: 7 },
  { key: "NSE_INDEX|Nifty Bank", name: "BANKNIFTY", radius: 5 },
];

async function upstoxGet(url, retries = 2) {
  for (let a = 0; a <= retries; a++) {
    const res = await fetch(url, { headers });
    if (res.status === 429 && a < retries) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** a));
      continue;
    }
    if (!res.ok) throw new Error(`Upstox ${res.status} for ${url}`);
    return res.json();
  }
}

function istToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

async function resolveContracts() {
  const out = [];
  for (const u of UNDERLYINGS) {
    const spotJson = await upstoxGet(
      `${BASE}/market-quote/ohlc?instrument_key=${encodeURIComponent(u.key)}&interval=1d`
    );
    const spotQuote = spotJson.data?.[u.key.replace("|", ":")] || {};
    const spot = spotQuote.last_price || spotQuote.ohlc?.close || 0;
    const chainJson = await upstoxGet(`${BASE}/option/contract?instrument_key=${encodeURIComponent(u.key)}`);
    const raw = chainJson.data || [];
    const todayStr = new Date().toISOString().split("T")[0];
    const expiries = [...new Set(raw.map((c) => c.expiry).filter((e) => e >= todayStr))].sort();
    const nearest = expiries[0];
    const cur = raw.filter((c) => c.expiry === nearest);
    const strikes = [...new Set(cur.map((c) => Number(c.strike_price)))].sort((a, b) => a - b);
    let atm = strikes[0], atmIdx = 0;
    strikes.forEach((s, i) => {
      if (Math.abs(s - spot) < Math.abs(atm - spot)) { atm = s; atmIdx = i; }
    });
    const allowed = strikes.slice(Math.max(0, atmIdx - u.radius), Math.min(strikes.length, atmIdx + u.radius + 1));
    for (const strike of allowed) {
      for (const type of ["CE", "PE"]) {
        const c = cur.find((x) => Number(x.strike_price) === strike && x.instrument_type === type);
        if (c) out.push({ symbol: c.trading_symbol, instrument_key: c.instrument_key, underlying: u.name, strike_price: strike, option_type: type, expiry: nearest });
      }
    }
    console.log(`${u.name}: spot=${spot} atm=${atm} expiry=${nearest} contracts=${out.filter((o) => o.underlying === u.name).length}`);
  }
  return out;
}

async function prevDayRange(instrumentKey, todayIST) {
  const from = new Date(Date.now() - 10 * 864e5).toISOString().split("T")[0];
  const json = await upstoxGet(
    `${BASE}/historical-candle/${encodeURIComponent(instrumentKey)}/day/${todayIST}/${from}`
  );
  const candles = json.data?.candles || [];
  const done = candles.filter((c) => !String(c[0]).startsWith(todayIST));
  const bar = done.length > 0 ? done[0] : candles[0];
  if (!bar) return null;
  const pdh = Number(bar[2]), pdl = Number(bar[3]), pdc = Number(bar[4]);
  const range = Number(Math.max(0, pdh - pdl).toFixed(2));
  if (!(range > 0 && pdc > 0)) return null;
  const delta = Number((range * 0.382 * 1.236).toFixed(2));
  return {
    pdh, pdl, pdc, range, delta,
    ac38_2: Number((pdc + delta).toFixed(2)),
    dc38_2: Number((pdc - delta).toFixed(2)),
    average: Number(((pdh + pdl + pdc) / 3).toFixed(2)),
  };
}

const sessionDate = istToday();
console.log("session:", sessionDate);
const contracts = await resolveContracts();
console.log(`resolved ${contracts.length} option contracts`);

let filled = 0, failed = 0;
for (const c of contracts) {
  try {
    const lv = await prevDayRange(c.instrument_key, sessionDate);
    if (!lv) { failed++; console.log(`  NO-HISTORY  ${c.symbol}`); continue; }
    await sql`
      INSERT INTO daily_reference_levels (
        symbol, instrument_key, instrument_type, session_date,
        pdh, pdl, pdc, range, delta, ac38_2, dc38_2, average
      ) VALUES (
        ${c.symbol}, ${c.instrument_key}, 'OPTION', ${sessionDate}::DATE,
        ${lv.pdh}, ${lv.pdl}, ${lv.pdc}, ${lv.range}, ${lv.delta}, ${lv.ac38_2}, ${lv.dc38_2}, ${lv.average}
      )
      ON CONFLICT (symbol, session_date) DO NOTHING;
    `;
    filled++;
    console.log(`  OK  ${c.symbol} PDH=${lv.pdh} PDL=${lv.pdl} AC=${lv.ac38_2} DC=${lv.dc38_2}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL  ${c.symbol}: ${err.message}`);
  }
  await new Promise((r) => setTimeout(r, 250));
}
console.log(`done: filled=${filled} failed=${failed} total=${contracts.length}`);
process.exit(0);
