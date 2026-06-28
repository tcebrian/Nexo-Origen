"use client";

import { useEffect, useMemo, useState } from "react";
import type { BrandId } from "@/app/dashboard/restaurantes/data";
import { formatDateRangeLabel, getSelectedRange, useDateRange } from "../../_components/date-range-context";
import { useRestaurants } from "@/app/dashboard/restaurantes/_hooks/use-restaurants";
import { buildPreventRecord } from "@/lib/prevent/calculate";
import { buildPreventView, filterPreventRecords } from "@/lib/prevent/filters";
import type { PreventFilters } from "@/lib/prevent/filters";
import type { PreventRecord } from "@/lib/prevent/types";
import { usePrevent } from "../_hooks/use-prevent";
import { PageErrorState } from "../../_components/page-error-state";
import { skeletonBlock } from "../../_components/ui/nexo-styles";
import { PreventHeader } from "./prevent-header";
import { PreventHeroProtection } from "./prevent-hero-protection";
import { PreventRestaurantTable } from "./prevent-restaurant-table";
import { PreventSidebar } from "./prevent-sidebar";
import { PreventStatusTabs, type PreventTab } from "./prevent-status-tabs";
import { PreventWeeklySummary } from "./prevent-weekly-summary";
import { ambientLayer, shellWorkspace } from "./ui/prevent-styles";

const TENANT_ID = "grupo-hambar";

const DEFAULT_FILTERS: PreventFilters = { brand: "todas" };

function mergeWithOperationalRestaurants(
  records: PreventRecord[],
  operational: { name: string; slug: string; brand: BrandId; currentMedia: number; totalReviews: number }[]
): PreventRecord[] {
  const bySlug = new Map(records.map((record) => [record.restaurantSlug, record]));

  return operational.map((restaurant) => {
    const existing = bySlug.get(restaurant.slug);
    if (existing) return existing;
    return buildPreventRecord(
      restaurant.name,
      restaurant.slug,
      restaurant.brand,
      restaurant.currentMedia,
      0
    );
  });
}

export function PreventPage() {
  const { range: activeRange } = useDateRange();
  const range = useMemo(() => getSelectedRange(activeRange), [activeRange]);
  const periodLabel = formatDateRangeLabel(activeRange);

  const { records, loading, error, refetch } = usePrevent({
    tenantId: TENANT_ID,
    start: range.start,
    end: range.end,
  });

  const { restaurants: operationalRestaurants } = useRestaurants({
    tenantId: TENANT_ID,
    start: range.start,
    end: range.end,
  });

  const [filters, setFilters] = useState<PreventFilters>(DEFAULT_FILTERS);
  const [activeTab, setActiveTab] = useState<PreventTab>("fuera_objetivo");

  const mergedRecords = useMemo(
    () =>
      mergeWithOperationalRestaurants(
        records,
        operationalRestaurants.map((restaurant) => ({
          name: restaurant.name,
          slug: restaurant.slug,
          brand: restaurant.brand,
          currentMedia: restaurant.currentMedia,
          totalReviews: restaurant.totalReviews,
        }))
      ),
    [records, operationalRestaurants]
  );

  const sourceBrands = useMemo(
    () => [...new Set(mergedRecords.map((record) => record.brand))],
    [mergedRecords]
  );

  const filteredRecords = useMemo(
    () => filterPreventRecords(mergedRecords, filters),
    [mergedRecords, filters]
  );

  const view = useMemo(() => buildPreventView(filteredRecords), [filteredRecords]);

  useEffect(() => {
    setFilters(DEFAULT_FILTERS);
    setActiveTab("fuera_objetivo");
  }, [range.start, range.end]);

  if (error) {
    return (
      <PageErrorState title="No se pudo cargar Nexo Prevent" message={error} onRetry={refetch} />
    );
  }

  return (
    <div className="pb-10">
      <PreventHeader
        filters={filters}
        sourceBrands={sourceBrands}
        onFiltersChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
      />

      <PreventHeroProtection summary={view.summary} periodLabel={periodLabel} loading={loading} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className={`${shellWorkspace} relative p-5 lg:p-6`}>
          <div className={ambientLayer}>
            <div className="absolute -left-16 top-1/4 h-48 w-48 rounded-full bg-violet-600/[0.06] blur-3xl" />
          </div>

          <div className="relative">
            <div className="mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--nexo-text-tertiary)]">
                Estado de tus restaurantes
              </p>
              <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-[var(--nexo-text)]">
                Prioriza dónde actuar
              </h2>
            </div>

            {loading ? (
              <div className="space-y-4">
                <div className={`h-12 ${skeletonBlock}`} />
                <div className={`h-64 ${skeletonBlock}`} />
              </div>
            ) : (
              <>
                <PreventStatusTabs summary={view.summary} activeTab={activeTab} onTabChange={setActiveTab} />
                <PreventRestaurantTable records={filteredRecords} activeTab={activeTab} />
                <PreventWeeklySummary weekly={view.weekly} loading={loading} />
              </>
            )}
          </div>
        </div>

        {!loading && filteredRecords.length > 0 ? <PreventSidebar records={filteredRecords} /> : null}
      </div>
    </div>
  );
}
