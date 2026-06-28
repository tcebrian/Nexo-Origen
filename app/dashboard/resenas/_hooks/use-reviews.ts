"use client";

import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh";
import { useCallback, useEffect, useState } from "react";
import { getReviewsRepository } from "@/lib/reviews/repository";
import type { Review } from "@/lib/reviews/types";

type UseReviewsOptions = {
  tenantId: string;
  start: Date;
  end: Date;
};

export function useReviews({ tenantId, start, end }: UseReviewsOptions) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const fetchReviews = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }

      try {
        const repo = await getReviewsRepository();
        const data = await repo.list({ tenantId, start, end });
        setReviews(data);
        setLastSync(new Date());
      } catch (err) {
        if (!silent) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar las reseñas");
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [tenantId, start, end]
  );

  useEffect(() => {
    void fetchReviews(false);
  }, [fetchReviews]);

  useAutoRefresh((silent) => fetchReviews(silent), 30_000, [fetchReviews]);

  return { reviews, loading, error, lastSync, refetch: () => fetchReviews(false) };
}
