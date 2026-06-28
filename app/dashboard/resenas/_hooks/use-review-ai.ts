"use client";

import { useCallback } from "react";
import type { Review } from "@/lib/reviews/types";

/** El análisis IA llega desde Supabase (Make); no se genera en cliente. */
export function useReviewAi() {
  const applyOverride = useCallback((review: Review): Review => review, []);

  const mergeReviews = useCallback(
    (reviews: Review[]) => reviews.map(applyOverride),
    [applyOverride]
  );

  const runAnalysis = useCallback(async (_review: Review) => {
    return;
  }, []);

  const runBulkAnalysis = useCallback(async (_reviews: Review[]) => {
    return;
  }, []);

  const isAnalyzing = useCallback((_id: string) => false, []);
  const getStep = useCallback((_id: string) => 0, []);

  return {
    mergeReviews,
    runAnalysis,
    runBulkAnalysis,
    isAnalyzing,
    getStep,
  };
}
