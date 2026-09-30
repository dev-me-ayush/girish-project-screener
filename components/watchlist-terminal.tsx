"use client";

import { useEffect, useState, useCallback, useRef, useSyncExternalStore } from "react";
import { SUPPORTED_INDICES, OptionContract } from "@/lib/upstox";
import {
  RefreshIcon,
  SearchIcon,
  XIcon,
  GearIcon,
  PlayIcon,
  StopIcon,
  ArrowLeftIcon,
  CheckIcon,
  BookmarkIcon,
  PencilIcon,
  ClockIcon,
  ChevronDownIcon,
} from "@/components/icons";

const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export interface WatchlistSummary {
  id: string;
  name: string;
  description: string;
  is_scanning_active: boolean;
  timeframe?: string;
  last_scanned_at: string | null;
  item_count: number;
  expired_count: number;
  created_at: string;
  updated_at?: string;
}

export interface WatchlistItem {
  id: string;
  watchlist_id: string;
  symbol: string;
  instrument_key: string;
  instrument_type: string;
  strike_price: number | null;
  option_type: string | null;
  expiry_date: string | null;
  timeframe: string;
  is_active: boolean;
  is_expired: boolean;
  added_at: string;
}

export interface QuoteData {
  lastPrice: number;
  oi: number;
  volume: number;
  netChange: number;
  ohlc?: { open: number; high: number; low: number; close: number };
}

export interface DatabaseStock {
  id: number;
  symbol: string;
  name: string;
  instrument_key: string;
  isin: string;
  sector: string;
}

interface WatchlistTerminalProps {
  initialWatchlists: WatchlistSummary[];
  initialActiveId?: string;
  initialItems?: WatchlistItem[];
  initialQuotes?: Record<string, QuoteData>;
  initialUpdatedAt?: string;
}

export const TIMEFRAME_GROUPS = [
  { label: "Minutes", options: ["1m", "3m", "5m", "15m", "30m"] },
  { label: "Hours", options: ["1h", "2h", "4h"] },
  { label: "Days", options: ["1D", "1W"] },
] as const;

