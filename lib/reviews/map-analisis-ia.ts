import type { AnalisisIaRow } from "@/lib/supabase/analisis-ia";
import type { MediaImpactResult } from "@/lib/reviews/media-impact";
import { IA_NO_DATA } from "./analisis-ia-constants";
import type { Review, ReviewAiAnalysis, ReviewPriority, ReviewSentiment } from "./types";

export function parseMotivoList(motivo: string | null | undefined): string[] {
  if (!motivo?.trim()) return [];
  const parts = motivo
    .split(/[|;\n]+/)
    .flatMap((chunk) => chunk.split(/,(?!\s)/))
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(parts)];
}

export function mapRiesgoToPriority(riesgo: string | null | undefined): ReviewPriority {
  const value = riesgo?.trim().toLowerCase() ?? "";
  if (/alto|crítico|critico|urgente|high/.test(value)) return "Alta";
  if (/medio|moderado|medium/.test(value)) return "Media";
  if (/bajo|low|leve/.test(value)) return "Baja";
  return "Media";
}

function mapSentimentLabelToReviewSentiment(label: string | null | undefined): ReviewSentiment {
  const value = label?.trim().toLowerCase() ?? "";
  if (/positiv|favorable|buen/.test(value)) return "positiva";
  if (/negativ|malo|mal|enfad|decepcion/.test(value)) return "negativa";
  return "neutral";
}

export function mapAnalisisToReviewAi(
  analisis: AnalisisIaRow,
  review: Pick<Review, "mediaBefore" | "mediaAfter" | "mediaImpact" | "rating">,
  mediaImpact?: MediaImpactResult | null
): ReviewAiAnalysis {
  const motives = parseMotivoList(analisis.motivo);

  return {
    summary: analisis.resumen?.trim() || IA_NO_DATA,
    motives: motives.length > 0 ? motives : [IA_NO_DATA],
    emotions: [],
    previousMedia: review.mediaBefore ?? mediaImpact?.mediaBefore ?? 0,
    currentMedia: review.mediaAfter ?? mediaImpact?.mediaAfter ?? 0,
    impact: review.mediaImpact ?? mediaImpact?.impact ?? 0,
    impactLabel: analisis.impacto?.trim() || IA_NO_DATA,
    priority: mapRiesgoToPriority(analisis.riesgo),
    recommendedAction: analisis.recomendacion?.trim() || IA_NO_DATA,
    suggestedReply: "",
    confidence: null,
    risk: analisis.riesgo?.trim() || IA_NO_DATA,
    sentiment: analisis.sentimiento?.trim() || IA_NO_DATA,
    employeeMentioned: analisis.empleado_mencionado?.trim() || null,
    pending: false,
  };
}

export type ReviewIaFields = {
  sentiment: ReviewSentiment;
  sentimentLabel: string;
  motiveLabel: string;
  recommendedAction: string;
  riskLevel: string;
  impactLabel: string;
  employeeMentioned: string | null;
  iaPending: boolean;
  analyzed: boolean;
  ai?: ReviewAiAnalysis;
};

export function resolveReviewIaFields(
  analisis: AnalisisIaRow | null,
  reviewBase: Pick<Review, "rating" | "mediaBefore" | "mediaAfter" | "mediaImpact">,
  mediaImpact?: MediaImpactResult | null
): ReviewIaFields {
  if (!analisis) {
    return {
      sentiment: "neutral",
      sentimentLabel: IA_NO_DATA,
      motiveLabel: IA_NO_DATA,
      recommendedAction: IA_NO_DATA,
      riskLevel: IA_NO_DATA,
      impactLabel: IA_NO_DATA,
      employeeMentioned: null,
      iaPending: true,
      analyzed: false,
    };
  }

  const ai = mapAnalisisToReviewAi(analisis, reviewBase, mediaImpact);
  const motives = parseMotivoList(analisis.motivo);

  return {
    sentiment: mapSentimentLabelToReviewSentiment(analisis.sentimiento),
    sentimentLabel: analisis.sentimiento?.trim() || IA_NO_DATA,
    motiveLabel: motives[0] ?? IA_NO_DATA,
    recommendedAction: analisis.recomendacion?.trim() || IA_NO_DATA,
    riskLevel: analisis.riesgo?.trim() || IA_NO_DATA,
    impactLabel: analisis.impacto?.trim() || IA_NO_DATA,
    employeeMentioned: analisis.empleado_mencionado?.trim() || null,
    iaPending: false,
    analyzed: true,
    ai,
  };
}

export function aggregateResumenFromAnalisis(
  analisisRows: Pick<AnalisisIaRow, "resumen">[]
): string | null {
  const summaries = analisisRows
    .map((row) => row.resumen?.trim())
    .filter((value): value is string => Boolean(value));

  if (summaries.length === 0) return null;
  return [...new Set(summaries)].slice(0, 3).join(" ");
}
