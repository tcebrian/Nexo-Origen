export type AlertRiskLevel = "ALTO" | "MEDIO" | "BAJO";

/** Nivel de riesgo del informe PNG según estrellas de la reseña. */
export function resolveRiskLevelFromStars(stars: number): AlertRiskLevel {
  const value = Math.round(stars);
  if (value <= 2) return "ALTO";
  if (value === 3) return "MEDIO";
  return "BAJO";
}
