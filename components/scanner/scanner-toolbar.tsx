"use client";

import React from "react";
import { RefreshIcon, SearchIcon } from "@/components/icons";

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
  onDownload: () => void;
}

export function ScannerToolbar({
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
  counts,
  onRefresh,
  isRefreshing,
  onDownload,
}: ScannerToolbarProps) {
  const tabs: Array<{ id: FilterTab; label: string; count: number }> = [
    { id: "ALL", label: "All", count: counts.total },
    { id: "EQUITIES", label: "Equities", count: counts.equities },
    { id: "OPTIONS", label: "Options", count: counts.options },
    { id: "UP_BREAKOUTS", label: "Up Breakouts", count: counts.up },
    { id: "LOW_BREAKOUTS", label: "Low Breakouts", count: counts.low },
    { id: "PINNED", label: "Watchlist", count: counts.pinned },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      {/* Row 1: search (flex-grow) + download + refresh */}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search symbols, underlyings, strikes..."
            aria-label="Search screener instruments"
            className="h-8 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-8 font-mono text-[11px] font-medium text-slate-900 placeholder-slate-400 transition-colors focus:border-slate-500 focus:outline-none shadow-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-xs leading-none text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              ×
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onDownload}
          title="Download instruments as Excel (.csv)"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 font-mono text-[11px] font-semibold text-slate-900 shadow-xs transition-colors hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98]"
        >
          <svg className="h-3 w-3 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          <span className="hidden sm:inline">Download</span>
        </button>

        {/* Refresh only — no time display */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label="Refresh 1-minute screener"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 font-mono text-[11px] font-semibold text-slate-900 shadow-xs transition-colors hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
        >
          <RefreshIcon
            className={`h-3 w-3 ${isRefreshing ? "animate-spin text-slate-900" : "text-slate-600"}`}
          />
          <span>{isRefreshing ? "Syncing" : "Refresh"}</span>
        </button>
      </div>

      {/* Row 2: filter tabs — full-width scroll */}
      <div
        role="tablist"
        aria-label="Screener filters"
        className="flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-lg border border-slate-200 bg-slate-100 p-0.5 scrollbar-none"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tab.id)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors ${
                isActive
                  ? "bg-white font-bold text-slate-900 shadow-xs"
                  : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded px-1.5 py-0.2 text-[10px] tabular font-bold ${
                  isActive ? "bg-slate-100 text-slate-900" : "bg-slate-200/80 text-slate-600"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
