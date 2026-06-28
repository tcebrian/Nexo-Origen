"use client";

import { fetchJson } from "@/lib/fetch-client";
import type { TrendWindowMode, WeeklyTrendPoint } from "@/lib/restaurants/weekly-media-trend";
import { useCallback, useEffect, useState } from "react";

type WeeklyTrendResponse = {
  weeks: WeeklyTrendPoint[];
  title: string;
  mode: TrendWindowMode;
  offset: number;
  canGoForward: boolean;
};

export function useRestaurantWeeklyTrend(slug: string, mode: TrendWindowMode, offset: number) {
  const [data, setData] = useState<WeeklyTrendResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrend = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        mode,
        offset: String(offset),
      });
      const json = await fetchJson<WeeklyTrendResponse>(
        `/api/restaurants/${encodeURIComponent(slug)}/weekly-trend?${params.toString()}`
      );
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la evolución semanal");
    } finally {
      setLoading(false);
    }
  }, [slug, mode, offset]);

  useEffect(() => {
    void fetchTrend();
  }, [fetchTrend]);

  return { data, loading, error, refetch: fetchTrend };
}
