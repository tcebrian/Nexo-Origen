"use client";

import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh";
import { useCallback, useEffect, useState } from "react";
import { getTalentoRepository } from "@/lib/talento/repository";
import type { EmployeeRecord, TalentoSummaryTrends } from "@/lib/talento/types";

const EMPTY_TRENDS: TalentoSummaryTrends = {
  employeesMentionedDelta: 0,
  positiveMentionsDelta: 0,
  negativeMentionsDelta: 0,
};

type UseTalentoOptions = {
  tenantId: string;
  start: Date;
  end: Date;
};

export function useTalento({ tenantId, start, end }: UseTalentoOptions) {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [summaryTrends, setSummaryTrends] = useState<TalentoSummaryTrends>(EMPTY_TRENDS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTalento = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const repo = await getTalentoRepository();
        const data = await repo.listEmployees({ tenantId, start, end });
        setEmployees(data.employees);
        setSummaryTrends(data.summaryTrends);
      } catch (err) {
        if (!silent) {
          setError(err instanceof Error ? err.message : "No se pudo cargar Talento");
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [tenantId, start, end]
  );

  useEffect(() => {
    void fetchTalento(false);
  }, [fetchTalento]);

  useAutoRefresh((silent) => fetchTalento(silent), 30_000, [fetchTalento]);

  return { employees, summaryTrends, loading, error, refetch: () => fetchTalento(false) };
}
