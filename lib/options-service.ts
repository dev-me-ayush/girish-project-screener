/**
 * Service utilities for Options Chain, OI calculations, and Index metadata
 */

export interface IndexConfig {
  name: string;
  key: string;
  step: number;
}

export const INDICES_CONFIG: IndexConfig[] = [
  { name: "NIFTY 50", key: "NSE_INDEX|Nifty 50", step: 50 },
  { name: "BANK NIFTY", key: "NSE_INDEX|Nifty Bank", step: 100 },
  { name: "FIN NIFTY", key: "NSE_INDEX|Nifty Fin Service", step: 50 },
  { name: "NIFTY MID SELECT", key: "NSE_INDEX|NIFTY MID SELECT", step: 25 },
];

export function formatIndianNumber(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "-";
  const isNegative = val < 0;
  const absVal = Math.abs(Math.round(val));
  const s = absVal.toString();
  
  if (s.length <= 3) {
    return isNegative ? `-${s}` : s;
  }
  
  const lastThree = s.substring(s.length - 3);
  const otherNumbers = s.substring(0, s.length - 3);
  const formatted = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree;
  return isNegative ? `-${formatted}` : formatted;
}

export function calculateAtmStrike(spotPrice: number, step: number): number {
  return Math.round(spotPrice / step) * step;
}

export function getPresetStrikes(
  atmStrike: number,
  step: number,
  mode: "consecutive" | "atm_plus_minus_2" | "atm_plus_minus_3"
): [number, number, number] {
  switch (mode) {
    case "consecutive":
      return [atmStrike, atmStrike + step, atmStrike + 2 * step];
    case "atm_plus_minus_2":
      return [atmStrike - 2 * step, atmStrike, atmStrike + 2 * step];
    case "atm_plus_minus_3":
      return [atmStrike - 3 * step, atmStrike, atmStrike + 3 * step];
    default:
      return [atmStrike, atmStrike + step, atmStrike + 2 * step];
  }
}
