import type { KpiRestaurantRow } from "./kpi-restaurantes";
export type KpiDiarioRow = {
  restaurante_id: number;
  fecha: string;
  total_resenas: number;
  media: number;
  negativas: number;
  positivas: number;
};

export type DailyNetworkPoint = {
  fecha: string;
  label: string;
  media: number;
  totalResenas: number;
};

export function aggregateKpiDiarioByRestaurante(
  rows: KpiDiarioRow[],
  metaById: Map<number, KpiRestaurantRow>
): KpiRestaurantRow[] {
  const byRestaurant = new Map<number, KpiDiarioRow[]>();

  for (const row of rows) {
    const list = byRestaurant.get(row.restaurante_id) ?? [];
    list.push(row);
    byRestaurant.set(row.restaurante_id, list);
  }

  const result: KpiRestaurantRow[] = [];

  for (const [restauranteId, dailyRows] of byRestaurant) {
    const meta = metaById.get(restauranteId);
    if (!meta) continue;

    let totalResenas = 0;
    let totalNegativas = 0;
    let totalPositivas = 0;
    let weightedSum = 0;
    let ultimaFecha = "";

    for (const day of dailyRows) {
      totalResenas += day.total_resenas;
      totalNegativas += day.negativas;
      totalPositivas += day.positivas;
      weightedSum += day.media * day.total_resenas;
      if (!ultimaFecha || day.fecha > ultimaFecha) {
        ultimaFecha = day.fecha;
      }
    }

    result.push({
      ...meta,
      total_resenas: totalResenas,
      resenas_negativas: totalNegativas,
      resenas_positivas: totalPositivas,
      media_total: totalResenas > 0 ? weightedSum / totalResenas : meta.media_total,
      ultima_resena: ultimaFecha ? `${ultimaFecha}T12:00:00` : meta.ultima_resena,
    });
  }

  return result;
}

export function buildDailyNetworkSeries(rows: KpiDiarioRow[]): DailyNetworkPoint[] {
  const byDay = new Map<string, { totalResenas: number; weightedSum: number }>();

  for (const row of rows) {
    const current = byDay.get(row.fecha) ?? { totalResenas: 0, weightedSum: 0 };
    current.totalResenas += row.total_resenas;
    current.weightedSum += row.media * row.total_resenas;
    byDay.set(row.fecha, current);
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, stats]) => ({
      fecha,
      label: new Date(`${fecha}T12:00:00`).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
      }),
      media: stats.totalResenas > 0 ? stats.weightedSum / stats.totalResenas : 0,
      totalResenas: stats.totalResenas,
    }));
}

export function aggregateKpiDiarioTotals(rows: KpiDiarioRow[]) {
  let totalResenas = 0;
  let totalNegativas = 0;
  let totalPositivas = 0;
  let weightedSum = 0;

  for (const row of rows) {
    totalResenas += row.total_resenas;
    totalNegativas += row.negativas;
    totalPositivas += row.positivas;
    weightedSum += row.media * row.total_resenas;
  }

  return {
    totalResenas,
    totalNegativas,
    totalPositivas,
    mediaGlobal: totalResenas > 0 ? weightedSum / totalResenas : 0,
    restaurantCount: new Set(rows.map((row) => row.restaurante_id)).size,
  };
}

export function getRestaurantDailySeries(
  rows: KpiDiarioRow[],
  restauranteId: number
): { labels: string[]; values: number[]; volumeSeries: { label: string; positive: number; negative: number }[] } {
  const daily = rows
    .filter((row) => row.restaurante_id === restauranteId)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  return {
    labels: daily.map((row) =>
      new Date(`${row.fecha}T12:00:00`).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
      })
    ),
    values: daily.map((row) => row.media),
    volumeSeries: daily.map((row) => ({
      label: new Date(`${row.fecha}T12:00:00`).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
      }),
      positive: row.positivas,
      negative: row.negativas,
    })),
  };
}
