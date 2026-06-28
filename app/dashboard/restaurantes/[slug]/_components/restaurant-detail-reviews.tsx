import Link from "next/link";
import { CommentExcerpt } from "@/app/dashboard/_components/comment-excerpt";
import type { RestaurantDetail } from "@/lib/restaurants/types";
import { getReviewHref } from "@/lib/text/excerpt";
import { detailKicker, detailSection, detailShell } from "./detail-health-styles";

type RestaurantDetailReviewsProps = {
  detail: RestaurantDetail;
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} estrellas`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <svg
          key={index}
          className={`h-4 w-4 ${index < rating ? "text-amber-400" : "text-white/10"}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function sentimentStyles(sentiment: "positive" | "negative" | "neutral") {
  if (sentiment === "negative") {
    return "border-red-400/20 bg-gradient-to-br from-red-500/[0.06] to-transparent";
  }
  if (sentiment === "positive") {
    return "border-emerald-400/15 bg-gradient-to-br from-emerald-500/[0.05] to-transparent";
  }
  return "border-white/[0.07] bg-black/20";
}

export function RestaurantDetailReviews({ detail }: RestaurantDetailReviewsProps) {
  const reviews = detail.recentReviews;

  return (
    <section className={`${detailShell} mt-6`}>
      <div className={detailSection}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={detailKicker}>Últimas reseñas conseguidas</p>
            <p className="mt-2 text-[13px] text-[var(--nexo-text-secondary)]">
              Las más recientes del periodo, ordenadas por fecha
            </p>
          </div>
          <Link
            href={detail.reviewsHref}
            className="text-[12px] font-medium text-violet-300 transition hover:text-violet-200"
          >
            Ver todas →
          </Link>
        </div>

        <div className="mt-6 space-y-3">
          {reviews.length === 0 ? (
            <p className="text-[14px] text-[var(--nexo-text-secondary)]">Sin reseñas en el periodo seleccionado.</p>
          ) : (
            reviews.map((review) => (
              <article
                key={review.id}
                className={`rounded-xl border p-4 sm:p-5 ${sentimentStyles(review.sentiment)}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-[14px] font-medium text-[var(--nexo-text)]">{review.author}</p>
                      <StarRating rating={review.rating} />
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--nexo-text-tertiary)]">
                      {review.date.toLocaleDateString("es-ES", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  {review.motive ? (
                    <span className="inline-flex shrink-0 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--nexo-text-secondary)]">
                      {review.motive}
                    </span>
                  ) : null}
                </div>
                <CommentExcerpt
                  text={review.text}
                  reviewHref={getReviewHref(review.id)}
                  maxLength={160}
                  className="mt-3 text-[14px] leading-relaxed text-[var(--nexo-text-secondary)]"
                />
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
