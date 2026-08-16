"use client";

import { IA_NO_ANALYSIS } from "@/lib/reviews/analisis-ia-constants";
import { formatImpactSummary, impactToneClass } from "@/lib/reviews/impact-display";
import { formatReviewDate } from "@/lib/reviews/format";
import type { Review, ReviewPriority, ReviewSentiment } from "@/lib/reviews/types";
import { MetaBlock } from "./ui/review-primitives";

function motiveTagClass(sentiment: ReviewSentiment) {
  if (sentiment === "positiva") {
    return "border-[var(--nexo-success-border)] bg-[var(--nexo-success-muted)] text-[var(--nexo-success)]";
  }
  if (sentiment === "neutral") {
    return "border-[var(--nexo-watch-border)] bg-[var(--nexo-watch-muted)] text-[var(--nexo-watch)]";
  }
  return "border-[var(--nexo-critical-border)] bg-[var(--nexo-critical-muted)] text-[var(--nexo-critical)]";
}

function riskBadgeClass(priority: ReviewPriority) {
  switch (priority) {
    case "Alta":
      return "border-[var(--nexo-critical-border)] bg-[var(--nexo-critical-muted)] text-[var(--nexo-critical)]";
    case "Media":
      return "border-[var(--nexo-watch-border)] bg-[var(--nexo-watch-muted)] text-[var(--nexo-watch)]";
    default:
      return "border-[var(--nexo-success-border)] bg-[var(--nexo-success-muted)] text-[var(--nexo-success)]";
  }
}

type ReviewAiSectionProps = {
  review: Review;
};

/** Todos los apartados de analisis_ia, cada uno una sola vez, en el orden del propio análisis. */
export function ReviewAiSection({ review }: ReviewAiSectionProps) {
  const ai = review.ai;

  if (review.iaPending || !ai) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--nexo-accent-border)] bg-[var(--nexo-accent-muted)] px-5 py-6 text-center">
        <p className="text-[13px] text-[var(--nexo-text-secondary)]">{IA_NO_ANALYSIS}</p>
      </div>
    );
  }

  const impact = formatImpactSummary(
    { mediaBefore: ai.previousMedia, mediaAfter: ai.currentMedia, impact: ai.impact },
    2
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <MetaBlock label="Resumen">
        <p className="text-[13px] leading-relaxed text-[var(--nexo-text-secondary)]">{ai.summary}</p>
      </MetaBlock>

      <MetaBlock label="Motivos detectados">
        <div className="flex flex-wrap gap-1.5">
          {ai.motives.map((motive) => (
            <span
              key={motive}
              className={`inline-flex rounded-lg border px-2.5 py-1 text-[12px] ${motiveTagClass(review.sentiment)}`}
            >
              {motive}
            </span>
          ))}
        </div>
      </MetaBlock>

      <MetaBlock label="Sentimiento">
        <p className="text-[13px] text-[var(--nexo-text)]">{ai.sentiment}</p>
        {ai.employeeMentioned ? (
          <p className="mt-2 text-[12px] text-[var(--nexo-text-secondary)]">
            <span className="uppercase tracking-[0.08em] text-[var(--nexo-text-tertiary)]">Empleado mencionado: </span>
            {ai.employeeMentioned}
          </p>
        ) : null}
      </MetaBlock>

      <MetaBlock label="Impacto en la media del local">
        <p className={`font-mono text-[15px] ${impactToneClass(impact.tone)}`}>{impact.delta}</p>
        <p className="mt-1 font-mono text-[13px] text-[var(--nexo-text)]">{impact.range}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-[var(--nexo-text-secondary)]">{ai.impactLabel}</p>
      </MetaBlock>

      <MetaBlock label="Riesgo">
        <span className={`inline-flex rounded-lg border px-2.5 py-1 text-[12px] font-medium ${riskBadgeClass(ai.priority)}`}>
          {ai.risk}
        </span>
      </MetaBlock>

      <MetaBlock label="Recomendación">
        <p className="text-[13px] leading-relaxed text-[var(--nexo-text-secondary)]">{ai.recommendedAction}</p>
      </MetaBlock>

      {ai.analyzedAt ? (
        <MetaBlock label="Analizado el">
          <time className="text-[13px] capitalize text-[var(--nexo-text)]">{formatReviewDate(ai.analyzedAt)}</time>
        </MetaBlock>
      ) : null}
    </div>
  );
}
