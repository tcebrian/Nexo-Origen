import { getTargetProgress } from "@/lib/restaurants/reputation-math";
import { REPUTATION_TARGET, type PreventRecord, type PreventStatus } from "./types";

export { REPUTATION_TARGET };

/** Mínimo de reseñas 5★ sugeridas cuando el local aún no tiene historial. */
export const MIN_POSITIVES_WITHOUT_REVIEWS = 3;

/**
 * Reseñas 5★ necesarias para alcanzar el objetivo.
 * (sum + 5n) / (count + n) >= target
 */
export function computePositivesNeeded(
  currentMedia: number,
  reviewCount: number,
  target = REPUTATION_TARGET
): number {
  if (reviewCount <= 0) return MIN_POSITIVES_WITHOUT_REVIEWS;
  if (currentMedia >= target) return 0;
  const sum = currentMedia * reviewCount;
  const needed = Math.ceil((target * reviewCount - sum) / (5 - target));
  return Math.max(0, needed);
}

/**
 * Reseñas 1★ que el local puede absorber antes de bajar del objetivo.
 * (sum + n) / (count + n) >= target
 */
export function computeNegativesTolerance(
  currentMedia: number,
  reviewCount: number,
  target = REPUTATION_TARGET
): number {
  if (currentMedia < target || reviewCount <= 0) return 0;
  const tolerance = Math.floor((reviewCount * (currentMedia - target)) / (target - 1));
  return Math.max(0, tolerance);
}

/**
 * Protección reputacional por local (0–99).
 * - Fuera de objetivo: escala por cercanía al target y volumen de reseñas.
 * - Dentro de objetivo sin margen negativo: 0%.
 * - Dentro con margen: más negativas absorbibles → más protección.
 */
export function computePreventProtectionPercent(
  currentMedia: number,
  reviewCount: number,
  target = REPUTATION_TARGET
): number {
  if (reviewCount <= 0) return 0;

  const tolerance = computeNegativesTolerance(currentMedia, reviewCount, target);

  if (currentMedia < target) {
    const progress = getTargetProgress(currentMedia, target);
    const volumeFactor = Math.min(1, Math.sqrt(reviewCount / 12));
    return Math.round(Math.min(42, progress * 0.42 * volumeFactor));
  }

  if (tolerance <= 0) return 0;

  const toleranceScore = 1 - Math.exp(-tolerance / 3.5);
  const mediaBonus = Math.min(0.12, (currentMedia - target) * 0.1);
  const volumeBonus = Math.min(0.08, Math.log10(reviewCount + 1) / 12);
  const raw = toleranceScore * (0.72 + mediaBonus + volumeBonus);

  return Math.min(99, Math.round(raw * 100));
}

/** Protección global ponderada por volumen de reseñas del periodo. */
export function computeNetworkProtectionPercent(records: PreventRecord[]): number {
  if (records.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const record of records) {
    const weight = Math.max(1, record.reviewCount);
    const protection =
      record.protectionPercent ??
      computePreventProtectionPercent(record.currentMedia, record.reviewCount, record.targetMedia);
    weightedSum += protection * weight;
    totalWeight += weight;
  }

  return Math.round(weightedSum / totalWeight);
}

export function simulateMediaAfterReviews(
  currentMedia: number,
  reviewCount: number,
  starRating: number,
  additionalCount: number
): number {
  if (additionalCount <= 0) return currentMedia;
  const baseSum = reviewCount > 0 ? currentMedia * reviewCount : 0;
  const baseCount = Math.max(0, reviewCount);
  const nextSum = baseSum + starRating * additionalCount;
  const nextCount = baseCount + additionalCount;
  return Number((nextSum / nextCount).toFixed(2));
}

export function classifyPreventStatus(
  currentMedia: number,
  negativesTolerance: number,
  target = REPUTATION_TARGET
): PreventStatus {
  if (currentMedia < target) return "fuera_objetivo";
  if (negativesTolerance <= 4) return "vigilancia";
  return "protegido";
}

export function getPreventAction(status: PreventStatus): string {
  const actions = {
    fuera_objetivo: "Recuperar objetivo 4.4",
    vigilancia: "Reforzar captación de reseñas positivas",
    protegido: "Mantener estrategia actual",
  } as const;
  return actions[status];
}

export function buildPreventRecord(
  restaurant: string,
  restaurantSlug: string,
  brand: PreventRecord["brand"],
  currentMedia: number,
  reviewCount: number,
  target = REPUTATION_TARGET
): PreventRecord {
  const positivesNeeded = computePositivesNeeded(currentMedia, reviewCount, target);
  const negativesTolerance = computeNegativesTolerance(currentMedia, reviewCount, target);
  const status = classifyPreventStatus(currentMedia, negativesTolerance, target);
  const protectionPercent = computePreventProtectionPercent(currentMedia, reviewCount, target);

  return {
    id: restaurantSlug,
    restaurant,
    restaurantSlug,
    brand,
    currentMedia,
    reviewCount,
    targetMedia: target,
    status,
    positivesNeeded,
    negativesTolerance,
    protectionPercent,
    action: getPreventAction(status),
  };
}
