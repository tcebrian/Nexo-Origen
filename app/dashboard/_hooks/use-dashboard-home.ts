"use client";

import { useCallback, useEffect, useState } from "react";
import { getDashboardOverview, type DashboardOverview } from "@/lib/services/dashboard";

type UseDashboardHomeOptions = {
  tenantId: string;
  start: Date;
  end: Date;
};

export function useDashboardHome({ tenantId, start, end }: UseDashboardHomeOptions) {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const overview = await getDashboardOverview({ tenantId, start, end });
      setData(overview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el resumen");
    } finally {
      setLoading(false);
    }
  }, [tenantId, start, end]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
