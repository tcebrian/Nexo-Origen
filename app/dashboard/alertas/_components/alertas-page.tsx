"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BrandId } from "@/app/dashboard/restaurantes/data";
import { brands } from "@/app/dashboard/restaurantes/data";
import { formatDateRangeLabel, getSelectedRange, useDateRange } from "../../_components/date-range-context";
import { useRestaurants } from "@/app/dashboard/restaurantes/_hooks/use-restaurants";
import {
  filterAlerts,
  filterAlertsByPeriod,
  getAlertKpis,
  getRestaurantHotspots,
  getRiskRadarAlerts,
  getTopPriorityAlert,
  getUrgentAlerts,
} from "@/lib/alerts/filters";
import type { AlertFilters } from "@/lib/alerts/types";
import { useAlerts } from "../_hooks/use-alerts";
import { PageErrorState } from "../../_components/page-error-state";
import { skeletonBlock } from "../../_components/ui/nexo-styles";
import { AlertasDetailPanel } from "./alertas-detail-panel";
import { AlertasExecutiveSnapshot, type AlertSummaryFilter } from "./alertas-executive-snapshot";
import { AlertasHeader } from "./alertas-header";
import { AlertasHotspots } from "./alertas-hotspots";
import { AlertasInbox } from "./alertas-inbox";
import { AlertasPriorityHero } from "./alertas-priority-hero";
import { shellWorkspace, workspaceGrid } from "./ui/alertas-styles";

const TENANT_ID = "grupo-hambar";

const DEFAULT_FILTERS: AlertFilters = {
  brand: "todas",
  status: "todos",
  restaurant: "todos",
};

function matchesSummaryFilter(alert: { status: string }, summaryFilter: AlertSummaryFilter) {
  if (summaryFilter === "critico") return alert.status === "critico";
  if (summaryFilter === "seguimiento") return alert.status === "seguimiento";
  if (summaryFilter === "open" || summaryFilter === "restaurants") {
    return alert.status === "critico" || alert.status === "seguimiento";
  }
  return true;
}

