"use client";

import React, { useState, useEffect, useCallback } from "react";
import { UnifiedScannedInstrument, MarketScanPayload } from "@/lib/scanner/market-coordinator";
import { ScannerTable } from "./scanner-table";
import { exportInstrumentsToExcel } from "@/lib/export-excel";
import { RefreshIcon } from "@/components/icons";

export function PinnedWatchlistView() {
  const [pinnedItems, setPinnedItems] = useState<UnifiedScannedInstrument[]>([]);
  const [pinnedSet, setPinnedSet] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async (manual = false) => {
    try {
      if (manual) setIsRefreshing(true);
      const [marketRes, pinRes] = await Promise.all([
        fetch("/api/scanner/market", { cache: "no-store" }),
        fetch("/api/watchlist/pin", { cache: "no-store" }),
      ]);

      if (marketRes.ok && pinRes.ok) {
        const marketJson: MarketScanPayload = await marketRes.json();
        const pinJson = await pinRes.json();

        const pins = new Set<string>((pinJson.items || []).map((x: { symbol: string }) => x.symbol));
        setPinnedSet(pins);

        const filtered = (marketJson.instruments || []).filter((i) => pins.has(i.symbol));
        setPinnedItems(filtered);
      }
    } catch (err) {
      console.error("Failed to load pinned watchlist:", err);
    } finally {
      setIsLoading(false);
      if (manual) setIsRefreshing(false);
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

        if (marketRes.ok && pinRes.ok && isMounted) {
          const marketJson: MarketScanPayload = await marketRes.json();
          const pinJson = await pinRes.json();

          const pins = new Set<string>((pinJson.items || []).map((x: { symbol: string }) => x.symbol));
          setPinnedSet(pins);

          const filtered = (marketJson.instruments || []).filter((i) => pins.has(i.symbol));
          setPinnedItems(filtered);
        }
      } catch (err) {
        console.error("Failed to load pinned watchlist:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    init();
    const interval = setInterval(() => {
      loadData();
    }, 60 * 1000); // 1-minute cadence

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [loadData]);

  const handleTogglePin = async (item: UnifiedScannedInstrument) => {
    // Optimistic removal from pinned list
    setPinnedSet((prev) => {
      const next = new Set(prev);
      next.delete(item.symbol);
      return next;
    });
    setPinnedItems((prev) => prev.filter((i) => i.symbol !== item.symbol));

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
      console.error("Failed to unpin:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-[400px] w-full max-w-[1440px] flex-col items-center justify-center px-4 font-mono text-xs text-zinc-400">
        <span className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
        <span>Loading watchlist...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
      {/* Workspace heading — matches screener rhythm */}
      <div className="flex flex-col gap-4 pb-5 sm:flex-row sm:items-end sm:justify-between sm:pb-6">
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
            My Watchlist
          </p>
          <h1 className="text-xl font-semibold tracking-[-0.02em] text-paper sm:text-2xl">
            Pinned Symbols
          </h1>
          <p className="text-[13px] leading-relaxed text-zinc-400">
            {pinnedItems.length === 0
              ? "Pin symbols on the screener to monitor them here every 1 minute."
              : `${pinnedItems.length} pinned ${pinnedItems.length === 1 ? "symbol" : "symbols"} · monitored every 1 minute for AC/DC 38.2% breakouts.`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="inline-flex h-8 items-center rounded-lg border border-line bg-zinc-900/40 px-2.5 font-mono text-[11px] text-zinc-300 tabular">
            <span className="font-semibold text-paper">{pinnedItems.length}</span>
            <span className="ml-1.5 text-zinc-500">pinned</span>
          </div>

          <button
            type="button"
            onClick={() => exportInstrumentsToExcel(pinnedItems, "WATCHLIST")}
            disabled={pinnedItems.length === 0}
            title="Download watchlist as Excel (.csv)"
            className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-zinc-900 px-3 font-mono text-[11px] font-medium text-paper transition-colors hover:border-zinc-700 hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-40"
          >
            <svg className="h-3 w-3 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <span className="hidden sm:inline">Download</span>
          </button>

          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            aria-label="Refresh watchlist"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-zinc-900 px-3 font-mono text-[11px] font-medium text-paper transition-colors hover:border-zinc-700 hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50"
          >
            <RefreshIcon
              className={`h-3 w-3 ${isRefreshing ? "animate-spin text-paper" : "text-zinc-400"}`}
            />
            <span>{isRefreshing ? "Syncing" : "Refresh"}</span>
          </button>
        </div>
      </div>

      {pinnedItems.length > 0 ? (
        <ScannerTable
          instruments={pinnedItems}
          pinnedSet={pinnedSet}
          onTogglePin={handleTogglePin}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-line bg-panel px-6 py-14 text-center">
          <p className="text-sm font-medium text-paper">Your watchlist is empty</p>
          <p className="mx-auto mt-1.5 max-w-md font-mono text-[11px] leading-relaxed text-zinc-500">
            Go to the 1-Minute Screener and pin any symbol to track it here with live AC/DC 38.2% levels.
          </p>
        </div>
      )}
    </div>
  );
}
