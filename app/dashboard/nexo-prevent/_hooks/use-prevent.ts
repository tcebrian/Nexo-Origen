"use client";

import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh";
import { useCallback, useEffect, useState } from "react";
import { getPreventRepository } from "@/lib/prevent/repository";
import type { PreventRecord } from "@/lib/prevent/types";

type UsePreventOptions = {
  tenantId: string;
  start: Date;
  end: Date;
};

export function usePrevent({ tenantId, start, end }: UsePreventOptions) {
  const [records, setRecords] = useState<PreventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrevent = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }

      try {
        const repo = await getPreventRepository();
        const data = await repo.list({ tenantId, start, end });
        setRecords(data);
      } catch (err) {
        if (!silent) {
          setError(err instanceof Error ? err.message : "No se pudo cargar Nexo Prevent");
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [tenantId, start, end]
  );

  useEffect(() => {
    void fetchPrevent(false);
  }, [fetchPrevent]);

  useAutoRefresh((silent) => fetchPrevent(silent), 30_000, [fetchPrevent]);

  return { records, loading, error, refetch: () => fetchPrevent(false) };
}
