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
    timeZone: "Asia/Kolkata",
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
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
    : "--:--:--";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-6 sm:px-6 sm:py-10">
      {/* Workspace heading — vertically breathing, optically centered group */}
      <div className="flex flex-col gap-4 pb-5 sm:flex-row sm:items-end sm:justify-between sm:pb-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute h-full w-full rounded-full bg-paper opacity-40 blip" />
              <span className="h-2 w-2 rounded-full bg-paper" />
            </span>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
              Benchmark Surveillance
            </p>
          </div>
          <h1 className="text-xl font-semibold tracking-[-0.02em] text-paper sm:text-2xl">
            Market Overview
          </h1>
          <p className="text-[13px] leading-relaxed text-zinc-400">
            Real-time prices with Fibonacci AC/DC 38.2 levels
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <div className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-zinc-900/80 px-2.5 font-mono text-[11px] text-zinc-300 tabular">
            <span className="text-zinc-500">Close in</span>
            <span className="w-6 text-right font-semibold text-paper">
              {secondsToNextMinute}s
            </span>
          </div>

          <div className="hidden h-8 items-center gap-1.5 rounded-lg border border-line bg-zinc-900/40 px-2.5 font-mono text-[11px] text-zinc-400 md:inline-flex tabular">
            <span className="text-zinc-500">Synced</span>
            <span className="text-zinc-200">{formattedTime}</span>
          </div>

          <button
            type="button"
            onClick={() => fetchIndices(true)}
            disabled={isRefreshing}
            aria-label="Refresh live indices"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-zinc-900 px-3 font-mono text-[11px] font-medium text-paper transition-colors hover:border-zinc-700 hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50 focus-visible:outline-paper"
          >
            <RefreshIcon
              className={`h-3 w-3 ${isRefreshing ? "animate-spin text-paper" : "text-zinc-400"}`}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Institutional card — contained, rounded, hairline */}
      <section
        aria-label="Benchmark indices"
        aria-live="polite"
        className="fade-in overflow-hidden rounded-xl border border-line bg-panel"
      >
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line bg-zinc-950/60 font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-400">
                <th scope="col" className="px-5 py-3 font-medium">Index</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Price</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Change</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">AC 38.2</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">DC 38.2</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-transparent">
              {indices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <p className="text-sm font-medium text-paper">No benchmark data</p>
                    <p className="mt-1 font-mono text-[11px] text-zinc-500">
                      Waiting for the market gateway — try Refresh.
                    </p>
                  </td>
                </tr>
              )}
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
                  className="transition-colors last:border-b-0 hover:bg-zinc-900/40"
                >
                  {/* 1. Name */}
                  <td className="px-5 py-4 align-middle whitespace-nowrap">
                    <p className="text-sm font-semibold tracking-[-0.01em] text-paper">
                      {idx.name}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                      {idx.symbol}
                    </p>
                  </td>

                  {/* 2. Price (NO rupee symbol) */}
                  <td className="px-5 py-4 text-right align-middle font-mono text-[15px] font-semibold text-paper whitespace-nowrap tabular">
                    {idx.lastPrice
                      ? idx.lastPrice.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : "--"}
                  </td>

                  {/* 3. Price Change */}
                  <td className="px-5 py-4 text-right align-middle whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] font-medium tabular ${
                        isUp
                          ? "border border-line bg-zinc-900 text-paper"
                          : "border border-red-900/50 bg-red-950/30 text-drop"
                      }`}
                    >
                      {isUp ? "+" : ""}
                      {idx.netChange.toFixed(2)} ({isUp ? "+" : ""}
                      {idx.percentageChange.toFixed(2)}%)
                    </span>
                  </td>

                  {/* 4. AC 38.2 (NO rupee symbol) */}
                  <td className="px-5 py-4 text-right align-middle font-mono text-[13px] font-medium text-zinc-300 whitespace-nowrap tabular">
                    {ac38_2.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>

                  {/* 5. DC 38.2 (NO rupee symbol) */}
                  <td className="px-5 py-4 text-right align-middle font-mono text-[13px] font-medium text-zinc-300 whitespace-nowrap tabular">
                    {dc38_2.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>

                  {/* 6. Date */}
                  <td className="px-5 py-4 text-right align-middle font-mono text-xs text-zinc-500 whitespace-nowrap tabular">
                    {refDate}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>

        {/* Terminal telemetry footer — inside card */}
        <div className="border-t border-line bg-ink/60 px-5 py-3">
          <div className="flex flex-col gap-1.5 font-mono text-[11px] text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
              <span>Cash session 09:15 – 15:30 IST</span>
            </div>
            <div className="flex items-center gap-2 tabular">
              <span>1-min close auto-sync</span>
              <span aria-hidden="true" className="text-zinc-600">·</span>
              <span>Upstox v2 gateway</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
