import { REPUTATION_TARGET } from "./metrics";

/** Reseñas de 1★ que el local puede absorber antes de caer bajo el objetivo. */
export function getNegativeBuffer(
  currentMedia: number,
  totalReviews: number,
  target = REPUTATION_TARGET
): number {
  if (totalReviews <= 0 || currentMedia < target) return 0;

  const currentSum = currentMedia * totalReviews;
  const headroom = currentSum - target * totalReviews;

  // Cada reseña negativa (1★) resta ~3.4 puntos de margen frente al objetivo 4.4
  return Math.max(0, Math.floor(headroom / (target - 1)));
}

export function getPositiveReviews(totalReviews: number, negativeReviews: number) {
  return Math.max(0, totalReviews - negativeReviews);
}

export function getMediaProgress(currentMedia: number, target = REPUTATION_TARGET) {
  const min = 3.5;
  const clamped = Math.min(5, Math.max(min, currentMedia));
  return Math.round(((clamped - min) / (5 - min)) * 100);
}

export function getTargetProgress(currentMedia: number, target = REPUTATION_TARGET) {
  if (currentMedia >= target) return 100;
  const min = 3.5;
  return Math.round(((currentMedia - min) / (target - min)) * 100);
}
