import { getPeriodBoundsFromDates, parseDateKeyStart, toDateKey } from "@/lib/dates/period";
import { dedupeResenas } from "@/lib/review-metrics";
import { getResenaDateKey } from "@/lib/supabase/chart-series";
import type { KpiDiarioRow } from "@/lib/supabase/kpi-diario";
import type { ResenaRow } from "@/lib/supabase/resenas";

export type TrendWindowMode = "month" | "quarter" | "semester";

export type WeeklyTrendPoint = {
  weekKey: string;
  label: string;
  shortLabel: string;
  media: number;
  reviewCount: number;
  positives: number;
  negatives: number;
};

export type TrendWindowRange = {
  start: Date;
  end: Date;
  title: string;
  mode: TrendWindowMode;
  offset: number;
};

function formatShortRange(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  const endLabel = end.toLocaleDateString("es-ES", {
    day: "numeric",
    month: sameMonth ? undefined : "short",
  });
  return `${startLabel} – ${endLabel}`;
}

function monthTitle(date: Date): string {
  const label = date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function resolveTrendWindowRange(mode: TrendWindowMode, offset: number): TrendWindowRange {
  const now = new Date();

  if (mode === "month") {
    const anchor = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end, title: monthTitle(anchor), mode, offset };
  }

  if (mode === "quarter") {
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const targetQuarter = currentQuarter + offset;
    const year = now.getFullYear() + Math.floor(targetQuarter / 4);
    const quarter = ((targetQuarter % 4) + 4) % 4;
    const startMonth = quarter * 3;
    const start = new Date(year, startMonth, 1);
    const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
    return { start, end, title: `Trimestre ${quarter + 1} · ${year}`, mode, offset };
  }

  const currentHalf = now.getMonth() < 6 ? 0 : 1;
  const targetHalf = currentHalf + offset;
  const year = now.getFullYear() + Math.floor(targetHalf / 2);
  const half = ((targetHalf % 2) + 2) % 2;
  const startMonth = half === 0 ? 0 : 6;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 6, 0, 23, 59, 59, 999);
  return { start, end, title: `${half === 0 ? "1.er" : "2.º"} semestre · ${year}`, mode, offset };
}

function iterateWeekChunks(start: Date, end: Date): { startKey: string; endKey: string; label: string }[] {
  const bounds = getPeriodBoundsFromDates(start, end);
  const chunks: { startKey: string; endKey: string; label: string }[] = [];
  let cursor = parseDateKeyStart(bounds.startKey);
  const endDate = parseDateKeyStart(bounds.endKey);

  let weekIndex = 1;
  while (cursor.getTime() <= endDate.getTime()) {
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 6);
    if (weekEnd.getTime() > endDate.getTime()) {
      weekEnd.setTime(endDate.getTime());
    }

    const startKey = toDateKey(cursor);
    const endKey = toDateKey(weekEnd);
    chunks.push({
      startKey,
      endKey,
      label: `Sem ${weekIndex}`,
    });

    weekIndex += 1;
    cursor = new Date(weekEnd);
    cursor.setDate(cursor.getDate() + 1);
  }

  return chunks;
}

function aggregateWeekFromKpi(
  kpiDiario: KpiDiarioRow[],
  restauranteId: number,
  startKey: string,
  endKey: string
) {
  const dailyInWeek = kpiDiario.filter(
    (row) =>
      Number(row.restaurante_id) === Number(restauranteId) &&
      row.fecha >= startKey &&
      row.fecha <= endKey &&
      row.total_resenas > 0
  );

  if (dailyInWeek.length === 0) return null;

  let weightedSum = 0;
  let reviewCount = 0;
  let positives = 0;
  let negatives = 0;

  for (const day of dailyInWeek) {
    weightedSum += day.media * day.total_resenas;
    reviewCount += day.total_resenas;
    positives += day.positivas;
    negatives += day.negativas;
  }

  return {
    media: weightedSum / reviewCount,
    reviewCount,
    positives,
    negatives,
  };
}

export function buildWeeklyMediaTrend(
  resenas: ResenaRow[],
  restauranteId: number,
  start: Date,
  end: Date,
  kpiDiario: KpiDiarioRow[] = []
): WeeklyTrendPoint[] {
  const scoped = dedupeResenas(resenas).filter(
    (row) => Number(row.restaurante_id) === Number(restauranteId)
  );
  const chunks = iterateWeekChunks(start, end);

  return chunks.map((chunk) => {
    const fromKpi = aggregateWeekFromKpi(kpiDiario, restauranteId, chunk.startKey, chunk.endKey);

    let media = 0;
    let reviewCount = 0;
    let positives = 0;
    let negatives = 0;

    if (fromKpi) {
      media = fromKpi.media;
      reviewCount = fromKpi.reviewCount;
      positives = fromKpi.positives;
      negatives = fromKpi.negatives;
    } else {
      const inWeek = scoped.filter((row) => {
        const key = getResenaDateKey(row);
        return key && key >= chunk.startKey && key <= chunk.endKey;
      });

      let sum = 0;
      for (const row of inWeek) {
        sum += row.estrellas;
        if (row.estrellas >= 4) positives += 1;
        else if (row.estrellas <= 2) negatives += 1;
      }

      reviewCount = inWeek.length;
      media = reviewCount > 0 ? sum / reviewCount : 0;
    }

    const rangeStart = parseDateKeyStart(chunk.startKey);
    const rangeEnd = parseDateKeyStart(chunk.endKey);

    return {
      weekKey: chunk.startKey,
      label: formatShortRange(rangeStart, rangeEnd),
      shortLabel: chunk.label,
      media,
      reviewCount,
      positives,
      negatives,
    };
  });
}
