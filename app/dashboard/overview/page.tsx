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
  const user = (users[0] as {
    id?: string;
    email: string;
    name?: string;
  }) || {
    email: sessionUser,
  };

  // Fetch initial benchmark quotes directly from Upstox gateway for instant SSR render
  const initialIndices = await getHeaderIndicesQuotes();
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
