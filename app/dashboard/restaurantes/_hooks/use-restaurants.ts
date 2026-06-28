"use client";

import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh";
import { useCallback, useEffect, useState } from "react";
import { getRestaurantsRepository } from "@/lib/restaurants/repository";
import type { RestaurantOperational, RestaurantsQuery } from "@/lib/restaurants/types";

export function useRestaurants(query: RestaurantsQuery) {
  const [restaurants, setRestaurants] = useState<RestaurantOperational[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }

      try {
        const repo = await getRestaurantsRepository();
        const data = await repo.listOperational(query);
        setRestaurants(data);
      } catch {
        if (!silent) setError("No se pudieron cargar los restaurantes");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [query.tenantId, query.start, query.end]
  );

  useEffect(() => {
    void fetchData(false);
  }, [fetchData]);

  useAutoRefresh((silent) => fetchData(silent), 30_000, [fetchData]);

  return { restaurants, loading, error, refetch: () => fetchData(false) };
}
