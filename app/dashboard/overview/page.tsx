import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { DashboardShell } from "@/components/dashboard-shell";
import { getHeaderIndicesQuotes } from "@/lib/upstox";
import { OverviewTerminal } from "@/components/overview-terminal";

export const metadata: Metadata = {
  title: "Benchmark Indices · Overview",
  description: "Live NIFTY 50, BANK NIFTY, and SENSEX real-time streaming overview.",
  robots: { index: false, follow: false },
};

export default async function DashboardOverviewPage() {
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

  // Fetch initial benchmark quotes directly from Upstox gateway for instant SSR render.
  // Upstox outage must not 500 the whole page — fall back to client refresh.
  let initialIndices: Awaited<ReturnType<typeof getHeaderIndicesQuotes>> = [];
  try {
    initialIndices = await getHeaderIndicesQuotes();
  } catch (err) {
    console.error("Overview SSR indices error:", err);
  }
  const initialUpdatedAt = new Date().toISOString();

  return (
    <DashboardShell user={user}>
      <OverviewTerminal
        initialIndices={initialIndices}
        initialUpdatedAt={initialUpdatedAt}
      />
    </DashboardShell>
  );
}
