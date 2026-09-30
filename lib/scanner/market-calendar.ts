/**
 * Indian Standard Time (IST) Market Calendar & Session Guard
 * Standard market session: Mon-Fri 09:15:00 - 15:30:00 IST
 */

// Official NSE Market Trading Holidays for 2026 (Format: YYYY-MM-DD)
export const NSE_HOLIDAYS_2026 = new Set<string>([
  "2026-01-26", // Republic Day
  "2026-03-03", // Holi
  "2026-03-20", // Id-Ul-Fitr
  "2026-03-27", // Ram Navami
  "2026-04-03", // Good Friday
  "2026-04-14", // Dr. Baba Saheb Ambedkar Jayanti
  "2026-05-01", // Maharashtra Day
  "2026-05-27", // Bakri Id
  "2026-08-15", // Independence Day
  "2026-08-26", // Milad-un-Nabi
  "2026-10-02", // Mahatma Gandhi Jayanti
  "2026-10-20", // Dussehra
  "2026-11-08", // Diwali Laxmi Pujan
  "2026-11-10", // Diwali Balipratipada
  "2026-11-24", // Guru Nanak Jayanti
  "2026-12-25", // Christmas
]);

export interface MarketSessionStatus {
  isMarketOpen: boolean;
  status: "OPEN" | "CLOSED" | "PRE_MARKET" | "HOLIDAY" | "WEEKEND";
  sessionDate: string; // YYYY-MM-DD
  currentTimeIST: string;
  label: string;
}

export function getMarketSessionStatus(date: Date = new Date()): MarketSessionStatus {
  // Convert date to IST parts
  const formatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const p of parts) partMap[p.type] = p.value;

  const year = partMap.year;
  const month = partMap.month;
  const day = partMap.day;
  const hour = parseInt(partMap.hour, 10);
  const minute = parseInt(partMap.minute, 10);

  const sessionDate = `${year}-${month}-${day}`;
  const currentTimeIST = `${partMap.hour}:${partMap.minute}`;

  // Check weekday (0 = Sun, 6 = Sat in IST)
  const istDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const dayOfWeek = istDate.getDay();

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      isMarketOpen: false,
      status: "WEEKEND",
      sessionDate,
      currentTimeIST,
      label: "WEEKEND (MARKET CLOSED)",
    };
  }

  if (NSE_HOLIDAYS_2026.has(sessionDate)) {
    return {
      isMarketOpen: false,
      status: "HOLIDAY",
      sessionDate,
      currentTimeIST,
      label: "TRADING HOLIDAY",
    };
  }

  const minutesFromMidnight = hour * 60 + minute;
  const marketOpenMinutes = 9 * 60 + 15; // 09:15 AM
  const marketCloseMinutes = 15 * 60 + 30; // 03:30 PM
  const preMarketMinutes = 8 * 60 + 30; // 08:30 AM

  if (minutesFromMidnight >= marketOpenMinutes && minutesFromMidnight < marketCloseMinutes) {
    return {
      isMarketOpen: true,
      status: "OPEN",
      sessionDate,
      currentTimeIST,
      label: "MARKET OPEN (5M SCANNING ACTIVE)",
    };
  }

  if (minutesFromMidnight >= preMarketMinutes && minutesFromMidnight < marketOpenMinutes) {
    return {
      isMarketOpen: false,
      status: "PRE_MARKET",
      sessionDate,
      currentTimeIST,
      label: "PRE-MARKET (PREPARING 5M LEVELS)",
    };
  }

  return {
    isMarketOpen: false,
    status: "CLOSED",
    sessionDate,
    currentTimeIST,
    label: "MARKET CLOSED (OFF-SESSION)",
  };
}
