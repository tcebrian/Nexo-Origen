"use client";

import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh";
import { useCallback, useEffect, useState } from "react";
import { getRankingRepository } from "@/lib/ranking/repository";
import type { RankingRecord } from "@/lib/ranking/types";

type UseRankingOptions = {
  tenantId: string;
  start: Date;
  end: Date;
};

export function useRanking({ tenantId, start, end }: UseRankingOptions) {
  const [records, setRecords] = useState<RankingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRanking = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }

      try {
        const repo = await getRankingRepository();
        const data = await repo.list({ tenantId, start, end });
        setRecords(data);
      } catch (err) {
        if (!silent) {
          setError(err instanceof Error ? err.message : "No se pudo cargar el ranking");
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [tenantId, start, end]
  );

  useEffect(() => {
    void fetchRanking(false);
  }, [fetchRanking]);

  useAutoRefresh((silent) => fetchRanking(silent), 30_000, [fetchRanking]);

  return { records, loading, error, refetch: () => fetchRanking(false) };
}
