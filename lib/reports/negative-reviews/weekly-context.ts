import "server-only";

import { toDateKey } from "@/lib/dates/period";
import { fetchSupabaseCanonicalReputationMetrics } from "@/lib/supabase/reputation-metrics.server";

export type WeeklyContext = {
  periodLabel: string;
  reviewsBefore: number;
  reviewsAfter: number;
  mediaBefore: number | null;
  mediaAfter: number | null;
};

function mondayOfWeek(date: Date): Date {
  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = normalized.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  normalized.setDate(normalized.getDate() - diffToMonday);
  return normalized;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatWeekLabel(start: Date, end: Date): string {
  const day = (d: Date) => d.getDate();
  const month = end.toLocaleDateString("es-ES", { month: "long" });
  const year = end.getFullYear();
  return `${day(start)} al ${day(end)} de ${month} de ${year}`;
}

function numberOrZero(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableAverage(row: Record<string, unknown> | undefined): number | null {
  if (!row || numberOrZero(row.total_resenas) === 0) return null;
  return numberOrZero(row.media_exacta);
}

/**
 * Weekly comparison comes from the same canonical Supabase calculator used by
 * the dashboard and reports. Vercel only formats the returned numbers.
 */
export async function computeWeeklyContext(
  restauranteId: number,
  reviewDateIso: string
): Promise<WeeklyContext> {
  const reviewDate = new Date(reviewDateIso);
  const currentWeekStart = mondayOfWeek(
    Number.isNaN(reviewDate.getTime()) ? new Date() : reviewDate
  );
  const currentWeekEnd = addDays(currentWeekStart, 6);
  const previousWeekStart = addDays(currentWeekStart, -7);
  const previousWeekEnd = addDays(currentWeekStart, -1);

  const [beforeRows, afterRows] = await Promise.all([
    fetchSupabaseCanonicalReputationMetrics(
      toDateKey(previousWeekStart),
      toDateKey(previousWeekEnd),
      [restauranteId]
    ),
    fetchSupabaseCanonicalReputationMetrics(
      toDateKey(currentWeekStart),
      toDateKey(currentWeekEnd),
      [restauranteId]
    ),
  ]);

  const before = beforeRows[0] as Record<string, unknown> | undefined;
  const after = afterRows[0] as Record<string, unknown> | undefined;

  return {
    periodLabel: formatWeekLabel(currentWeekStart, currentWeekEnd),
    reviewsBefore: numberOrZero(before?.total_resenas),
    reviewsAfter: numberOrZero(after?.total_resenas),
    mediaBefore: nullableAverage(before),
    mediaAfter: nullableAverage(after),
  };
}
