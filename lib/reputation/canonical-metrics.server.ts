import "server-only";

import type { UserScope } from "@/lib/auth/types";
import {
  loadNexoPeriodSnapshot,
  type LoadSnapshotOptions,
} from "@/lib/dashboard-data";
import type {
  PeriodData,
  PeriodDataSource,
} from "@/lib/supabase/period-types";

/**
 * NEXO CANONICAL CALCULATOR
 *
 * Nexo server adapter for the canonical reputation metrics.
 *
 * PostgreSQL/Supabase owns the deterministic numeric calculation through
 * public.nexo_reputation_period_metrics(...). Vercel orchestrates the request,
 * applies authorization/scope and formats the already-calculated result.
 *
 * Numeric reputation KPIs NEVER come from UI formulas, prompts,
 * dashboard_kpis or interface-specific overrides.
 */
export async function getCanonicalReputationPeriod(
  startKey: string,
  endKey: string,
  scope?: UserScope,
  options?: LoadSnapshotOptions
): Promise<PeriodData> {
  const snapshot = await loadNexoPeriodSnapshot(startKey, endKey, scope, {
    ...options,
    // dashboard_kpis can still exist for legacy/diagnostic purposes, but must
    // never override canonical numeric reputation metrics.
    skipDashboardKpis: true,
  });

  const network = snapshot.metrics.network;

  const source: PeriodDataSource =
    network.source === "resenas" ? "resenas" : "empty";

  return {
    bounds: snapshot.bounds,
    catalog: snapshot.catalog,
    activeKpiRows: snapshot.activeKpiRows,
    aggregates: {
      totalResenas: network.totalResenas,
      totalNegativas: network.totalNegativas,
      totalPositivas: network.totalPositivas,
      mediaGlobal: network.mediaGlobal,
      byRestaurante: snapshot.metrics.byRestaurante,
      hasResenasEnPeriodo: snapshot.resenas.length > 0,
      source,
      ultimaActualizacion: network.ultimaActualizacion,
      positivePct: network.positivePct,
      negativePct: network.negativePct,
    },
    dailySeries: snapshot.dailySeries,
    kpiDiarioRows: snapshot.kpiDiario,
    resenas: snapshot.resenas,
    fetchedAt: snapshot.fetchedAt,
    problemDistribution: snapshot.metrics.problemDistribution,
    chartSource: snapshot.chartSource,
    analisisByResenaId: snapshot.analisisByResenaId,
    dashboardKpis: null,
    reviewImpactsByResenaId: snapshot.reviewImpactsByResenaId,
  };
}
