"use client";

import React from "react";

interface PinButtonProps {
  isPinned: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function PinButton({ isPinned, onToggle, disabled }: PinButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      disabled={disabled}
      title={isPinned ? "Remove from Pinned Watchlist" : "Pin to Watchlist"}
      className={`group flex h-7 w-7 items-center justify-center rounded border transition-colors ${
        isPinned
          ? "border-zinc-500 bg-white text-black"
          : "border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-zinc-600 hover:text-white"
      }`}
    >
      <span className="text-sm leading-none">
        {isPinned ? "★" : "☆"}
      </span>
    </button>
  );
}
