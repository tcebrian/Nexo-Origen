import { classifyMediaStatus, type RestaurantPeriodMetrics } from "@/lib/review-metrics";
import type { KpiRestaurantRow } from "@/lib/supabase/kpi-restaurantes";
import type { OperationalStatus } from "./types";

export type ReputationDataSource = "period" | "lifetime" | "none";

export type ReputationInputs = {
  currentMedia: number;
  totalReviews: number;
  positiveReviews: number;
  negativeReviews: number;
  dataSource: ReputationDataSource;
};

/** Snapshot histórico de kpi_restaurantes (media y volumen acumulado). */
export function resolveLifetimeInputs(catalog: KpiRestaurantRow): ReputationInputs {
  if (catalog.total_resenas > 0) {
    return {
      currentMedia: catalog.media_total,
      totalReviews: catalog.total_resenas,
      positiveReviews: catalog.resenas_positivas,
      negativeReviews: catalog.resenas_negativas,
      dataSource: "lifetime",
    };
  }

  return {
    currentMedia: 0,
    totalReviews: 0,
    positiveReviews: 0,
    negativeReviews: 0,
    dataSource: "none",
  };
}

/** Métricas del periodo activo (kpi_diario / reseñas del rango). */
export function resolvePeriodInputs(
  period: RestaurantPeriodMetrics | undefined
): ReputationInputs | null {
  if (!period) return null;

  return {
    currentMedia: period.totalResenas > 0 ? period.media : 0,
    totalReviews: period.totalResenas,
    positiveReviews: period.resenasPositivas,
    negativeReviews: period.resenasNegativas,
    dataSource: "period",
  };
}

/**
 * @deprecated Usar resolveLifetimeInputs / resolvePeriodInputs por separado.
 */
export function resolveReputationInputs(
  period: RestaurantPeriodMetrics | undefined,
  catalog: KpiRestaurantRow
): ReputationInputs {
  return resolvePeriodInputs(period) ?? resolveLifetimeInputs(catalog);
}

export function resolveOperationalStatus(
  period: RestaurantPeriodMetrics | undefined,
  inputs: ReputationInputs
): OperationalStatus {
  if (period && period.totalResenas > 0) {
    return period.operationalStatus;
  }
  return classifyMediaStatus(inputs.currentMedia, inputs.totalReviews > 0).operationalStatus;
}
