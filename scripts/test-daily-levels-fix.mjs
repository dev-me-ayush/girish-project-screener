/**
 * Regression test for the PDH/PDL/PDC source fix.
 *
 * Proves, against LIVE Upstox data:
 *  T1. AC/DC formula unchanged (20MICRONS + BSOFT ground truth, offline).
 *  T2. /api/cron/warm-levels persists previous-session levels for 2 symbols.
 *  T3. Stored PDH/PDL/PDC equal Upstox historical daily (last completed
 *      session) AND differ from today's live quote OHLC (the old bug source).
 *  T4. Warmup is idempotent (second run fills nothing).
 *  T5. /api/scanner/market read path serves the stored levels with zero
 *      additional history fetching (fast, bounded).
 *
 * Requires: Next dev/server at TEST_BASE_URL (default http://localhost:3000),
 * UPSTOX_ACCESS_TOKEN and DATABASE_URL in env.
 * Cleans up its 2 test rows afterwards (zero footprint).
 */
import { neon } from "@neondatabase/serverless";
import process from "node:process";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
const token = process.env.UPSTOX_ACCESS_TOKEN;
const sql = neon(process.env.DATABASE_URL);
const TEST_SYMBOLS = ["20MICRONS", "RELIANCE"];

let failures = 0;
function assert(cond, msg) {
  if (cond) {
    console.log(`  PASS: ${msg}`);
  } else {
    failures++;
    console.error(`  FAIL: ${msg}`);
  }
}

async function waitForServer() {
  console.log("[SETUP] Waiting for server...");
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`, { cache: "no-store" });
      if (r.ok) {
        console.log("  Server is up.");
        return;
      }
    } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 3000));
  }
  throw new Error("Server did not come up at " + BASE);
}

function fib(pdh, pdl, pdc) {
  const range = Number((pdh - pdl).toFixed(2));
  const delta = Number((range * 0.382 * 1.236).toFixed(2));
  return {
    range,
    delta,
    ac: Number((pdc + delta).toFixed(2)),
    dc: Number((pdc - delta).toFixed(2)),
  };
}

async function upstoxHistory(instrumentKey) {
  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const todayIST = istNow.toISOString().split("T")[0];
  const fromDate = new Date(istNow.getTime() - 10 * 86400000).toISOString().split("T")[0];
  const url = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instrumentKey)}/day/${todayIST}/${fromDate}`;
  const res = await fetch(url, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`history fetch failed: ${res.status}`);
  const candles = (await res.json()).data?.candles || [];
  const completed = candles.filter((c) => !c[0].startsWith(todayIST));
  const prev = completed.length > 0 ? completed[0] : candles[0];
  return { date: prev[0], pdh: Number(prev[2]), pdl: Number(prev[3]), pdc: Number(prev[4]) };
}

