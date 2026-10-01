"use client";

import React, { useState, useEffect } from "react";
import { exportAlertsToExcel } from "@/lib/export-excel";

export interface LoggedAlert {
  id: string;
  symbol: string;
  instrument_type: "EQUITY" | "OPTION";
  timeframe: string;
  level_name: string;
  level_price: number;
  trigger_price: number;
  direction: "BULLISH" | "BEARISH";
  breach_count: number;
  session_date: string;
  breakout_time: string;
  triggered_at: string;
}

export function BreakoutAlertsView() {
  const [alerts, setAlerts] = useState<LoggedAlert[]>([]);
  const [watchlistCount, setWatchlistCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const res = await fetch("/api/scanner/alerts?limit=50", { cache: "no-store" });
        if (res.ok && isMounted) {
          const json = await res.json();
          setAlerts(json.alerts || []);
          setWatchlistCount(typeof json.watchlistSymbolsCount === "number" ? json.watchlistSymbolsCount : null);
        }
      } catch (err) {
        console.error("Failed to load alerts:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 15000); // 15s refresh for alerts
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-[400px] w-full max-w-[1440px] flex-col items-center justify-center px-4 font-mono text-xs text-zinc-400">
        <span className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
        <span>Loading breakout events...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
      {/* Workspace heading — matches screener rhythm */}
      <div className="flex flex-col gap-4 pb-5 sm:flex-row sm:items-end sm:justify-between sm:pb-6">
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
            Alerts Feed
          </p>
          <h1 className="text-xl font-semibold tracking-[-0.02em] text-paper sm:text-2xl">
            Breakout Alerts
          </h1>
          <p className="text-[13px] leading-relaxed text-zinc-400">
            Confirmed 1m AC/DC 38.2% breaches for your watchlist · auto-refreshes every 15s
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="inline-flex h-8 items-center rounded-lg border border-line bg-zinc-900/40 px-2.5 font-mono text-[11px] text-zinc-300 tabular">
            <span className="font-semibold text-paper">{alerts.length}</span>
            <span className="ml-1.5 text-zinc-500">events</span>
          </div>

          <button
            type="button"
            onClick={() => exportAlertsToExcel(alerts)}
            disabled={alerts.length === 0}
            title="Download alerts as Excel (.csv)"
            className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-zinc-900 px-3 font-mono text-[11px] font-medium text-paper transition-colors hover:border-zinc-700 hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-40"
          >
            <svg className="h-3 w-3 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </div>

      {alerts.length > 0 ? (
        <div className="fade-in grid gap-2">
          {alerts.map((alert) => {
            const isBullish = alert.direction === "BULLISH";
            return (
              <article
                key={alert.id}
                className="flex flex-col gap-3 rounded-xl border border-line bg-panel px-4 py-3.5 transition-colors hover:border-zinc-700 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                      isBullish
                        ? "border-line bg-zinc-900 text-paper"
                        : "border-red-900/50 bg-red-950/30 text-drop"
                    }`}
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      {isBullish ? (
                        <path d="M12 5l7 12H5z" />
                      ) : (
                        <path d="M12 19l-7-12h14z" />
                      )}
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold tracking-[-0.01em] text-paper">{alert.symbol}</span>
                      <span className="rounded border border-line bg-zinc-900 px-1 py-px font-mono text-[9px] text-zinc-400">
                        {alert.instrument_type}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                          isBullish
                            ? "border border-line bg-paper text-ink"
                            : "border border-red-900/50 bg-red-950/30 text-drop"
                        }`}
                      >
                        {isBullish ? "Up Breakout" : "Low Breakout"}
                      </span>
                      <span className="rounded-full border border-line bg-zinc-900 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-zinc-300 tabular">
                        Trigger #{alert.breach_count || 1}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-zinc-400 tabular">
                      Crossed {alert.level_name} ({Number(alert.level_price).toFixed(2)}) at{" "}
                      <span className="font-semibold text-paper">{Number(alert.trigger_price).toFixed(2)}</span>
                    </p>
                  </div>
                </div>

                <div className="shrink-0 font-mono text-[11px] tabular sm:text-right">
                  <div className="font-semibold text-paper">{alert.breakout_time || "Market Open"}</div>
                  <div className="text-[10px] text-zinc-500">
                    {alert.session_date ? String(alert.session_date).slice(0, 10) : ""}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : watchlistCount === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-panel px-6 py-14 text-center">
          <p className="text-sm font-medium text-paper">No stocks in your watchlist yet</p>
          <p className="mx-auto mt-1.5 max-w-md font-mono text-[11px] leading-relaxed text-zinc-500">
            Pin symbols on the 1-Minute Screener to receive breakout alerts here.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-line bg-panel px-6 py-14 text-center">
          <p className="text-sm font-medium text-paper">No breakout events today</p>
          <p className="mx-auto mt-1.5 max-w-md font-mono text-[11px] leading-relaxed text-zinc-500">
            {watchlistCount ? `${watchlistCount} watchlist ${watchlistCount === 1 ? "symbol" : "symbols"} monitored. ` : ""}Alerts trigger live during market hours (09:15–15:30 IST) on AC/DC 38.2% crosses.
          </p>
        </div>
      )}
    </div>
  );
}
