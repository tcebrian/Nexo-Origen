import { getInclusiveQueryBounds, getPeriodBounds } from "@/lib/date-utils";
import { toDateKey } from "@/lib/dates/period";

export function getDefaultInformePeriodKeys(days = 30): {
  startKey: string;
  endKey: string;
} {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return { startKey: toDateKey(start), endKey: toDateKey(end) };
}

export function resolveInformePeriod(
  startKey?: string,
  endKey?: string,
  defaultDays = 30
) {
  if (startKey && endKey) {
    return getPeriodBounds(startKey, endKey);
  }
  const defaults = getDefaultInformePeriodKeys(defaultDays);
  return getPeriodBounds(defaults.startKey, defaults.endKey);
}

/**
 * Solo resuelve fechas de consulta.
 * Los KPI del informe se calculan exclusivamente en Supabase.
 */
export function getInformeQueryBounds(
  startKey?: string,
  endKey?: string,
  defaultDays = 30
) {
  const bounds = resolveInformePeriod(startKey, endKey, defaultDays);
  return {
    bounds,
    queryBounds: getInclusiveQueryBounds(bounds.startKey, bounds.endKey),
  };
}
