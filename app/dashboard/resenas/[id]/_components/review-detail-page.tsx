"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSelectedRange, useDateRange } from "@/app/dashboard/_components/date-range-context";
import { useReviewAi } from "../../_hooks/use-review-ai";
import { useReviewDetailAnalisis } from "../../_hooks/use-review-detail-analisis";
import { useReviews } from "../../_hooks/use-reviews";
import { ResenasReviewDetail } from "../../_components/resenas-review-detail";
import { ambientLayer, shellPremium } from "../../_components/ui/resenas-styles";

const TENANT_ID = "grupo-hambar";

export function ReviewDetailPage({ reviewId }: { reviewId: string }) {
  const { range: activeRange } = useDateRange();
  const range = useMemo(() => getSelectedRange(activeRange), [activeRange]);

  const { reviews, loading, error } = useReviews({
    tenantId: TENANT_ID,
    start: range.start,
    end: range.end,
  });

  const { mergeReviews } = useReviewAi();
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());

  const allReviews = useMemo(
    () =>
      mergeReviews(reviews).map((review) =>
        reviewedIds.has(review.id) ? { ...review, reviewed: true } : review
      ),
    [reviews, mergeReviews, reviewedIds]
  );

  const reviewFromList = useMemo(
    () =>
      allReviews.find(
        (r) =>
          r.id === reviewId ||
          r.reviewId === reviewId ||
          r.resenaId === reviewId
      ) ?? null,
    [allReviews, reviewId]
  );

  const { review, loadingAnalisis } = useReviewDetailAnalisis(reviewFromList);

  useEffect(() => {
    if (!review || typeof window === "undefined") return;
    if (window.location.hash !== "#comentario") return;

    const target = document.getElementById("comentario");
    if (!target) return;

    const timer = window.setTimeout(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [review?.id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[900px] pb-12">
        <div className="mb-6 h-4 w-40 animate-pulse rounded bg-white/[0.04]" />
        <div className="h-[640px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-[400px] max-w-[900px] flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-black/20 p-10 text-center">
        <p className="text-[13px] font-medium text-red-300">No se pudo cargar la reseña</p>
        <Link href="/dashboard/resenas" className="mt-5 text-[13px] text-violet-300 hover:text-violet-200">
          Volver a Reseñas
        </Link>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="mx-auto flex min-h-[400px] max-w-[900px] flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-black/20 p-10 text-center">
        <p className="text-[15px] font-medium text-gray-300">Reseña no encontrada</p>
        <p className="mt-2 text-[13px] text-gray-600">
          Puede estar fuera del periodo seleccionado o no existir en el sistema.
        </p>
        <Link href="/dashboard/resenas" className="mt-6 text-[13px] text-violet-300 hover:text-violet-200">
          ← Volver a la bandeja
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px] pb-12">
      <nav className="mb-6 flex items-center gap-2 text-[12px] text-gray-600">
        <Link href="/dashboard/resenas" className="transition hover:text-gray-400">
          Reseñas
        </Link>
        <span>/</span>
        <span className="text-gray-400">{review.restaurant}</span>
        <span>/</span>
        <span className="text-gray-300">{review.author}</span>
      </nav>

      <div className={`${shellPremium} min-h-[640px] overflow-hidden`}>
        <div className={ambientLayer}>
          <div className="absolute -right-16 top-0 h-56 w-56 rounded-full bg-violet-600/12 blur-3xl" />
          <div className="absolute bottom-0 left-1/4 h-40 w-40 rounded-full bg-rose-600/8 blur-3xl" />
        </div>

        <div className="relative min-h-[640px]">
          <ResenasReviewDetail
            review={review}
            loadingAnalisis={loadingAnalisis}
            onMarkReviewed={(id) => setReviewedIds((prev) => new Set(prev).add(id))}
            onCreateAlert={() => undefined}
          />
        </div>
      </div>

      <div className="mt-6 flex justify-between">
        <Link href="/dashboard/resenas" className="text-[13px] text-gray-500 transition hover:text-gray-300">
          ← Volver a la bandeja
        </Link>
        <Link
          href={`/dashboard/restaurantes/${review.restaurantSlug}`}
          className="text-[13px] text-violet-300 transition hover:text-violet-200"
        >
          Ver restaurante →
        </Link>
      </div>
    </div>
  );
}
