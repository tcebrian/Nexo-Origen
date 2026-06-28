"use client";

import { IA_NO_ANALYSIS } from "@/lib/reviews/analisis-ia-constants";
import { formatDeltaPoints } from "@/lib/reviews/impact-display";
import type { Review, ReviewPriority, ReviewSentiment } from "@/lib/reviews/types";
import { IconSparkle } from "./ui/icons";

function motiveTagClass(sentiment: ReviewSentiment) {
  if (sentiment === "positiva") return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
  if (sentiment === "neutral") return "border-amber-400/20 bg-amber-500/10 text-amber-200";
  return "border-red-400/20 bg-red-500/10 text-red-200";
}

function priorityClass(priority: ReviewPriority, sentiment: ReviewSentiment) {
  if (priority === "Alta" || sentiment === "negativa") {
    return {
      box: "border-red-400/15 bg-red-500/[0.06]",
      badge: "border-red-400/30 bg-red-500/15 text-red-200",
    };
  }
  if (priority === "Media") {
    return {
      box: "border-amber-400/15 bg-amber-500/[0.06]",
      badge: "border-amber-400/30 bg-amber-500/15 text-amber-200",
    };
  }
  return {
    box: "border-emerald-400/15 bg-emerald-500/[0.06]",
    badge: "border-emerald-400/30 bg-emerald-500/15 text-emerald-200",
  };
}

type ReviewAiSectionProps = {
  review: Review;
  isAnalyzing: boolean;
  analysisStep: number;
  onAnalyze: () => void;
  onRegenerate: () => void;
};

export function ReviewAiSection({
  review,
}: ReviewAiSectionProps) {
  const ai = review.ai;
  const priorityStyles = ai ? priorityClass(ai.priority, review.sentiment) : null;

  if (review.iaPending || !ai) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.1] bg-black/30 px-5 py-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">NEXO Intelligence</p>
        <p className="mt-2 text-base text-gray-300">{IA_NO_ANALYSIS}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <IconSparkle className="h-3.5 w-3.5 text-gray-400" />
        <p className="text-sm font-medium text-gray-200">Análisis NEXO IA</p>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-gray-500">Resumen</p>
          <p className="text-sm leading-relaxed text-gray-300">{ai.summary}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-gray-500">Motivos</p>
            <div className="flex flex-wrap gap-1.5">
              {ai.motives.map((m) => (
                <span key={m} className={`rounded-md border px-2.5 py-1 text-xs ${motiveTagClass(review.sentiment)}`}>
                  {m}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-gray-500">Sentimiento</p>
            <p className="text-sm text-gray-300">{ai.sentiment}</p>
            {ai.employeeMentioned ? (
              <p className="mt-3 text-sm text-gray-400">
                <span className="text-xs uppercase tracking-[0.08em] text-gray-500">Empleado: </span>
                {ai.employeeMentioned}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2">
            <p className="text-xs uppercase tracking-[0.08em] text-gray-500">Impacto</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-300">{ai.impactLabel}</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2">
            <p className="text-xs uppercase tracking-[0.08em] text-gray-500">Variación media</p>
            <p className={`mt-1 font-mono text-lg ${ai.impact < 0 ? "text-red-400" : "text-gray-200"}`}>
              {formatDeltaPoints(ai.impact, 2)}
            </p>
          </div>
        </div>

        {priorityStyles ? (
          <div className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${priorityStyles.box}`}>
            <p className="text-sm text-gray-400">Riesgo</p>
            <span className={`rounded-md border px-2.5 py-1 text-xs font-medium ${priorityStyles.badge}`}>
              {ai.risk}
            </span>
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-gray-500">Recomendación</p>
          <p className="text-sm leading-relaxed text-gray-400">{ai.recommendedAction}</p>
        </div>
      </div>
    </div>
  );
}
