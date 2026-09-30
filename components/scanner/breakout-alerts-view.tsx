"use client";

import React, { useState, useEffect } from "react";

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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const res = await fetch("/api/scanner/alerts?limit=50", { cache: "no-store" });
        if (res.ok && isMounted) {
          const json = await res.json();
          setAlerts(json.alerts || []);
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
      <div className="flex min-h-[300px] flex-col items-center justify-center font-mono text-xs text-zinc-400">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-white mb-3" />
        <span>Loading breakout events...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-mono">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3 text-xs">
        <div>
          <h2 className="text-sm font-bold text-white tracking-wider">LIVE BREAKOUT ALERTS FEED</h2>
          <p className="text-zinc-400 mt-0.5">
            Real-time institutional log of confirmed 5m AC/DC 38.2% Fibonacci breaches.
          </p>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-950 px-3 py-1 text-white">
          {alerts.length} Events Logged
        </div>
      </div>

      {alerts.length > 0 ? (
        <div className="grid gap-2.5">
          {alerts.map((alert) => {
            const isBullish = alert.direction === "BULLISH";
            return (
              <div
                key={alert.id}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 p-3.5 transition-colors hover:border-zinc-700"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded border text-sm ${
                      isBullish
                        ? "border-zinc-700 bg-zinc-900 text-white"
                        : "border-red-900 bg-red-950/60 text-red-400"
                    }`}
                  >
                    {isBullish ? "▲" : "▼"}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{alert.symbol}</span>
                      <span className="rounded bg-zinc-900 px-1.5 py-0.2 text-[10px] text-zinc-400 border border-zinc-800">
                        {alert.instrument_type}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                          isBullish ? "bg-white text-black" : "bg-red-900 text-white"
                        }`}
                      >
                        {isBullish ? "UP BREAKOUT" : "LOW BREAKOUT"}
                      </span>
                      {alert.breach_count > 1 && (
                        <span className="rounded bg-zinc-800 px-1.5 py-0.2 text-[10px] text-zinc-300">
                          {alert.breach_count}x Today
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      Crossed {alert.level_name} ({Number(alert.level_price).toFixed(2)}) at{" "}
                      <strong className="text-white">{Number(alert.trigger_price).toFixed(2)}</strong>
                    </p>
                  </div>
                </div>

                <div className="text-right text-xs">
                  <div className="text-white font-medium">{alert.breakout_time || "Market Open"}</div>
                  <div className="text-[10px] text-zinc-500">
                    {alert.session_date ? String(alert.session_date).slice(0, 10) : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-800 p-12 text-center text-xs text-zinc-500">
          No breakout events recorded today. Alerts trigger live during market hours (09:15–15:30 IST) when any of the 2,732 instruments cross AC 38.2% or DC 38.2%.
        </div>
      )}
    </div>
  );
}
