import type { UnifiedScannedInstrument } from "./scanner/market-coordinator";
import { buildWorkbook, type CellValue } from "./xlsx-writer";

export interface ExportableInstrument {
  symbol: string;
  instrument_type?: "EQUITY" | "OPTION" | string;
  underlying?: string;
  strike_price?: number;
  option_type?: "CE" | "PE" | string;
  expiry?: string;
  ltp: number;
  net_change: number;
  volume?: number;
  oi?: number;
  pdh?: number;
  pdl?: number;
  pdc?: number;
  ac38_2?: number;
  dc38_2?: number;
  status?: string;
  breach_count?: number;
  breakout_time?: string | null;
  levels?: {
    pdh: number;
    pdl: number;
    pdc: number;
    ac38_2: number;
    dc38_2: number;
  };
  breakout?: {
    status: string;
    direction?: "UP" | "LOW" | "INSIDE" | string;
    breachCount: number;
    breachTimes?: string[];
    latestBreachTime: string | null;
  };
}

function istDateStr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

function cleanLabel(label: string): string {
  return label.replace(/[^a-zA-Z0-9_-]/g, "_").toUpperCase().slice(0, 24) || "ALL";
}

function directionOf(inst: ExportableInstrument): "up" | "down" | "none" {
  const d = inst.breakout?.direction;
  if (d === "UP") return "up";
  if (d === "LOW") return "down";
  const status = (inst.breakout?.status || inst.status || "").toUpperCase();
  if (status.includes("UP") || status.includes("ABOVE") || status.includes("BULLISH")) return "up";
  if (status.includes("LOW") || status.includes("BELOW") || status.includes("BEARISH")) return "down";
  return "none";
}

function numOrBlank(v: number | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
}

function finiteOrNull(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function saveBytes(bytes: Uint8Array, fileName: string): void {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    console.warn("Export skipped: downloads require a browser environment.");
    return;
  }
  const blob = new Blob([new Uint8Array(bytes)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Real styled .xlsx export (dependency-free writer): dark header, autofilter,
 * numeric cells, direction-tinted Status column. Scoped by whatever list the
 * caller passes (All / Equities / Options / Watchlist), so the file always
 * matches the tab the user is looking at.
 */
export function exportInstrumentsToExcel(
  instruments: (UnifiedScannedInstrument | ExportableInstrument)[],
  categoryLabel: string = "All"
): void {
  if (!instruments || instruments.length === 0) {
    console.warn("Export skipped: no instruments available to export.");
    return;
  }

  const rows: CellValue[][] = instruments.map((inst) => {
    const hasLevels = "levels" in inst && Boolean(inst.levels);
    const hasBreakout = "breakout" in inst && Boolean(inst.breakout);
    const flat = inst as ExportableInstrument;

    const pdh = hasLevels ? inst.levels!.pdh : flat.pdh || 0;
    const pdl = hasLevels ? inst.levels!.pdl : flat.pdl || 0;
    const pdc = hasLevels ? inst.levels!.pdc : flat.pdc || 0;
    const ac = hasLevels ? inst.levels!.ac38_2 : flat.ac38_2 || 0;
    const dc = hasLevels ? inst.levels!.dc38_2 : flat.dc38_2 || 0;

    const status = hasBreakout ? inst.breakout!.status : flat.status || "Inside Range";
    const breachCount = hasBreakout ? inst.breakout!.breachCount : flat.breach_count || 0;
    const times = hasBreakout ? ((inst.breakout!.breachTimes || []) as string[]) : [];
    const triggerTimes =
      times.length > 0
        ? times.map((t, i) => `#${i + 1}: ${t}`).join(" | ")
        : (hasBreakout ? inst.breakout!.latestBreachTime : flat.breakout_time) || "--";

    const isOption = inst.instrument_type === "OPTION";
    return [
      inst.symbol,
      inst.instrument_type || "EQUITY",
      ("underlying" in inst && typeof inst.underlying === "string" ? inst.underlying : "") || "",
      isOption && "strike_price" in inst && typeof inst.strike_price === "number" ? inst.strike_price : null,
      (isOption && "option_type" in inst && typeof inst.option_type === "string" ? inst.option_type : "") || "",
      ("expiry" in inst && typeof inst.expiry === "string" ? inst.expiry : "") || "",
      numOrBlank(inst.ltp),
      typeof inst.net_change === "number" && Number.isFinite(inst.net_change) && inst.net_change !== 0
        ? Math.round(inst.net_change * 100) / 100
        : null,
      numOrBlank(pdh),
      numOrBlank(pdl),
      numOrBlank(pdc),
      numOrBlank(ac),
      numOrBlank(dc),
      "volume" in inst && typeof inst.volume === "number" && inst.volume > 0 ? Math.round(inst.volume) : null,
      "oi" in inst && typeof inst.oi === "number" && inst.oi > 0 ? Math.round(inst.oi) : null,
      status,
      breachCount > 0 ? `Trigger #${breachCount}` : "--",
      triggerTimes,
    ];
  });

  const label = cleanLabel(categoryLabel);
  const bytes = buildWorkbook([
    {
      name: `1M ${label}`.slice(0, 31),
      headers: [
        "Symbol", "Type", "Underlying", "Strike", "Side", "Expiry",
        "1m LTP", "Day Change", "PDH", "PDL", "PDC", "AC 38.2", "DC 38.2",
        "Volume", "OI", "1m Status", "Triggers", "Trigger Times",
      ],
      rows,
      widths: [26, 9, 12, 11, 7, 12, 12, 12, 11, 11, 11, 11, 11, 13, 13, 16, 12, 30],
      rowStyle: (i) => ({ statusCol: 15, tone: directionOf(instruments[i] as ExportableInstrument) }),
      negRedCols: new Set([7]),
      intCols: new Set([3, 13, 14]),
    },
  ]);

  saveBytes(bytes, `NSE_1M_${label}_${istDateStr()}.xlsx`);
}

export interface ExportableAlert {
  symbol: string;
  instrument_type: string;
  timeframe?: string;
  level_name: string;
  level_price: number;
  trigger_price: number;
  direction: string;
  breach_count: number;
  breakout_time?: string;
  session_date?: string;
  triggered_at?: string;
}

export function exportAlertsToExcel(alerts: ExportableAlert[]): void {
  if (!alerts || alerts.length === 0) {
    console.warn("Export skipped: no alerts to export.");
    return;
  }

  const rows: CellValue[][] = alerts.map((a) => [
    a.symbol,
    a.instrument_type || "EQUITY",
    a.timeframe || "1m",
    a.direction,
    a.breach_count || 1,
    finiteOrNull(a.trigger_price),
    a.level_name,
    finiteOrNull(a.level_price),
    a.breakout_time || "--",
    a.session_date ? String(a.session_date).slice(0, 10) : "--",
  ]);

  const bytes = buildWorkbook([
    {
      name: "Breakout Alerts",
      headers: [
        "Symbol", "Type", "Timeframe", "Direction", "Trigger #",
        "Trigger Price", "Level Name", "Level Price", "Trigger Time", "Session Date",
      ],
      rows,
      widths: [24, 9, 10, 11, 10, 14, 14, 12, 14, 13],
      rowStyle: (i) => {
        const d = (alerts[i].direction || "").toUpperCase();
        return {
          statusCol: 3,
          tone: d.includes("BULL") ? "up" : d.includes("BEAR") ? "down" : "none",
        };
      },
    },
  ]);

  saveBytes(bytes, `NSE_Breakout_Alerts_${istDateStr()}.xlsx`);
}