export function WatchlistTerminal({
  initialWatchlists,
  initialActiveId = "",
  initialItems = [],
  initialQuotes = {},
  initialUpdatedAt = new Date().toISOString(),
}: WatchlistTerminalProps) {
  const [watchlists, setWatchlists] = useState<WatchlistSummary[]>(initialWatchlists);
  const [activeId, setActiveId] = useState<string>(initialActiveId);
  const [items, setItems] = useState<WatchlistItem[]>(initialItems);
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>(initialQuotes);
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date(initialUpdatedAt));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isScanningToggling, setIsScanningToggling] = useState(false);
  const [secondsToNextMinute, setSecondsToNextMinute] = useState<number>(60);
  const isMounted = useMounted();
  const isFetchingRef = useRef(false);

  // Transient Draft Creation Panel State (directory view)
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);

  // Inline Watchlist Renaming State (inside settings)
  const [isRenamingList, setIsRenamingList] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  // Watchlist Timeframe Popover State
  const [isTimeframeOpen, setIsTimeframeOpen] = useState(false);
  const timeframeRef = useRef<HTMLDivElement>(null);

  // Symbol Search Pop-up Modal State
  const [isSymbolModalOpen, setIsSymbolModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<"EQUITY" | "INDEX" | "OPTION">("EQUITY");
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [dbStocks, setDbStocks] = useState<DatabaseStock[]>([]);
  const [isSearchingDb, setIsSearchingDb] = useState(false);

  // Options State for Modal
  const [modalOptionUnderlying, setModalOptionUnderlying] = useState(SUPPORTED_INDICES[0].instrumentKey);
  const [modalOptions, setModalOptions] = useState<OptionContract[]>([]);
  const [isLoadingModalOptions, setIsLoadingModalOptions] = useState(false);

  const [actionError, setActionError] = useState<string | null>(null);

  // Active Watchlist Object
  const activeWatchlist = watchlists.find((w) => w.id === activeId);

  // 1. Fetch Items & Quotes for the Active Watchlist
  const loadActiveWatchlistData = useCallback(async (wlId: string, manual = false) => {
    if (!wlId) return;
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (manual) setIsRefreshing(true);

    try {
      const res = await fetch(`/api/watchlists/${wlId}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.status === "success") {
          setItems(json.items || []);
          if (json.quotes) {
            setQuotes(json.quotes);
          }
          if (json.watchlist) {
            setWatchlists((prev) =>
              prev.map((w) =>
                w.id === wlId
                  ? {
                      ...w,
                      name: json.watchlist.name,
                      is_scanning_active: json.watchlist.is_scanning_active,
                      timeframe: json.watchlist.timeframe || w.timeframe || "1m",
                      last_scanned_at: json.watchlist.last_scanned_at,
                      item_count: (json.items || []).length,
                    }
                  : w
              )
            );
          }
          setLastUpdated(new Date(json.updatedAt || Date.now()));
          setActionError(null);
        }
      }
    } catch (err) {
      console.error("Failed to load active watchlist:", err);
    } finally {
      isFetchingRef.current = false;
      if (manual) {
        setTimeout(() => setIsRefreshing(false), 250);
      }
    }
  }, []);

  // Open Watchlist Settings View
  const handleOpenSettings = useCallback(
    (id: string) => {
      setActiveId(id);
      setIsDrafting(false);
      setIsRenamingList(false);
      setIsTimeframeOpen(false);
      setActionError(null);
      if (typeof window !== "undefined") {
        window.history.pushState(null, "", `?id=${id}`);
      }
      loadActiveWatchlistData(id, false);
    },
    [loadActiveWatchlistData]
  );

  // Back to Watchlists Directory View
  const handleBackToDirectory = useCallback(() => {
    setActiveId("");
    setIsRenamingList(false);
    setIsTimeframeOpen(false);
    setActionError(null);
    setIsSymbolModalOpen(false);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/dashboard/watchlists");
    }
  }, []);

  // Click outside to close timeframe popover
  useEffect(() => {
    if (!isTimeframeOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (timeframeRef.current && !timeframeRef.current.contains(e.target as Node)) {
        setIsTimeframeOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isTimeframeOpen]);

  // 2. Minute-Boundary Auto-Refresh (:00 Clock Rollover)
  useEffect(() => {
    let minuteTimeout: NodeJS.Timeout;
    let minuteInterval: NodeJS.Timeout;

    const setupMinuteCadence = () => {
      const now = new Date();
      const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

      minuteTimeout = setTimeout(() => {
        if (activeId) loadActiveWatchlistData(activeId, false);
        minuteInterval = setInterval(() => {
          if (activeId) loadActiveWatchlistData(activeId, false);
        }, 60000);
      }, msUntilNextMinute);
    };

    setupMinuteCadence();

    return () => {
      clearTimeout(minuteTimeout);
      clearInterval(minuteInterval);
    };
  }, [activeId, loadActiveWatchlistData]);

  // 3. 1-Second Countdown Ticker
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

  // 4. Fetch Nifty 500 Stocks from Neon PostgreSQL in Real Time
  useEffect(() => {
    if (!isSymbolModalOpen || modalTab !== "EQUITY") return;

    let isCancelled = false;
    const timer = setTimeout(async () => {
      setIsSearchingDb(true);
      try {
        const query = modalSearchQuery.trim();
        const url = query
          ? `/api/instruments/equities?q=${encodeURIComponent(query)}`
          : `/api/instruments/equities`;

        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (!isCancelled && json.status === "success") {
            setDbStocks(json.equities || []);
          }
        }
      } catch (err) {
        console.error("Failed to query stocks from database:", err);
      } finally {
        if (!isCancelled) setIsSearchingDb(false);
      }
    }, 150);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [isSymbolModalOpen, modalTab, modalSearchQuery]);

  // 5. Fetch Options Chain when Underlying Changes in Modal
  useEffect(() => {
    if (!isSymbolModalOpen || modalTab !== "OPTION" || !modalOptionUnderlying) return;

    let isCancelled = false;
    async function fetchChain() {
      setIsLoadingModalOptions(true);
      try {
        const res = await fetch(
          `/api/options/chain?underlying=${encodeURIComponent(modalOptionUnderlying)}`,
          { cache: "no-store" }
        );
        if (res.ok) {
          const json = await res.json();
          if (!isCancelled && json.status === "success" && Array.isArray(json.options)) {
            setModalOptions(json.options);
          }
        }
      } catch (err) {
        console.error("Failed to fetch option chain:", err);
      } finally {
        if (!isCancelled) setIsLoadingModalOptions(false);
      }
    }

    fetchChain();
    return () => {
      isCancelled = true;
    };
  }, [isSymbolModalOpen, modalTab, modalOptionUnderlying]);

  // Handler: Save New Watchlist (from draft panel in directory view)
  const handleSaveDraftWatchlist = async () => {
    const trimmed = draftName.trim();
    if (!trimmed) {
      setDraftError("Watchlist name is required");
      return;
    }

    try {
      const res = await fetch("/api/watchlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();

      if (res.ok && data.status === "success") {
        const created: WatchlistSummary = {
          id: data.watchlist.id,
          name: data.watchlist.name,
          description: data.watchlist.description || "",
          is_scanning_active: false,
          timeframe: data.watchlist.timeframe || "1m",
          last_scanned_at: null,
          item_count: 0,
          expired_count: 0,
          created_at: data.watchlist.created_at,
        };
        setWatchlists((prev) => [created, ...prev]);
        setIsDrafting(false);
        setDraftName("");
        setDraftError(null);
      } else {
        setDraftError(data.message || "Failed to create watchlist");
      }
    } catch (err) {
      console.error(err);
      setDraftError("Network error while creating watchlist");
    }
  };

  // Handler: Toggle Start / Stop Scanner for any watchlist
  const handleToggleScanner = async (wlId: string, currentState: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isScanningToggling) return;
    const nextState = !currentState;
    setIsScanningToggling(true);

    // Optimistic update
    setWatchlists((prev) =>
      prev.map((w) => (w.id === wlId ? { ...w, is_scanning_active: nextState } : w))
    );

    try {
      const res = await fetch(`/api/watchlists/${wlId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_scanning_active: nextState }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== "success") {
        // Revert on failure
        setWatchlists((prev) =>
          prev.map((w) => (w.id === wlId ? { ...w, is_scanning_active: currentState } : w))
        );
        setActionError(data.message || "Failed to toggle scanner");
      }
    } catch (err) {
      console.error("Scanner toggle error:", err);
      setWatchlists((prev) =>
        prev.map((w) => (w.id === wlId ? { ...w, is_scanning_active: currentState } : w))
      );
      setActionError("Failed to update scanner status");
    } finally {
      setIsScanningToggling(false);
    }
  };

  // Handler: Rename Watchlist
  const handleRenameWatchlist = async () => {
    if (!activeId || !renameValue.trim()) {
      setIsRenamingList(false);
      return;
    }

    try {
      const res = await fetch(`/api/watchlists/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      const data = await res.json();

      if (res.ok && data.status === "success") {
        setWatchlists((prev) =>
          prev.map((w) => (w.id === activeId ? { ...w, name: data.watchlist.name } : w))
        );
        setIsRenamingList(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handler: Update Timeframe on Active Watchlist
  const handleUpdateWatchlistTimeframe = async (newTimeframe: string) => {
    if (!activeId) return;
    setIsTimeframeOpen(false);

    // Optimistically update active watchlist timeframe
    setWatchlists((prev) =>
      prev.map((w) => (w.id === activeId ? { ...w, timeframe: newTimeframe } : w))
    );

    try {
      const res = await fetch(`/api/watchlists/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeframe: newTimeframe }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== "success") {
        console.error("Failed to update timeframe on server:", data?.message);
      }
    } catch (err) {
      console.error("Failed to persist timeframe:", err);
    }
  };

  // Handler: Delete Watchlist
  const handleDeleteWatchlist = async (idToDelete: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const wl = watchlists.find((w) => w.id === idToDelete);
    if (!wl) return;
    if (!confirm(`Delete watchlist "${wl.name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/watchlists/${idToDelete}`, { method: "DELETE" });
      if (res.ok) {
        setWatchlists((prev) => prev.filter((w) => w.id !== idToDelete));
        if (activeId === idToDelete) {
          handleBackToDirectory();
          setItems([]);
          setQuotes({});
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handler: Delete Watchlist Item
  const handleDeleteItem = async (itemId: string) => {
    if (!activeId) return;

    try {
      const res = await fetch(`/api/watchlists/${activeId}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        setWatchlists((prev) =>
          prev.map((w) =>
            w.id === activeId ? { ...w, item_count: Math.max(0, w.item_count - 1) } : w
          )
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handler: Add Stock from Symbol Pop-up (Optimistic & Blazing Fast)
  const handleSelectAndAddStock = async (stock: DatabaseStock) => {
    if (!activeId) return;
    setActionError(null);

    // 1. Immediately close modal for instant 0ms perceived latency
    setIsSymbolModalOpen(false);

    // 2. Optimistically append symbol to local table
    const tempId = `temp-${stock.instrument_key}`;
    const targetTf = activeWatchlist?.timeframe || "1m";
    const optimisticItem: WatchlistItem = {
      id: tempId,
      watchlist_id: activeId,
      symbol: stock.symbol,
      instrument_key: stock.instrument_key,
      instrument_type: "EQUITY",
      strike_price: null,
      option_type: null,
      expiry_date: null,
      timeframe: targetTf,
      is_active: true,
      is_expired: false,
      added_at: "",
    };

    setItems((prev) => [...prev, optimisticItem]);
    setWatchlists((prev) =>
      prev.map((w) => (w.id === activeId ? { ...w, item_count: w.item_count + 1 } : w))
    );

    // 3. Persist and hydrate live quote in background
    try {
      const res = await fetch(`/api/watchlists/${activeId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: stock.symbol,
          instrumentKey: stock.instrument_key,
          instrumentType: "EQUITY",
          timeframe: targetTf,
        }),
      });
      const data = await res.json();

      if (res.ok && data.status === "success") {
        setItems((prev) => prev.map((i) => (i.id === tempId ? data.item : i)));
        if (data.quote) {
          const q = data.quote;
          const k = data.item.instrument_key;
          const s = data.item.symbol;
          setQuotes((prev) => ({
            ...prev,
            [k]: q,
            [k.replace(":", "|")]: q,
            [k.replace("|", ":")]: q,
            [s]: q,
            [`NSE_EQ:${s}`]: q,
            [`NSE_EQ|${s}`]: q,
          }));
        }
      } else {
        // Rollback optimistic addition
        setItems((prev) => prev.filter((i) => i.id !== tempId));
        setWatchlists((prev) =>
          prev.map((w) => (w.id === activeId ? { ...w, item_count: Math.max(0, w.item_count - 1) } : w))
        );
        setActionError(data.message || "Failed to add symbol");
      }
    } catch (err) {
      console.error(err);
      setItems((prev) => prev.filter((i) => i.id !== tempId));
      setWatchlists((prev) =>
        prev.map((w) => (w.id === activeId ? { ...w, item_count: Math.max(0, w.item_count - 1) } : w))
      );
      setActionError("Failed to add symbol");
    }
  };

  // Handler: Add Index from Pop-up (Optimistic & Instant)
  const handleSelectAndAddIndex = async (idx: (typeof SUPPORTED_INDICES)[0]) => {
    if (!activeId) return;
    setActionError(null);
    setIsSymbolModalOpen(false);

    const tempId = `temp-${idx.instrumentKey}`;
    const targetTf = activeWatchlist?.timeframe || "1m";
    const optimisticItem: WatchlistItem = {
      id: tempId,
      watchlist_id: activeId,
      symbol: idx.name,
      instrument_key: idx.instrumentKey,
      instrument_type: "INDEX",
      strike_price: null,
      option_type: null,
      expiry_date: null,
      timeframe: targetTf,
      is_active: true,
      is_expired: false,
      added_at: "",
    };

    setItems((prev) => [...prev, optimisticItem]);
    setWatchlists((prev) =>
      prev.map((w) => (w.id === activeId ? { ...w, item_count: w.item_count + 1 } : w))
    );

    try {
      const res = await fetch(`/api/watchlists/${activeId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: idx.name,
          instrumentKey: idx.instrumentKey,
          instrumentType: "INDEX",
          timeframe: targetTf,
        }),
      });
      const data = await res.json();

      if (res.ok && data.status === "success") {
        setItems((prev) => prev.map((i) => (i.id === tempId ? data.item : i)));
        if (data.quote) {
          const q = data.quote;
          const k = data.item.instrument_key;
          const s = data.item.symbol;
          setQuotes((prev) => ({
            ...prev,
            [k]: q,
            [k.replace(":", "|")]: q,
            [k.replace("|", ":")]: q,
            [s]: q,
          }));
        }
      } else {
        setItems((prev) => prev.filter((i) => i.id !== tempId));
        setWatchlists((prev) =>
          prev.map((w) => (w.id === activeId ? { ...w, item_count: Math.max(0, w.item_count - 1) } : w))
        );
        setActionError(data.message || "Failed to add index");
      }
    } catch (err) {
      console.error(err);
      setItems((prev) => prev.filter((i) => i.id !== tempId));
      setWatchlists((prev) =>
        prev.map((w) => (w.id === activeId ? { ...w, item_count: Math.max(0, w.item_count - 1) } : w))
      );
      setActionError("Failed to add index");
    }
  };

  // Handler: Add Option Contract from Pop-up (Optimistic & Instant)
  const handleSelectAndAddOption = async (contract: OptionContract) => {
    if (!activeId) return;
    setActionError(null);
    setIsSymbolModalOpen(false);

    const tempId = `temp-${contract.instrumentKey}`;
    const targetTf = activeWatchlist?.timeframe || "1m";
    const optimisticItem: WatchlistItem = {
      id: tempId,
      watchlist_id: activeId,
      symbol: contract.tradingSymbol,
      instrument_key: contract.instrumentKey,
      instrument_type: contract.optionType === "CE" ? "OPTION_CE" : "OPTION_PE",
      strike_price: contract.strikePrice,
      option_type: contract.optionType,
      expiry_date: contract.expiry,
      timeframe: targetTf,
      is_active: true,
      is_expired: false,
      added_at: "",
    };

    setItems((prev) => [...prev, optimisticItem]);
    setWatchlists((prev) =>
      prev.map((w) => (w.id === activeId ? { ...w, item_count: w.item_count + 1 } : w))
    );

    try {
      const res = await fetch(`/api/watchlists/${activeId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: contract.tradingSymbol,
          instrumentKey: contract.instrumentKey,
          instrumentType: contract.optionType === "CE" ? "OPTION_CE" : "OPTION_PE",
          strikePrice: contract.strikePrice,
          optionType: contract.optionType,
          expiryDate: contract.expiry,
          underlyingKey: contract.underlyingKey,
          timeframe: targetTf,
        }),
      });
      const data = await res.json();

      if (res.ok && data.status === "success") {
        setItems((prev) => prev.map((i) => (i.id === tempId ? data.item : i)));
        if (data.quote) {
          const q = data.quote;
          const k = data.item.instrument_key;
          const s = data.item.symbol;
          setQuotes((prev) => ({
            ...prev,
            [k]: q,
            [k.replace(":", "|")]: q,
            [k.replace("|", ":")]: q,
            [s]: q,
          }));
        }
      } else {
        setItems((prev) => prev.filter((i) => i.id !== tempId));
        setWatchlists((prev) =>
          prev.map((w) => (w.id === activeId ? { ...w, item_count: Math.max(0, w.item_count - 1) } : w))
        );
        setActionError(data.message || "Failed to add option contract");
      }
    } catch (err) {
      console.error(err);
      setItems((prev) => prev.filter((i) => i.id !== tempId));
      setWatchlists((prev) =>
        prev.map((w) => (w.id === activeId ? { ...w, item_count: Math.max(0, w.item_count - 1) } : w))
      );
      setActionError("Failed to add option contract");
    }
  };

  const formattedTime = isMounted
    ? lastUpdated.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
    : "--:--:--";

  // ==========================================
  // VIEW 1: WATCHLISTS DIRECTORY VIEW (Panels)
  // ==========================================
  if (!activeId) {
    const hasWatchlists = watchlists.length > 0;

    return (
      <div className="flex flex-col w-full flex-1 min-h-[calc(100dvh-3.5rem)] bg-ink">
        {/* Header Bar */}
        <div className="flex h-14 w-full items-center justify-between border-b border-line bg-ink px-4 sm:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-paper" />
            <h1 className="text-xs font-mono font-semibold uppercase tracking-wider text-paper">
              Watchlists
            </h1>
            {hasWatchlists && (
              <span className="text-[11px] font-mono text-zinc-500">
                ({watchlists.length}/10)
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {watchlists.length < 10 && (
              <button
                type="button"
                onClick={() => {
                  setIsDrafting((prev) => !prev);
                  setDraftName("");
                  setDraftError(null);
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-700 bg-paper px-3 text-xs font-mono font-semibold text-ink transition-all hover:bg-zinc-200 shadow-xs"
                title="Create"
              >
                <span className="text-sm font-bold leading-none">+</span>
                <span>Create</span>
              </button>
            )}
          </div>
        </div>

        {/* Action / Draft Error Banner */}
        {draftError && (
          <div className="flex items-center justify-between border-b border-red-900/60 bg-red-950/40 px-4 sm:px-6 py-2 text-xs font-mono text-red-300 shrink-0">
            <span>{draftError}</span>
            <button
              type="button"
              onClick={() => setDraftError(null)}
              className="text-red-400 hover:text-paper"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Main Body */}
        {!hasWatchlists ? (
          /* Empty State: Focused institutional action card centered vertically & horizontally */
          <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12">
            <div className="w-full max-w-md rounded-2xl border border-line bg-zinc-950/60 p-8 text-center shadow-xl backdrop-blur-xs">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-paper">
                <BookmarkIcon className="h-6 w-6 text-paper" />
              </div>
              <h2 className="text-base font-sans font-bold text-paper">
                No watchlists yet
              </h2>
              <p className="mt-2 text-xs font-mono text-zinc-400 leading-relaxed">
                Build a watchlist to track real-time equities, benchmark indices, and option contracts with live Upstox LTP.
              </p>

              {!isDrafting ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsDrafting(true);
                    setDraftName("");
                    setDraftError(null);
                  }}
                  className="mt-6 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-paper px-4 text-xs font-mono font-bold text-ink transition-all hover:bg-zinc-200 shadow-xs"
                  title="Create"
                >
                  <span className="text-sm leading-none font-bold">+</span>
                  <span>Create</span>
                </button>
              ) : (
                <div className="mt-6 flex flex-col gap-3 text-left">
                  <input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveDraftWatchlist();
                      if (e.key === "Escape") setIsDrafting(false);
                    }}
                    placeholder="e.g. Momentum, Banking, Tech..."
                    autoFocus
                    className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs font-mono text-paper placeholder-zinc-500 focus:outline-none focus:border-paper transition-colors"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsDrafting(false)}
                      className="h-8 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-xs font-mono text-zinc-400 hover:text-paper transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveDraftWatchlist}
                      className="h-8 rounded-lg bg-paper px-4 text-xs font-mono font-bold text-ink hover:bg-zinc-200 transition-colors"
                    >
                      Save Watchlist
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Panel Structure: Left to Right Panels Container */
          <div className="flex-1 overflow-y-auto bg-ink divide-y divide-line">
            {/* Transient Create Watchlist Panel: Minimal compact input & Save only */}
            {isDrafting && (
              <div className="w-full bg-ink border-b border-line px-4 sm:px-6 py-3 flex items-center gap-2">
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveDraftWatchlist();
                    if (e.key === "Escape") setIsDrafting(false);
                  }}
                  placeholder="Watchlist name..."
                  autoFocus
                  className="h-8 w-56 sm:w-64 rounded-lg border border-zinc-700 bg-ink px-2.5 text-xs font-mono text-paper placeholder-zinc-500 focus:outline-none focus:border-paper"
                />
                <button
                  type="button"
                  onClick={handleSaveDraftWatchlist}
                  className="h-8 rounded-lg bg-paper px-3 text-xs font-mono font-semibold text-ink hover:opacity-90 transition-all shrink-0"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsDrafting(false)}
                  className="h-8 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-xs font-mono text-zinc-400 hover:text-paper transition-all shrink-0"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* List of Saved Watchlist Panels */}
            {watchlists.map((wl) => {
              return (
                <div
                  key={wl.id}
                  className="w-full px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4 bg-ink hover:bg-zinc-950/60 transition-colors group"
                >
                  {/* Left Side: Name and Stock Count + Timeframe */}
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <h2 className="text-base font-sans font-bold text-paper truncate">
                      {wl.name}
                    </h2>
                    <span className="text-xs font-mono text-zinc-400">
                      {wl.item_count} {wl.item_count === 1 ? "Stock" : "Stocks"} • {wl.timeframe || "1m"}
                    </span>
                  </div>

                  {/* Right Side: Start/Stop Scanner (icon only: green/red) & Settings (icon only) */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleToggleScanner(wl.id, wl.is_scanning_active, e)}
                      disabled={isScanningToggling}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors shadow-xs ${
                        wl.is_scanning_active
                          ? "bg-red-600 hover:bg-red-500 text-white border border-red-500"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500"
                      } disabled:opacity-50`}
                      title={wl.is_scanning_active ? "Stop Scanner" : "Start Scanner"}
                      aria-label={wl.is_scanning_active ? "Stop Scanner" : "Start Scanner"}
                    >
                      {wl.is_scanning_active ? (
                        <StopIcon className="h-4 w-4 fill-current" />
                      ) : (
                        <PlayIcon className="h-4 w-4 fill-current ml-0.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenSettings(wl.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-paper hover:bg-zinc-800 transition-colors shadow-xs"
                      title="Settings"
                      aria-label="Settings"
                    >
                      <GearIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Telemetry Footer - Pinned cleanly to bottom */}
        <div className="mt-auto border-t border-line bg-zinc-950/60 px-4 sm:px-6 py-2.5 shrink-0">
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
              <span>Upstox Market Gateway</span>
            </div>
            <div>
              <span>{watchlists.length} of 10 Watchlists</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // VIEW 2: WATCHLIST EXCEL-STYLE WORKSHEET & STOCK MANAGEMENT
  // ============================================================
  return (
    <div className="flex flex-col w-full flex-1 min-h-[calc(100dvh-3.5rem)] bg-ink relative">
      {/* 1. Top Control Bar */}
      <div className="flex h-12 w-full items-center justify-between border-b border-zinc-800 bg-ink px-4 sm:px-6">
        {/* Left: Back button + Watchlist Title + Rename */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={handleBackToDirectory}
            title="Back to Watchlists"
            aria-label="Back to Watchlists"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-paper hover:border-zinc-700 hover:bg-zinc-800 transition-colors shrink-0"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
          </button>

          <span className="h-3 w-px bg-zinc-800 shrink-0" />

          {/* Watchlist Name / Rename Inline */}
          {isRenamingList ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameWatchlist();
                  if (e.key === "Escape") setIsRenamingList(false);
                }}
                autoFocus
                className="h-7 w-40 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs font-mono text-paper focus:outline-none focus:border-paper"
              />
              <button
                type="button"
                onClick={handleRenameWatchlist}
                title="Save name"
                aria-label="Save name"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-paper text-ink hover:bg-zinc-200 transition-colors shadow-xs"
              >
                <CheckIcon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsRenamingList(false)}
                title="Cancel"
                aria-label="Cancel"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-paper transition-colors"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-sm font-sans font-bold text-paper truncate">
                {activeWatchlist?.name}
              </h1>
              <button
                type="button"
                onClick={() => {
                  setRenameValue(activeWatchlist?.name || "");
                  setIsRenamingList(true);
                }}
                title="Rename Watchlist"
                aria-label="Rename Watchlist"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:text-paper hover:bg-zinc-800/80 transition-colors"
              >
                <PencilIcon className="h-3 w-3" />
              </button>
            </div>
          )}

          <span className="h-3 w-px bg-zinc-800 shrink-0" />

          {/* Institutional Watchlist Timeframe Popover */}
          <div className="relative shrink-0" ref={timeframeRef}>
            <button
              type="button"
              onClick={() => setIsTimeframeOpen((prev) => !prev)}
              title="Watchlist Timeframe"
              aria-label="Watchlist Timeframe"
              aria-expanded={isTimeframeOpen}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 text-xs font-mono font-medium text-paper hover:bg-zinc-800 hover:border-zinc-600 transition-colors shadow-xs"
            >
              <ClockIcon className="h-3.5 w-3.5 text-zinc-400" />
              <span>{activeWatchlist?.timeframe || "1m"}</span>
              <ChevronDownIcon
                className={`h-3 w-3 text-zinc-400 transition-transform duration-150 ${
                  isTimeframeOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isTimeframeOpen && (
              <div
                className="absolute left-0 top-full mt-1.5 w-60 rounded-xl border border-zinc-700 bg-zinc-950 p-2.5 shadow-2xl z-40 backdrop-blur-xs"
                role="menu"
              >
                <div className="space-y-2.5">
                  {TIMEFRAME_GROUPS.map((group) => (
                    <div key={group.label}>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 px-1 mb-1">
                        {group.label}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {group.options.map((tf) => {
                          const isActive = (activeWatchlist?.timeframe || "1m") === tf;
                          return (
                            <button
                              key={tf}
                              type="button"
                              onClick={() => handleUpdateWatchlistTimeframe(tf)}
                              className={`h-7 px-2.5 rounded-md text-xs font-mono transition-colors ${
                                isActive
                                  ? "bg-paper text-ink font-bold shadow-xs"
                                  : "bg-zinc-900 text-zinc-400 hover:text-paper hover:bg-zinc-800 border border-zinc-800/80"
                              }`}
                            >
                              {tf}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <span className="h-3 w-px bg-zinc-800 shrink-0" />

          {/* Search Symbols Trigger on the Left Side */}
          <button
            type="button"
            onClick={() => {
              setIsSymbolModalOpen(true);
              setModalSearchQuery("");
            }}
            className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-line bg-paper px-3 text-xs font-mono font-bold text-ink hover:bg-zinc-200 transition-all shrink-0 shadow-xs"
          >
            <SearchIcon className="h-3.5 w-3.5" />
            <span>Search Symbols</span>
          </button>
        </div>

        {/* Right: Scanner Status, Countdown, and Refresh */}
        <div className="flex items-center gap-3 shrink-0 ml-4">

          {activeWatchlist?.is_scanning_active && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-zinc-800 bg-zinc-900 text-[10px] font-mono text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-paper animate-ping" />
              SCANNING ON
            </span>
          )}

          <div className="hidden sm:flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] font-mono text-zinc-400">
            <span className="text-zinc-500">Close</span>
            <span className="font-semibold text-paper w-5 text-right">
              {secondsToNextMinute}s
            </span>
          </div>

          <button
            type="button"
            onClick={() => loadActiveWatchlistData(activeId, true)}
            disabled={isRefreshing || !activeId}
            aria-label="Refresh watchlist quotes"
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2 text-xs font-mono text-zinc-400 hover:text-paper hover:bg-zinc-800 transition-all disabled:opacity-50"
          >
            <RefreshIcon
              className={`h-3 w-3 ${isRefreshing ? "animate-spin text-paper" : ""}`}
            />
          </button>

          <button
            type="button"
            onClick={(e) => handleDeleteWatchlist(activeId, e)}
            aria-label="Delete watchlist"
            title="Delete Watchlist"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-red-400 hover:border-red-900/60 hover:bg-red-950/40 transition-colors"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Error Banners */}
      {actionError && (
        <div className="flex items-center justify-between border-b border-red-900/60 bg-red-950/40 px-4 sm:px-6 py-1.5 text-xs font-mono text-red-300">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-400 hover:text-paper"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 2. Excel Spreadsheet Worksheet */}
      <div className="flex-1 overflow-x-auto bg-ink">
        <table className="w-full border-collapse border-b border-zinc-800 font-mono text-xs text-left">
          {/* Excel Column Headers */}
          <thead>
            <tr className="bg-zinc-950 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
              <th className="w-12 border-r border-zinc-800 py-1.5 px-2 text-center font-bold text-zinc-500">
                #
              </th>
              <th className="w-28 border-r border-zinc-800 py-1.5 px-3 font-semibold">
                Type
              </th>
              <th className="min-w-[240px] border-r border-zinc-800 py-1.5 px-3 font-semibold">
                Symbol / Contract
              </th>
              <th className="w-28 border-r border-zinc-800 py-1.5 px-3 text-right font-semibold">
                LTP (₹)
              </th>
              <th className="w-28 border-r border-zinc-800 py-1.5 px-3 text-right font-semibold">
                Day Chg
              </th>
              <th className="w-24 border-zinc-800 py-1.5 px-3 text-center font-semibold">
                Action
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-800/80">
            {/* SAVED STOCK ROWS (1 to N) */}
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-14 text-center font-mono text-xs text-zinc-500">
                  No symbols in this watchlist. Click &quot;Search Symbols&quot; above to add instruments.
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const quote =
                  quotes[item.instrument_key] ||
                  quotes[item.instrument_key.replace(":", "|")] ||
                  quotes[item.instrument_key.replace("|", ":")] ||
                  quotes[item.symbol] ||
                  quotes[`NSE_EQ:${item.symbol}`] ||
                  quotes[`NSE_EQ|${item.symbol}`];
                const lastPrice = quote?.lastPrice ?? 0;
                const netChange = quote?.netChange ?? 0;
                const isUp = netChange >= 0;
                const isOption = item.instrument_type.startsWith("OPTION");
                const isIndex = item.instrument_type === "INDEX";
                const typeLabel = isOption
                  ? "Option"
                  : isIndex
                  ? "Index"
                  : "Stock";

                return (
                  <tr
                    key={item.id}
                    className="h-9 hover:bg-zinc-900/40 transition-colors group"
                  >
                    {/* Row Number */}
                    <td className="w-12 border-r border-zinc-800 py-1.5 text-center font-mono text-[11px] text-zinc-500 bg-zinc-950/60 select-none">
                      {idx + 1}
                    </td>

                    {/* Type */}
                    <td className="w-28 border-r border-zinc-800 px-3 py-1.5 text-zinc-400">
                      <span className="text-[11px] uppercase font-semibold">
                        {typeLabel}
                      </span>
                    </td>

                    {/* Symbol Name & Details */}
                    <td className="min-w-[240px] border-r border-zinc-800 px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-paper text-xs">
                          {item.symbol}
                        </span>
                        {item.strike_price && (
                          <span className="text-[10px] text-zinc-500">
                            ({item.strike_price} {item.option_type})
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Live LTP */}
                    <td className="w-28 border-r border-zinc-800 px-3 py-1.5 text-right font-mono font-bold text-paper">
                      {lastPrice > 0
                        ? lastPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })
                        : "--"}
                    </td>

                    {/* Day Change */}
                    <td className="w-28 border-r border-zinc-800 px-3 py-1.5 text-right">
                      {lastPrice > 0 ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold ${
                            isUp
                              ? "bg-zinc-800 text-paper border border-zinc-700"
                              : "bg-red-950/40 text-red-400 border border-red-900/50"
                          }`}
                        >
                          {isUp ? "+" : ""}
                          {netChange.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-zinc-600 font-mono">--</span>
                      )}
                    </td>

                    {/* Action: Delete */}
                    <td className="w-24 px-2 py-0.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                        className="h-6 w-6 inline-flex items-center justify-center rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                        title="Delete stock"
                        aria-label={`Delete ${item.symbol}`}
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 3. Telemetry Footer */}
      <div className="mt-auto border-t border-zinc-800 bg-zinc-950 px-4 sm:px-6 py-2 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
            <span>Last Synced: {formattedTime}</span>
          </div>
          <div className="flex items-center gap-4">
            <span>{items.length} {items.length === 1 ? "Symbol" : "Symbols"}</span>
          </div>
        </div>
      </div>

      {/* ======================================================= */}
      {/* 4. SYMBOL SEARCH POP-UP PANEL MODAL                     */}
      {/* ======================================================= */}
      {isSymbolModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setIsSymbolModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl h-[560px] bg-ink border border-zinc-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 bg-zinc-950">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-paper" />
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-paper">
                  Select Symbol
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsSymbolModalOpen(false)}
                className="h-6 w-6 inline-flex items-center justify-center rounded-lg text-zinc-400 hover:text-paper hover:bg-zinc-800 transition-colors"
                aria-label="Close dialog"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Segment Tabs & Timeframe Selection Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900/60 px-4 py-2">
              {/* Tabs */}
              <div className="flex rounded-lg border border-zinc-800 bg-ink p-0.5">
                <button
                  type="button"
                  onClick={() => setModalTab("EQUITY")}
                  className={`px-3 py-1 text-xs font-mono rounded-md transition-colors ${
                    modalTab === "EQUITY"
                      ? "bg-zinc-800 font-bold text-paper shadow-xs"
                      : "text-zinc-400 hover:text-paper"
                  }`}
                >
                  Equities
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab("INDEX")}
                  className={`px-3 py-1 text-xs font-mono rounded-md transition-colors ${
                    modalTab === "INDEX"
                      ? "bg-zinc-800 font-bold text-paper shadow-xs"
                      : "text-zinc-400 hover:text-paper"
                  }`}
                >
                  Indices
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab("OPTION")}
                  className={`px-3 py-1 text-xs font-mono rounded-md transition-colors ${
                    modalTab === "OPTION"
                      ? "bg-zinc-800 font-bold text-paper shadow-xs"
                      : "text-zinc-400 hover:text-paper"
                  }`}
                >
                  Options
                </button>
              </div>

              {/* Watchlist Timeframe Indicator */}
              <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-400">
                <ClockIcon className="h-3.5 w-3.5 text-zinc-500" />
                <span>Watchlist:</span>
                <span className="font-semibold text-paper px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700">
                  {activeWatchlist?.timeframe || "1m"}
                </span>
              </div>
            </div>

            {/* Search Input Bar (for Equities) */}
            {modalTab === "EQUITY" && (
              <div className="p-3 border-b border-zinc-800 bg-ink">
                <div className="relative flex items-center">
                  <SearchIcon className="absolute left-3 h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    value={modalSearchQuery}
                    onChange={(e) => setModalSearchQuery(e.target.value)}
                    placeholder="Search symbols..."
                    autoFocus
                    className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-9 pr-8 text-xs font-mono text-paper placeholder-zinc-500 focus:outline-none focus:border-paper"
                  />
                  {modalSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setModalSearchQuery("")}
                      className="absolute right-2.5 text-zinc-500 hover:text-paper"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Options Filter Bar (for Options tab) */}
            {modalTab === "OPTION" && (
              <div className="p-3 border-b border-zinc-800 bg-ink flex items-center gap-3">
                <span className="text-xs font-mono text-zinc-400">Underlying:</span>
                <select
                  value={modalOptionUnderlying}
                  onChange={(e) => setModalOptionUnderlying(e.target.value)}
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-mono text-paper focus:outline-none cursor-pointer"
                >
                  {SUPPORTED_INDICES.map((idx) => (
                    <option key={idx.instrumentKey} value={idx.instrumentKey} className="bg-zinc-900 text-paper">
                      {idx.name}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] font-mono text-zinc-500">
                  {isLoadingModalOptions ? "Fetching contracts..." : `${modalOptions.length} Contracts`}
                </span>
              </div>
            )}

            {/* Modal Body: Scrollable Results List */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/80 bg-ink">
              {/* TAB 1: EQUITIES */}
              {modalTab === "EQUITY" && (
                <>
                  {isSearchingDb ? (
                    <div className="p-8 text-center text-xs font-mono text-zinc-500">
                      Searching...
                    </div>
                  ) : dbStocks.length === 0 ? (
                    <div className="p-8 text-center text-xs font-mono text-zinc-500">
                      No matching symbols found.
                    </div>
                  ) : (
                    dbStocks.map((stock) => (
                      <button
                        key={stock.id}
                        type="button"
                        onClick={() => handleSelectAndAddStock(stock)}
                        className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-zinc-900 transition-colors group"
                      >
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-paper group-hover:underline">
                              {stock.symbol}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 uppercase">
                              {stock.sector || "Equity"}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-zinc-400 truncate max-w-sm">
                            {stock.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          <span className="hidden sm:inline text-[10px] font-mono text-zinc-600">
                            {stock.instrument_key}
                          </span>
                          <span className="h-6 px-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-paper text-xs font-mono font-semibold group-hover:bg-paper group-hover:text-ink transition-all flex items-center gap-1 shadow-xs">
                            <span>+ Add</span>
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </>
              )}

              {/* TAB 2: BENCHMARK INDICES */}
              {modalTab === "INDEX" && (
                <div className="divide-y divide-zinc-800/80">
                  {SUPPORTED_INDICES.map((idx) => (
                    <button
                      key={idx.instrumentKey}
                      type="button"
                      onClick={() => handleSelectAndAddIndex(idx)}
                      className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-900 transition-colors group"
                    >
                      <div>
                        <div className="font-bold text-sm text-paper">
                          {idx.name}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-500">
                          {idx.instrumentKey}
                        </div>
                      </div>
                      <span className="h-6 px-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-paper text-xs font-mono font-semibold group-hover:bg-paper group-hover:text-ink transition-all shadow-xs">
                        + Add Index
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* TAB 3: LIVE F&O OPTIONS (ATM ±7 STRIKES) */}
              {modalTab === "OPTION" && (
                <div className="divide-y divide-zinc-800/80">
                  {isLoadingModalOptions ? (
                    <div className="p-8 text-center text-xs font-mono text-zinc-500">
                      Loading ATM ±7 Option Strikes...
                    </div>
                  ) : modalOptions.length === 0 ? (
                    <div className="p-8 text-center text-xs font-mono text-zinc-500">
                      No options contracts currently available for this underlying.
                    </div>
                  ) : (
                    modalOptions.map((opt) => (
                      <button
                        key={opt.instrumentKey}
                        type="button"
                        onClick={() => handleSelectAndAddOption(opt)}
                        className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-zinc-900 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${
                              opt.optionType === "CE"
                                ? "border-zinc-700 bg-zinc-800 text-paper"
                                : "border-zinc-800 bg-zinc-900 text-zinc-300"
                            }`}
                          >
                            {opt.optionType}
                          </span>
                          <div>
                            <div className="font-bold text-xs text-paper">
                              {opt.tradingSymbol} {opt.isAtm ? "(ATM)" : ""}
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              Strike: ₹{opt.strikePrice} • Exp: {opt.expiry}
                            </div>
                          </div>
                        </div>

                        <span className="h-6 px-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-paper text-xs font-mono font-semibold group-hover:bg-paper group-hover:text-ink transition-all shadow-xs">
                          + Add Option
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Modal Bottom Footer */}
            <div className="border-t border-zinc-800 bg-zinc-950 px-4 py-2 flex items-center justify-between text-[11px] font-mono text-zinc-500">
              <span>Click any instrument to add directly to watchlist</span>
              <span>Press Esc to close</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
