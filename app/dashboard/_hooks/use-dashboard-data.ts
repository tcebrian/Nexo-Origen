"use client";

import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh";
import { fetchJson } from "@/lib/fetch-client";
import { toDateKey } from "@/lib/dates/period";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DashboardData } from "@/lib/supabase/dashboard-data.types";
import { useAuth } from "../_components/auth-context";

const EMPTY_DATA: DashboardData = {
  mediaGlobal: 0,
  totalResenas: 0,
  totalPositivas: 0,
  totalNegativas: 0,
  positivePct: 0,
  negativePct: 0,
  ultimaActualizacion: null,
  totalRestaurantes: 0,
  ranking: [],
  restaurantesRiesgo: [],
  alertas: [],
  distribucionMarca: [],
  resumenIA: "Sin datos disponibles.",
  peorRestaurante: null,
  restauranteMasNegativas: null,
  chartPending: true,
  chartLabels: [],
  chartValues: [],
  chartSource: "empty",
  problemDistribution: [],
};

function cacheKey(userId: string, startKey: string, endKey: string) {
  return `nexo:dashboard:${userId}:${startKey}:${endKey}`;
}

function readCachedDashboard(userId: string, startKey: string, endKey: string): DashboardData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(userId, startKey, endKey));
    if (!raw) return null;
    return JSON.parse(raw) as DashboardData;
  } catch {
    return null;
  }
}

function writeCachedDashboard(userId: string, startKey: string, endKey: string, data: DashboardData) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(cacheKey(userId, startKey, endKey), JSON.stringify(data));
  } catch {
    // quota exceeded — ignore
  }
}

export function useDashboardData(start: Date, end: Date) {
  const { userId } = useAuth();
  const startKey = useMemo(() => toDateKey(start), [start]);
  const endKey = useMemo(() => toDateKey(end), [end]);

  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasShownData = useRef(false);

  const fetchData = useCallback(
    async (silent = false) => {
      const cached = readCachedDashboard(userId, startKey, endKey);
      const hasStale = cached != null || hasShownData.current;

      if (!silent && !hasStale) {
        setLoading(true);
        setError(null);
      } else if (!silent) {
        setRefreshing(true);
        setError(null);
      }

      try {
        const params = new URLSearchParams({ start: startKey, end: endKey });
        const json = await fetchJson<DashboardData>(`/api/dashboard?${params.toString()}`);
        setData(json);
        writeCachedDashboard(userId, startKey, endKey, json);
        hasShownData.current = json.totalRestaurantes > 0;
      } catch (err) {
        console.error("[useDashboardData]", err);
        if (!silent) {
          const message =
            err instanceof Error && err.message.startsWith("HTTP 401")
              ? "Sesión expirada. Vuelve a iniciar sesión."
              : err instanceof Error
                ? err.message
                : "Error desconocido";
          setError(message);
          if (err instanceof Error && err.message.startsWith("HTTP 401")) {
            sessionStorage.removeItem(cacheKey(userId, startKey, endKey));
          }
          if (!hasStale) setData(EMPTY_DATA);
        }
      } finally {
        if (!silent) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [userId, startKey, endKey]
  );

  useEffect(() => {
    const cached = readCachedDashboard(userId, startKey, endKey);
    if (cached) {
      setData(cached);
      setLoading(false);
      hasShownData.current = cached.totalRestaurantes > 0;
      void fetchData(true);
      return;
    }

    setData(EMPTY_DATA);
    setLoading(true);
    hasShownData.current = false;
    void fetchData(false);
  }, [fetchData, userId, startKey, endKey]);

  useAutoRefresh((silent) => fetchData(silent), 60_000, [fetchData]);

  return { data, loading, refreshing, error, refetch: () => fetchData(false) };
}
