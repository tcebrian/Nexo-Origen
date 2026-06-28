"use client";

import { useMemo, useState } from "react";
import { getSelectedRange, useDateRange } from "../../_components/date-range-context";
import {
  buildTalentoPageView,
  getRestaurantOptions,
  type TalentoFilters,
} from "@/lib/talento/filters";
import { useTalento } from "../_hooks/use-talento";
import { PageErrorState } from "../../_components/page-error-state";
import { TalentoByRestaurant } from "./talento-by-restaurant";
import { TalentoFeaturedComments } from "./talento-featured-comments";
import { TalentoFeaturedEmployees } from "./talento-featured-employees";
import { TalentoHeader } from "./talento-header";
import { TalentoImprovement } from "./talento-improvement";
import { TalentoSummaryBar } from "./talento-summary";
import { TalentoTrends } from "./talento-trends";
import { skeletonBlock } from "./ui/talento-styles";

const TENANT_ID = "grupo-hambar";

const DEFAULT_FILTERS: TalentoFilters = {
  brand: "todas",
  restaurant: "todos",
};

function TalentoSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`h-32 ${skeletonBlock}`} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`h-[420px] ${skeletonBlock}`} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className={`h-80 ${skeletonBlock}`} />
        <div className={`h-80 ${skeletonBlock}`} />
      </div>
    </div>
  );
}

export function TalentoPage() {
  const { range: activeRange } = useDateRange();
  const range = useMemo(() => getSelectedRange(activeRange), [activeRange]);

  const { employees, summaryTrends, loading, error, refetch } = useTalento({
    tenantId: TENANT_ID,
    start: range.start,
    end: range.end,
  });

  const [filters, setFilters] = useState<TalentoFilters>(DEFAULT_FILTERS);

  const restaurantOptions = useMemo(() => {
    const pool =
      filters.brand === "todas"
        ? employees
        : employees.filter((e) => e.brand === filters.brand);
    return getRestaurantOptions(pool);
  }, [employees, filters.brand]);

  const view = useMemo(
    () => buildTalentoPageView(employees, filters, summaryTrends),
    [employees, filters, summaryTrends]
  );

  if (error) {
    return (
      <PageErrorState title="No se pudo cargar Talento" message={error} onRetry={refetch} />
    );
  }

  return (
    <div className="pb-12">
      <TalentoHeader
        filters={filters}
        restaurantOptions={restaurantOptions}
        onFiltersChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
      />

      <TalentoSummaryBar summary={view.summary} trends={view.summaryTrends} loading={loading} />

      {loading ? (
        <TalentoSkeleton />
      ) : view.summary.employeesMentioned === 0 ? (
        <div className="rounded-2xl border border-white/[0.07] bg-[#06050B] px-8 py-24 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.03]">
            <svg className="h-6 w-6 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-[15px] font-medium text-gray-300">Sin menciones de empleados</p>
          <p className="mt-2 text-[13px] text-gray-600">
            Amplía el periodo o revisa que las reseñas incluyan nombres del equipo.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 items-stretch gap-5 xl:grid-cols-3">
            <TalentoFeaturedEmployees employees={view.featuredEmployees} />
            <TalentoImprovement employees={view.improvementOpportunities} />
            <TalentoTrends items={view.trendItems} />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <TalentoFeaturedComments comments={view.featuredComments} />
            <TalentoByRestaurant rows={view.restaurantRows} />
          </div>
        </>
      )}
    </div>
  );
}
