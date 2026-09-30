"use client";

import { useState, useEffect, useCallback } from "react";
import { InfoTooltip } from "@/components/info-tooltip";

interface AlertRecord {
  id: string;
  watchlist_id: string;
  symbol: string;
  instrument_key: string;
  timeframe: string;
  level_type: string;
  level_price: string | number;
  trigger_price: string | number;
  direction: string;
  open_interest: string | number | null;
  triggered_at: string;
}

export function AlertsViewer() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [filterDirection, setFilterDirection] = useState<string>("ALL");
  const [searchSymbol, setSearchSymbol] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/scanner/alerts?limit=100", { cache: "no-store" });
      const data = await res.json();
      if (data.status === "success") {
        setAlerts(data.alerts || []);
      }
    } catch (err) {
      console.error("Failed to load alerts:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const res = await fetch("/api/scanner/alerts?limit=100", { cache: "no-store" });
        const data = await res.json();
        if (isMounted && data.status === "success") {
          setAlerts(data.alerts || []);
        }
      } catch (err) {
        console.error("Failed to load alerts:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const formatOI = (num: number | string | null) => {
    if (!num) return "--";
    const n = Number(num);
    if (n >= 10000000) return `${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `${(n / 100000).toFixed(2)} L`;
    return n.toLocaleString("en-IN");
  };

  const filtered = alerts.filter((a) => {
    const matchesDir =
      filterDirection === "ALL" || a.direction.toUpperCase() === filterDirection;
    const matchesSym =
      !searchSymbol || a.symbol.toLowerCase().includes(searchSymbol.toLowerCase());
    return matchesDir && matchesSym;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-paper sm:text-2xl">
            Crossover Alerts Log
          </h1>
          <InfoTooltip text="Historical log of all Fibonacci AC & DC 38.2% levels crossed during scanning sessions." />
        </div>

        <button
          type="button"
          onClick={fetchAlerts}
          className="inline-flex h-8 items-center rounded-lg border border-line bg-ink px-3 text-xs font-medium text-paper transition-colors hover:border-signal"
        >
          {isLoading ? "Refreshing..." : "Refresh Logs"}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-ink-raised p-4">
        <input
          type="text"
          placeholder="Filter by symbol (e.g. NIFTY, RELIANCE)..."
          value={searchSymbol}
          onChange={(e) => setSearchSymbol(e.target.value)}
          className="h-8 w-64 rounded-lg border border-line bg-ink px-3 text-xs text-paper placeholder-faint focus:border-signal focus:outline-none"
        />

        <div className="flex items-center gap-1 text-xs font-mono">
          <span className="text-muted mr-1">Direction:</span>
          {(["ALL", "BULLISH", "BEARISH"] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => setFilterDirection(dir)}
              className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                filterDirection === dir
                  ? "bg-signal text-ink font-semibold"
                  : "border border-line bg-ink text-muted hover:text-paper"
              }`}
            >
              {dir}
            </button>
          ))}
        </div>

        <span className="text-xs font-mono text-faint ml-auto">
          Showing {filtered.length} of {alerts.length} logged alerts
        </span>
      </div>

      {/* Alerts Table */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-12 text-center text-xs text-muted">
          No matching crossover alerts found in database.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-ink-raised">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-line bg-ink text-faint">
              <tr>
                <th className="px-3 py-2.5">Trigger Timestamp</th>
                <th className="px-3 py-2.5">Symbol</th>
                <th className="px-3 py-2.5">Timeframe</th>
                <th className="px-3 py-2.5">Signal Type</th>
                <th className="px-3 py-2.5">Target Level</th>
                <th className="px-3 py-2.5">Trigger Price</th>
                <th className="px-3 py-2.5">OI at Trigger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((alert) => (
                <tr key={alert.id} className="transition-colors hover:bg-ink/50">
                  <td className="px-3 py-2.5 text-zinc-400">
                    {new Date(alert.triggered_at).toLocaleString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      day: "2-digit",
                      month: "short",
                    })}
                  </td>
                  <td className="px-3 py-2.5 font-bold text-paper">
                    {alert.symbol}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="rounded-md border border-line bg-ink px-1.5 py-0.5 text-[10px]">
                      {alert.timeframe}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                        alert.direction === "BULLISH"
                          ? "border-zinc-500 bg-zinc-800 text-paper"
                          : "border-zinc-700 bg-zinc-900 text-zinc-400"
                      }`}
                    >
                      {alert.direction} • {alert.level_type}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-zinc-300">
                    ₹{Number(alert.level_price).toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-paper">
                    ₹{Number(alert.trigger_price).toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-zinc-400">
                    {formatOI(alert.open_interest)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
