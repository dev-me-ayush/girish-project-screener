import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { DashboardShell } from "@/components/dashboard-shell";
import { MarketScreenerView } from "@/components/scanner/market-screener-view";

export const metadata: Metadata = {
  title: "1-Minute Market Screener · Dashboard",
  description: "2,732-Instrument Full Market 1-Minute Fibonacci AC/DC Screener.",
  robots: { index: false, follow: false },
};

export default async function DashboardScannerPage() {
  const cookieStore = await cookies();
  const sessionUser = cookieStore.get("session_user")?.value;

  if (!sessionUser) {
    redirect("/sign-in");
  }

  const users = await sql`
    SELECT id, email, name FROM users WHERE email = ${sessionUser} LIMIT 1
  `;
  if (users.length === 0) {
    redirect("/sign-in");
  }
  const user = users[0] as {
    id?: string;
    email: string;
    name?: string;
  };

  return (
    <DashboardShell user={user}>
      <MarketScreenerView />
    </DashboardShell>
  );
}
