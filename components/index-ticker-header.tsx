"use client";

import { useEffect, useState } from "react";
import { IndexQuote } from "@/lib/upstox";

export function IndexTickerHeader() {
  const [indices, setIndices] = useState<IndexQuote[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/indices", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!isCancelled && data.status === "success" && Array.isArray(data.indices)) {
          setIndices(data.indices);
          const timeStr = new Date(data.updatedAt || Date.now()).toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          setLastUpdated(timeStr);
        }
      } catch (err) {
        console.error("Failed to fetch indices:", err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 60000);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (isLoading && indices.length === 0) {
    return (
      <div className="hidden items-center gap-3 text-xs text-muted xl:flex">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-zinc-600" />
        <span>Loading indices...</span>
      </div>
    );
  }

  return (
    <div className="hidden items-center gap-4 text-xs xl:flex">
      <div className="flex items-center gap-4 border-x border-line px-3 py-1">
        {indices.map((idx) => {
          const isUp = idx.netChange >= 0;
          return (
            <div key={idx.symbol} className="flex items-center gap-1.5 font-mono">
              <span className="text-[11px] font-medium text-faint">{idx.name}:</span>
              <span className="font-semibold text-paper">
                ₹{idx.lastPrice ? idx.lastPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "--"}
              </span>
              <span
                className={`text-[10px] font-medium px-1 rounded ${
                  isUp ? "bg-zinc-800 text-paper" : "bg-zinc-900 text-zinc-400"
                }`}
              >
                {isUp ? "+" : ""}
                {idx.netChange.toFixed(2)} ({isUp ? "+" : ""}
                {idx.percentageChange.toFixed(2)}%)
              </span>
            </div>
          );
        })}
      </div>
      {lastUpdated && (
        <span className="text-[10px] text-zinc-500 font-mono" title="Refreshed every 1 minute">
          1m • {lastUpdated}
        </span>
      )}
    </div>
  );
}
