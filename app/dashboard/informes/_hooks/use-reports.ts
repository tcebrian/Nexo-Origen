"use client";

import { useCallback, useEffect, useState } from "react";
import { getReportsRepository } from "@/lib/reports/repository";
import type { ReportAutomation, ReportRecord } from "@/lib/reports/types";

type UseReportsOptions = {
  tenantId: string;
  start: Date;
  end: Date;
};

export function useReports({ tenantId, start, end }: UseReportsOptions) {
  const [latest, setLatest] = useState<ReportRecord | null>(null);
  const [library, setLibrary] = useState<ReportRecord[]>([]);
  const [automations, setAutomations] = useState<ReportAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const repo = await getReportsRepository();
      const query = { tenantId, start, end };
      const [latestReport, libraryReports, automationList] = await Promise.all([
        repo.getLatest(query),
        repo.listLibrary(query),
        repo.listAutomations(),
      ]);
      setLatest(latestReport);
      setLibrary(libraryReports);
      setAutomations(automationList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los informes");
    } finally {
      setLoading(false);
    }
  }, [tenantId, start, end]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return {
    latest,
    library,
    automations,
    loading,
    error,
    refetch: fetchReports,
    setAutomations,
    setLibrary,
  } as const;
}
