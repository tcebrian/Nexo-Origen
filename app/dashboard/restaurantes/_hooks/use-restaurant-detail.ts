"use client";

import { useCallback, useEffect, useState } from "react";
import { getRestaurantsRepository } from "@/lib/restaurants/repository";
import type { RestaurantDetail, RestaurantsQuery } from "@/lib/restaurants/types";

export function useRestaurantDetail(slug: string, query: RestaurantsQuery) {
  const [detail, setDetail] = useState<RestaurantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const repo = await getRestaurantsRepository();
      const data = await repo.getDetail(slug, query);
      if (!data) {
        setError("Restaurante no encontrado");
        setDetail(null);
      } else {
        setDetail(data);
      }
    } catch {
      setError("No se pudo cargar el detalle del restaurante");
    } finally {
      setLoading(false);
    }
  }, [slug, query.tenantId, query.start, query.end]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return { detail, loading, error, refetch: fetchData };
}
