"use client";

import { applyAnalisisToReview } from "@/lib/reviews/apply-analisis-to-review";
import type { Review } from "@/lib/reviews/types";
import type { AnalisisIaRow } from "@/lib/supabase/analisis-ia";
import { useEffect, useState } from "react";

type AnalisisFetchState = {
  review: Review | null;
  loadingAnalisis: boolean;
};

/**
 * Carga analisis_ia por review_id (`analisis_ia.review_id = resenas.review_id`).
 */
export function useReviewDetailAnalisis(review: Review | null): AnalisisFetchState {
  const [enriched, setEnriched] = useState<Review | null>(review);
  const [loadingAnalisis, setLoadingAnalisis] = useState(false);

  useEffect(() => {
    setEnriched(review);
    if (!review) return;

    const lookupReviewId = review.reviewId?.trim() || null;

    if (!lookupReviewId) {
      console.warn("[review-detail] Sin review_id en la reseña — no se puede consultar analisis_ia");
      return;
    }

    const currentReview = review;
    let cancelled = false;

    async function loadAnalisis() {
      setLoadingAnalisis(true);
      try {
        const params = new URLSearchParams({ review_id: lookupReviewId! });
      const response = await fetch(`/api/analisis-ia?${params.toString()}`, {
        credentials: "include",
      });

        const payload = (await response.json()) as {
          analisis: AnalisisIaRow | null;
          error: string | null;
        };

        if (payload.error) {
          console.error("[review-detail] analisis_ia error Supabase", payload.error);
        }

        if (cancelled) return;

        setEnriched(applyAnalisisToReview(currentReview, payload.analisis));
      } catch (err) {
        console.error("[review-detail] analisis_ia fetch failed", err);
        if (!cancelled) setEnriched(currentReview);
      } finally {
        if (!cancelled) setLoadingAnalisis(false);
      }
    }

    void loadAnalisis();

    return () => {
      cancelled = true;
    };
  }, [review]);

  return { review: enriched, loadingAnalisis };
}
