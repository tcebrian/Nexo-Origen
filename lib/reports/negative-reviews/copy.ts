import { IA_NO_DATA } from "@/lib/reviews/analisis-ia-constants";
import type { ReviewCategory } from "@/lib/reviews/types";
import type { ReviewPriority } from "@/lib/reviews/types";

export function buildImpactText(params: {
  mediaBefore: number | null;
  mediaAfter: number | null;
  impact: number | null;
  stars: number;
}): string {
  const { mediaBefore, mediaAfter, impact, stars } = params;

  if (mediaAfter == null) {
    return IA_NO_DATA;
  }

  if (mediaBefore == null) {
    return `Primera reseña del periodo en este local. Media actual ${mediaAfter.toFixed(2)}.`;
  }

  const delta = impact ?? mediaAfter - mediaBefore;

  if (delta <= -0.05) {
    return `La media bajó ${Math.abs(delta).toFixed(2)} puntos (${mediaBefore.toFixed(2)} → ${mediaAfter.toFixed(2)}). Reseña de ${stars}★ con efecto negativo inmediato.`;
  }

  if (delta >= 0.05) {
    return `La media subió ${delta.toFixed(2)} puntos (${mediaBefore.toFixed(2)} → ${mediaAfter.toFixed(2)}), pese a la valoración baja.`;
  }

  return `Impacto neutro en la media (${mediaBefore.toFixed(2)} → ${mediaAfter.toFixed(2)}).`;
}

/** @deprecated El análisis IA proviene de Supabase (analisis_ia). */
export function buildRecommendation(
  _category: ReviewCategory,
  _priority: ReviewPriority,
  _motive: string
): string {
  return IA_NO_DATA;
}
