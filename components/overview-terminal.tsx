"use client";

import { useEffect, useState, useCallback, useRef, useSyncExternalStore } from "react";
import { IndexQuote } from "@/lib/upstox";
import { calculateFibLevels, FibLevels } from "@/lib/fibonacci";
import { RefreshIcon } from "@/components/icons";

const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

function getFallbackReferenceDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  if (d.getDay() === 0) d.setDate(d.getDate() - 2);
  else if (d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface OverviewTerminalProps {
  initialIndices: IndexQuote[];
  initialUpdatedAt: string;
}

export function OverviewTerminal({
  initialIndices,
  initialUpdatedAt,
}: OverviewTerminalProps) {
  const [indices, setIndices] = useState<IndexQuote[]>(initialIndices);
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date(initialUpdatedAt));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [secondsToNextMinute, setSecondsToNextMinute] = useState<number>(60);
  const isMounted = useMounted();
  const isFetchingRef = useRef(false);

  // Core Data Fetcher
  const fetchIndices = useCallback(async (manual = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (manual) setIsRefreshing(true);

    try {
      const res = await fetch("/api/indices", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.status === "success" && Array.isArray(json.indices)) {
          setIndices(json.indices);
          setLastUpdated(new Date(json.updatedAt || Date.now()));
        }
      }
    } catch (err) {
      console.error("Failed to refresh indices:", err);
    } finally {
      isFetchingRef.current = false;
      if (manual) {
        setTimeout(() => setIsRefreshing(false), 250);
      }
    }
  }, []);

  // Minute-boundary auto-refresh synchronized with clock minute close
  useEffect(() => {
    let minuteTimeout: NodeJS.Timeout;
    let minuteInterval: NodeJS.Timeout;

    const setupMinuteCadence = () => {
      const now = new Date();
      const msUntilNextMinute =
        (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

      minuteTimeout = setTimeout(() => {
        fetchIndices(false);
        minuteInterval = setInterval(() => {
          fetchIndices(false);
        }, 60000);
      }, msUntilNextMinute);
    };

    setupMinuteCadence();

    return () => {
      clearTimeout(minuteTimeout);
      clearInterval(minuteInterval);
    };
  }, [fetchIndices]);

  // 1-second countdown to next minute close
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const secs = 60 - now.getSeconds();
      setSecondsToNextMinute(secs === 60 ? 60 : secs);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync immediately when tab regains focus
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchIndices(false);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [fetchIndices]);

  const formattedTime = isMounted
    ? lastUpdated.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
    : "--:--:--";

  return (
    <div className="flex flex-1 flex-col w-full min-h-0 bg-ink">
      {/* Top Status & Cadence Control Bar */}
      <div className="flex h-12 w-full items-center justify-between border-b border-line bg-ink px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-paper" />
            <h1 className="text-xs font-mono font-semibold uppercase tracking-wider text-paper">
              Benchmark Surveillance
            </h1>
          </div>
          <span className="hidden sm:inline-block h-3 w-px bg-line" />
          <span className="hidden sm:inline-block text-[11px] font-mono text-zinc-400">
            Real-Time Prices & Fibonacci AC/DC 38.2
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-1 text-[11px] font-mono text-zinc-300">
            <span className="text-zinc-500">Close in</span>
            <span className="font-semibold text-paper w-5 text-right">
              {secondsToNextMinute}s
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
            <span className="text-zinc-500">Last Synced:</span>
            <span className="text-zinc-200">{formattedTime}</span>
          </div>

          <button
            type="button"
            onClick={() => fetchIndices(true)}
            disabled={isRefreshing}
            aria-label="Refresh live indices"
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-zinc-900 px-2.5 text-xs font-mono font-medium text-paper transition-all hover:bg-zinc-800 active:scale-95 disabled:opacity-50"
          >
            <RefreshIcon
              className={`h-3 w-3 ${isRefreshing ? "animate-spin text-paper" : "text-zinc-400"}`}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Edge-to-edge Full-Width Institutional Table with continuous left-to-right dividers */}
      <div className="flex-1 w-full overflow-x-auto">
        <table className="w-full border-collapse font-mono text-left">
          <thead>
            <tr className="border-b border-line bg-zinc-950/60 text-[11px] uppercase tracking-wider text-zinc-400">
              <th className="py-3 px-4 sm:px-6 font-semibold">Index</th>
              <th className="py-3 px-4 sm:px-6 text-right font-semibold">Price</th>
              <th className="py-3 px-4 sm:px-6 text-right font-semibold">Change</th>
              <th className="py-3 px-4 sm:px-6 text-right font-semibold">AC 38.2</th>
              <th className="py-3 px-4 sm:px-6 text-right font-semibold">DC 38.2</th>
              <th className="py-3 px-4 sm:px-6 text-right font-semibold">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-ink">
            {indices.map((idx) => {
              const isUp = idx.netChange >= 0;

              const high = idx.high || idx.lastPrice;
              const low = idx.low || idx.lastPrice;
              const close = idx.close || idx.lastPrice;

              const fib: FibLevels =
                idx.fibLevels ||
                calculateFibLevels(
                  high > 0 ? high : idx.lastPrice,
                  low > 0 ? low : idx.lastPrice,
                  close > 0 ? close : idx.lastPrice
                );

              const ac38_2 = fib.ac38_2;
              const dc38_2 = fib.dc38_2;
              const refDate = idx.referenceDate || getFallbackReferenceDate();

              return (
                <tr
                  key={idx.symbol}
                  className="border-b border-line transition-colors hover:bg-zinc-950/60"
                >
                  {/* 1. Name */}
                  <td className="py-3.5 px-4 sm:px-6 align-middle font-sans font-bold text-sm sm:text-base text-paper whitespace-nowrap">
                    {idx.name}
                  </td>

                  {/* 2. Price (NO rupee symbol) */}
                  <td className="py-3.5 px-4 sm:px-6 text-right align-middle font-mono font-bold text-base sm:text-lg text-paper whitespace-nowrap">
                    {idx.lastPrice
                      ? idx.lastPrice.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : "--"}
                  </td>

                  {/* 3. Price Change */}
                  <td className="py-3.5 px-4 sm:px-6 text-right align-middle whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${
                        isUp
                          ? "border border-zinc-700 bg-zinc-800 text-paper"
                          : "border border-red-900/60 bg-red-950/40 text-red-400"
                      }`}
                    >
                      {isUp ? "+" : ""}
                      {idx.netChange.toFixed(2)} ({isUp ? "+" : ""}
                      {idx.percentageChange.toFixed(2)}%)
                    </span>
                  </td>

                  {/* 4. AC 38.2 (NO rupee symbol) */}
                  <td className="py-3.5 px-4 sm:px-6 text-right align-middle font-mono text-xs sm:text-sm font-semibold text-paper whitespace-nowrap">
                    {ac38_2.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>

                  {/* 5. DC 38.2 (NO rupee symbol) */}
                  <td className="py-3.5 px-4 sm:px-6 text-right align-middle font-mono text-xs sm:text-sm font-semibold text-paper whitespace-nowrap">
                    {dc38_2.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>

                  {/* 6. Date */}
                  <td className="py-3.5 px-4 sm:px-6 text-right align-middle font-mono text-xs text-zinc-400 whitespace-nowrap">
                    {refDate}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Terminal Telemetry Footer */}
      <div className="border-t border-line bg-zinc-950/40 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
            <span>Cash Market Trading Session: 09:15 - 15:30 IST</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Cadence: 1-Minute Close Auto-Sync</span>
            <span className="hidden sm:inline">•</span>
            <span>Provider: Upstox v2 Market Gateway</span>
          </div>
        </div>
      </div>
    </div>
  );
}
