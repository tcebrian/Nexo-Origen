"use client";

import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh";
import { toDateKey } from "@/lib/dates/period";
import type { DashboardOverview } from "@/lib/services/dashboard";
import type { RestaurantAlert } from "@/lib/alerts/types";
import type { RestaurantOperational } from "@/lib/restaurants/types";
import { useCallback, useEffect, useMemo, useState } from "react";

type SerializedOverview = Omit<DashboardOverview, "urgentAlerts" | "recentActivity"> & {
  urgentAlerts: (Omit<RestaurantAlert, "detectedAt"> & { detectedAt: string })[];
  recentActivity: {
    id: string;
    restaurant: string;
    restaurantSlug: string;
    brand: RestaurantOperational["brand"];
    description: string;
    occurredAt: string;
    type: "alert" | "review" | "improvement";
  }[];
};

function hydrateOverview(raw: SerializedOverview): DashboardOverview {
  return {
    ...raw,
    urgentAlerts: raw.urgentAlerts.map((a) => ({
      ...a,
      detectedAt: new Date(a.detectedAt),
    })),
    recentActivity: raw.recentActivity.map((a) => ({
      ...a,
      occurredAt: new Date(a.occurredAt),
    })),
  };
}

const EMPTY: DashboardOverview = {
  networkMedia: 0,
  totalReviews: 0,
  totalNegatives: 0,
  onTarget: 0,
  onWatch: 0,
  critical: 0,
  urgentAlerts: [],
  recentActivity: [],
  topPerformers: [],
  needsAttention: [],
};

export function useDashboardOverview(start: Date, end: Date) {
  const [data, setData] = useState<DashboardOverview>(EMPTY);
  const [loading, setLoading] = useState(true);

  const startKey = useMemo(() => toDateKey(start), [start]);
  const endKey = useMemo(() => toDateKey(end), [end]);

  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams({ start: startKey, end: endKey });
        const response = await fetch(`/api/platform/overview?${params.toString()}`, {
          credentials: "include",
        });
        if (!response.ok) throw new Error("overview fetch failed");
        const json = (await response.json()) as SerializedOverview;
        setData(hydrateOverview(json));
      } catch (err) {
        console.error("[useDashboardOverview]", err);
        if (!silent) setData(EMPTY);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [startKey, endKey]
  );

  useEffect(() => {
    void fetchData(false);
  }, [fetchData]);

  useAutoRefresh((silent) => fetchData(silent), 30_000, [fetchData]);

  return { data, loading };
}