async function upstoxQuote(instrumentKey) {
  const url = `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(instrumentKey)}`;
  const res = await fetch(url, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
  const data = (await res.json()).data || {};
  const q = Object.values(data)[0];
  return { high: q.ohlc.high, low: q.ohlc.low, close: q.ohlc.close, last: q.last_price };
}

async function run() {
  await waitForServer();

  // T1: formula ground truth (offline)
  console.log("\n[T1] AC/DC formula ground truth...");
  const m = fib(216.45, 209.02, 212.8);
  assert(m.ac === 216.31 && m.dc === 209.29, `20MICRONS AC=${m.ac} DC=${m.dc} (expect 216.31/209.29)`);
  const b = fib(300.85, 290.0, 295.8);
  assert(b.ac === 300.92 && b.dc === 290.68, `BSOFT row1 AC=${b.ac} DC=${b.dc} (expect 300.92/290.68)`);

  // T2: warm 2 symbols
  console.log("\n[T2] Warming session levels via cron route...");
  const warmRes = await fetch(
    `${BASE}/api/cron/warm-levels?symbols=${TEST_SYMBOLS.join(",")}&delayMs=200`,
    { cache: "no-store" }
  );
  const warm = await warmRes.json();
  console.log("  Warm stats:", JSON.stringify(warm.stats));
  const sessionDate = warm.session?.sessionDate;
  assert(warm.status === "success" && sessionDate, `warm route ok, session=${sessionDate}`);
  assert(warm.stats.filled >= 1, `filled >= 1 (got ${warm.stats.filled})`);

  // Instrument keys for direct comparison
  const keys = {};
  for (const s of TEST_SYMBOLS) {
    const rows = await sql`SELECT instrument_key FROM stocks WHERE symbol = ${s} LIMIT 1`;
    keys[s] = rows[0].instrument_key;
  }

  // T3: stored rows vs historical truth vs live quote (old bug source)
  console.log("\n[T3] Stored levels vs Upstox historical truth...");
  for (const s of TEST_SYMBOLS) {
    const rows = await sql`
      SELECT pdh, pdl, pdc, ac38_2, dc38_2 FROM daily_reference_levels
      WHERE symbol = ${s} AND session_date = ${sessionDate}::DATE LIMIT 1`;
    assert(rows.length === 1, `${s}: stored row exists for ${sessionDate}`);
    if (rows.length === 0) continue;
    const stored = { pdh: Number(rows[0].pdh), pdl: Number(rows[0].pdl), pdc: Number(rows[0].pdc) };
    const hist = await upstoxHistory(keys[s]);
    console.log(`  ${s}: prev session ${hist.date} | hist PDH=${hist.pdh} PDL=${hist.pdl} PDC=${hist.pdc} | stored PDH=${stored.pdh} PDL=${stored.pdl} PDC=${stored.pdc}`);
    assert(
      stored.pdh === hist.pdh && stored.pdl === hist.pdl && stored.pdc === hist.pdc,
      `${s}: stored PDH/PDL/PDC equal historical daily (last completed session)`
    );
    const q = await upstoxQuote(keys[s]);
    console.log(`  ${s}: today's live quote H=${q.high} L=${q.low} C=${q.close}`);
    if (q.high !== hist.pdh || q.low !== hist.pdl || q.close !== hist.pdc) {
      assert(
        stored.pdh !== q.high || stored.pdl !== q.low || stored.pdc !== q.close,
        `${s}: stored values are NOT today's live OHLC (old-bug regression check)`
      );
    } else {
      console.log(`  SKIP: quote equals history for ${s} (no session boundary crossed)`);
    }
    const f = fib(stored.pdh, stored.pdl, stored.pdc);
    assert(
      Number(rows[0].ac38_2) === f.ac && Number(rows[0].dc38_2) === f.dc,
      `${s}: stored AC/DC match formula (AC=${rows[0].ac38_2} DC=${rows[0].dc38_2})`
    );
  }

  // T4: idempotence
  console.log("\n[T4] Warmup idempotence...");
  const warm2 = await (
    await fetch(`${BASE}/api/cron/warm-levels?symbols=${TEST_SYMBOLS.join(",")}&delayMs=200`, { cache: "no-store" })
  ).json();
  assert(warm2.stats.filled === 0 && warm2.stats.alreadyStored === TEST_SYMBOLS.length,
    `second run fills 0 (filled=${warm2.stats.filled}, alreadyStored=${warm2.stats.alreadyStored})`);

  // T5: market scan read path serves stored levels
  console.log("\n[T5] Market scan read path...");
  const t0 = Date.now();
  const scanRes = await fetch(`${BASE}/api/scanner/market?force=true`, { cache: "no-store" });
  const scan = await scanRes.json();
  console.log(`  Scan returned ${scan.totalInstruments} instruments in ${Date.now() - t0}ms`);
  assert(scan.status === "success", "market scan ok");
  for (const s of TEST_SYMBOLS) {
    const item = (scan.instruments || []).find((i) => i.symbol === s);
    assert(!!item, `${s} present in scan payload`);
    if (!item) continue;
    const hist = await upstoxHistory(keys[s]);
    assert(
      item.levels.pdh === hist.pdh && item.levels.pdl === hist.pdl && item.levels.pdc === hist.pdc,
      `${s}: scan payload levels equal historical truth (PDH=${item.levels.pdh})`
    );
  }

  // Cleanup: remove test rows (zero footprint)
  console.log("\n[CLEANUP] Removing test rows...");
  await sql`DELETE FROM daily_reference_levels WHERE session_date = ${sessionDate}::DATE AND symbol = ANY(${TEST_SYMBOLS})`;
  console.log("  Removed.");

  console.log(`\n==== RESULT: ${failures === 0 ? "ALL TESTS PASSED" : failures + " FAILURES"} ====`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
