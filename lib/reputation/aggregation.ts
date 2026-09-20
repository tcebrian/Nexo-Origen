export type KpiDailyReputationRow = {
  restaurante_id: number;
  total_resenas: number;
  media: number;
  negativas: number;
  positivas: number;
};

export type AggregatedDailyReputation = {
  totalResenas: number;
  sumRating: number;
  negativas: number;
  positivas: number;
  media: number;
};

export type PeriodMetricsSource = "resenas" | "kpi_diario" | "empty";

export function weightedAverage(
  values: Array<{ value: number; weight: number }>
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const item of values) {
    weightedSum += item.value * item.weight;
    totalWeight += item.weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

export function percentageOfTotal(
  part: number,
  total: number,
  decimals = 1
): number {
  if (total <= 0) return 0;
  const factor = 10 ** decimals;
  return Math.round(((part / total) * 100) * factor) / factor;
}

export function aggregateKpiDailyByRestaurant(
  rows: KpiDailyReputationRow[]
): Map<number, AggregatedDailyReputation> {
  const acc = new Map<
    number,
    Omit<AggregatedDailyReputation, "media">
  >();

  for (const row of rows) {
    if (row.restaurante_id <= 0) continue;

    const current = acc.get(row.restaurante_id) ?? {
      totalResenas: 0,
      sumRating: 0,
      negativas: 0,
      positivas: 0,
    };

    current.totalResenas += row.total_resenas;
    current.sumRating += row.media * row.total_resenas;
    current.negativas += row.negativas;
    current.positivas += row.positivas;
    acc.set(row.restaurante_id, current);
  }

  return new Map(
    Array.from(acc.entries()).map(([restauranteId, totals]) => [
      restauranteId,
      {
        ...totals,
        media: totals.totalResenas > 0 ? totals.sumRating / totals.totalResenas : 0,
      },
    ])
  );
}

export function choosePeriodMetricsSource(
  reviewCount: number,
  kpiDailyCount: number
): PeriodMetricsSource {
  if (reviewCount > 0) return "resenas";
  if (kpiDailyCount > 0) return "kpi_diario";
  return "empty";
}
