import { dedupeResenas } from "@/lib/review-metrics";
import type { KpiDiarioRow, DailyNetworkPoint } from "./kpi-diario";
import { buildDailyNetworkSeries, getRestaurantDailySeries } from "./kpi-diario";
import { getResenaActivityDateValue, type ResenaRow } from "./resenas";

export type RestaurantChartSeries = {
  labels: string[];
  values: number[];
  volumeSeries: { label: string; positive: number; negative: number }[];
  source: "kpi_diario" | "resenas" | "empty";
};

function formatDayLabel(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}

/** Día (YYYY-MM-DD) en el que se cuenta la reseña en las gráficas: fecha de actividad. */
export function getResenaDateKey(row: ResenaRow): string {
  const raw = getResenaActivityDateValue(row);
  if (!raw) return "";
  return raw.slice(0, 10);
}

/** Evolución diaria de la red calculada desde reseñas deduplicadas. */
export function buildDailyNetworkSeriesFromResenas(resenas: ResenaRow[]): DailyNetworkPoint[] {
  const byDay = new Map<string, { sum: number; count: number }>();

  for (const row of dedupeResenas(resenas)) {
    const fecha = getResenaDateKey(row);
    if (!fecha) continue;
    const current = byDay.get(fecha) ?? { sum: 0, count: 0 };
    current.sum += row.estrellas;
    current.count += 1;
    byDay.set(fecha, current);
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, stats]) => ({
      fecha,
      label: formatDayLabel(fecha),
      media: stats.count > 0 ? stats.sum / stats.count : 0,
      totalResenas: stats.count,
    }));
}

export function resolveDailyNetworkSeries(
  kpiDiario: KpiDiarioRow[],
  resenas: ResenaRow[]
): { series: DailyNetworkPoint[]; source: "kpi_diario" | "resenas" | "empty" } {
  if (kpiDiario.length > 0) {
    const series = buildDailyNetworkSeries(kpiDiario);
    if (series.length > 0) {
      return { series, source: "kpi_diario" };
    }
  }

  const fromResenas = buildDailyNetworkSeriesFromResenas(resenas);
  if (fromResenas.length > 0) {
    return { series: fromResenas, source: "resenas" };
  }

  return { series: [], source: "empty" };
}

function buildRestaurantSeriesFromResenas(
  resenas: ResenaRow[],
  restauranteId: number
): RestaurantChartSeries {
  const byDay = new Map<string, { sum: number; count: number; positive: number; negative: number }>();

  for (const row of dedupeResenas(resenas).filter((r) => r.restaurante_id === restauranteId)) {
    const fecha = getResenaDateKey(row);
    if (!fecha) continue;
    const current = byDay.get(fecha) ?? { sum: 0, count: 0, positive: 0, negative: 0 };
    current.sum += row.estrellas;
    current.count += 1;
    if (row.estrellas >= 4) current.positive += 1;
    else if (row.estrellas <= 3) current.negative += 1;
    byDay.set(fecha, current);
  }

  const days = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b));

  return {
    labels: days.map(([fecha]) => formatDayLabel(fecha)),
    values: days.map(([, stats]) => (stats.count > 0 ? stats.sum / stats.count : 0)),
    volumeSeries: days.map(([fecha, stats]) => ({
      label: formatDayLabel(fecha),
      positive: stats.positive,
      negative: stats.negative,
    })),
    source: days.length > 0 ? "resenas" : "empty",
  };
}

/** Series de evolución y volumen para un restaurante (kpi_diario → resenas). */
export function getRestaurantChartSeries(
  kpiDiario: KpiDiarioRow[],
  resenas: ResenaRow[],
  restauranteId: number
): RestaurantChartSeries {
  const fromKpi = getRestaurantDailySeries(kpiDiario, restauranteId);
  if (fromKpi.values.length > 0) {
    return { ...fromKpi, source: "kpi_diario" };
  }

  return buildRestaurantSeriesFromResenas(resenas, restauranteId);
}

/** Sparkline de media diaria para ranking / tarjetas. */
export function buildRestaurantSparkline(
  kpiDiario: KpiDiarioRow[],
  resenas: ResenaRow[],
  restauranteId: number,
  maxPoints = 7
): number[] {
  const series = getRestaurantChartSeries(kpiDiario, resenas, restauranteId);
  if (series.values.length === 0) return [];

  const values = series.values;
  if (values.length <= maxPoints) return values;

  const step = (values.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, index) => {
    const sourceIndex = Math.round(index * step);
    return values[sourceIndex] ?? values[values.length - 1];
  });
}
