export const REPUTATION_TARGET = 4.4;
export const REPUTATION_WATCH_THRESHOLD = 4.0;

export type ReviewPolarity = "positive" | "neutral" | "negative";
export type ReviewAttentionLevel = "critical" | "follow_up" | "none";
export type ReputationStatusLabel = "Óptimo" | "En riesgo" | "Crítico";
export type ReputationOperationalStatus = "on_target" | "watch" | "critical";

export function isKpiNegativeReview(stars: number): boolean {
  return stars <= 2;
}

export function isReviewRequiringAttention(stars: number): boolean {
  return stars <= 3;
}

export function getReviewAttentionLevel(stars: number): ReviewAttentionLevel {
  if (isKpiNegativeReview(stars)) return "critical";
  if (stars === 3) return "follow_up";
  return "none";
}

export function classifyReviewStars(stars: number): ReviewPolarity {
  if (stars >= 4) return "positive";
  if (isKpiNegativeReview(stars)) return "negative";
  return "neutral";
}

export function classifyMediaStatus(
  media: number,
  hasReviews: boolean
): {
  statusLabel: ReputationStatusLabel;
  operationalStatus: ReputationOperationalStatus;
} {
  if (!hasReviews) {
    return { statusLabel: "En riesgo", operationalStatus: "watch" };
  }

  if (media >= REPUTATION_TARGET) {
    return { statusLabel: "Óptimo", operationalStatus: "on_target" };
  }

  if (media >= REPUTATION_WATCH_THRESHOLD) {
    return { statusLabel: "En riesgo", operationalStatus: "watch" };
  }

  return { statusLabel: "Crítico", operationalStatus: "critical" };
}
