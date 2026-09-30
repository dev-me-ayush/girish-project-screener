import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  WatchlistTerminal,
  WatchlistSummary,
  WatchlistItem,
  QuoteData,
} from "@/components/watchlist-terminal";
import { getQuotesAndOI } from "@/lib/upstox";

export const metadata: Metadata = {
  title: "Watchlists · Dashboard",
  description: "Curated equities and options watchlist terminal with live execution quotes.",
  robots: { index: false, follow: false },
};

export default async function DashboardWatchlistsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const cookieStore = await cookies();
  const sessionUser = cookieStore.get("session_user")?.value;

  if (!sessionUser) {
    redirect("/sign-in");
  }

  const { id: queryId } = await searchParams;

  const [users, rawWatchlists] = await Promise.all([
    sql`SELECT id, email, name FROM users WHERE email = ${sessionUser} LIMIT 1`,
    sql`
      SELECT 
        w.id,
        w.name,
        w.description,
        w.is_scanning_active,
        w.timeframe,
        w.last_scanned_at,
        w.created_at,
        w.updated_at,
        COUNT(i.id)::int AS item_count,
        COUNT(CASE WHEN i.is_expired = TRUE THEN 1 END)::int AS expired_count
      FROM watchlists w
      LEFT JOIN watchlist_items i ON w.id = i.watchlist_id
      WHERE w.user_email = ${sessionUser} OR w.user_email = 'girishsir@my.app.com'
      GROUP BY w.id
      ORDER BY w.created_at ASC;
    `,
  ]);

  const user = (users[0] as {
    id?: string;
    email: string;
    name?: string;
  }) || {
    email: sessionUser,
  };

  const watchlists = rawWatchlists as WatchlistSummary[];
  const activeId = queryId && watchlists.some((w) => w.id === queryId)
    ? queryId
    : "";

  let initialItems: WatchlistItem[] = [];
  let initialQuotes: Record<string, QuoteData> = {};

  if (activeId) {
    const rawItems = await sql`
      SELECT 
        id, 
        watchlist_id, 
        symbol, 
        instrument_key, 
        instrument_type, 
        strike_price, 
        option_type, 
        expiry_date, 
        timeframe,
        is_active,
        is_expired, 
        added_at
      FROM watchlist_items
      WHERE watchlist_id = ${activeId}
      ORDER BY added_at ASC;
    `;
    initialItems = rawItems as WatchlistItem[];

    const keys = initialItems.map((i) => i.instrument_key).filter(Boolean);
    if (keys.length > 0) {
      initialQuotes = await getQuotesAndOI(keys);
    }
  }

  return (
    <DashboardShell user={user}>
      <WatchlistTerminal
        initialWatchlists={watchlists}
        initialActiveId={activeId}
        initialItems={initialItems}
        initialQuotes={initialQuotes}
        initialUpdatedAt={new Date().toISOString()}
      />
    </DashboardShell>
  );
}
