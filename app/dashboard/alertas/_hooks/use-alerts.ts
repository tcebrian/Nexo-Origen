"use client";

import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh";
import { useCallback, useEffect, useState } from "react";
import { getAlertsRepository } from "@/lib/alerts/repository";
import type { RestaurantAlert } from "@/lib/alerts/types";

type UseAlertsOptions = {
  tenantId: string;
  start: Date;
  end: Date;
};

export function useAlerts({ tenantId, start, end }: UseAlertsOptions) {
  const [alerts, setAlerts] = useState<RestaurantAlert[]>([]);
  const [resolvedThisWeek, setResolvedThisWeek] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }

      try {
        const repo = await getAlertsRepository();
        const query = { tenantId, start, end };
        const data = await repo.list(query);
        setAlerts(data);

        if (!silent) {
          const resolved = await repo.resolvedCountThisWeek();
          setResolvedThisWeek(resolved);
        }
      } catch (err) {
        if (!silent) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar las alertas");
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [tenantId, start, end]
  );

  useEffect(() => {
    void fetchAlerts(false);
  }, [fetchAlerts]);

  useAutoRefresh((silent) => fetchAlerts(silent), 30_000, [fetchAlerts]);

  const resolveAlert = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === id
          ? {
              ...alert,
              status: "resuelto",
              activeAlerts: 0,
              resolvedAt: new Date(),
            }
          : alert
      )
    );
    setResolvedThisWeek((count) => count + 1);
  }, []);

  return { alerts, resolvedThisWeek, loading, error, refetch: () => fetchAlerts(false), resolveAlert };
}
