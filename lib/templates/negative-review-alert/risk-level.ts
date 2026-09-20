import { getReviewAttentionLevel } from "@/lib/reputation/rules";

export type AlertRiskLevel = "ALTO" | "MEDIO" | "BAJO";

/** Nivel de riesgo del informe PNG según estrellas de la reseña. */
export function resolveRiskLevelFromStars(stars: number): AlertRiskLevel {
  const attentionLevel = getReviewAttentionLevel(Math.round(stars));
  if (attentionLevel === "critical") return "ALTO";
  if (attentionLevel === "follow_up") return "MEDIO";
  return "BAJO";
}
