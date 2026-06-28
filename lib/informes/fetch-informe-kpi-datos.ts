import "server-only";

import {
  computeInformeKpiFromResenas,
  getInformeQueryBounds,
} from "@/lib/informes/informe-kpi-utils";
import type { InformeKpiDatos } from "@/lib/informes/types";
import { dedupeResenas } from "@/lib/review-metrics";
import { fetchResenasForPeriodServer } from "@/lib/supabase/resenas.server";

/**
 * KPIs del informe desde Supabase (`resenas`).
 * Acepta periodo opcional; por defecto últimos 30 días.
 */
export async function fetchInformeKpiDatos(
  startKey?: string,
  endKey?: string
): Promise<InformeKpiDatos> {
  const { bounds, queryBounds } = getInformeQueryBounds(startKey, endKey, 30);

  const raw = await fetchResenasForPeriodServer(
    { start: bounds.start, end: bounds.end },
    { queryBounds }
  );

  return computeInformeKpiFromResenas(dedupeResenas(raw));
}
