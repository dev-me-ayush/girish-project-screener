"use client";

import React from "react";
import { UnifiedScannedInstrument } from "@/lib/scanner/market-coordinator";

interface BreakoutBannerProps {
  recentBreakout: UnifiedScannedInstrument | null;
  onDismiss: () => void;
}

export function BreakoutBanner({ recentBreakout, onDismiss }: BreakoutBannerProps) {
  if (!recentBreakout || recentBreakout.breakout.direction === "INSIDE") {
    return null;
  }

  const isUp = recentBreakout.breakout.direction === "UP";
  const { symbol, ltp, breakout, levels } = recentBreakout;

  return (
    <div className="relative mb-4 flex items-center justify-between overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900/90 p-4 font-mono shadow-2xl backdrop-blur-md">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-black text-lg">
          {isUp ? "⚡" : "🔻"}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white tracking-wider">
              {isUp ? "UP BREAKOUT [5m]" : "LOW BREAKOUT [5m]"}
            </span>
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">
              {breakout.breachCount}x Breach Today
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-300">
            <strong className="text-white">{symbol}</strong> breached{" "}
            {breakout.levelName} ({breakout.levelPrice?.toFixed(2)}) at{" "}
            <span className="text-white font-semibold">{ltp.toFixed(2)}</span> · PDC:{" "}
            {levels.pdc.toFixed(2)} · Trigger Time: {breakout.latestBreachTime || "Just now"}
          </p>
        </div>
      </div>

      <button
        onClick={onDismiss}
        className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-600 hover:text-white transition-colors"
      >
        Dismiss
      </button>
    </div>
  );
}
