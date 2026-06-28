/**
 * Utilidades de fechas para consultas Supabase.
 * Regla inclusiva: fecha >= inicio y fecha < día siguiente al fin.
 */
export {
  APP_TIMEZONE,
  getDaysInPeriod,
  getPeriodBounds,
  getPeriodBoundsFromDates,
  isDateKeyInRange,
  isValidDateKey,
  parseDateKeyEnd,
  parseDateKeyStart,
  toDateKey,
} from "@/lib/dates/period";

import { toDateKey, type PeriodBounds } from "@/lib/dates/period";

export type QueryDateBounds = {
  startIso: string;
  endExclusiveIso: string;
  startKey: string;
  endKey: string;
};

/** Día siguiente a endKey (YYYY-MM-DD) para filtro exclusivo. */
export function getNextDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);
  return toDateKey(date);
}

/** Límites para Supabase: gte inicio, lt día después del fin. */
export function getInclusiveQueryBounds(startKey: string, endKey: string): QueryDateBounds {
  const start = startKey <= endKey ? startKey : endKey;
  const end = startKey <= endKey ? endKey : startKey;
  const endExclusive = getNextDateKey(end);

  return {
    startKey: start,
    endKey: end,
    startIso: `${start}T00:00:00`,
    endExclusiveIso: `${endExclusive}T00:00:00`,
  };
}

export function getInclusiveQueryBoundsFromDates(start: Date, end: Date): QueryDateBounds {
  return getInclusiveQueryBounds(toDateKey(start), toDateKey(end));
}

export function isTimestampInQueryRange(
  value: string | null | undefined,
  bounds: QueryDateBounds
): boolean {
  if (!value) return false;
  const ts = new Date(value);
  if (Number.isNaN(ts.getTime())) return false;
  const start = new Date(bounds.startIso);
  const endExclusive = new Date(bounds.endExclusiveIso);
  return ts >= start && ts < endExclusive;
}

export function periodBoundsToQuery(bounds: PeriodBounds): QueryDateBounds {
  return getInclusiveQueryBounds(bounds.startKey, bounds.endKey);
}