export function AlertasPage() {
  const { range: activeRange } = useDateRange();
  const range = useMemo(() => getSelectedRange(activeRange), [activeRange]);
  const periodLabel = formatDateRangeLabel(activeRange);

  const { alerts, resolvedThisWeek, loading, error, refetch, resolveAlert } = useAlerts({
    tenantId: TENANT_ID,
    start: range.start,
    end: range.end,
  });

  const { restaurants: operationalRestaurants } = useRestaurants({
    tenantId: TENANT_ID,
    start: range.start,
    end: range.end,
  });

  const [filters, setFilters] = useState<AlertFilters>(DEFAULT_FILTERS);
  const [summaryFilter, setSummaryFilter] = useState<AlertSummaryFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const didInitSelection = useRef(false);

  const periodAlerts = useMemo(
    () => filterAlertsByPeriod(alerts, range.start, range.end),
    [alerts, range.start, range.end]
  );

  const scopedAlerts = useMemo(
    () =>
      filterAlerts(periodAlerts, {
        brand: filters.brand,
        status: "todos",
        restaurant: filters.restaurant,
      }),
    [periodAlerts, filters.brand, filters.restaurant]
  );

  const filteredAlerts = useMemo(() => {
    const base = filterAlerts(periodAlerts, filters);
    if (summaryFilter === "all") return base;
    return base.filter((alert) => matchesSummaryFilter(alert, summaryFilter));
  }, [periodAlerts, filters, summaryFilter]);

  const restaurantList = useMemo(
    () =>
      operationalRestaurants.map((restaurant) => ({
        name: restaurant.name,
        slug: restaurant.slug,
        brand: restaurant.brand as BrandId,
      })),
    [operationalRestaurants]
  );

  const restaurantPool = useMemo(
    () =>
      filters.brand === "todas"
        ? restaurantList
        : restaurantList.filter((restaurant) => restaurant.brand === filters.brand),
    [restaurantList, filters.brand]
  );

  const selectedBrandLabel =
    filters.brand === "todas"
      ? null
      : (brands.find((brand) => brand.id === filters.brand)?.name ?? filters.brand);

  const selectedRestaurantName =
    filters.restaurant === "todos"
      ? null
      : restaurantPool.find((restaurant) => restaurant.slug === filters.restaurant)?.name ?? null;

  const inboxAlerts = useMemo(() => getRiskRadarAlerts(filteredAlerts), [filteredAlerts]);
  const priorityAlert = useMemo(() => getTopPriorityAlert(scopedAlerts), [scopedAlerts]);
  const hotspots = useMemo(() => getRestaurantHotspots(scopedAlerts), [scopedAlerts]);

  const kpis = useMemo(
    () => getAlertKpis(scopedAlerts, resolvedThisWeek),
    [scopedAlerts, resolvedThisWeek]
  );

  const selectedAlert = useMemo(
    () => periodAlerts.find((alert) => alert.id === selectedId) ?? null,
    [periodAlerts, selectedId]
  );

  useEffect(() => {
    setFilters(DEFAULT_FILTERS);
    setSummaryFilter("all");
    setSelectedId(null);
    didInitSelection.current = false;
  }, [range.start, range.end]);

  useEffect(() => {
    if (loading || didInitSelection.current) return;

    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    const firstUrgent = getUrgentAlerts(filteredAlerts)[0];
    if (isDesktop && firstUrgent && (!selectedId || !filteredAlerts.some((alert) => alert.id === selectedId))) {
      setSelectedId(firstUrgent.id);
    }

    didInitSelection.current = true;
  }, [loading, filteredAlerts, selectedId]);

  useEffect(() => {
    if (selectedId && !filteredAlerts.some((alert) => alert.id === selectedId)) {
      setSelectedId(filteredAlerts[0]?.id ?? null);
    }
  }, [filteredAlerts, selectedId]);

  function handleFiltersChange(patch: Partial<AlertFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    if (patch.status !== undefined || patch.brand !== undefined || patch.restaurant !== undefined) {
      setSummaryFilter("all");
    }
  }

  function handleSummaryFilter(filter: AlertSummaryFilter) {
    setSummaryFilter((prev) => (prev === filter ? "all" : filter));
    if (filter === "critico" || filter === "seguimiento") {
      setFilters((prev) => ({ ...prev, status: filter }));
    } else if (filter === "open" || filter === "restaurants") {
      setFilters((prev) => ({ ...prev, status: "todos", restaurant: "todos" }));
    }
  }

  function handleSelect(id: string) {
    setSelectedId(id);
    const isDesktop = typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
    if (!isDesktop) setMobileDetailOpen(true);
  }

  function handleResolve(id: string) {
    resolveAlert(id);
    const updated = periodAlerts.map((alert) =>
      alert.id === id
        ? { ...alert, status: "resuelto" as const, activeAlerts: 0, resolvedAt: new Date() }
        : alert
    );
    const next = getUrgentAlerts(filterAlerts(updated, filters))[0];
    setSelectedId(next?.id ?? null);
  }

  if (error) {
    return (
      <PageErrorState
        title="No se pudieron cargar las alertas"
        message={error}
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="pb-10">
      <AlertasHeader
        filters={filters}
        restaurantList={restaurantList}
        onFiltersChange={handleFiltersChange}
      />

      <AlertasExecutiveSnapshot
        kpis={kpis}
        periodLabel={periodLabel}
        brandLabel={selectedBrandLabel}
        restaurantLabel={selectedRestaurantName}
        loading={loading}
        activeFilter={summaryFilter}
        onFilter={handleSummaryFilter}
      />

      {!loading && priorityAlert ? (
        <AlertasPriorityHero alert={priorityAlert} onSelect={handleSelect} />
      ) : null}

      {!loading ? (
        <AlertasHotspots
          hotspots={hotspots}
          activeRestaurant={filters.restaurant === "todos" ? undefined : filters.restaurant}
          onSelectRestaurant={(slug) =>
            handleFiltersChange({ restaurant: filters.restaurant === slug ? "todos" : slug })
          }
        />
      ) : null}

      <div className={`${shellWorkspace} ${workspaceGrid}`}>
        <div className="relative min-h-[520px] overflow-y-auto border-b border-[var(--nexo-border)] lg:border-b-0">
          {loading ? (
            <div className="space-y-4 p-6">
              <div className={`h-48 ${skeletonBlock}`} />
              <div className={`h-64 ${skeletonBlock}`} />
            </div>
          ) : (
            <AlertasInbox alerts={inboxAlerts} selectedId={selectedId} onSelect={handleSelect} />
          )}
        </div>

        <aside className="relative hidden min-h-[520px] overflow-hidden border-l border-[var(--nexo-border)] lg:block">
          <AlertasDetailPanel alert={selectedAlert} onResolve={handleResolve} />
        </aside>
      </div>

      {!loading && selectedAlert && mobileDetailOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar detalle"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileDetailOpen(false)}
          />
          <div className={`absolute inset-x-3 bottom-3 flex h-[min(88svh,720px)] flex-col overflow-hidden ${shellWorkspace}`}>
            <AlertasDetailPanel
              alert={selectedAlert}
              onResolve={handleResolve}
              onClose={() => setMobileDetailOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
