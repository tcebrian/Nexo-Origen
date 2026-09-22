import "server-only";

import type { UserScope } from "@/lib/auth/types";
import { toDateKey } from "@/lib/dates/period";
import { categoriaMotivoLabel } from "@/lib/supabase/resena-motivos";
import { fetchCanonicalMotiveBreakdown } from "@/lib/supabase/reputation-motives.server";
import { fetchSupabaseCanonicalReputationMetrics } from "@/lib/supabase/reputation-metrics.server";
import { loadPeriodDataServer } from "@/lib/supabase/period-api.server";
import { fetchResenasForPeriodServer } from "@/lib/supabase/resenas.server";
import { marcaToBrandId } from "@/lib/supabase/kpi-mappers";
import { buildReportsFromKpi } from "@/lib/supabase/reports-builder";
import type { CanonicalWeeklyReportNumbers } from "@/lib/reports/weekly/build-from-kpi";
import type { ReportRecord } from "@/lib/reports/types";

const NEGATIVE_COLORS: [number, number, number][] = [
  [255, 130, 0],
  [55, 55, 60],
  [120, 120, 125],
  [255, 180, 60],
  [180, 80, 80],
];

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function canonicalWeeklyNumbers(
  startKey: string,
  endKey: string,
  restaurantIds: number[]
): Promise<CanonicalWeeklyReportNumbers> {
  if (restaurantIds.length === 0) {
    return {
      totalReviews: 0,
      negativeReviews: 0,
      negativePercent: 0,
      weeklyAverage: 0,
      negativeReasons: [],
    };
  }

  const [metricRows, motiveRows] = await Promise.all([
    fetchSupabaseCanonicalReputationMetrics(startKey, endKey, restaurantIds),
    fetchCanonicalMotiveBreakdown(startKey, endKey, restaurantIds),
  ]);

  const network = metricRows[0];
  const uniqueMotives = new Map<string, { count: number; percent: number }>();

  for (const row of motiveRows) {
    if (!uniqueMotives.has(row.categoria)) {
      uniqueMotives.set(row.categoria, {
        count: row.networkCount,
        percent: row.networkPercent,
      });
    }
  }

  const negativeReasons = [...uniqueMotives.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([categoria, values], index) => ({
      label: categoriaMotivoLabel(categoria),
      count: values.count,
      percent: Math.round(values.percent * 10) / 10,
      color: NEGATIVE_COLORS[index % NEGATIVE_COLORS.length],
    }));

  return {
    totalReviews: num(network?.network_total_resenas),
    negativeReviews: num(network?.network_negativas),
    negativePercent: num(network?.network_negative_pct),
    weeklyAverage: num(network?.network_media_exacta),
    negativeReasons,
  };
}

async function buildCanonicalReportContext(
  rows: Awaited<ReturnType<typeof loadPeriodDataServer>>["activeKpiRows"],
  startKey: string,
  endKey: string
): Promise<Record<string, CanonicalWeeklyReportNumbers>> {
  const byBrand = new Map<string, number[]>();

  for (const row of rows) {
    const brand = marcaToBrandId(row.marca);
    const ids = byBrand.get(brand) ?? [];
    ids.push(row.restaurante_id);
    byBrand.set(brand, ids);
  }

  const entries = await Promise.all([
    canonicalWeeklyNumbers(
      startKey,
      endKey,
      rows.map((row) => row.restaurante_id)
    ).then((value) => ["network", value] as const),
    ...[...byBrand.entries()].map(([brand, ids]) =>
      canonicalWeeklyNumbers(startKey, endKey, ids).then(
        (value) => [`brand:${brand}`, value] as const
      )
    ),
  ]);

  return Object.fromEntries(entries);
}

export async function loadCanonicalReports(input: {
  start: Date;
  end: Date;
  scope?: UserScope;
}): Promise<ReportRecord[]> {
  const period = await loadPeriodDataServer(input.start, input.end, input.scope);
  const rows = period.activeKpiRows;
  const resenas = await fetchResenasForPeriodServer({
    start: period.bounds.start,
    end: period.bounds.end,
  });

  const canonical = await buildCanonicalReportContext(
    rows,
    toDateKey(period.bounds.start),
    toDateKey(period.bounds.end)
  );

  return buildReportsFromKpi(
    rows,
    { start: period.bounds.start, end: period.bounds.end },
    resenas,
    period.analisisByResenaId,
    canonical
  );
}
