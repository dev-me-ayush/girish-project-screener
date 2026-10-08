"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import {
  LayersIcon,
  BookmarkIcon,
  BoltIcon,
  ChartBarIcon,
  LogoutIcon,
} from "@/components/icons";
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
    name: "1-Minute Screener",
    href: "/dashboard/scanner",
    matcher: (path: string) => path.startsWith("/dashboard/scanner"),
    icon: BoltIcon,
  },
  {
    name: "Options & OI",
    href: "/dashboard/options",
    matcher: (path: string) => path.startsWith("/dashboard/options"),
    icon: ChartBarIcon,
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
    icon: LayersIcon,
  },
];

export function DashboardShell({ user, children }: DashboardShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900 antialiased">
      {/* Slim header — logo + workspace switch + logout icon only */}
      <header className="sticky top-0 z-50 flex h-11 w-full items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-3 backdrop-blur-md sm:px-4 shadow-xs">
        {/* Brand mark only */}
        <Link
          href="/dashboard/overview"
          aria-label="Go to overview"
          className="flex shrink-0 items-center text-slate-900 transition-opacity hover:opacity-85"
        >
          <Logo className="h-[18px] w-[18px] text-slate-900" />
        </Link>

        {/* Center: Segmented Navigation Switch Tabs */}
        <nav
          aria-label="Workspace Switcher"
          className="flex min-w-0 items-center overflow-x-auto rounded-lg border border-slate-200 bg-slate-100 p-0.5 shadow-inner scrollbar-none"
        >
          {DASHBOARD_TABS.map((tab) => {
            const isActive = tab.matcher(pathname);
            const Icon = tab.icon;

            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-white text-slate-900 font-semibold shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                <Icon
                  className={`h-3 w-3 shrink-0 ${
                    isActive ? "text-slate-900" : "text-slate-500"
                  }`}
                />
                <span>{tab.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right: account + logout */}
        <div className="flex shrink-0 items-center gap-2">
          <span
            title={user.email}
            className="hidden max-w-44 truncate font-mono text-[11px] text-slate-500 md:block"
          >
            {user.email}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Log out"
              title="Log out"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
            >
              <LogoutIcon className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </header>

      {/* Main Workspace Area (Full width, Zero sidebar) */}
      <main className="flex flex-1 flex-col w-full min-h-[calc(100dvh-2.75rem)] bg-slate-50">
        {children}
      </main>
    </div>
  );
}
