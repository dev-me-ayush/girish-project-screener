"use client";

import React, { useState, useEffect, useCallback } from "react";
import { UnifiedScannedInstrument, MarketScanPayload } from "@/lib/scanner/market-coordinator";
import { ScannerTable } from "./scanner-table";

export function PinnedWatchlistView() {
  const [pinnedItems, setPinnedItems] = useState<UnifiedScannedInstrument[]>([]);
  const [pinnedSet, setPinnedSet] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
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
    }, 5 * 60 * 1000);

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
      <div className="flex min-h-[300px] flex-col items-center justify-center font-mono text-xs text-zinc-400">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-white mb-3" />
        <span>Loading Pinned Watchlist...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between font-mono text-xs border-b border-zinc-800 pb-3">
        <div>
          <h2 className="text-sm font-bold text-white tracking-wider">MY PINNED WATCHLIST</h2>
          <p className="text-zinc-400 mt-0.5">
            Your single focused portfolio monitored every 5 minutes for AC/DC 38.2% breakouts.
          </p>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-950 px-3 py-1 text-white">
          {pinnedItems.length} Pinned Symbols
        </div>
      </div>

      {pinnedItems.length > 0 ? (
        <ScannerTable
          instruments={pinnedItems}
          pinnedSet={pinnedSet}
          onTogglePin={handleTogglePin}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-800 p-12 text-center font-mono text-xs text-zinc-500">
          <p className="text-sm text-zinc-400 mb-1">Your Watchlist is empty.</p>
          <p>
            Go to the <strong className="text-white">Market Screener</strong> and click the{" "}
            <span className="text-white">★</span> icon next to any of the 2,732 stocks or options to pin it here.
          </p>
        </div>
      )}
    </div>
  );
}
