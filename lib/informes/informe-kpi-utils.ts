import { getInclusiveQueryBounds, getPeriodBounds } from "@/lib/date-utils";
import { toDateKey } from "@/lib/dates/period";
import type { InformeKpiDatos } from "@/lib/informes/types";
import { dedupeResenas } from "@/lib/review-metrics";
import { isReviewRequiringAttention } from "@/lib/reputation/rules";
import type { ResenaRow } from "@/lib/supabase/resenas";

/** Reseñas que el informe histórico trata como problemáticas/seguimiento: 1–3★. */
export function isInformeAttentionReview(stars: number): boolean {
  return stars >= 1 && isReviewRequiringAttention(stars);
}

/** @deprecated Nombre histórico. No equivale al KPI oficial de negativas (1–2★). */
export function isNegativeInformeReview(stars: number): boolean {
  return isInformeAttentionReview(stars);
}

export function countUniqueRestaurants(resenas: ResenaRow[]): number {
  const keys = new Set<string>();

  for (const row of resenas) {
    if (row.restaurante_id != null) {
      keys.add(`id:${row.restaurante_id}`);
      continue;
    }
    const name = row.restaurante_nombre?.trim() || row.restaurante?.trim();
    if (name) keys.add(`name:${name.toLowerCase()}`);
  }

  return keys.size;
}

export function computeInformeKpiFromResenas(resenas: ResenaRow[]): InformeKpiDatos {
  if (resenas.length === 0) {
    return {
      media: 0,
      resenas: 0,
      negativas: 0,
      restaurantes: 0,
    };
  }

  const totalEstrellas = resenas.reduce((sum, row) => sum + row.estrellas, 0);
  const negativas = resenas.filter((row) => isInformeAttentionReview(row.estrellas)).length;

  return {
    media: totalEstrellas / resenas.length,
    resenas: resenas.length,
    negativas,
    restaurantes: countUniqueRestaurants(resenas),
  };
}

export function getDefaultInformePeriodKeys(days = 30): { startKey: string; endKey: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return { startKey: toDateKey(start), endKey: toDateKey(end) };
}

export function resolveInformePeriod(startKey?: string, endKey?: string, defaultDays = 30) {
  if (startKey && endKey) {
    return getPeriodBounds(startKey, endKey);
  }
  const defaults = getDefaultInformePeriodKeys(defaultDays);
  return getPeriodBounds(defaults.startKey, defaults.endKey);
}

export function getInformeQueryBounds(startKey?: string, endKey?: string, defaultDays = 30) {
  const bounds = resolveInformePeriod(startKey, endKey, defaultDays);
  return {
    bounds,
    queryBounds: getInclusiveQueryBounds(bounds.startKey, bounds.endKey),
  };
}
