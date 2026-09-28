import { sql } from "@/lib/db";
import { site } from "@/lib/site";

export type ScreenerStock = {
  symbol: string;
  name: string;
  price: string;
  change: string;
  rsi: string;
  volume: string;
  cap: string;
  up: boolean;
};

export async function getScreenerStocks(): Promise<ScreenerStock[]> {
  try {
    const rows = await sql`
      SELECT symbol, name, price, change, rsi, volume, market_cap, is_up
      FROM screener_stocks
      ORDER BY id ASC
    `;

    if (!rows || rows.length === 0) {
      return site.screener.rows;
    }

    return rows.map((r) => ({
      symbol: String(r.symbol),
      name: String(r.name),
      price: typeof r.price === "number" ? r.price.toFixed(2) : String(r.price),
      change: String(r.change),
      rsi: typeof r.rsi === "number" ? r.rsi.toFixed(1) : String(r.rsi),
      volume: String(r.volume),
      cap: String(r.market_cap),
      up: Boolean(r.is_up),
    }));
  } catch (error) {
    console.warn("Failed to fetch screener stocks from Neon, falling back to static data:", error);
    return site.screener.rows;
  }
}
