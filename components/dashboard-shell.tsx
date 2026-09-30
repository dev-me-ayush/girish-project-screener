"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo, Wordmark } from "@/components/logo";
import {
  LayersIcon,
  BookmarkIcon,
  BoltIcon,
  ChartBarIcon,
} from "@/components/icons";
import { HeaderMarketStatus } from "@/components/scanner/header-market-status";
import { signOut } from "@/app/sign-in/actions";

interface DashboardShellProps {
  user: {
    id?: string;
    email: string;
    name?: string;
  };
  children?: React.ReactNode;
}

const DASHBOARD_TABS = [
  {
    name: "Overview",
    href: "/dashboard/overview",
    matcher: (path: string) => path === "/dashboard/overview" || path === "/dashboard",
    icon: LayersIcon,
  },
  {
    name: "5m Screener",
    href: "/dashboard/scanner",
    matcher: (path: string) => path.startsWith("/dashboard/scanner"),
    icon: BoltIcon,
  },
  {
    name: "My Watchlist",
    href: "/dashboard/watchlists",
    matcher: (path: string) => path.startsWith("/dashboard/watchlists"),
    icon: BookmarkIcon,
  },
  {
    name: "Alerts Feed",
    href: "/dashboard/alerts",
    matcher: (path: string) => path.startsWith("/dashboard/alerts"),
    icon: ChartBarIcon,
  },
];

export function DashboardShell({ user, children }: DashboardShellProps) {
  const pathname = usePathname();
  const userInitial = (user.name || user.email || "U").charAt(0).toUpperCase();

  return (
    <div className="flex min-h-dvh flex-col bg-ink text-paper antialiased">
      {/* Top Header with Segmented Workspace Switch */}
      <header className="sticky top-0 z-50 flex h-14 w-full items-center justify-between border-b border-line bg-ink/95 px-4 backdrop-blur-md sm:px-6">
        {/* Brand & Market Status */}
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/overview"
            className="flex items-center gap-2 text-paper transition-opacity hover:opacity-85"
          >
            <Logo className="h-5 w-5 text-paper" />
            <Wordmark />
          </Link>

          <HeaderMarketStatus />
        </div>

        {/* Center: Segmented Navigation Switch Tabs */}
        <nav
          aria-label="Workspace Switcher"
          className="flex items-center overflow-x-auto rounded-lg border border-line bg-zinc-900/90 p-1 shadow-inner scrollbar-none"
        >
          {DASHBOARD_TABS.map((tab) => {
            const isActive = tab.matcher(pathname);
            const Icon = tab.icon;

            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`relative flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-paper text-ink font-semibold shadow-xs"
                    : "text-zinc-400 hover:text-paper hover:bg-zinc-800/60"
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 shrink-0 ${
                    isActive ? "text-ink" : "text-zinc-500"
                  }`}
                />
                <span>{tab.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right: User Profile & Exit */}
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 text-right sm:flex">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line bg-zinc-900 font-mono text-xs font-semibold text-paper">
              {userInitial}
            </div>
            <div className="max-w-[120px] truncate text-xs font-mono text-zinc-400">
              {user.email.split("@")[0]}
            </div>
          </div>

          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex h-7 items-center justify-center rounded-lg border border-line bg-zinc-900 px-2.5 text-[11px] font-mono font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800 hover:text-paper"
            >
              Exit
            </button>
          </form>
        </div>
      </header>

      {/* Main Workspace Area (Full width, Zero sidebar) */}
      <main className="flex flex-1 flex-col w-full min-h-[calc(100dvh-3.5rem)] bg-ink">
        {children}
      </main>
    </div>
  );
}
