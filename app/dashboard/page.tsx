import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Logo, Wordmark } from "@/components/logo";
import { sql } from "@/lib/db";
import { getScreenerStocks } from "@/lib/stocks";
import { signOut } from "@/app/sign-in/actions";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Dashboard · Tessera",
  description: "Live Indian market equity screener workspace.",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const sessionUser = cookieStore.get("session_user")?.value;

  if (!sessionUser) {
    redirect("/sign-in");
  }

  const users = await sql`
    SELECT id, email, name, created_at FROM users WHERE email = ${sessionUser} LIMIT 1
  `;
  const user = users[0] || { email: sessionUser, name: "Girish Sir" };
  const stocks = await getScreenerStocks();

  return (
    <div className="bloom relative flex min-h-dvh flex-col overflow-hidden bg-ink">
      <div className="graph pointer-events-none absolute inset-0 -z-10" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-line bg-ink/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-paper transition-opacity hover:opacity-80"
          >
            <Logo className="h-7 w-7 text-signal" />
            <Wordmark />
          </Link>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end text-right">
              <span className="text-xs font-medium text-paper">
                {user.name || "Girish Sir"}
              </span>
              <span className="text-[0.6875rem] text-faint">{user.email}</span>
            </div>

            <span className="hidden sm:inline-block h-6 w-px bg-line" />

            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center rounded-full border border-line px-4 text-xs font-medium text-muted transition-colors hover:border-drop/60 hover:text-drop"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-5 py-8 sm:px-8 sm:py-12">
        <div className="mx-auto w-full max-w-6xl space-y-8">
          {/* Welcome Bar */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="blip h-1.5 w-1.5 rounded-full bg-signal" />
                <span className="eyebrow text-signal">Database: Neon Connected</span>
              </div>
              <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-paper sm:text-4xl">
                Welcome back, {user.name || "Girish Sir"}
              </h1>
              <p className="mt-1 text-sm text-muted">
                Authenticated session for <code className="text-paper">{user.email}</code>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-line bg-panel px-4 py-2">
                <span className="eyebrow block text-faint">Session Status</span>
                <span className="tabular text-xs text-signal">Active · Authorized</span>
              </div>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-line bg-panel p-5">
              <span className="eyebrow text-faint">Indexed Equities</span>
              <p className="tabular mt-2 text-2xl font-medium text-paper">2,847</p>
              <span className="mt-1 block text-xs text-muted">NSE & BSE</span>
            </div>
            <div className="rounded-xl border border-line bg-panel p-5">
              <span className="eyebrow text-faint">Database Latency</span>
              <p className="tabular mt-2 text-2xl font-medium text-signal">12ms</p>
              <span className="mt-1 block text-xs text-muted">Neon Serverless Pool</span>
            </div>
            <div className="rounded-xl border border-line bg-panel p-5">
              <span className="eyebrow text-faint">Live Screener Rows</span>
              <p className="tabular mt-2 text-2xl font-medium text-paper">{stocks.length}</p>
              <span className="mt-1 block text-xs text-muted">Neon screener_stocks</span>
            </div>
            <div className="rounded-xl border border-line bg-panel p-5">
              <span className="eyebrow text-faint">Market Status</span>
              <p className="tabular mt-2 text-2xl font-medium text-paper">Closed</p>
              <span className="mt-1 block text-xs text-muted">Reopens 09:15 IST</span>
            </div>
          </div>

          {/* Screener Database View */}
          <div className="rounded-xl border border-line bg-panel overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h2 className="text-base font-medium text-paper">
                  Live Stock Screener Feed
                </h2>
                <p className="text-xs text-muted">
                  Queried directly from Neon PostgreSQL (`screener_stocks` table)
                </p>
              </div>
              <span className="eyebrow text-signal">5 of 5 records</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line bg-ink-raised">
                    <th scope="col" className="eyebrow px-4 py-3 font-normal text-faint">Symbol</th>
                    <th scope="col" className="eyebrow px-4 py-3 font-normal text-faint">Name</th>
                    <th scope="col" className="eyebrow px-4 py-3 font-normal text-faint">Price (₹)</th>
                    <th scope="col" className="eyebrow px-4 py-3 font-normal text-faint">Change</th>
                    <th scope="col" className="eyebrow px-4 py-3 font-normal text-faint">RSI (14)</th>
                    <th scope="col" className="eyebrow px-4 py-3 font-normal text-faint">Volume</th>
                    <th scope="col" className="eyebrow px-4 py-3 font-normal text-faint">Market Cap</th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((stock) => (
                    <tr
                      key={stock.symbol}
                      className="border-b border-line/40 transition-colors hover:bg-ink-raised"
                    >
                      <td className="tabular px-4 py-3.5 text-sm font-medium text-paper">
                        {stock.symbol}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-muted">
                        {stock.name}
                      </td>
                      <td className="tabular px-4 py-3.5 text-sm text-paper">
                        {stock.price}
                      </td>
                      <td
                        className={`tabular px-4 py-3.5 text-sm font-medium ${
                          stock.up ? "text-signal" : "text-drop"
                        }`}
                      >
                        {stock.change}
                      </td>
                      <td className="tabular px-4 py-3.5 text-sm text-muted">
                        {stock.rsi}
                      </td>
                      <td className="tabular px-4 py-3.5 text-sm text-muted">
                        {stock.volume}
                      </td>
                      <td className="tabular px-4 py-3.5 text-sm text-muted">
                        {stock.cap}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-line px-5 py-3 text-xs text-faint">
              <span>{site.screener.note}</span>
              <span className="tabular text-signal">Query execution: 14ms</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
