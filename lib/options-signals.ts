/**
 * Directional OI momentum signals for the Three-Strike OI Analysis table.
 *
 * A signal fires only on a delta inflection (sign flip of the
 * Put-Call difference delta), not on every row:
 * - BULLISH: delta turns positive (negative -> positive inflection)
 * - BEARISH: delta turns negative (positive -> negative inflection)
 * - null: no inflection (momentum continuation or flat)
 */

export type OISignal = "BULLISH" | "BEARISH" | null;

/**
 * Returns the directional signal for one time-series row.
 *
 * Rows are ordered newest-first: `changeDiff` is Diff_T - Diff_{T-1}
 * and `olderDelta` is Diff_{T-1} - Diff_{T-2} (0 when unavailable).
 */
export function getOISignal(changeDiff: number, olderDelta: number): OISignal {
  if (changeDiff > 0 && olderDelta <= 0) return "BULLISH";
  if (changeDiff < 0 && olderDelta >= 0) return "BEARISH";
  return null;
}

export interface OISignalRowInput {
  difference: number;
  changeDiff?: number;
  revSignal?: boolean;
  signal?: OISignal | null;
}

/**
 * Annotates newest-first rows with `changeDiff`, `signal`, and the legacy
 * boolean `revSignal` (true when either directional signal fires).
 * Mutates and returns the same array for use in API routes.
 */
export function annotateOISignals<T extends OISignalRowInput>(rows: T[]): T[] {
  for (let i = 0; i < rows.length; i++) {
    if (i + 1 < rows.length) {
      const prevDiff = rows[i + 1].difference;
      const changeDiff = rows[i].difference - prevDiff;
      const olderDelta =
        i + 2 < rows.length ? rows[i + 1].difference - rows[i + 2].difference : 0;
      const signal = getOISignal(changeDiff, olderDelta);
      rows[i].changeDiff = changeDiff;
      rows[i].signal = signal;
      rows[i].revSignal = signal !== null;
    } else {
      rows[i].changeDiff = 0;
      rows[i].signal = null;
      rows[i].revSignal = false;
    }
  }
  return rows;
}
