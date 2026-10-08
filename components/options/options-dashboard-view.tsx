"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { INDICES_CONFIG, formatIndianNumber, getPresetStrikes } from "@/lib/options-service";
import {
  generateHistoryCSV,
  createHistoryExcelWorkbook,
  downloadCSVFile,
  downloadExcelFile,
} from "@/lib/options-export";

interface IndexQuote {
  ltp: number;
  change: number;
  pChange: number;
}

interface StrikeRow {
  sp: number;
  callInstrumentKey: string;
  putInstrumentKey: string;
  callOI: number;
  callPrevOI: number;
  callOIChange: number;
  callVol: number;
  putOI: number;
  putPrevOI: number;
  putOIChange: number;
  putVol: number;
  netOI: number;
  netOIChange: number;
}

interface HistoryRow {
  timestamp: string;
  time: string;
  strikes: Array<{ strike: number; callOIChange: number; putOIChange: number }>;
  totalCallOIChange: number;
  totalPutOIChange: number;
  difference: number;
  changeDiff: number;
  revSignal: boolean;
}

export function OptionsDashboardView() {
  // Pure production light theme by default across the board
  // Filters & State
  const [selectedIdxKey, setSelectedIdxKey] = useState("NSE_INDEX|Nifty 50");
  const [expiries, setExpiries] = useState<string[]>([]);
  const [selectedExpiry, setSelectedExpiry] = useState<string>("");
  const [strikeMode, setStrikeMode] = useState<"consecutive" | "atm_plus_minus_2" | "atm_plus_minus_3" | "custom">("consecutive");
  const [customStrikes, setCustomStrikes] = useState<[number, number, number]>([0, 0, 0]);
  const [intervalMinutes, setIntervalMinutes] = useState<number>(3);

  // Data states
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");
  const [historyRefreshedAt, setHistoryRefreshedAt] = useState<string>("");
  const [isExporting, setIsExporting] = useState<"csv" | "excel" | null>(null);
  const [indicesQuotes, setIndicesQuotes] = useState<Record<string, IndexQuote>>({});
  const [atmStrike, setAtmStrike] = useState<number>(0);
  const [pcr, setPcr] = useState<number>(0);
  const [chain, setChain] = useState<StrikeRow[]>([]);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);

  const selectedIndexConfig = useMemo(() => {
    return INDICES_CONFIG.find((c) => c.key === selectedIdxKey) || INDICES_CONFIG[0];
  }, [selectedIdxKey]);

  // Determine active 3 strikes
  const activeStrikes: [number, number, number] = useMemo(() => {
    if (strikeMode === "custom" && customStrikes[0] > 0) {
      return customStrikes;
    }
    if (atmStrike > 0 && strikeMode !== "custom") {
      return getPresetStrikes(atmStrike, selectedIndexConfig.step, strikeMode);
    }
    return [0, 0, 0];
  }, [strikeMode, customStrikes, atmStrike, selectedIndexConfig.step]);

  // Fetch Option Chain & Overview
  const fetchChain = useCallback(async () => {
    try {
      setLoading(true);
      const url = `/api/options/chain?instrument_key=${encodeURIComponent(selectedIdxKey)}${
        selectedExpiry ? `&expiry_date=${selectedExpiry}` : ""
      }`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setIndicesQuotes(data.indices || {});
        setExpiries(data.expiries || []);
        if (!selectedExpiry && data.selectedExpiry) {
          setSelectedExpiry(data.selectedExpiry);
        }
        setAtmStrike(data.atmStrike || 0);
        setPcr(data.pcr || 0);
        setChain(data.chain || []);
        setLastRefreshed(new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }));
      }
    } catch (err) {
      console.error("Failed to fetch option chain:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedIdxKey, selectedExpiry]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (ignore) return;
      await fetchChain();
    }
    load();
    return () => {
      ignore = true;
    };
  }, [fetchChain]);

  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  // Fetch History whenever active strikes, chain, interval, or refresh key changes
  useEffect(() => {
    let ignore = false;
    if (!activeStrikes[0] || chain.length === 0) return;

    const strikesPayload = activeStrikes.map((s) => {
      const match = chain.find((r) => r.sp === s);
      return {
        strike: s,
        ceKey: match?.callInstrumentKey || "",
        peKey: match?.putInstrumentKey || "",
        cePrevOI: match?.callPrevOI,
        pePrevOI: match?.putPrevOI,
      };
    });

    if (strikesPayload.some((s) => !s.ceKey || !s.peKey)) return;

    async function loadHistory() {
      try {
        setHistoryLoading(true);
        const res = await fetch("/api/options/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            strikes: strikesPayload,
            intervalMinutes,
          }),
        });
        const d = await res.json();
        if (!ignore && d.success) {
          setHistoryRows(d.rows || []);
          setHistoryRefreshedAt(new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }));
        }
      } catch (e) {
        if (!ignore) {
          console.error("Failed to fetch options history:", e);
        }
      } finally {
        if (!ignore) {
          setHistoryLoading(false);
        }
      }
    }

    loadHistory();

    return () => {
      ignore = true;
    };
  }, [activeStrikes, chain, intervalMinutes, historyRefreshKey]);

  const handleManualRefreshHistory = useCallback(() => {
    setHistoryRefreshKey((prev) => prev + 1);
  }, []);

  // Download handlers
  const handleDownloadCSV = useCallback(() => {
    if (historyRows.length === 0) return;
    try {
      setIsExporting("csv");
      const csvStr = generateHistoryCSV(historyRows, {
        indexName: selectedIndexConfig.name,
        expiry: selectedExpiry,
        intervalMinutes,
        activeStrikes,
      });
      const safeIndex = selectedIndexConfig.name.replace(/\s+/g, "_");
      const filename = `${safeIndex}_Three_Strike_OI_${selectedExpiry}_${intervalMinutes}m.csv`;
      downloadCSVFile(csvStr, filename);
    } catch (err) {
      console.error("CSV download error:", err);
    } finally {
      setIsExporting(null);
    }
  }, [historyRows, selectedIndexConfig.name, selectedExpiry, intervalMinutes, activeStrikes]);

  const handleDownloadExcel = useCallback(async () => {
    if (historyRows.length === 0) return;
    try {
      setIsExporting("excel");
      const wb = await createHistoryExcelWorkbook(historyRows, {
        indexName: selectedIndexConfig.name,
        expiry: selectedExpiry,
        intervalMinutes,
        activeStrikes,
      });
      const safeIndex = selectedIndexConfig.name.replace(/\s+/g, "_");
      const filename = `${safeIndex}_Three_Strike_OI_${selectedExpiry}_${intervalMinutes}m.xlsx`;
      await downloadExcelFile(wb, filename);
    } catch (err) {
      console.error("Excel download error:", err);
    } finally {
      setIsExporting(null);
    }
  }, [historyRows, selectedIndexConfig.name, selectedExpiry, intervalMinutes, activeStrikes]);

  // Selected 3 strikes summary data
  const selectedStrikesData = useMemo(() => {
    return activeStrikes
      .filter((s) => s > 0)
      .map((s, idx) => {
        const r = chain.find((row) => row.sp === s);
        const callChange = r?.callOIChange || 0;
        const putChange = r?.putOIChange || 0;
        let bias = "Neutral";
        if (putChange > callChange + 100000) bias = "Strong Support";
        else if (callChange > putChange + 100000) bias = "Strong Resistance";
        else if (putChange > callChange) bias = "Support";
        else if (callChange > putChange) bias = "Resistance";

        return {
          id: `${s}-${idx}`,
          strike: s,
          callOIChange: callChange,
          putOIChange: putChange,
          bias,
        };
      });
  }, [activeStrikes, chain]);

  const selectedTotalCallChange = useMemo(() => {
    return selectedStrikesData.reduce((acc, curr) => acc + curr.callOIChange, 0);
  }, [selectedStrikesData]);

  const selectedTotalPutChange = useMemo(() => {
    return selectedStrikesData.reduce((acc, curr) => acc + curr.putOIChange, 0);
  }, [selectedStrikesData]);

  const selectedTotalDiff = useMemo(() => {
    return selectedTotalPutChange - selectedTotalCallChange;
  }, [selectedTotalPutChange, selectedTotalCallChange]);

  // Multi-strike ladder around ATM
  const ladderStrikes = useMemo(() => {
    if (!atmStrike || chain.length === 0) return [];
    const minSP = atmStrike - selectedIndexConfig.step * 6;
    const maxSP = atmStrike + selectedIndexConfig.step * 6;
    return chain.filter((r) => r.sp >= minSP && r.sp <= maxSP);
  }, [atmStrike, chain, selectedIndexConfig.step]);

  // Max volume in ladder for highlights
  const peakCallVol = useMemo(() => Math.max(...ladderStrikes.map((r) => r.callVol), 0), [ladderStrikes]);
  const peakPutVol = useMemo(() => Math.max(...ladderStrikes.map((r) => r.putVol), 0), [ladderStrikes]);

  return (
    <div className="min-h-[calc(100vh-2.75rem)] w-full bg-slate-50 text-slate-900">
      <div className="flex flex-col gap-4 p-4 sm:p-6 w-full">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg border border-slate-200 bg-white text-slate-800 shadow-xs">
          <div className="flex flex-wrap items-center gap-3.5">
            {/* Index Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Index:
              </span>
              <select
                value={selectedIdxKey}
                onChange={(e) => {
                  setSelectedIdxKey(e.target.value);
                  setSelectedExpiry("");
                }}
                className="rounded px-2.5 py-1 text-xs font-semibold focus:outline-none border bg-slate-100/80 border-slate-300 text-slate-900 focus:border-slate-500"
              >
                {INDICES_CONFIG.map((idx) => (
                  <option key={idx.key} value={idx.key}>
                    {idx.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Expiry Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Expiry:
              </span>
              <select
                value={selectedExpiry}
                onChange={(e) => setSelectedExpiry(e.target.value)}
                className="rounded px-2.5 py-1 text-xs font-semibold focus:outline-none border bg-slate-100/80 border-slate-300 text-slate-900 focus:border-slate-500"
              >
                {expiries.map((exp) => (
                  <option key={exp} value={exp}>
                    {exp}
                  </option>
                ))}
              </select>
            </div>

            {/* Strike Mode Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Strikes Mode:
              </span>
              <select
                value={strikeMode}
                onChange={(e) =>
                  setStrikeMode(
                    e.target.value as "consecutive" | "atm_plus_minus_2" | "atm_plus_minus_3" | "custom"
                  )
                }
                className="rounded px-2.5 py-1 text-xs font-semibold focus:outline-none border bg-slate-100/80 border-slate-300 text-slate-900 focus:border-slate-500"
              >
                <option value="consecutive">Consecutive (ATM, +1, +2)</option>
                <option value="atm_plus_minus_2">ATM ± 2 (Wide)</option>
                <option value="atm_plus_minus_3">ATM ± 3 (Max Spread)</option>
                <option value="custom">Custom Pick</option>
              </select>
            </div>

            {strikeMode === "custom" && (
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map((idx) => (
                  <select
                    key={idx}
                    value={customStrikes[idx] || (chain[idx]?.sp || 0)}
                    onChange={(e) => {
                      const next: [number, number, number] = [...customStrikes];
                      next[idx] = Number(e.target.value);
                      setCustomStrikes(next);
                    }}
                    className="rounded px-2 py-1 text-xs border bg-slate-100 border-slate-300 text-slate-900"
                  >
                    {chain.map((c) => (
                      <option key={c.sp} value={c.sp}>
                        {c.sp}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            )}
          </div>

          {/* Refresh & Last Updated Status */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-slate-500">
              Updated: {lastRefreshed || "Loading..."}
            </span>

            <button
              onClick={() => fetchChain()}
              disabled={loading}
              className="rounded px-3.5 py-1 text-xs font-bold transition-all bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 shadow-xs"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* TOP SECTION: 2-COLUMN GRID (Matching Screenshot Top Half) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
          {/* LEFT COLUMN: PCR + Indices + 3-Strike Summary Table */}
          <div className="lg:col-span-5 xl:col-span-5 flex flex-col gap-3.5">
            {/* PCR Banner */}
            <div className="flex items-center justify-between px-4 py-2.5 rounded-md border shadow-xs bg-sky-50 border-sky-200 text-sky-900">
              <span className="text-xs font-bold tracking-wider uppercase">PCR (Put-Call Ratio)</span>
              <span className="text-base font-extrabold font-mono px-3 py-0.5 rounded border bg-white text-sky-700 border-sky-300 shadow-xs">
                {pcr.toFixed(2)}
              </span>
            </div>

            {/* Indices Ticker Table */}
            <div className="overflow-x-auto border rounded-md w-full shadow-xs bg-white border-slate-200">
              <table className="w-full text-left text-xs font-mono">
                <thead className="border-b bg-slate-100/90 text-slate-600 border-slate-200">
                  <tr>
                    <th className="py-2 px-3.5 font-semibold">Index</th>
                    <th className="py-2 px-3.5 font-semibold text-right">Spot Price</th>
                    <th className="py-2 px-3.5 font-semibold text-right">Change</th>
                    <th className="py-2 px-3.5 font-semibold text-right">% Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {INDICES_CONFIG.map((idx) => {
                    const q = indicesQuotes[idx.name];
                    const isUp = (q?.change || 0) >= 0;
                    return (
                      <tr key={idx.name} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3.5 font-semibold text-slate-800">
                          {idx.name}
                        </td>
                        <td className="py-2 px-3.5 text-right font-bold text-slate-900">
                          {q?.ltp ? q.ltp.toLocaleString("en-IN") : "-"}
                        </td>
                        <td
                          className={`py-2 px-3.5 text-right font-bold ${
                            isUp ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {q ? `${isUp ? "+" : ""}${q.change}` : "-"}
                        </td>
                        <td
                          className={`py-2 px-3.5 text-right font-bold ${
                            isUp ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {q ? `${isUp ? "+" : ""}${q.pChange}%` : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Selected 3 Strikes Table (Anchor & Next Strikes) */}
            <div className="overflow-x-auto border rounded-md w-full shadow-xs bg-white border-slate-200">
              <table className="w-full text-xs font-mono">
                <thead className="border-b bg-amber-100/70 text-slate-800 border-amber-200">
                  <tr>
                    <th className="py-2 px-3.5 text-left font-bold">Strike</th>
                    <th className="py-2 px-3.5 text-right font-semibold bg-rose-100/60 text-rose-800">
                      CALL OI Change
                    </th>
                    <th className="py-2 px-3.5 text-right font-semibold bg-emerald-100/60 text-emerald-800">
                      PUT OI Change
                    </th>
                    <th className="py-2 px-3.5 text-center font-semibold">DIFFERENCE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedStrikesData.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3.5 font-bold text-slate-900">
                        {s.strike.toLocaleString("en-IN")}
                      </td>
                      <td
                        className={`py-2.5 px-3.5 text-right font-bold ${
                          s.callOIChange < 0
                            ? "text-rose-600 bg-rose-50/50"
                            : "text-slate-700"
                        }`}
                      >
                        {formatIndianNumber(s.callOIChange)}
                      </td>
                      <td
                        className={`py-2.5 px-3.5 text-right font-bold ${
                          s.putOIChange > 0
                            ? "text-emerald-700 bg-emerald-50/50"
                            : "text-slate-700"
                        }`}
                      >
                        {formatIndianNumber(s.putOIChange)}
                      </td>
                      <td className="py-2.5 px-3.5 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${
                            s.bias.includes("Support")
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : s.bias.includes("Resistance")
                              ? "bg-rose-100 text-rose-800 border-rose-300"
                              : "text-slate-500 border-slate-200"
                          }`}
                        >
                          {s.bias}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="font-bold border-t-2 bg-amber-50 border-amber-200 text-slate-900">
                  <tr>
                    <td className="py-2.5 px-3.5">TOTAL</td>
                    <td className="py-2.5 px-3.5 text-right text-rose-700">
                      {formatIndianNumber(selectedTotalCallChange)}
                    </td>
                    <td className="py-2.5 px-3.5 text-right text-emerald-700">
                      {formatIndianNumber(selectedTotalPutChange)}
                    </td>
                    <td
                      className={`py-2.5 px-3.5 text-center font-extrabold ${
                        selectedTotalDiff >= 0 ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {formatIndianNumber(selectedTotalDiff)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* RIGHT COLUMN: Strike-Wise OI & Volume Chain */}
          <div className="lg:col-span-7 xl:col-span-7 flex flex-col gap-1.5 w-full">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Strike-Wise Open Interest & Volume Chain
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                ATM: <span className="font-bold text-slate-900">{atmStrike}</span>
              </span>
            </div>

            <div className="overflow-x-auto border rounded-md w-full max-h-[410px] overflow-y-auto shadow-xs bg-white border-slate-200">
              <table className="w-full text-xs font-mono">
                <thead className="sticky top-0 border-b shadow-xs z-10 bg-amber-100/90 text-slate-800 border-amber-200">
                  <tr>
                    <th className="py-2 px-3 text-center font-bold">SP</th>
                    <th className="py-2 px-3 text-right font-semibold">NET OI CHANGE</th>
                    <th className="py-2 px-3 text-right font-semibold">NET OI</th>
                    <th className="py-2 px-3 text-right font-semibold">CALL VOLUME</th>
                    <th className="py-2 px-3 text-right font-semibold">PUT VOLUME</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {ladderStrikes.map((r) => {
                    const isAtm = r.sp === atmStrike;
                    const isPeakCall = r.callVol > 0 && r.callVol === peakCallVol;
                    const isPeakPut = r.putVol > 0 && r.putVol === peakPutVol;

                    return (
                      <tr
                        key={r.sp}
                        className={`transition-colors ${
                          isAtm
                            ? "bg-blue-50/80 font-bold border-y-2 border-blue-300"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <td
                          className={`py-2 px-3 text-center font-extrabold ${
                            isAtm ? "text-blue-900" : "text-slate-900"
                          }`}
                        >
                          {r.sp}
                          {isAtm && (
                            <span className="ml-1 text-[9px] px-1 py-0.2 rounded font-bold bg-blue-200 text-blue-900">
                              ATM
                            </span>
                          )}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-semibold ${
                            r.netOIChange > 0
                              ? "text-emerald-700 bg-emerald-50/40"
                              : "text-rose-700 bg-rose-50/40"
                          }`}
                        >
                          {formatIndianNumber(r.netOIChange)}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-bold ${
                            r.netOI > 0
                              ? "text-emerald-700 bg-emerald-50/40"
                              : "text-rose-700 bg-rose-50/40"
                          }`}
                        >
                          {formatIndianNumber(r.netOI)}
                        </td>
                        <td
                          className={`py-2 px-3 text-right ${
                            isPeakCall
                              ? "bg-amber-100 text-amber-950 font-black border border-amber-300"
                              : "text-slate-700"
                          }`}
                        >
                          {formatIndianNumber(r.callVol)}
                        </td>
                        <td
                          className={`py-2 px-3 text-right ${
                            isPeakPut
                              ? "bg-amber-100 text-amber-950 font-black border border-amber-300"
                              : "text-slate-700"
                          }`}
                        >
                          {formatIndianNumber(r.putVol)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: THREE STRIKE RANGE CHANGE IN OI ANALYSIS (Time-Series) */}
        <div className="flex flex-col gap-2.5 p-4 sm:p-5 rounded-lg w-full shadow-xs border mt-1 bg-white border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 border-slate-200">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold tracking-wide uppercase text-slate-900">
                Three Strike Range Change in OI Analysis
              </h2>
              <span className="text-[11px] font-mono text-slate-500">
                ({activeStrikes.filter(Boolean).join(", ")})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Interval Selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase text-slate-500">Interval:</span>
                <select
                  value={intervalMinutes}
                  onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                  className="rounded px-2.5 py-1 text-xs font-semibold focus:outline-none border bg-slate-100 border-slate-300 text-slate-900"
                >
                  <option value={1}>1 Minute</option>
                  <option value={3}>3 Minutes</option>
                  <option value={5}>5 Minutes</option>
                  <option value={15}>15 Minutes</option>
                </select>
              </div>

              {/* Section-Specific Refresh Button */}
              <button
                type="button"
                onClick={handleManualRefreshHistory}
                disabled={historyLoading}
                className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold border transition-colors bg-white hover:bg-slate-100 text-slate-800 border-slate-300 disabled:opacity-50 cursor-pointer shadow-2xs"
                title="Refresh Three Strike Analysis Table"
              >
                <svg
                  className={`w-3.5 h-3.5 ${historyLoading ? "animate-spin text-blue-600" : "text-slate-600"}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span>{historyLoading ? "Refreshing..." : "Refresh Table"}</span>
              </button>

              {/* Timestamp indicator */}
              {historyRefreshedAt && (
                <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                  {historyRefreshedAt}
                </span>
              )}

              {/* Download Dropdown / Buttons */}
              <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200">
                <button
                  type="button"
                  onClick={handleDownloadExcel}
                  disabled={isExporting !== null || historyRows.length === 0}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold border transition-colors bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300 disabled:opacity-40 cursor-pointer shadow-2xs"
                  title="Download Formatted Excel (.xlsx) with colors"
                >
                  <svg className="w-3.5 h-3.5 text-emerald-700" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
                    <path d="M8.8 17.5l1.7-2.8 1.7 2.8h1.8l-2.6-4.1 2.4-3.9h-1.8l-1.5 2.6-1.5-2.6H7.2l2.4 3.9-2.6 4.1h1.8z" />
                  </svg>
                  <span>{isExporting === "excel" ? "Exporting..." : "Excel (.xlsx)"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadCSV}
                  disabled={isExporting !== null || historyRows.length === 0}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold border transition-colors bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 disabled:opacity-40 cursor-pointer shadow-2xs"
                  title="Download Raw CSV (.csv)"
                >
                  <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-3.5-3.5M12 16l3.5-3.5M4 20h16" />
                  </svg>
                  <span>{isExporting === "csv" ? "Exporting..." : "CSV"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Intraday Table */}
          <div className="overflow-x-auto w-full max-h-[550px] overflow-y-auto">
            <table className="w-full text-xs font-mono">
              <thead className="sticky top-0 border-b z-10 shadow-xs bg-slate-100 text-slate-800 border-slate-300">
                <tr>
                  <th rowSpan={2} className="py-2.5 px-3.5 text-left font-bold border-r border-slate-300">
                    Time
                  </th>
                  {activeStrikes.map((s, idx) => (
                    <th
                      key={idx}
                      colSpan={2}
                      className="py-1.5 px-3 text-center font-bold border-r bg-cyan-100/70 text-cyan-950 border-slate-300"
                    >
                      {s || `Strike ${idx + 1}`}
                    </th>
                  ))}
                  <th
                    rowSpan={2}
                    className="py-2.5 px-3.5 text-right font-bold bg-rose-100/60 text-rose-900"
                  >
                    CALL OI Change
                  </th>
                  <th
                    rowSpan={2}
                    className="py-2.5 px-3.5 text-right font-bold bg-emerald-100/60 text-emerald-900"
                  >
                    PUT OI Change
                  </th>
                  <th
                    rowSpan={2}
                    className="py-2.5 px-3.5 text-right font-bold bg-amber-100/60 text-amber-950"
                  >
                    Difference
                  </th>
                  <th
                    rowSpan={2}
                    className="py-2.5 px-3.5 text-right font-bold bg-amber-100/60 text-amber-950"
                  >
                    Change% diff (Δ)
                  </th>
                  <th rowSpan={2} className="py-2.5 px-3.5 text-center font-bold">
                    Rev. Signal
                  </th>
                </tr>
                <tr className="border-t border-slate-300">
                  {activeStrikes.map((_, idx) => (
                    <React.Fragment key={idx}>
                      <th className="py-1 px-3 text-right text-[10px] text-rose-700 bg-rose-50/40">
                        CALL
                      </th>
                      <th className="py-1 px-3 text-right text-[10px] border-r text-emerald-700 bg-emerald-50/40 border-slate-300">
                        PUT
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {historyLoading ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center font-sans text-slate-500">
                      Loading intraday snapshots starting from 09:15 AM...
                    </td>
                  </tr>
                ) : historyRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center font-sans text-slate-500">
                      No intraday candle data available for selected strikes today.
                    </td>
                  </tr>
                ) : (
                  historyRows.map((row, idx) => {
                    const isDeltaPositive = row.changeDiff > 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3.5 text-left font-bold border-r text-slate-900 border-slate-200">
                          {row.time}
                        </td>
                        {activeStrikes.map((s, sIdx) => {
                          const sData = row.strikes.find((st) => st.strike === s);
                          return (
                            <React.Fragment key={sIdx}>
                              <td
                                className={`py-2 px-3 text-right font-medium ${
                                  (sData?.callOIChange || 0) < 0
                                    ? "text-rose-600 bg-rose-50/30"
                                    : "text-slate-600"
                                }`}
                              >
                                {formatIndianNumber(sData?.callOIChange)}
                              </td>
                              <td
                                className={`py-2 px-3 text-right font-medium border-r ${
                                  (sData?.putOIChange || 0) > 0
                                    ? "text-emerald-700 bg-emerald-50/30 border-slate-200"
                                    : "text-slate-800 border-slate-200"
                                }`}
                              >
                                {formatIndianNumber(sData?.putOIChange)}
                              </td>
                            </React.Fragment>
                          );
                        })}
                        <td className="py-2.5 px-3.5 text-right font-bold text-rose-700 bg-rose-50/20">
                          {formatIndianNumber(row.totalCallOIChange)}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-bold text-emerald-700 bg-emerald-50/20">
                          {formatIndianNumber(row.totalPutOIChange)}
                        </td>
                        <td
                          className={`py-2.5 px-3.5 text-right font-bold ${
                            row.difference >= 0 ? "text-emerald-700 font-extrabold" : "text-rose-700 font-extrabold"
                          }`}
                        >
                          {formatIndianNumber(row.difference)}
                        </td>
                        <td
                          className={`py-2.5 px-3.5 text-right font-bold ${
                            isDeltaPositive
                              ? "text-emerald-800 bg-emerald-100/60 font-black"
                              : "text-rose-800 bg-rose-100/60 font-bold"
                          }`}
                        >
                          {formatIndianNumber(row.changeDiff)}
                        </td>
                        <td className="py-2.5 px-3.5 text-center">
                          {row.revSignal ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-xs">
                              REVERSAL
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
