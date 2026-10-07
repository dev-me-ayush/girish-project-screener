import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getMarketSessionStatus } from "@/lib/scanner/market-calendar";
import { ensureSessionLevels } from "@/lib/scanner/daily-levels";
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
 *   limit=900                    max symbols per run (default 900, cap 2732)
 *   delayMs=1000                 pacing between Upstox calls (default 1000)
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
    const rawLimit = Number(searchParams.get("limit") || "900");
    const rawDelay = Number(searchParams.get("delayMs") || "1000");
    const limit = Math.min(
      Math.max(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 900, 1),
      2732
    );
    const delayMs = Math.min(
      Math.max(Number.isFinite(rawDelay) ? Math.floor(rawDelay) : 1000, 0),
      5000
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

    let instruments = dbStocks.map((s) => ({
      symbol: String(s.symbol),
      instrument_key: String(s.instrument_key),
      instrument_type: "EQUITY" as const,
    }));
    if (symbolsParam.length > 0) {
      const wanted = new Set(symbolsParam);
      instruments = instruments.filter((i) => wanted.has(i.symbol.toUpperCase()));
    }

    const stats = await ensureSessionLevels(session.sessionDate, instruments, {
      delayMs,
      maxSymbols: limit,
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
