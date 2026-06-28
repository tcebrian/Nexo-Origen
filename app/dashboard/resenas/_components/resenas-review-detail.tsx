"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { IA_NO_DATA } from "@/lib/reviews/analisis-ia-constants";
import { formatImpactSummary, impactToneClass } from "@/lib/reviews/impact-display";
import { formatReviewDate } from "@/lib/reviews/format";
import type { Review, ReviewPriority } from "@/lib/reviews/types";
import { RestaurantBrandLine } from "../../_components/restaurant-brand-line";
import { ReviewAiSection } from "./review-ai-section";
import {
  btnOutline,
  panelChrome,
  sectionPad,
  surfaceDetail,
  textKicker,
} from "./ui/resenas-styles";
import { GoogleBadge, SentimentBadge, StarRating, avatarTone } from "./ui/review-primitives";
import { IconSparkle } from "./ui/icons";

type ResenasReviewDetailProps = {
  review: Review | null;
  loadingAnalisis?: boolean;
  isAnalyzing: boolean;
  analysisStep: number;
  onAnalyze: (review: Review) => void;
  onMarkReviewed: (id: string) => void;
  onCreateAlert: (review: Review) => void;
  onClose?: () => void;
};

function priorityStyles(priority: ReviewPriority) {
  switch (priority) {
    case "Alta":
      return "border-[var(--nexo-critical-border)] bg-[var(--nexo-critical-muted)] text-[var(--nexo-critical)]";
    case "Media":
      return "border-[var(--nexo-watch-border)] bg-[var(--nexo-watch-muted)] text-[var(--nexo-watch)]";
    default:
      return "border-[var(--nexo-success-border)] bg-[var(--nexo-success-muted)] text-[var(--nexo-success)]";
  }
}

function MetaBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)] px-4 py-3.5">
      <p className={textKicker}>{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 py-24 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)]">
        <svg className="h-7 w-7 text-[var(--nexo-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      </div>
      <p className="text-[16px] font-medium text-[var(--nexo-text)]">Selecciona una reseña</p>
      <p className="mt-2 max-w-[280px] text-[13px] leading-relaxed text-[var(--nexo-text-secondary)]">
        Haz clic en una tarjeta de la bandeja para ver el expediente completo.
      </p>
    </div>
  );
}

