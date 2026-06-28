"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BrandId } from "@/app/dashboard/restaurantes/data";
import { toDateKey } from "@/lib/dates/period";
import type { NegativeReviewReportRow } from "@/lib/reports/negative-reviews/types";

export type NegativeReviewsBrandFilter = "todas" | BrandId;

type UseNegativeReviewsOptions = {
  start: Date;
  end: Date;
  brand?: NegativeReviewsBrandFilter;
  limit?: number;
};

function toApiBrand(brand: NegativeReviewsBrandFilter): string {
  return brand === "todas" ? "all" : brand;
}

export function useNegativeReviews({
  start,
  end,
  brand = "todas",
  limit = 50,
}: UseNegativeReviewsOptions) {
  const [rows, setRows] = useState<NegativeReviewReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  // Use a ref to track the latest fetch params so the effect doesn't
  // depend on Date object identity (which changes on every render).
  const paramsRef = useRef({ start, end, brand, limit });
  paramsRef.current = { start, end, brand, limit };

  // Stable refetch: reads latest params from ref, never recreated.
  const refetch = useCallback(async () => {
    const { start: s, end: e, brand: b, limit: l } = paramsRef.current;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        start: toDateKey(s),
        end: toDateKey(e),
        brand: toApiBrand(b),
        limit: String(l),
      });
      const response = await fetch(`/api/informes/negative-reviews?${params.toString()}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("No se pudieron cargar las reseñas negativas");
      }

      const payload = (await response.json()) as {
        rows: NegativeReviewReportRow[];
        fetchedAt?: string;
      };

      setRows(payload.rows ?? []);
      setFetchedAt(payload.fetchedAt ?? null);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []); // no deps — reads params from ref

  // Fire only when the *string* representation of the params changes,
  // not on every Date object identity change.
  const startKey = toDateKey(start);
  const endKey = toDateKey(end);

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startKey, endKey, brand, limit]);

  return { rows, loading, error, fetchedAt, refetch };
}
