import {
  getDaysInPeriod,
  getPeriodBoundsFromDates,
  parseDateKeyStart,
  toDateKey,
} from "@/lib/dates/period";
import { dedupeResenas } from "@/lib/review-metrics";
import { getResenaDateKey } from "@/lib/supabase/chart-series";
import type { ResenaRow } from "@/lib/supabase/resenas";
import type { RestaurantDayBreakdown, RestaurantStarBucket } from "./types";

const MAX_DAY_SLOTS = 7;

function formatDayLabel(dateKey: string, withWeekday: boolean): string {
  const date = parseDateKeyStart(dateKey);
  const dayMonth = date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  if (!withWeekday) return dayMonth;
  const weekday = date.toLocaleDateString("es-ES", { weekday: "short" });
  return `${weekday} ${dayMonth}`;
}

function classifyReview(stars: number): { positive: number; negative: number } {
  if (stars >= 4) return { positive: 1, negative: 0 };
  if (stars <= 2) return { positive: 0, negative: 1 };
  return { positive: 0, negative: 0 };
}

function iterateDateKeys(startKey: string, endKey: string): string[] {
  const keys: string[] = [];
  let cursor = parseDateKeyStart(startKey);
  const end = parseDateKeyStart(endKey);

  while (cursor.getTime() <= end.getTime()) {
    keys.push(toDateKey(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
  }

  return keys;
}

export function buildStarDistribution(
  resenas: ResenaRow[],
  restauranteId: number
): RestaurantStarBucket[] {
  const counts = new Map<number, number>([
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [5, 0],
  ]);

  for (const row of dedupeResenas(resenas).filter((item) => item.restaurante_id === restauranteId)) {
    const stars = Math.max(1, Math.min(5, Math.round(row.estrellas)));
    counts.set(stars, (counts.get(stars) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([stars, count]) => ({ stars, count }));
}

export function buildPeriodDayBreakdown(
  resenas: ResenaRow[],
  restauranteId: number,
  start: Date,
  end: Date
): { days: RestaurantDayBreakdown[]; mode: "week" | "top" } {
  const bounds = getPeriodBoundsFromDates(start, end);
  const periodDayCount = getDaysInPeriod(bounds);
  const byDay = new Map<string, { positive: number; negative: number; total: number }>();

  for (const row of dedupeResenas(resenas).filter((item) => item.restaurante_id === restauranteId)) {
    const dateKey = getResenaDateKey(row);
    if (!dateKey || dateKey < bounds.startKey || dateKey > bounds.endKey) continue;

    const current = byDay.get(dateKey) ?? { positive: 0, negative: 0, total: 0 };
    const bucket = classifyReview(row.estrellas);
    current.positive += bucket.positive;
    current.negative += bucket.negative;
    current.total += 1;
    byDay.set(dateKey, current);
  }

  const toBreakdown = (dateKey: string, stats: { positive: number; negative: number; total: number }) => ({
    dateKey,
    label: formatDayLabel(dateKey, true),
    positive: stats.positive,
    negative: stats.negative,
    total: stats.total,
  });

  if (periodDayCount <= MAX_DAY_SLOTS) {
    const days = iterateDateKeys(bounds.startKey, bounds.endKey).map((dateKey) =>
      toBreakdown(dateKey, byDay.get(dateKey) ?? { positive: 0, negative: 0, total: 0 })
    );
    return { days, mode: "week" };
  }

  const days = Array.from(byDay.entries())
    .map(([dateKey, stats]) => toBreakdown(dateKey, stats))
    .sort((a, b) => b.total - a.total || b.dateKey.localeCompare(a.dateKey))
    .slice(0, MAX_DAY_SLOTS)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  return { days, mode: "top" };
}
