"use client";

import React from "react";

export type FilterTab = "ALL" | "EQUITIES" | "OPTIONS" | "UP_BREAKOUTS" | "LOW_BREAKOUTS" | "PINNED";

interface ScannerToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeTab: FilterTab;
  onTabChange: (t: FilterTab) => void;
  counts: {
    total: number;
    equities: number;
    options: number;
    up: number;
    low: number;
    pinned: number;
  };
  onRefresh: () => void;
  isRefreshing?: boolean;
  currentTimeIST?: string;
  lastScannedAt?: string;
  isMarketOpen?: boolean;
}

export function ScannerToolbar({
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
  counts,
  onRefresh,
  isRefreshing,
  currentTimeIST,
  lastScannedAt,
  isMarketOpen = false,
}: ScannerToolbarProps) {
  const tabs: Array<{ id: FilterTab; label: string; count: number }> = [
    { id: "ALL", label: "All", count: counts.total },
    { id: "EQUITIES", label: "Equities", count: counts.equities },
    { id: "OPTIONS", label: "Options", count: counts.options },
    { id: "UP_BREAKOUTS", label: "Up Breakouts", count: counts.up },
    { id: "LOW_BREAKOUTS", label: "Low Breakouts", count: counts.low },
    { id: "PINNED", label: "★ Watchlist", count: counts.pinned },
  ];

  const formattedLastSync = lastScannedAt
    ? new Date(lastScannedAt).toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "--:--";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 font-mono">
      {/* Left: Compact Symbol & Strike Search */}
      <div className="relative w-full sm:w-64 md:w-72">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search 2,732 symbols, strikes..."
          className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-white placeholder-zinc-500 transition-colors focus:border-zinc-500 focus:outline-none"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {/* Center: Filter Tabs */}
      <div className="flex items-center overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950 p-0.5 scrollbar-none">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded px-2.5 py-1 text-xs transition-colors ${
                isActive
                  ? "bg-zinc-800 text-white font-semibold shadow-xs"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900/50"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded px-1 text-[10px] ${
                  isActive ? "bg-zinc-700 text-white" : "bg-zinc-900 text-zinc-500"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right: Single-Line Timings, Last Sync, and Refresh Control Group */}
      <div className="flex h-8 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-2.5 text-xs text-zinc-400">
        {isMarketOpen ? (
          <>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">IST</span>
              <span className="font-semibold text-white">{currentTimeIST || "--:--"}</span>
            </div>

            <span className="text-zinc-700">·</span>

            <div className="flex items-center gap-1 text-[11px] text-zinc-400">
              <span className="text-zinc-500">Synced:</span>
              <span className="text-zinc-300">{formattedLastSync}</span>
            </div>

            <span className="text-zinc-700">·</span>
          </>
        ) : null}

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 rounded bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
          title="Force 5-minute Market Refresh"
        >
          <span className={isRefreshing ? "animate-spin" : ""}>↻</span>
          <span>{isRefreshing ? "Syncing..." : "Refresh"}</span>
        </button>
      </div>
    </div>
  );
}