export function ResenasReviewDetail({
  review,
  loadingAnalisis = false,
  isAnalyzing,
  analysisStep,
  onAnalyze,
  onMarkReviewed,
  onCreateAlert,
  onClose,
}: ResenasReviewDetailProps) {
  const [aiOpen, setAiOpen] = useState(false);
  const [alertCreated, setAlertCreated] = useState(false);

  useEffect(() => {
    setAiOpen(false);
    setAlertCreated(false);
  }, [review?.id]);

  useEffect(() => {
    if (review && !review.iaPending && review.ai) {
      setAiOpen(true);
    }
  }, [review?.id, review?.iaPending, review?.ai]);

  if (!review) {
    return (
      <div className={`flex h-full flex-col ${surfaceDetail}`}>
        <EmptyState />
      </div>
    );
  }

  const motiveLabel = review.motiveLabel;
  const riskDisplay = review.riskLevel;
  const recommendedAction = review.iaPending ? IA_NO_DATA : (review.ai?.recommendedAction ?? review.recommendedAction);
  const impactLabel = review.impactLabel ?? review.ai?.impactLabel ?? IA_NO_DATA;
  const impactSnapshot = review.ai
    ? {
        mediaBefore: review.ai.previousMedia,
        mediaAfter: review.ai.currentMedia,
        impact: review.ai.impact,
      }
    : {
        mediaBefore: review.mediaBefore,
        mediaAfter: review.mediaAfter,
        impact: review.mediaImpact,
      };
  const impact = formatImpactSummary(impactSnapshot, 2);

  function handleOpenAi() {
    setAiOpen(true);
  }

  function handleCreateAlert() {
    onCreateAlert(review!);
    setAlertCreated(true);
  }

  return (
    <div className={`relative flex h-full flex-col ${surfaceDetail}`}>
      <div className={`relative ${panelChrome} ${sectionPad} py-4`}>
        <div className="flex items-center justify-end gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className={`${btnOutline} px-2.5 py-1 text-[11px] lg:hidden`}
            >
              Cerrar
            </button>
          )}
          {!review.reviewed && (
            <span className="rounded-md border border-[var(--nexo-accent-border)] bg-[var(--nexo-accent-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--nexo-accent)]">
              Sin revisar
            </span>
          )}
          <GoogleBadge />
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div className={`border-b border-[var(--nexo-border)] ${sectionPad} py-6`}>
          <div className="flex items-start gap-4">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--nexo-border)] bg-gradient-to-br text-sm font-semibold shadow-[var(--nexo-shadow-sm)] ${avatarTone(review.author)}`}
            >
              {review.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[22px] font-medium tracking-tight text-[var(--nexo-text)]">{review.author}</h2>
                  <Link
                    href={`/dashboard/restaurantes/${review.restaurantSlug}`}
                    className="mt-2 inline-block transition hover:opacity-90"
                  >
                    <RestaurantBrandLine
                      brand={review.brand}
                      brandLabel={review.brandLabel}
                      name={review.restaurant}
                      logoSize="xs"
                      nameClassName="text-[13px] text-[var(--nexo-text-secondary)]"
                    />
                  </Link>
                </div>
                <SentimentBadge sentiment={review.sentiment} compact />
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <MetaBlock label="Fecha">
              <time className="text-[13px] capitalize text-[var(--nexo-text)]">{formatReviewDate(review.date)}</time>
            </MetaBlock>
            <MetaBlock label="Valoración">
              <div className="flex items-center gap-2">
                <StarRating rating={review.rating} size="md" />
                <span className="font-mono text-[14px] text-[var(--nexo-text)]">{review.rating}.0</span>
              </div>
            </MetaBlock>
            {review.location ? (
              <MetaBlock label="Dirección">
                <p className="text-[13px] text-[var(--nexo-text)]">{review.location}</p>
              </MetaBlock>
            ) : null}
          </div>
        </div>

        <div id="comentario" className={`scroll-mt-6 ${sectionPad} py-6`}>
          <p className={textKicker}>Comentario</p>
          <blockquote className="mt-4 rounded-2xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)] px-5 py-5 text-[16px] font-light leading-[1.8] text-[var(--nexo-text)]">
            &ldquo;{review.text}&rdquo;
          </blockquote>
        </div>

        <div className={`border-t border-[var(--nexo-border)] ${sectionPad} py-6`}>
          <div className="grid gap-3 sm:grid-cols-2">
            <MetaBlock label="Motivo detectado">
              <span className="inline-flex rounded-lg border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-2.5 py-1 text-[13px] text-[var(--nexo-text)]">
                {motiveLabel}
              </span>
            </MetaBlock>
            <MetaBlock label="Impacto en la media del local">
              <p className={`font-mono text-[15px] ${impactToneClass(impact.tone)}`}>{impact.delta}</p>
              <p className="mt-1 font-mono text-[13px] text-[var(--nexo-text)]">{impact.range}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--nexo-text-secondary)]">
                {impactLabel}
              </p>
            </MetaBlock>
            <MetaBlock label="Riesgo">
              <span className={`inline-flex rounded-lg border px-2.5 py-1 text-[12px] font-medium ${priorityStyles(review.ai?.priority ?? review.priority)}`}>
                {riskDisplay}
              </span>
            </MetaBlock>
            <MetaBlock label="Acción recomendada">
              <p className="text-[13px] leading-relaxed text-[var(--nexo-text-secondary)]">{recommendedAction}</p>
            </MetaBlock>
          </div>
        </div>

        <div className={`border-t border-[var(--nexo-border)] ${sectionPad} py-6`}>
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/restaurantes/${review.restaurantSlug}`} className={btnOutline}>
              Ver restaurante
            </Link>
            <button
              type="button"
              onClick={handleCreateAlert}
              disabled={alertCreated}
              className="rounded-xl border border-[var(--nexo-critical-border)] bg-[var(--nexo-critical-muted)] px-3.5 py-2 text-[12px] font-medium text-[var(--nexo-critical)] transition hover:opacity-90 disabled:opacity-50"
            >
              {alertCreated ? "Alerta creada" : "Crear alerta"}
            </button>
            {!review.reviewed && (
              <button
                type="button"
                onClick={() => onMarkReviewed(review.id)}
                className="rounded-xl border border-[var(--nexo-success-border)] bg-[var(--nexo-success-muted)] px-3.5 py-2 text-[12px] font-medium text-[var(--nexo-success)] transition hover:opacity-90"
              >
                Marcar revisada
              </button>
            )}
            <Link href="/dashboard/informes" className={btnOutline}>
              Ver informe
            </Link>
          </div>
        </div>

        <div className={`border-t border-[var(--nexo-border)] ${sectionPad} py-6`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <IconSparkle className="h-4 w-4 text-[var(--nexo-accent)]" />
              <p className="text-[13px] font-medium text-[var(--nexo-text)]">Análisis Nexo</p>
            </div>
            {!aiOpen && (
              <button
                type="button"
                onClick={handleOpenAi}
                className="text-[12px] font-medium text-[var(--nexo-accent)] transition hover:text-[var(--nexo-accent-hover)]"
              >
                Ver análisis →
              </button>
            )}
          </div>

          {!aiOpen ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[var(--nexo-accent-border)] bg-[var(--nexo-accent-muted)] px-5 py-6">
              <p className="text-[13px] text-[var(--nexo-text-secondary)]">
                {loadingAnalisis
                  ? "Cargando análisis desde Supabase…"
                  : review.iaPending
                    ? IA_NO_DATA
                    : "Resumen, motivo, impacto y recomendación desde Supabase."}
              </p>
            </div>
          ) : (
            <div className="mt-5">
              <ReviewAiSection
                review={review}
                isAnalyzing={isAnalyzing}
                analysisStep={analysisStep}
                onAnalyze={() => onAnalyze(review)}
                onRegenerate={() => onAnalyze(review)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
