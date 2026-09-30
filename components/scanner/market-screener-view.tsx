"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { UnifiedScannedInstrument, MarketScanPayload } from "@/lib/scanner/market-coordinator";
import { BreakoutBanner } from "./breakout-banner";
import { ScannerToolbar, FilterTab } from "./scanner-toolbar";
import { ScannerTable } from "./scanner-table";

export function MarketScreenerView() {
  const [data, setData] = useState<MarketScanPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [pinnedSet, setPinnedSet] = useState<Set<string>>(new Set());
  const [recentBreakout, setRecentBreakout] = useState<UnifiedScannedInstrument | null>(null);

  // Fetch live market data
  const loadMarketData = useCallback(async (force: boolean = false) => {
    try {
      if (force) setIsRefreshing(true);
      const res = await fetch(`/api/scanner/market${force ? "?force=true" : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load market scan");
      const json: MarketScanPayload = await res.json();
      setData(json);

      // Check for prominent recent breakout
      const fresh = json.instruments.find((i) => i.breakout.isFreshCrossing);
      if (fresh) {
        setRecentBreakout(fresh);
      }
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
          const fresh = json.instruments.find((i) => i.breakout.isFreshCrossing);
          if (fresh) setRecentBreakout(fresh);
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
    const interval = setInterval(() => {
      loadMarketData();
    }, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
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

  // Filter instruments based on search and active tab
  const filteredInstruments = useMemo(() => {
    if (!data?.instruments) return [];
    let list = data.instruments;

    // Filter by Tab
    if (activeTab === "EQUITIES") list = list.filter((i) => i.instrument_type === "EQUITY");
    else if (activeTab === "OPTIONS") list = list.filter((i) => i.instrument_type === "OPTION");
    else if (activeTab === "UP_BREAKOUTS") list = list.filter((i) => i.breakout.direction === "UP");
    else if (activeTab === "LOW_BREAKOUTS") list = list.filter((i) => i.breakout.direction === "LOW");
    else if (activeTab === "PINNED") list = list.filter((i) => pinnedSet.has(i.symbol));

    // Filter by Search Query
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
  }, [data, activeTab, searchQuery, pinnedSet]);

  if (isLoading && !data) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center font-mono text-xs text-zinc-400">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-white mb-3" />
        <span>Loading full 2,732-instrument market scan...</span>
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
    <div className="space-y-3">
      {/* Prominent High-Impact Flash Banner */}
      <BreakoutBanner
        recentBreakout={recentBreakout}
        onDismiss={() => setRecentBreakout(null)}
      />

      {/* Toolbar & Filters with Unified Single-Line Controls */}
      <ScannerToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={counts}
        onRefresh={() => loadMarketData(true)}
        isRefreshing={isRefreshing}
        currentTimeIST={data?.session?.currentTimeIST}
        lastScannedAt={data?.scannedAt}
        isMarketOpen={data?.session?.isMarketOpen}
      />

      {/* Virtualized/Paginated 2,732-Instrument Table */}
      <ScannerTable
        instruments={filteredInstruments}
        pinnedSet={pinnedSet}
        onTogglePin={handleTogglePin}
      />
    </div>
  );
}
