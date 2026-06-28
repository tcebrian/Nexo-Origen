"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CommentExcerpt } from "@/app/dashboard/_components/comment-excerpt";
import { RestaurantBrandLine } from "@/app/dashboard/_components/restaurant-brand-line";
import { formatReviewDate } from "@/lib/reviews/format";
import { getReviewHref } from "@/lib/text/excerpt";
import type { Review } from "@/lib/reviews/types";
import { inboxCard, textKicker } from "./ui/resenas-styles";
import { SentimentBadge, StarRating, avatarTone } from "./ui/review-primitives";

type ResenasInboxListProps = {
  reviews: Review[];
};

const sentimentBorder = {
  positiva: "border-l-[var(--nexo-success)]",
  negativa: "border-l-[var(--nexo-critical)]",
  neutral: "border-l-[var(--nexo-watch)]",
} as const;

function MotiveBadge({ label }: { label: string }) {
  return (
    <span className="rounded-md border border-[var(--nexo-border)] bg-[var(--nexo-inset)] px-2 py-0.5 text-[10px] font-medium text-[var(--nexo-text-secondary)]">
      {label}
    </span>
  );
}

export function ResenasInboxList({ reviews }: ResenasInboxListProps) {
  const router = useRouter();

  if (reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-8 py-28 text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)]">
          <svg className="h-6 w-6 text-[var(--nexo-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
        <p className="text-[15px] font-medium text-[var(--nexo-text)]">Sin reseñas en este criterio</p>
        <p className="mt-2 max-w-sm text-[13px] text-[var(--nexo-text-secondary)]">
          Ajusta los filtros o amplía el periodo para ver más opiniones.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 lg:p-6">
      <div className="px-1 pb-1">
        <p className={textKicker}>
          {reviews.length} reseña{reviews.length === 1 ? "" : "s"} · prioridad
        </p>
      </div>

      {reviews.map((review) => {
        const isCritical =
          review.rating === 1 || (review.sentiment === "negativa" && review.priority === "Alta");
        const href = `/dashboard/resenas/${review.id}`;

        return (
          <article
            key={review.id}
            role="link"
            tabIndex={0}
            onClick={() => router.push(href)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                router.push(href);
              }
            }}
            className={`nexo-card-surface relative z-0 hover:z-[1] ${inboxCard} cursor-pointer border-l-[3px] ${sentimentBorder[review.sentiment]}`}
          >
            <div className="relative w-full text-left">
              <div className="flex gap-4">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--nexo-border)] bg-gradient-to-br text-[12px] font-semibold shadow-[var(--nexo-shadow-sm)] ${avatarTone(review.author)}`}
                >
                  {review.initials}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[15px] font-medium text-[var(--nexo-text)]">{review.author}</p>
                        {isCritical && (
                          <span className="rounded-md border border-[var(--nexo-critical-border)] bg-[var(--nexo-critical-muted)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--nexo-critical)]">
                            Crítica
                          </span>
                        )}
                        {!review.reviewed && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--nexo-accent)]" />
                        )}
                      </div>
                      <div className="mt-1">
                        <RestaurantBrandLine
                          brand={review.brand}
                          brandLabel={review.brandLabel}
                          name={review.restaurant}
                          logoSize="chip"
                          nameClassName="truncate text-[12px] text-[var(--nexo-text-secondary)]"
                        />
                      </div>
                    </div>
                    <time className="shrink-0 text-right text-[10px] leading-snug text-[var(--nexo-text-tertiary)]">
                      {formatReviewDate(review.date)}
                    </time>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <StarRating rating={review.rating} size="sm" />
                    {!review.reviewed && (
                      <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--nexo-accent)]">
                        Sin revisar
                      </span>
                    )}
                  </div>

                  <CommentExcerpt
                    text={review.text}
                    reviewHref={getReviewHref(review.id)}
                    maxLength={120}
                    className="mt-3 text-[14px] leading-relaxed text-[var(--nexo-text-secondary)]"
                    onReadMoreClick={(event) => event.stopPropagation()}
                  />

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <SentimentBadge sentiment={review.sentiment} compact />
                    <MotiveBadge label={review.motiveLabel} />
                  </div>
                </div>
              </div>
            </div>

            <div className="relative mt-4 flex justify-end border-t border-[var(--nexo-border)] pt-3">
              <Link
                href={href}
                onClick={(event) => event.stopPropagation()}
                className="text-[12px] font-medium text-[var(--nexo-accent)] transition hover:text-[var(--nexo-accent-hover)]"
              >
                Ver reseña →
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
