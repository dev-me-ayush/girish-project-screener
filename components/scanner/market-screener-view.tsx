"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { UnifiedScannedInstrument, MarketScanPayload } from "@/lib/scanner/market-coordinator";
import { ScannerToolbar, FilterTab } from "./scanner-toolbar";
import { ScannerTable } from "./scanner-table";
import { exportInstrumentsToExcel } from "@/lib/export-excel";

export function MarketScreenerView() {
  const [data, setData] = useState<MarketScanPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [pinnedSet, setPinnedSet] = useState<Set<string>>(new Set());

  // Fetch live market data
  const loadMarketData = useCallback(async (force: boolean = false) => {
    try {
      if (force) setIsRefreshing(true);
      const res = await fetch(`/api/scanner/market${force ? "?force=true" : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load market scan");
      const json: MarketScanPayload = await res.json();
      setData(json);
    } catch (err) {
      console.error("Error fetching market data:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const [marketRes, pinRes] = await Promise.all([
          fetch("/api/scanner/market", { cache: "no-store" }),
          fetch("/api/watchlist/pin", { cache: "no-store" }),
        ]);

        if (marketRes.ok && isMounted) {
          const json: MarketScanPayload = await marketRes.json();
          setData(json);
        }

        if (pinRes.ok && isMounted) {
          const pJson = await pinRes.json();
          const set = new Set<string>((pJson.items || []).map((x: { symbol: string }) => x.symbol));
          setPinnedSet(set);
        }
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    init();
    // Candle-close cadence: align polls to just after each wall-clock minute
    // boundary (+7s settlement) so the LTP read approximates the just-closed
    // 1m candle. A cross during the 10:23 candle is therefore picked up by the
    // 10:24:0x poll and stamped 10:24:00 — never mid-candle tick time.
    let timeout: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      const now = Date.now();
      const msToNextMinute = 60000 - (now % 60000);
      timeout = setTimeout(() => {
        loadMarketData();
        scheduleNext();
      }, msToNextMinute + 7000);
    };
    scheduleNext();

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [loadMarketData]);

  // Toggle Pin Action
  const handleTogglePin = async (item: UnifiedScannedInstrument) => {
    // Optimistic toggle
    setPinnedSet((prev) => {
      const next = new Set(prev);
      if (next.has(item.symbol)) next.delete(item.symbol);
      else next.add(item.symbol);
      return next;
    });

    try {
      await fetch("/api/watchlist/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: item.symbol,
          instrumentKey: item.instrument_key,
          instrumentType: item.instrument_type,
        }),
      });
    } catch (err) {
      console.error("Failed to sync pin with database:", err);
    }
  };

  // Filter instruments by active tab + search
  const filteredInstruments = useMemo(() => {
    if (!data?.instruments) return [];
    let list = data.instruments;

    // Filter by Tab
    if (activeTab === "EQUITIES") list = list.filter((i) => i.instrument_type === "EQUITY");
    else if (activeTab === "OPTIONS") list = list.filter((i) => i.instrument_type === "OPTION");
    else if (activeTab === "UP_BREAKOUTS") list = list.filter((i) => i.breakout.direction === "UP");
    else if (activeTab === "LOW_BREAKOUTS") list = list.filter((i) => i.breakout.direction === "LOW");
    else if (activeTab === "PINNED") list = list.filter((i) => pinnedSet.has(i.symbol));

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.symbol.toLowerCase().includes(q) ||
          i.underlying?.toLowerCase().includes(q) ||
          String(i.strike_price || "").includes(q)
      );
    }

    return list;
  }, [data, activeTab, pinnedSet, searchQuery]);

  if (isLoading && !data) {
    return (
      <div className="mx-auto flex min-h-[400px] w-full max-w-[1440px] flex-col items-center justify-center px-4 font-mono text-xs text-zinc-400">
        <span className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
        <span>Loading 1-minute market scan...</span>
      </div>
    );
  }

  const counts = {
    total: data?.totalInstruments || 0,
    equities: data?.equitiesCount || 0,
    options: data?.optionsCount || 0,
    up: data?.upBreakoutsCount || 0,
    low: data?.lowBreakoutsCount || 0,
    pinned: pinnedSet.size,
  };

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
      {/* Workspace heading — matches overview rhythm */}
      <div className="flex flex-col gap-1.5 pb-5 sm:pb-6">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
          1-Minute Screener
        </p>
        <h1 className="text-xl font-semibold tracking-[-0.02em] text-paper sm:text-2xl">
          Breakout Scan
        </h1>
        <p className="text-[13px] leading-relaxed text-zinc-400">
          {counts.total.toLocaleString("en-IN")} instruments · {counts.up} up · {counts.low} low · Fibonacci AC/DC 38.2
        </p>
      </div>

      {/* Search + download + refresh / filter tabs — no time display */}
      <ScannerToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={counts}
        onRefresh={() => loadMarketData(true)}
        isRefreshing={isRefreshing}
        onDownload={() => exportInstrumentsToExcel(filteredInstruments, activeTab)}
      />

      {/* 1-minute instrument table */}
      <div className="mt-3">
        <ScannerTable
          instruments={filteredInstruments}
          pinnedSet={pinnedSet}
          onTogglePin={handleTogglePin}
        />
      </div>
    </div>
  );
}
