import { sql } from "./db";
import { getIndexOptionChain } from "./upstox";

export const DEFAULT_OPTIONS_WATCHLIST_NAME = "DEFAULT OPTIONS (ATM ±7)";

export interface DefaultOptionsSyncResult {
  watchlistId: string;
  name: string;
  totalContracts: number;
  niftyCount: number;
  bankNiftyCount: number;
  niftyExpiry: string;
  bankNiftyExpiry: string;
  niftyAtm: number;
  bankNiftyAtm: number;
  syncedAt: string;
}

/**
 * Synchronizes the Default Options Watchlist with the nearest active weekly expiry
 * contracts for NIFTY 50 (ATM ± 7 strikes = 30 contracts) and BANK NIFTY (ATM ± 5 strikes = 22 contracts).
 * Total: ~52 highly liquid contracts.
 */
export async function syncDefaultOptionsWatchlist(
  userEmail: string
): Promise<DefaultOptionsSyncResult> {
  const targetEmail = userEmail?.trim();
  if (!targetEmail) throw new Error("syncDefaultOptionsWatchlist: userEmail is required");

  // 1. Locate or create the Default Options Watchlist
  let rows = await sql`
    SELECT id, name, updated_at
    FROM watchlists
    WHERE name = ${DEFAULT_OPTIONS_WATCHLIST_NAME} AND user_email = ${targetEmail}
    ORDER BY created_at ASC
    LIMIT 1;
  `;

  if (rows.length === 0) {
    rows = await sql`
      INSERT INTO watchlists (user_email, name, description, timeframe, is_scanning_active)
      VALUES (${targetEmail}, ${DEFAULT_OPTIONS_WATCHLIST_NAME}, 'Auto-synced current weekly expiry NIFTY & BANKNIFTY ATM ±7 options', '1m', TRUE)
      RETURNING id, name, updated_at;
    `;
  }

  const watchlistId = rows[0].id as string;

  // 2. Fetch fresh Index Option Chains concurrently
  // Nifty: 7 strikes above + 7 below + 1 ATM = 15 strikes = 30 contracts
  // Bank Nifty: 5 strikes above + 5 below + 1 ATM = 11 strikes = 22 contracts
  const [niftyChain, bankChain] = await Promise.all([
    getIndexOptionChain("NSE_INDEX|Nifty 50", 7),
    getIndexOptionChain("NSE_INDEX|Nifty Bank", 5),
  ]);

  const allContracts = [...niftyChain.options, ...bankChain.options];

  if (allContracts.length > 0) {
    // 3. Clear outdated / expired contracts for this watchlist
    await sql`
      DELETE FROM watchlist_items
      WHERE watchlist_id = ${watchlistId};
    `;

    // 4. Batch insert current active contracts
    const symbols = allContracts.map((c) => c.tradingSymbol);
    const keys = allContracts.map((c) => c.instrumentKey);
    const types = allContracts.map((c) => (c.optionType === "CE" ? "OPTION_CE" : "OPTION_PE"));
    const strikes = allContracts.map((c) => c.strikePrice);
    const optTypes = allContracts.map((c) => c.optionType);
    const expiries = allContracts.map((c) => c.expiry);

    await sql`
      INSERT INTO watchlist_items (
        watchlist_id, symbol, instrument_key, instrument_type,
        strike_price, option_type, expiry_date, timeframe, is_active, is_expired
      )
      SELECT
        ${watchlistId},
        u.symbol,
        u.key,
        u.type,
        u.strike,
        u.opt_type,
        u.expiry,
        '1m',
        TRUE,
        FALSE
      FROM UNNEST(
        ${symbols}::text[],
        ${keys}::text[],
        ${types}::text[],
        ${strikes}::numeric[],
        ${optTypes}::text[],
        ${expiries}::date[]
      ) AS u(symbol, key, type, strike, opt_type, expiry);
    `;

    // 5. Update timestamp on watchlist
    await sql`
      UPDATE watchlists
      SET updated_at = NOW(), is_scanning_active = TRUE
      WHERE id = ${watchlistId};
    `;
  }

  return {
    watchlistId,
    name: DEFAULT_OPTIONS_WATCHLIST_NAME,
    totalContracts: allContracts.length,
    niftyCount: niftyChain.options.length,
    bankNiftyCount: bankChain.options.length,
    niftyExpiry: niftyChain.underlying.nearestExpiry,
    bankNiftyExpiry: bankChain.underlying.nearestExpiry,
    niftyAtm: niftyChain.underlying.atmStrike,
    bankNiftyAtm: bankChain.underlying.atmStrike,
    syncedAt: new Date().toISOString(),
  };
}

/**
 * Checks whether the default options watchlist needs a daily sync.
 * Triggers sync automatically if:
 * 1. Watchlist does not exist or has 0 items
 * 2. Has any expired contracts (expiry_date < today)
 * 3. Was not updated on the current trading day
 */
export async function ensureDefaultOptionsWatchlistSynced(
  userEmail: string = "girishsir@my.app.com"
): Promise<void> {
  try {
    const targetEmail = userEmail || "girishsir@my.app.com";
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const todayIST = new Date(Date.now() + istOffsetMs).toISOString().split("T")[0];

    const wls = await sql`
      SELECT w.id, w.updated_at,
             COUNT(wi.id)::int as item_count,
             COUNT(CASE WHEN wi.expiry_date < ${todayIST}::date THEN 1 END)::int as expired_count
      FROM watchlists w
      LEFT JOIN watchlist_items wi ON w.id = wi.watchlist_id
      WHERE w.name = ${DEFAULT_OPTIONS_WATCHLIST_NAME} AND (w.user_email = ${targetEmail} OR w.user_email = 'girishsir@my.app.com')
      GROUP BY w.id;
    `;

    if (wls.length === 0) {
      await syncDefaultOptionsWatchlist(targetEmail);
      return;
    }

    const wl = wls[0];
    const itemCount = Number(wl.item_count || 0);
    const expiredCount = Number(wl.expired_count || 0);

    const updatedDate = wl.updated_at
      ? new Date(new Date(wl.updated_at).getTime() + istOffsetMs).toISOString().split("T")[0]
      : "";

    // If empty, has expired items, or not updated today, resync
    if (itemCount === 0 || expiredCount > 0 || updatedDate !== todayIST) {
      await syncDefaultOptionsWatchlist(targetEmail);
    }
  } catch (err) {
    console.error("Failed to check / sync default options watchlist:", err);
  }
}
