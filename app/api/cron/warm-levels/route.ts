import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getMarketSessionStatus } from "@/lib/scanner/market-calendar";
import { ensureSessionLevels } from "@/lib/scanner/daily-levels";
import { getActiveAtmOptionsContracts } from "@/lib/scanner/options-resolver";
import { getSessionEmail, unauthorizedResponse } from "@/lib/session";
import { serverError } from "@/lib/api-error";
import { isCronAuthorized } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

/**
 * Pre-market session warmup: persists the previous completed session's
 * PDH/PDL/PDC (from Upstox historical daily candles) into
 * `daily_reference_levels` so 1-minute scans serve grounded values.
 *
 * Schedule daily ~05:30 IST (before pre-market) plus optionally again at
 * ~09:00 IST. Sequential ~1s pacing keeps it under Upstox rate limits
 * alongside the quote cycle. Resumable: each run only fills symbols still
 * missing for the session.
 *
 * Query params:
 *   symbols=20MICRONS,RELIANCE  limit the run to these symbols (testing)
 *   limit=2732                   max symbols per run (default 2732, full universe)
 *   delayMs=250                  pacing between Upstox calls (default 250)
 *   concurrency=6                parallel warmup workers (default 6, cap 12)
 */
export async function GET(req: NextRequest) {
  try {
    // Expensive warmup: scheduler (CRON_SECRET bearer) or signed-in user.
    if (!isCronAuthorized(req)) {
      const sessionEmail = await getSessionEmail();
      if (!sessionEmail) return unauthorizedResponse();
    }

    const { searchParams } = new URL(req.url);
    const session = getMarketSessionStatus();
    const rawLimit = Number(searchParams.get("limit") || "2732");
    const rawDelay = Number(searchParams.get("delayMs") || "250");
    const rawConcurrency = Number(searchParams.get("concurrency") || "6");
    const limit = Math.min(
      Math.max(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 2732, 1),
      2732
    );
    const delayMs = Math.min(
      Math.max(Number.isFinite(rawDelay) ? Math.floor(rawDelay) : 250, 0),
      5000
    );
    const concurrency = Math.min(
      Math.max(Number.isFinite(rawConcurrency) ? Math.floor(rawConcurrency) : 6, 1),
      12
    );
    const symbolsParam = (searchParams.get("symbols") || "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 100);

    const dbStocks = (await sql`
      SELECT symbol, instrument_key
      FROM stocks
      ORDER BY symbol ASC;
    `) as Array<{ symbol: string; instrument_key: string }>;

    // Option contracts (52 ATM) are warmed FIRST so their PDH/PDL/AC/DC
    // are present at the open instead of trailing the equity queue.
    // A chain failure must not block equity warmup, so resolve defensively.
    let optionInstruments: Array<{
      symbol: string;
      instrument_key: string;
      instrument_type: "OPTION";
    }> = [];
    try {
      const contracts = await getActiveAtmOptionsContracts();
      optionInstruments = contracts.map((o) => ({
        symbol: String(o.symbol),
        instrument_key: String(o.instrument_key),
        instrument_type: "OPTION" as const,
      }));
    } catch (err) {
      console.error("Warmup: option chain resolution failed, warming equities only:", err);
    }

    let equityInstruments = dbStocks.map((s) => ({
      symbol: String(s.symbol),
      instrument_key: String(s.instrument_key),
      instrument_type: "EQUITY" as const,
    }));
    if (symbolsParam.length > 0) {
      const wanted = new Set(symbolsParam);
      equityInstruments = equityInstruments.filter((i) => wanted.has(i.symbol.toUpperCase()));
      optionInstruments = optionInstruments.filter((i) => wanted.has(i.symbol.toUpperCase()));
    }
    const instruments = [...optionInstruments, ...equityInstruments];

    const stats = await ensureSessionLevels(session.sessionDate, instruments, {
      delayMs,
      maxSymbols: limit,
      concurrency,
    });

    return NextResponse.json({
      status: "success",
      session: {
        sessionDate: session.sessionDate,
        status: session.status,
        label: session.label,
      },
      stats,
    });
  } catch (err: unknown) {
    return serverError("Session warmup failed", err);
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
