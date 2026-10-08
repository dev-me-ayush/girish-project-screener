import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { OptionsDashboardView } from "@/components/options/options-dashboard-view";

export const metadata = {
  title: "Options & Open Interest | Market Screener",
  description: "Real-time index options chain and three-strike open interest concentration tracker.",
};

export default async function DashboardOptionsPage() {
  const cookieStore = await cookies();
  const sessionUser = cookieStore.get("session_user")?.value;

  if (!sessionUser) {
    redirect("/sign-in");
  }

  let user = { email: "user@tessera.internal" };
  try {
    user = JSON.parse(sessionUser);
  } catch {
    // fallback
  }

  return (
    <DashboardShell user={user}>
      <OptionsDashboardView />
    </DashboardShell>
  );
}
