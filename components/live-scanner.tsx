"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  MultiWatchlistSymbolResult,
  MultiWatchlistScanResponse,
} from "@/lib/scanner";
import {
  RefreshIcon,
  CheckIcon,
  LayersIcon,
  ChevronDownIcon,
} from "@/components/icons";
import { InfoTooltip } from "@/components/info-tooltip";

interface WatchlistSummaryOption {
  id: string;
  name: string;
  item_count: number;
  timeframe?: string;
  is_scanning_active: boolean;
}

export function LiveScanner() {
  const [watchlists, setWatchlists] = useState<WatchlistSummaryOption[]>([]);
  const [selectedWlIds, setSelectedWlIds] = useState<string[]>([]);
  const [screenerResults, setScreenerResults] = useState<MultiWatchlistSymbolResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScannedAt, setLastScannedAt] = useState<string>("");
  const [isWlDropdownOpen, setIsWlDropdownOpen] = useState(false);
  const wlDropdownRef = useRef<HTMLDivElement>(null);

  // 1. Initial Load of Saved Watchlists
  useEffect(() => {
    let isMounted = true;

    async function loadWatchlists() {
      try {
        const res = await fetch("/api/watchlists", { cache: "no-store" });
        const data = await res.json();

        if (isMounted && data.status === "success" && data.watchlists) {
          setWatchlists(data.watchlists);
          // Default: select all watchlists
          const ids = data.watchlists.map((w: WatchlistSummaryOption) => w.id);
          setSelectedWlIds(ids);

          if (ids.length > 0) {
            // Trigger initial screener scan
            fetch(`/api/scanner/multi?watchlistIds=${encodeURIComponent(ids.join(","))}`)
              .then((r) => r.json())
              .then((d) => {
                if (isMounted && d.status === "success" && d.scan) {
                  const scan: MultiWatchlistScanResponse = d.scan;
                  setScreenerResults(scan.results || []);
                  setLastScannedAt(
                    new Date(scan.scannedAt).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })
                  );
                }
              })
              .catch(console.error);
          }
        }
      } catch (err) {
        console.error("Failed to load watchlists:", err);
      }
    }

    loadWatchlists();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (wlDropdownRef.current && !wlDropdownRef.current.contains(e.target as Node)) {
        setIsWlDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // 3. Scan Selected Watchlists
  const executeScan = useCallback(
    async (targetIds?: string[]) => {
      const ids = targetIds || selectedWlIds;
      if (ids.length === 0) {
        setScreenerResults([]);
        return;
      }

      setIsScanning(true);
      try {
        const queryParam = ids.join(",");
        const res = await fetch(`/api/scanner/multi?watchlistIds=${encodeURIComponent(queryParam)}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (data.status === "success" && data.scan) {
          const scan: MultiWatchlistScanResponse = data.scan;
          setScreenerResults(scan.results || []);
          setLastScannedAt(
            new Date(scan.scannedAt).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          );
        }
      } catch (err) {
        console.error("Screener scan error:", err);
      } finally {
        setIsScanning(false);
      }
    },
    [selectedWlIds]
  );

  const breakoutCount = screenerResults.filter((r) => r.breakout?.hasBroken).length;

  return (
    <div className="flex flex-col w-full flex-1 min-h-[calc(100dvh-3.5rem)] bg-ink relative">
      {/* ========================================================= */}
      {/* 1. COMPLETE SUB-HEADER (Directly below main dashboard header) */}
      {/* ========================================================= */}
      <div className="flex h-12 w-full items-center justify-between border-b border-zinc-800 bg-ink px-4 sm:px-6 shrink-0">
        {/* Left Side: Title, Info Icon, Watchlist Selector, and Scan Trigger */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Title + Info Icon */}
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-paper shrink-0" />
            <h1 className="text-xs font-mono font-semibold uppercase tracking-wider text-paper shrink-0">
              Watchlist Screener
            </h1>
            <InfoTooltip
              text="Institutional real-time screener tracking Previous Day High/Low breaches and Fibonacci 38.2%, 50%, 61.8% pivots across active stocks in selected watchlists."
              side="bottom"
            />
          </div>

          <span className="h-3 w-px bg-zinc-800 shrink-0" />

          {/* Watchlists Dropdown Selector with Info Icon */}
          <div className="flex items-center gap-1.5" ref={wlDropdownRef}>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsWlDropdownOpen((prev) => !prev)}
                aria-expanded={isWlDropdownOpen}
                title="Select Watchlists"
                className="inline-flex h-7 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 text-xs font-mono font-medium text-paper hover:bg-zinc-800 hover:border-zinc-600 transition-colors shadow-xs"
              >
                <LayersIcon className="h-3.5 w-3.5 text-zinc-400" />
                <span className="truncate max-w-[140px] sm:max-w-[200px]">
                  {selectedWlIds.length === 0
                    ? "Select Watchlists"
                    : selectedWlIds.length === watchlists.length
                    ? `All Watchlists (${watchlists.length})`
                    : selectedWlIds.length === 1
                    ? watchlists.find((w) => w.id === selectedWlIds[0])?.name || "1 Watchlist"
                    : `${selectedWlIds.length} of ${watchlists.length} Watchlists`}
                </span>
                <ChevronDownIcon
                  className={`h-3 w-3 text-zinc-400 transition-transform duration-150 ${
                    isWlDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Watchlists Popover Menu */}
              {isWlDropdownOpen && (
                <div
                  className="absolute left-0 top-full mt-1.5 z-50 w-72 rounded-xl border border-zinc-700 bg-zinc-950 p-2 shadow-2xl space-y-1.5 backdrop-blur-xs"
                  role="menu"
                >
                  <div className="flex items-center justify-between px-2 py-1 border-b border-zinc-800 text-[11px] font-mono text-zinc-400">
                    <span className="uppercase tracking-wider font-semibold text-zinc-500">
                      Filter Watchlists
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = watchlists.map((w) => w.id);
                        const isAll = selectedWlIds.length === watchlists.length;
                        const next = isAll ? [] : allIds;
                        setSelectedWlIds(next);
                        if (!isAll) executeScan(allIds);
                      }}
                      className="text-paper hover:underline font-semibold"
                    >
                      {selectedWlIds.length === watchlists.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-0.5 divide-y divide-zinc-900/60">
                    {watchlists.length === 0 ? (
                      <div className="p-3 text-center text-xs font-mono text-zinc-500">
                        No watchlists available.
                      </div>
                    ) : (
                      watchlists.map((wl) => {
                        const isSelected = selectedWlIds.includes(wl.id);
                        return (
                          <div
                            key={wl.id}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors group ${
                              isSelected
                                ? "bg-zinc-900 text-paper font-medium"
                                : "text-zinc-400 hover:bg-zinc-900/60 hover:text-paper"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                const next = isSelected
                                  ? selectedWlIds.filter((id) => id !== wl.id)
                                  : [...selectedWlIds, wl.id];
                                setSelectedWlIds(next);
                                executeScan(next);
                              }}
                              className="flex items-center gap-2 flex-1 text-left truncate mr-2"
                            >
                              <div
                                className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                  isSelected
                                    ? "bg-paper border-paper text-ink"
                                    : "border-zinc-700 bg-zinc-900"
                                }`}
                              >
                                {isSelected && <CheckIcon className="h-2.5 w-2.5 stroke-[2.5]" />}
                              </div>
                              <span className="truncate">{wl.name}</span>
                            </button>

                            <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-zinc-500">
                              <span>{wl.item_count}</span>
                              {wl.timeframe && (
                                <span className="px-1 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                                  {wl.timeframe}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedWlIds([wl.id]);
                                  executeScan([wl.id]);
                                  setIsWlDropdownOpen(false);
                                }}
                                className="ml-1 text-[10px] text-zinc-400 hover:text-paper hover:underline px-1 py-0.5"
                                title="Filter only this watchlist"
                              >
                                Only
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
            <InfoTooltip
              text="Select specific watchlists or scan all watchlists concurrently to filter candidate stocks."
              side="bottom"
            />
          </div>

          <span className="h-3 w-px bg-zinc-800 shrink-0" />

          {/* Scan Selected Action Trigger */}
          <button
            type="button"
            onClick={() => executeScan()}
            disabled={isScanning || selectedWlIds.length === 0}
            className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-line bg-paper px-3 text-xs font-mono font-bold text-ink hover:bg-zinc-200 transition-all shrink-0 shadow-xs disabled:opacity-50"
          >
            <RefreshIcon className={`h-3 w-3 ${isScanning ? "animate-spin" : ""}`} />
            <span>{isScanning ? "Scanning..." : "Scan Selected"}</span>
          </button>
        </div>

        {/* Right Side: Telemetry, Timestamp, and Refresh */}
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <div className="hidden md:flex items-center gap-2 text-[11px] font-mono text-zinc-400">
            <span>{screenerResults.length} Symbols</span>
            <span className="text-zinc-700">•</span>
            <span className={breakoutCount > 0 ? "text-paper font-semibold" : "text-zinc-500"}>
              {breakoutCount} {breakoutCount === 1 ? "Breakout" : "Breakouts"}
            </span>
          </div>

          {lastScannedAt && (
            <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline">
              Synced: <span className="text-zinc-400">{lastScannedAt}</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => executeScan()}
            disabled={isScanning || selectedWlIds.length === 0}
            aria-label="Refresh screener data"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-paper hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <RefreshIcon className={`h-3 w-3 ${isScanning ? "animate-spin text-paper" : ""}`} />
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. SPREADSHEET TABLE WITH CONTINUOUS DIVIDERS & INFO ICONS */}
      {/* ========================================================= */}
      <div className="flex-1 overflow-x-auto bg-ink">
        <table className="w-full border-collapse border-b border-zinc-800 font-mono text-xs text-left">
          {/* Column Headers with Educational Info Icons on each metric */}
          <thead>
            <tr className="bg-zinc-950 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-800 sticky top-0 z-20">
              {/* 1. Row Index */}
              <th className="w-12 border-r border-zinc-800 py-1.5 px-2 text-center text-zinc-500 sticky left-0 bg-zinc-950 z-30">
                <div className="inline-flex items-center justify-center gap-1">
                  <span>#</span>
                  <InfoTooltip text="Sequential row index in the filtered screener universe." side="bottom" />
                </div>
              </th>

              {/* 2. Symbol */}
              <th className="min-w-40 border-r border-zinc-800 py-1.5 px-3 sticky left-12 bg-zinc-950 z-30 font-semibold">
                <div className="inline-flex items-center gap-1">
                  <span>Symbol</span>
                  <InfoTooltip text="Trading symbol and market instrument category (Equity, Index, or Option)." side="bottom" />
                </div>
              </th>

              {/* 3. Timeframe */}
              <th className="w-16 border-r border-zinc-800 py-1.5 px-2 text-center font-semibold">
                <div className="inline-flex items-center justify-center gap-1">
                  <span>TF</span>
                  <InfoTooltip text="Watchlist candle timeframe analyzed for session Fibonacci pivot calculations." side="bottom" />
                </div>
              </th>

              {/* 4. LTP */}
              <th className="w-28 border-r border-zinc-800 py-1.5 px-3 text-right font-semibold">
                <div className="inline-flex items-center justify-end gap-1">
                  <span>LTP</span>
                  <InfoTooltip text="Last Traded Price in real time from Upstox market feed." side="bottom" />
                </div>
              </th>

              {/* 5. Day Change */}
              <th className="w-24 border-r border-zinc-800 py-1.5 px-3 text-right font-semibold">
                <div className="inline-flex items-center justify-end gap-1">
                  <span>Day Chg</span>
                  <InfoTooltip text="Net day price change relative to previous session close." side="bottom" />
                </div>
              </th>

              {/* 6. Open Interest */}
              <th className="w-24 border-r border-zinc-800 py-1.5 px-3 text-right font-semibold">
                <div className="inline-flex items-center justify-end gap-1">
                  <span>OI</span>
                  <InfoTooltip text="Live Open Interest (OI) from Upstox. Displays contract OI for F&O options/futures, and aggregate active expiry derivative OI for F&O underlying equities. Non-F&O cash equities display N/A." side="bottom" />
                </div>
              </th>

              {/* 7. Volume */}
              <th className="w-24 border-r border-zinc-800 py-1.5 px-3 text-right font-semibold">
                <div className="inline-flex items-center justify-end gap-1">
                  <span>Volume</span>
                  <InfoTooltip text="Cumulative trading volume recorded for current session." side="bottom" />
                </div>
              </th>

              {/* 8. PDH */}
              <th className="w-24 border-r border-zinc-800 py-1.5 px-3 text-right font-semibold">
                <div className="inline-flex items-center justify-end gap-1">
                  <span>PDH</span>
                  <InfoTooltip text="Previous Day High (100.0% Fibonacci baseline anchor)." side="bottom" />
                </div>
              </th>

              {/* 9. PDL */}
              <th className="w-24 border-r border-zinc-800 py-1.5 px-3 text-right font-semibold">
                <div className="inline-flex items-center justify-end gap-1">
                  <span>PDL</span>
                  <InfoTooltip text="Previous Day Low (0.0% Fibonacci baseline anchor)." side="bottom" />
                </div>
              </th>

              {/* 10. AC 38.2% */}
              <th className="w-24 border-r border-zinc-800 py-1.5 px-3 text-right font-semibold">
                <div className="inline-flex items-center justify-end gap-1">
                  <span>AC 38.2%</span>
                  <InfoTooltip text="Ascending Fibonacci 38.2% level: PDH - 0.382 * (PDH - PDL). Key structural retracement pivot." side="bottom" />
                </div>
              </th>

              {/* 11. DC 38.2% */}
              <th className="w-24 border-r border-zinc-800 py-1.5 px-3 text-right font-semibold">
                <div className="inline-flex items-center justify-end gap-1">
                  <span>DC 38.2%</span>
                  <InfoTooltip text="Descending Fibonacci 38.2% level: PDL + 0.382 * (PDH - PDL). Key structural retracement pivot." side="bottom" />
                </div>
              </th>

              {/* 12. Breakout Status */}
              <th className="min-w-40 border-r border-zinc-800 py-1.5 px-3 text-left font-semibold">
                <div className="inline-flex items-center gap-1">
                  <span>Breakout Status</span>
                  <InfoTooltip text="Real-time breakout detection indicating whether price has breached PDH, PDL, or Fibonacci thresholds." side="bottom" />
                </div>
              </th>

              {/* 13. Time */}
              <th className="w-24 py-1.5 px-3 text-center font-semibold">
                <div className="inline-flex items-center justify-center gap-1">
                  <span>Time</span>
                  <InfoTooltip text="Timestamp of the detected level breakout or latest quotation update." side="bottom" />
                </div>
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-zinc-800/80">
            {screenerResults.length === 0 ? (
              <tr>
                <td colSpan={13} className="py-20 text-center text-zinc-500">
                  {isScanning ? (
                    <div className="flex flex-col items-center gap-2">
                      <RefreshIcon className="h-5 w-5 animate-spin text-paper" />
                      <span className="text-xs font-mono text-zinc-400">
                        Scanning selected watchlists...
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-zinc-500">
                      {selectedWlIds.length === 0
                        ? "No watchlists selected. Choose one or more watchlists from the header to run screener."
                        : "No symbols currently found in the selected watchlists."}
                    </span>
                  )}
                </td>
              </tr>
            ) : (
              screenerResults.map((item, idx) => {
                const isPositive = item.netChange > 0;
                const isNegative = item.netChange < 0;
                const b = item.breakout;

                return (
                  <tr
                    key={item.itemId}
                    className="h-9 hover:bg-zinc-900/40 transition-colors group"
                  >
                    {/* Sticky Row Number */}
                    <td className="w-12 border-r border-zinc-800 py-1.5 text-center font-mono text-[11px] text-zinc-500 bg-zinc-950/60 sticky left-0 group-hover:bg-zinc-950 select-none">
                      {idx + 1}
                    </td>

                    {/* Sticky Symbol */}
                    <td className="min-w-40 border-r border-zinc-800 px-3 py-1.5 sticky left-12 bg-ink group-hover:bg-zinc-950">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-paper text-xs">{item.symbol}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded border border-zinc-800 bg-zinc-900 text-zinc-400 uppercase">
                          {item.instrumentType}
                        </span>
                      </div>
                    </td>

                    {/* Timeframe */}
                    <td className="w-16 border-r border-zinc-800 px-2 py-1.5 text-center">
                      <span className="px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-[10px] text-zinc-300 font-semibold">
                        {item.timeframe}
                      </span>
                    </td>

                    {/* LTP (Zero rupee symbol) */}
                    <td className="w-28 border-r border-zinc-800 px-3 py-1.5 text-right font-mono font-bold text-paper">
                      {item.ltp > 0
                        ? item.ltp.toLocaleString("en-IN", { minimumFractionDigits: 2 })
                        : "--"}
                    </td>

                    {/* Net Change */}
                    <td className="w-24 border-r border-zinc-800 px-3 py-1.5 text-right">
                      {item.ltp > 0 ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold ${
                            isPositive
                              ? "bg-zinc-800 text-paper border border-zinc-700"
                              : isNegative
                              ? "bg-red-950/40 text-red-400 border border-red-900/50"
                              : "text-zinc-500"
                          }`}
                        >
                          {isPositive ? "+" : ""}
                          {item.netChange.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-zinc-600 font-mono">--</span>
                      )}
                    </td>

                    {/* Open Interest */}
                    <td className="w-24 border-r border-zinc-800 px-3 py-1.5 text-right font-mono">
                      {item.openInterest > 0 ? (
                        <span
                          className="text-paper font-semibold"
                          title={`${item.openInterest.toLocaleString("en-IN")} open contracts`}
                        >
                          {item.openInterest >= 1000000
                            ? `${(item.openInterest / 1000000).toFixed(2)}M`
                            : item.openInterest >= 1000
                            ? `${(item.openInterest / 1000).toFixed(1)}k`
                            : item.openInterest.toLocaleString("en-IN")}
                        </span>
                      ) : (
                        <span
                          className="text-zinc-600 font-mono text-[11px]"
                          title={
                            item.instrumentType === "EQUITY"
                              ? "Non-F&O equity: Cash shares carry no derivative Open Interest"
                              : "0 open contracts"
                          }
                        >
                          {item.instrumentType === "EQUITY" ? "N/A" : "0"}
                        </span>
                      )}
                    </td>

                    {/* Volume */}
                    <td className="w-24 border-r border-zinc-800 px-3 py-1.5 text-right text-zinc-400 font-mono">
                      {item.volume >= 1000000
                        ? `${(item.volume / 1000000).toFixed(2)}M`
                        : item.volume >= 1000
                        ? `${(item.volume / 1000).toFixed(1)}k`
                        : item.volume.toLocaleString("en-IN")}
                    </td>

                    {/* PDH (Zero rupee symbol) */}
                    <td className="w-24 border-r border-zinc-800 px-3 py-1.5 text-right text-zinc-400 font-mono">
                      {item.pdh.toFixed(2)}
                    </td>

                    {/* PDL (Zero rupee symbol) */}
                    <td className="w-24 border-r border-zinc-800 px-3 py-1.5 text-right text-zinc-400 font-mono">
                      {item.pdl.toFixed(2)}
                    </td>

                    {/* Fib AC 38.2% (Zero rupee symbol) */}
                    <td className="w-24 border-r border-zinc-800 px-3 py-1.5 text-right text-zinc-300 font-mono">
                      {item.ac38_2 > 0 ? item.ac38_2.toFixed(2) : "--"}
                    </td>

                    {/* Fib DC 38.2% (Zero rupee symbol) */}
                    <td className="w-24 border-r border-zinc-800 px-3 py-1.5 text-right text-zinc-300 font-mono">
                      {item.dc38_2 > 0 ? item.dc38_2.toFixed(2) : "--"}
                    </td>

                    {/* Breakout Status */}
                    <td className="min-w-36 border-r border-zinc-800 px-3 py-1.5 font-mono text-[11px] text-paper">
                      {b.statusLabel || "Inside Range"}
                    </td>

                    {/* Breakout Time */}
                    <td className="w-24 py-1.5 px-3 text-center text-[11px] font-mono text-zinc-400">
                      {b.breakoutTime || "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ========================================================= */}
      {/* 3. PINNED TELEMETRY FOOTER                                */}
      {/* ========================================================= */}
      <div className="mt-auto border-t border-zinc-800 bg-zinc-950/60 px-4 sm:px-6 py-2.5 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
            <span>Upstox Live Screener Engine</span>
          </div>
          <div className="flex items-center gap-4">
            <span>
              {selectedWlIds.length} of {watchlists.length} Watchlists Active
            </span>
            <span className="text-zinc-700">•</span>
            <span>{screenerResults.length} Instruments</span>
          </div>
        </div>
      </div>
    </div>
  );
}
