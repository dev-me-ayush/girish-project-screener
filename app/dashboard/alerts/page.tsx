import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { DashboardShell } from "@/components/dashboard-shell";
import { AlertsViewer } from "@/components/alerts-viewer";

export const metadata: Metadata = {
  title: "Alerts Log · Dashboard",
  description: "Historical log of Fibonacci AC and DC 38.2% crossover events.",
  robots: { index: false, follow: false },
};

export default async function DashboardAlertsPage() {
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

  return (
    <DashboardShell user={user}>
      <AlertsViewer />
    </DashboardShell>
  );
}
