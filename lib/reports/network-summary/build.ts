import { REPUTATION_TARGET } from "@/lib/restaurants/metrics";
import { marcaToBrandId } from "@/lib/supabase/kpi-mappers";
import type { KpiRestaurantRow } from "@/lib/supabase/kpi-restaurantes";
import { categoriaMotivoLabel } from "@/lib/supabase/resena-motivos";
import type { SupabaseMetricRow } from "@/lib/supabase/reputation-metrics.server";
import type { CanonicalMotiveBreakdownRow } from "@/lib/supabase/reputation-motives.server";
import type { NetworkReportGroup } from "./brand-groups";
import type {
  NetworkSummaryData,
  NetworkSummaryLocationRow,
  NetworkSummaryLocationStatus,
  NetworkSummaryReasonSegment,
} from "./types";

function formatPeriodLabel(start: Date, end: Date): string {
  const fmt = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

function shortLocationName(name: string): string {
  return (
    name
      .replace(
        /^(BK|Burger King|Popeyes|Santa Gloria|Tim Hortons|Ribs|Sibuya|Taberna Volapi[eé]|Volapi[eé]|Vault)\s+/i,
        ""
      )
      .trim() || name
  );
}

const WATCH_THRESHOLD = 4.0;

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toStatus(row: KpiRestaurantRow): {
  status: NetworkSummaryLocationStatus;
  label: string;
} {
  if (row.total_resenas === 0) return { status: "no_reviews", label: "Sin reseñas" };
  if (row.media_total >= REPUTATION_TARGET) {
    return { status: "on_target", label: "Sobre el objetivo" };
  }
  if (row.media_total >= WATCH_THRESHOLD) {
    return { status: "watch", label: "Cerca del objetivo" };
  }
  return { status: "risk", label: "Bajo objetivo" };
}

function topRestaurantMotive(
  motives: CanonicalMotiveBreakdownRow[],
  restauranteId: number
): string {
  const row = motives
    .filter((item) => item.restauranteId === restauranteId)
    .sort((a, b) => b.count - a.count || a.categoria.localeCompare(b.categoria))[0];
  return row ? categoriaMotivoLabel(row.categoria) : "Sin reseñas negativas";
}

function networkMotives(
  motives: CanonicalMotiveBreakdownRow[],
  limit = 6
): NetworkSummaryReasonSegment[] {
  const byCategory = new Map<
    string,
    { categoria: string; count: number; percent: number }
  >();

  for (const row of motives) {
    if (byCategory.has(row.categoria)) continue;
    byCategory.set(row.categoria, {
      categoria: row.categoria,
      count: row.networkCount,
      percent: row.networkPercent,
    });
  }

  const ranked = [...byCategory.values()].sort(
    (a, b) => b.count - a.count || a.categoria.localeCompare(b.categoria)
  );

  if (ranked.length <= limit) {
    return ranked.map((item) => ({
      label: categoriaMotivoLabel(item.categoria),
      categoria: item.categoria,
      count: item.count,
      percent: Math.round(item.percent * 10) / 10,
    }));
  }

  const kept = ranked.slice(0, Math.max(1, limit - 1));
  const rest = ranked.slice(Math.max(1, limit - 1));
  const other = {
    categoria: "OTRO",
    count: rest.reduce((sum, item) => sum + item.count, 0),
    // Presentation-only grouping: sum canonical percentages instead of
    // recalculating a new KPI formula in Vercel.
    percent: rest.reduce((sum, item) => sum + item.percent, 0),
  };

  return [...kept, other].map((item) => ({
    label: categoriaMotivoLabel(item.categoria),
    categoria: item.categoria,
    count: item.count,
    percent: Math.round(item.percent * 10) / 10,
  }));
}

/**
 * Presentation-only builder.
 * Numeric KPIs and motive percentages are already calculated by Supabase.
 */
export function buildNetworkSummaryReport(
  group: NetworkReportGroup,
  allRows: KpiRestaurantRow[],
  metricRows: SupabaseMetricRow[],
  motiveRows: CanonicalMotiveBreakdownRow[],
  period: { start: Date; end: Date }
): NetworkSummaryData {
  const brandIdSet = new Set(group.brandIds);
  const rows = allRows
    .filter((row) => brandIdSet.has(marcaToBrandId(row.marca)))
    .filter((row) => !group.restaurantFilter || group.restaurantFilter(row));

  const network = metricRows[0];
  const totalReviews = num(network?.network_total_resenas);
  const positiveReviews = num(network?.network_positivas);
  const negativeReviews = num(network?.network_negativas);
  const weightedAverage = num(network?.network_media_exacta);
  const positivePercent = num(network?.network_positive_pct);
  const negativePercent = num(network?.network_negative_pct);

  const belowTarget = rows
    .filter((row) => row.total_resenas > 0 && row.media_total < REPUTATION_TARGET)
    .sort((a, b) => a.media_total - b.media_total);

  const locations: NetworkSummaryLocationRow[] = rows
    .map((row) => {
      const { status, label } = toStatus(row);
      return {
        name: shortLocationName(row.restaurante),
        brandLabel: row.marca,
        rating: row.total_resenas > 0 ? row.media_total : null,
        reviewCount: row.total_resenas,
        status,
        statusLabel: label,
        mainNegativeMotive: topRestaurantMotive(motiveRows, row.restaurante_id),
      };
    })
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  const negativeReasons = networkMotives(motiveRows, 6);

  const citiesLabel = [...new Set(rows.map((row) => row.ciudad.trim()).filter(Boolean))]
    .sort()
    .join(" + ")
    .toUpperCase();

  return {
    groupId: group.id,
    groupLabel: group.label,
    groupSublabel: group.sublabel,
    periodLabel: formatPeriodLabel(period.start, period.end),
    periodStart: period.start.toISOString(),
    periodEnd: period.end.toISOString(),
    citiesLabel,
    totalLocations: rows.length,
    totalReviews,
    positiveReviews,
    positivePercent: Math.round(positivePercent * 10) / 10,
    negativeReviews,
    negativePercent: Math.round(negativePercent * 10) / 10,
    weightedAverage: Math.round(weightedAverage * 100) / 100,
    targetAverage: REPUTATION_TARGET,
    belowTargetCount: belowTarget.length,
    belowTargetLocations: belowTarget.map((row) => shortLocationName(row.restaurante)),
    locations,
    negativeReasons,
    negativeReasonsTotal: motiveRows[0]?.networkTotal ?? 0,
  };
}
