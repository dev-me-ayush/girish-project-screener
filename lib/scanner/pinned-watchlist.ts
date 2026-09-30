import { sql } from "../db";

export interface PinnedSymbolRecord {
  symbol: string;
  instrument_key: string;
  instrument_type: "EQUITY" | "OPTION";
  created_at: string;
}

/**
 * Fetches all pinned symbols for a user (single personal watchlist)
 */
export async function getUserPinnedSymbols(
  userEmail: string = "girishsir@my.app.com"
): Promise<PinnedSymbolRecord[]> {
  const targetEmail = userEmail || "girishsir@my.app.com";
  try {
    const rows = await sql`
      SELECT symbol, instrument_key, instrument_type, created_at
      FROM user_pinned_symbols
      WHERE user_email = ${targetEmail}
      ORDER BY created_at DESC;
    `;
    return rows.map((r) => ({
      symbol: r.symbol as string,
      instrument_key: r.instrument_key as string,
      instrument_type: r.instrument_type as "EQUITY" | "OPTION",
      created_at: String(r.created_at),
    }));
  } catch (err) {
    console.error("Error reading pinned symbols:", err);
    return [];
  }
}

/**
 * Atomic 1-click toggle pin/unpin for a symbol in the user's single personal watchlist
 */
export async function togglePinnedSymbol(
  symbol: string,
  instrumentKey: string,
  instrumentType: "EQUITY" | "OPTION" = "EQUITY",
  userEmail: string = "girishsir@my.app.com"
): Promise<{ isPinned: boolean; symbol: string }> {
  const targetEmail = userEmail || "girishsir@my.app.com";

  // Check if already pinned
  const existing = await sql`
    SELECT id FROM user_pinned_symbols
    WHERE user_email = ${targetEmail} AND symbol = ${symbol}
    LIMIT 1;
  `;

  if (existing.length > 0) {
    // Unpin
    await sql`
      DELETE FROM user_pinned_symbols
      WHERE user_email = ${targetEmail} AND symbol = ${symbol};
    `;
    return { isPinned: false, symbol };
  } else {
    // Pin
    await sql`
      INSERT INTO user_pinned_symbols (user_email, symbol, instrument_key, instrument_type)
      VALUES (${targetEmail}, ${symbol}, ${instrumentKey}, ${instrumentType})
      ON CONFLICT (user_email, symbol) DO NOTHING;
    `;
    return { isPinned: true, symbol };
  }
}
