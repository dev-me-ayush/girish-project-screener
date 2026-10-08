"use client";

import { useEffect, useState, useCallback, useRef, useSyncExternalStore } from "react";
import { IndexQuote } from "@/lib/upstox";
import { FibLevels } from "@/lib/fibonacci";
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
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-slate-900">
              Benchmark Surveillance
            </p>
          </div>
          <h1 className="text-xl font-bold tracking-[-0.02em] text-slate-900 sm:text-2xl">
            Market Overview
          </h1>
          <p className="text-[13px] leading-relaxed font-medium text-slate-700">
            Real-time prices with Fibonacci AC/DC 38.2 levels
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <div className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 font-mono text-[11px] text-slate-800 tabular shadow-xs">
            <span className="text-slate-500 font-medium">Close in</span>
            <span className="w-6 text-right font-bold text-slate-900">
              {secondsToNextMinute}s
            </span>
          </div>

          <div className="hidden h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 font-mono text-[11px] text-slate-800 md:inline-flex tabular shadow-xs">
            <span className="text-slate-500 font-medium">Synced</span>
            <span className="text-slate-900 font-semibold">{formattedTime}</span>
          </div>

          <button
            type="button"
            onClick={() => fetchIndices(true)}
            disabled={isRefreshing}
            aria-label="Refresh live indices"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 font-mono text-[11px] font-semibold text-slate-900 transition-colors hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50 shadow-xs focus-visible:outline-slate-900"
          >
            <RefreshIcon
              className={`h-3 w-3 ${isRefreshing ? "animate-spin text-slate-900" : "text-slate-600"}`}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Institutional card — white background, slate border, soft shadow */}
      <section
        aria-label="Benchmark indices"
        aria-live="polite"
        className="fade-in overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs"
      >
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 font-mono text-[11px] uppercase tracking-[0.12em] text-slate-900">
                <th scope="col" className="px-5 py-3 font-bold">Index</th>
                <th scope="col" className="px-5 py-3 text-right font-bold">Price</th>
                <th scope="col" className="px-5 py-3 text-right font-bold">Change</th>
                <th scope="col" className="px-5 py-3 text-right font-bold">AC 38.2</th>
                <th scope="col" className="px-5 py-3 text-right font-bold">DC 38.2</th>
                <th scope="col" className="px-5 py-3 text-right font-bold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {indices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <p className="text-sm font-bold text-slate-900">No benchmark data</p>
                    <p className="mt-1 font-mono text-[11px] text-slate-500">
                      Waiting for the market gateway — try Refresh.
                    </p>
                  </td>
                </tr>
              )}
            {indices.map((idx) => {
              const isUp = idx.netChange >= 0;

              // AC/DC must anchor to the previous completed session (server
              // fibLevels). Never derive them from today's live OHLC: with no
              // grounded levels, render "--" instead of wrong numbers.
              const fib: FibLevels | undefined = idx.fibLevels;

              const ac38_2 = fib?.ac38_2;
              const dc38_2 = fib?.dc38_2;
              const refDate = idx.referenceDate || getFallbackReferenceDate();

              return (
                <tr
                  key={idx.symbol}
                  className="transition-colors last:border-b-0 hover:bg-slate-50"
                >
                  {/* 1. Name */}
                  <td className="px-5 py-4 align-middle whitespace-nowrap">
                    <p className="text-sm font-bold tracking-[-0.01em] text-slate-900">
                      {idx.name}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      {idx.symbol}
                    </p>
                  </td>

                  {/* 2. Price (NO rupee symbol) */}
                  <td className="px-5 py-4 text-right align-middle font-mono text-[15px] font-bold text-slate-900 whitespace-nowrap tabular">
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
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold tabular ${
                        isUp
                          ? "border border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border border-rose-300 bg-rose-50 text-rose-700"
                      }`}
                    >
                      {isUp ? "+" : ""}
                      {idx.netChange.toFixed(2)} ({isUp ? "+" : ""}
                      {idx.percentageChange.toFixed(2)}%)
                    </span>
                  </td>

                  {/* 4. AC 38.2 (NO rupee symbol) */}
                  <td className="px-5 py-4 text-right align-middle font-mono text-[13px] font-semibold text-slate-700 whitespace-nowrap tabular">
                    {typeof ac38_2 === "number" && ac38_2 > 0
                      ? ac38_2.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : "--"}
                  </td>

                  {/* 5. DC 38.2 (NO rupee symbol) */}
                  <td className="px-5 py-4 text-right align-middle font-mono text-[13px] font-semibold text-slate-700 whitespace-nowrap tabular">
                    {typeof dc38_2 === "number" && dc38_2 > 0
                      ? dc38_2.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : "--"}
                  </td>

                  {/* 6. Date */}
                  <td className="px-5 py-4 text-right align-middle font-mono text-xs font-medium text-slate-500 whitespace-nowrap tabular">
                    {refDate}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>

        {/* Terminal telemetry footer — inside card */}
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
          <div className="flex flex-col gap-1.5 font-mono text-[11px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-900" />
              <span className="font-medium text-slate-700">Cash session 09:15 – 15:30 IST</span>
            </div>
            <div className="flex items-center gap-2 tabular font-medium text-slate-600">
              <span>1-min close auto-sync</span>
              <span aria-hidden="true" className="text-slate-400">·</span>
              <span>Upstox v2 gateway</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
