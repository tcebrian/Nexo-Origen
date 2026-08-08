"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateRangeLabel, getSelectedRange, useDateRange } from "../../_components/date-range-context";
import { useAuth } from "../../_components/auth-context";
import { useDashboardControls } from "../../_components/dashboard-controls";
import { applyRestaurantFilters } from "@/lib/restaurants/filters";
import { getNetworkSummary } from "@/lib/restaurants/metrics";
import type { RestaurantFilters } from "@/lib/restaurants/types";
import { tenant } from "../../tenant";
import { useRestaurants } from "../_hooks/use-restaurants";
import { RestaurantesBrandRail } from "./restaurantes-brand-rail";
import { RestaurantesCard } from "./restaurantes-card";
import { RestaurantesStatusSummary } from "./restaurantes-status-summary";
import { RestaurantesTable } from "./restaurantes-table";
import { RestaurantesToolbar } from "./restaurantes-toolbar";
import { shell } from "./ui/restaurantes-styles";

const TENANT_ID = "grupo-hambar";

function IconCalendar() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

export function RestaurantesPage() {
  const router = useRouter();
  const { isRestaurantUser, primaryRestaurant } = useAuth();
  const { range: activeRange } = useDateRange();
  const range = useMemo(() => getSelectedRange(activeRange), [activeRange]);
  const periodLabel = formatDateRangeLabel(activeRange);
  const { openPanel } = useDashboardControls();

  const { restaurants: operationalList, loading, error, refetch } = useRestaurants({
    tenantId: TENANT_ID,
    start: range.start,
    end: range.end,
  });

  const [filters, setFilters] = useState<RestaurantFilters>({
    company: tenant.name,
    brand: "todas",
    status: "todos",
    search: "",
    sort: "risk",
  });

  useEffect(() => {
    if (!isRestaurantUser) return;
    if (primaryRestaurant) {
      router.replace(`/dashboard/restaurantes/${primaryRestaurant.slug}`);
    } else {
      router.replace("/dashboard");
    }
  }, [isRestaurantUser, primaryRestaurant, router]);

  const filtered = useMemo(
    () => applyRestaurantFilters(operationalList, filters),
    [operationalList, filters]
  );

  const summary = useMemo(() => getNetworkSummary(filtered), [filtered]);

  const sourceBrands = useMemo(
    () => [...new Set(operationalList.map((restaurant) => restaurant.brand))],
    [operationalList]
  );

  if (isRestaurantUser) return null;

  if (error) {
    return (
      <div className={`flex min-h-[420px] flex-col items-center justify-center ${shell} p-10 text-center`}>
        <p className="text-[13px] font-medium text-[var(--nexo-critical)]">No se pudieron cargar los restaurantes</p>
        <p className="mt-2 max-w-md text-[12px] text-[var(--nexo-text-secondary)]">{error}</p>
        <button
          type="button"
          onClick={refetch}
          className="mt-5 rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)] px-4 py-2 text-[11px] text-[var(--nexo-text)]"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] pb-12">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--nexo-text)]">
            Restaurantes
          </h1>
          <p className="mt-2 text-[13px] text-[var(--nexo-text-secondary)]">
            Estado operativo por marca y local.
          </p>
        </div>

        <button
          type="button"
          onClick={openPanel}
          className="inline-flex h-10 shrink-0 items-center gap-2.5 rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-4 text-[12px] text-[var(--nexo-text-secondary)] transition hover:border-[var(--nexo-border-strong)] hover:text-[var(--nexo-text)]"
        >
          <IconCalendar />
          <span>{periodLabel}</span>
        </button>
      </header>

      {loading ? (
        <div className="space-y-8">
          <div className="h-24 animate-pulse rounded-2xl border border-[var(--nexo-border)] bg-[var(--nexo-card)]" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-2xl border border-[var(--nexo-border)] bg-[var(--nexo-card)]"
              />
            ))}
          </div>
          <div className="h-[480px] animate-pulse rounded-2xl border border-[var(--nexo-border)] bg-[var(--nexo-card)]" />
        </div>
      ) : (
        <>
          <RestaurantesBrandRail
            selectedBrand={filters.brand}
            onBrandChange={(brand) => setFilters((f) => ({ ...f, brand }))}
            sourceBrands={sourceBrands}
          />

          <RestaurantesStatusSummary summary={summary} />

          <RestaurantesToolbar
            filters={filters}
            resultCount={filtered.length}
            onStatusChange={(status) => setFilters((f) => ({ ...f, status }))}
            onSearchChange={(search) => setFilters((f) => ({ ...f, search }))}
            onSortChange={(sort) => setFilters((f) => ({ ...f, sort }))}
          />

          <section>
            {filtered.length === 0 ? (
              <div className={`flex flex-col items-center justify-center px-6 py-24 text-center ${shell}`}>
                <p className="text-sm font-medium text-[var(--nexo-text)]">Sin restaurantes en esta selección</p>
                <p className="mt-2 max-w-sm text-[13px] text-[var(--nexo-text-secondary)]">
                  Prueba otra marca en el selector superior.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3 lg:hidden">
                  {filtered.map((restaurant) => (
                    <RestaurantesCard key={restaurant.id} restaurant={restaurant} />
                  ))}
                </div>
                <div className="hidden lg:block">
                  <RestaurantesTable restaurants={filtered} />
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
