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

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Semana actual vs anterior usando exclusivamente el calculador canónico
 * public.nexo_reputation_period_metrics(...).
 */
export async function computeWeeklyContext(
  restauranteId: number,
  reviewDateIso: string
): Promise<WeeklyContext> {
  const parsed = new Date(reviewDateIso);
  const currentWeekStart = mondayOfWeek(Number.isNaN(parsed.getTime()) ? new Date() : parsed);
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

  const before = beforeRows[0];
  const after = afterRows[0];
  const beforeCount = num(before?.total_resenas);
  const afterCount = num(after?.total_resenas);

  return {
    periodLabel: formatWeekLabel(currentWeekStart, currentWeekEnd),
    reviewsBefore: beforeCount,
    reviewsAfter: afterCount,
    mediaBefore: beforeCount > 0 ? num(before?.media_exacta) : null,
    mediaAfter: afterCount > 0 ? num(after?.media_exacta) : null,
  };
}
