import type { BrandId } from "@/app/dashboard/restaurantes/data";
import { restaurantSlug } from "@/app/dashboard/restaurantes/utils";
import type { RestaurantAlert } from "@/lib/alerts/types";
import {
  computeNegativesTolerance,
  computePositivesNeeded,
  buildPreventRecord,
} from "@/lib/prevent/calculate";
import type { PreventRecord } from "@/lib/prevent/types";
import type { RankingRecord } from "@/lib/ranking/types";
import { classifyMediaStatus, type RestaurantPeriodMetrics } from "@/lib/review-metrics";
import { REPUTATION_TARGET } from "@/lib/review-metrics";
import {
  buildShortRecommendedAction,
  getStatusLabel,
} from "@/lib/restaurants/metrics";
import {
  resolveLifetimeInputs,
  resolveOperationalStatus,
  resolvePeriodInputs,
} from "@/lib/restaurants/reputation-inputs";
import { computeProtectionLevel } from "@/lib/restaurants/reputation-metrics";
import { mediaTrendFromChange } from "@/lib/restaurants/trend";
import type { OperationalStatus, RestaurantOperational } from "@/lib/restaurants/types";
import type { KpiRestaurantRow } from "./kpi-restaurantes";

import { marcaToBrandId } from "@/lib/restaurants/brand-resolve";

export { marcaToBrandId, resolveBrandId } from "@/lib/restaurants/brand-resolve";

export function brandBucket(marca: string): string {
  const m = marca.toLowerCase();
  if (m.includes("burger")) return "Burger King";
  if (m.includes("popeyes")) return "Popeyes";
  if (m.includes("santa")) return "Santa Gloria";
  if (m.includes("tim")) return "Tim Hortons";
  if (m.includes("vault")) return "Vault";
  return "Otros";
}

export function mapEstadoToOperational(estado: string): OperationalStatus {
  const e = estado.toLowerCase();
  if (e.includes("crit")) return "critical";
  if (e.includes("riesgo") || e === "regular") return "watch";
  return "on_target";
}

type OperationalExtras = {
  mediaChange?: number;
  sparkline?: number[];
};

export function catalogRowToOperational(
  catalog: KpiRestaurantRow,
  periodMetrics: RestaurantPeriodMetrics | undefined,
  extras: OperationalExtras = {}
): RestaurantOperational {
  const lifetime = resolveLifetimeInputs(catalog);
  const period = resolvePeriodInputs(periodMetrics);
  const inputs = period ?? lifetime;
  const status = periodMetrics
    ? resolveOperationalStatus(periodMetrics, inputs)
    : classifyMediaStatus(lifetime.currentMedia, lifetime.totalReviews > 0).operationalStatus;
  const recommendedPositiveReviews = computePositivesNeeded(
    inputs.currentMedia,
    inputs.totalReviews
  );
  const negativeBuffer = computeNegativesTolerance(inputs.currentMedia, inputs.totalReviews);
  const activeAlerts = inputs.negativeReviews;
  const mediaChange = extras.mediaChange ?? 0;
  const slug = restaurantSlug(catalog.restaurante);

  return {
    id: slug,
    slug,
    name: catalog.restaurante,
    location: catalog.ciudad,
    brand: marcaToBrandId(catalog.marca),
    brandLabel: catalog.marca,
    currentMedia: inputs.currentMedia,
    targetMedia: REPUTATION_TARGET,
    status,
    statusLabel: getStatusLabel(status),
    protectionLevel: computeProtectionLevel(inputs.currentMedia, inputs.totalReviews),
    activeAlerts,
    totalReviews: inputs.totalReviews,
    positiveReviews: inputs.positiveReviews,
    negativeReviews: inputs.negativeReviews,
    recommendedPositiveReviews,
    negativeBuffer,
    recommendedAction: buildShortRecommendedAction(
      status,
      activeAlerts,
      recommendedPositiveReviews
    ),
    trend: mediaTrendFromChange(mediaChange),
    sparkline: extras.sparkline ?? [],
    lastReviewAt: periodMetrics?.ultimaResena ?? catalog.ultima_resena,
  };
}

/** @deprecated Usar catalogRowToOperational con fila de catálogo + métricas de periodo. */
export function metricsToOperational(
  metrics: RestaurantPeriodMetrics,
  extras: OperationalExtras = {}
): RestaurantOperational {
  const catalog: KpiRestaurantRow = {
    restaurante_id: metrics.restauranteId,
    restaurante: metrics.restaurante,
    ciudad: metrics.ciudad,
    marca: metrics.marca,
    total_resenas: metrics.totalResenas,
    media_total: metrics.media,
    resenas_negativas: metrics.resenasNegativas,
    resenas_positivas: metrics.resenasPositivas,
    ultima_resena: metrics.ultimaResena,
    estado: metrics.statusLabel,
    media_google: null,
    total_resenas_google: null,
  };
  return catalogRowToOperational(catalog, metrics, extras);
}

export function kpiToOperational(row: KpiRestaurantRow): RestaurantOperational {
  return catalogRowToOperational(row, undefined);
}

export function metricsToRanking(
  metrics: RestaurantPeriodMetrics,
  mediaChange = 0
): RankingRecord {
  return {
    id: metrics.slug,
    restaurant: metrics.restaurante,
    restaurantSlug: metrics.slug,
    brand: metrics.brand,
    media: metrics.media,
    reviews: metrics.totalResenas,
    negatives: metrics.resenasNegativas,
    activeAlerts: metrics.resenasNegativas,
    criticalAlerts: metrics.operationalStatus === "critical" ? metrics.resenasNegativas : 0,
    mediaChange,
    monthsAboveTarget: metrics.media >= REPUTATION_TARGET ? 1 : 0,
    sparkline: [],
  };
}

export function kpiToRanking(row: KpiRestaurantRow, mediaChange = 0): RankingRecord {
  const slug = restaurantSlug(row.restaurante);
  const status = classifyMediaStatus(row.media_total, row.total_resenas > 0).operationalStatus;

  return {
    id: slug,
    restaurant: row.restaurante,
    restaurantSlug: slug,
    brand: marcaToBrandId(row.marca),
    media: row.media_total,
    reviews: row.total_resenas,
    negatives: row.resenas_negativas,
    activeAlerts: row.resenas_negativas,
    criticalAlerts: status === "critical" ? row.resenas_negativas : 0,
    mediaChange,
    monthsAboveTarget: row.media_total >= REPUTATION_TARGET ? 1 : 0,
    sparkline: [],
  };
}

export function kpiToPrevent(row: KpiRestaurantRow): PreventRecord {
  return buildPreventRecord(
    row.restaurante,
    restaurantSlug(row.restaurante),
    marcaToBrandId(row.marca),
    row.media_total,
    row.total_resenas
  );
}

/** @deprecated Usar buildAlertsFromResenas para alertas por reseña. */
export function kpiToAlert(_row: KpiRestaurantRow): RestaurantAlert | null {
  return null;
}
