"use client";

import React, { useSyncExternalStore } from "react";
import { getMarketSessionStatus, MarketSessionStatus } from "@/lib/scanner/market-calendar";

function subscribe(callback: () => void) {
  const timer = setInterval(callback, 10_000);
  return () => clearInterval(timer);
}

let cachedStatus: MarketSessionStatus = getMarketSessionStatus();
let lastCheck = 0;

function getSnapshot(): MarketSessionStatus {
  const now = Date.now();
  if (now - lastCheck >= 5_000) {
    cachedStatus = getMarketSessionStatus();
    lastCheck = now;
  }
  return cachedStatus;
}

function getServerSnapshot(): MarketSessionStatus | null {
  return null;
}

export function HeaderMarketStatus() {
  const session = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!session) {
    return (
      <div className="hidden items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-[11px] font-mono text-zinc-500 sm:inline-flex">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
        <span>NSE --:--</span>
      </div>
    );
  }

  const isOpen = session.isMarketOpen;

  return (
    <div
      className={`hidden items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-mono transition-colors sm:inline-flex ${
        isOpen
          ? "border-zinc-700 bg-zinc-900/95 text-white"
          : "border-zinc-800/80 bg-zinc-950 text-zinc-400"
      }`}
      title={`NSE Session: ${session.label} (IST ${session.currentTimeIST})`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isOpen ? "bg-white animate-pulse shadow-[0_0_6px_rgba(255,255,255,0.7)]" : "bg-zinc-600"
        }`}
      />
      <span className="font-semibold tracking-wider">
        {isOpen ? "NSE LIVE" : "NSE CLOSED"}
      </span>
      <span className="text-zinc-600">·</span>
      <span className="text-[10px] text-zinc-400">
        {isOpen
          ? "09:15–15:30"
          : session.status === "WEEKEND"
          ? "WEEKEND"
          : session.status === "HOLIDAY"
          ? "HOLIDAY"
          : "OPENS 09:15"}
      </span>
    </div>
  );
}
