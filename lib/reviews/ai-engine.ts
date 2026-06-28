import { IA_NO_DATA } from "./analisis-ia-constants";
import type { Review, ReviewAiAnalysis } from "./types";

export const AI_ANALYSIS_STEPS = [
  "Leyendo reseña",
  "Detectando motivos",
  "Calculando impacto",
  "Generando recomendación",
] as const;

export type AiChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type PeriodInsight = {
  headline: string;
  narrative: string;
  analyzedPct: number;
  topMotives: { label: string; count: number }[];
};

/** @deprecated El análisis IA se carga desde Supabase; no se genera en cliente. */
export function analyzeReview(_review: Review, _baseMediaHint?: number): ReviewAiAnalysis | null {
  return null;
}

export function generatePeriodInsights(reviews: Review[]): PeriodInsight {
  const withAnalysis = reviews.filter((review) => review.ai && !review.iaPending);
  const analyzedPct =
    reviews.length > 0 ? Math.round((withAnalysis.length / reviews.length) * 100) : 0;

  const motiveCounts = new Map<string, number>();
  for (const review of reviews) {
    const motive = review.motiveLabel;
    if (!motive || motive === IA_NO_DATA) continue;
    motiveCounts.set(motive, (motiveCounts.get(motive) ?? 0) + 1);
  }

  const topMotives = Array.from(motiveCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));

  if (withAnalysis.length === 0) {
    return {
      headline: IA_NO_DATA,
      narrative: IA_NO_DATA,
      analyzedPct,
      topMotives: [],
    };
  }

  const summaries = withAnalysis
    .map((review) => review.ai?.summary)
    .filter((value): value is string => Boolean(value && value !== IA_NO_DATA));

  return {
    headline: summaries[0] ?? IA_NO_DATA,
    narrative: summaries.slice(0, 2).join(" ") || IA_NO_DATA,
    analyzedPct,
    topMotives,
  };
}

export function getChatPresets(): { id: string; label: string; prompt: string }[] {
  return [];
}

export function answerReviewQuestion(
  _review: Review,
  _question: string,
  _analysis: Review["ai"]
): string {
  return IA_NO_DATA;
}
