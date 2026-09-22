import { REPUTATION_TARGET } from "@/lib/restaurants/metrics";
import { marcaToBrandId } from "@/lib/supabase/kpi-mappers";
import type { KpiRestaurantRow } from "@/lib/supabase/kpi-restaurantes";
import type { PeriodNetworkAggregate } from "@/lib/supabase/period-types";
import {
  categoriaMotivoLabel,
} from "@/lib/supabase/resena-motivos";
import type { SupabaseMotiveMetricRow } from "@/lib/supabase/reputation-metrics.server";
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

function toStatus(
  row: KpiRestaurantRow
): { status: NetworkSummaryLocationStatus; label: string } {
  if (row.total_resenas === 0) {
    return { status: "no_reviews", label: "Sin reseñas" };
  }
  if (row.media_total >= REPUTATION_TARGET) {
    return { status: "on_target", label: "Sobre el objetivo" };
  }
  if (row.media_total >= WATCH_THRESHOLD) {
    return { status: "watch", label: "Cerca del objetivo" };
  }
  return { status: "risk", label: "Bajo objetivo" };
}

function buildReasonSegments(
  motives: SupabaseMotiveMetricRow[],
  limit = 6
): NetworkSummaryReasonSegment[] {
  const ranked = motives.map((row) => ({
    categoria: row.categoria,
    label: categoriaMotivoLabel(row.categoria),
    count: Number(row.motivo_count) || 0,
    percent: Number(row.percent) || 0,
  }));

  if (ranked.length <= limit) return ranked;

  const kept = ranked.slice(0, limit - 1);
  const rest = ranked.slice(limit - 1);
  const restCount = rest.reduce((sum, item) => sum + item.count, 0);
  const restPercent = rest.reduce((sum, item) => sum + item.percent, 0);

  kept.push({
    categoria: "OTRO",
    label: categoriaMotivoLabel("OTRO"),
    count: restCount,
    percent: restPercent,
  });

  return kept;
}

/**
 * Render-only builder. All numerical reputation KPIs and motive counts arrive
 * already calculated by Supabase.
 */
export function buildNetworkSummaryReport(
  group: NetworkReportGroup,
  allRows: KpiRestaurantRow[],
  period: { start: Date; end: Date },
  officialAggregate: PeriodNetworkAggregate,
  officialMotives: SupabaseMotiveMetricRow[],
  topMotiveByRestaurant: Map<number, string>
): NetworkSummaryData {
  const brandIdSet = new Set(group.brandIds);
  const rows = allRows
    .filter((row) => brandIdSet.has(marcaToBrandId(row.marca)))
    .filter((row) => !group.restaurantFilter || group.restaurantFilter(row));

  const belowTarget = rows
    .filter(
      (row) =>
        row.total_resenas > 0 && row.media_total < REPUTATION_TARGET
    )
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
        mainNegativeMotive:
          topMotiveByRestaurant.get(row.restaurante_id) ??
          "Sin reseñas negativas",
      };
    })
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  const negativeReasons = buildReasonSegments(officialMotives);
  const negativeReasonsTotal =
    officialMotives.length > 0
      ? Number(officialMotives[0]?.total_categorizadas) || 0
      : 0;

  const citiesLabel = [
    ...new Set(rows.map((row) => row.ciudad.trim()).filter(Boolean)),
  ]
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
    totalReviews: officialAggregate.totalResenas,
    positiveReviews: officialAggregate.totalPositivas,
    positivePercent: officialAggregate.positivePct,
    negativeReviews: officialAggregate.totalNegativas,
    negativePercent: officialAggregate.negativePct,
    weightedAverage: officialAggregate.mediaGlobal,
    targetAverage: REPUTATION_TARGET,
    belowTargetCount: belowTarget.length,
    belowTargetLocations: belowTarget.map((row) =>
      shortLocationName(row.restaurante)
    ),
    locations,
    negativeReasons,
    negativeReasonsTotal,
  };
}
