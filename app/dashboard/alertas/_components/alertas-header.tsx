"use client";

import type { BrandId } from "@/app/dashboard/restaurantes/data";
import { brands } from "@/app/dashboard/restaurantes/data";
import { formatDateRangeLabel, useDateRange } from "@/app/dashboard/_components/date-range-context";
import { useDashboardControls } from "@/app/dashboard/_components/dashboard-controls";
import type { AlertFilters } from "@/lib/alerts/types";
import { FilterSelect } from "../../resenas/_components/ui/review-primitives";
import { AlertasBrandRail } from "./alertas-brand-rail";
import { ambientLayer, filterToggle, filterToggleIdle, shellPremiumHeader } from "./ui/alertas-styles";

type RestaurantOption = {
  slug: string;
  name: string;
  brand: BrandId;
};

type AlertasHeaderProps = {
  filters: AlertFilters;
  restaurantList: RestaurantOption[];
  onFiltersChange: (patch: Partial<AlertFilters>) => void;
};

function IconCalendar() {
  return (
    <svg className="h-4 w-4 shrink-0 text-violet-300/90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "critico", label: "Crítico" },
  { value: "seguimiento", label: "Seguimiento" },
  { value: "resuelto", label: "Resuelta" },
];

export function AlertasHeader({ filters, restaurantList, onFiltersChange }: AlertasHeaderProps) {
  const { range } = useDateRange();
  const periodLabel = formatDateRangeLabel(range);
  const { openPanel } = useDashboardControls();

  const restaurantPool =
    filters.brand === "todas"
      ? restaurantList
      : restaurantList.filter((restaurant) => restaurant.brand === filters.brand);

  const restaurantOptions = [
    { value: "todos", label: "Todos los locales" },
    ...restaurantPool.map((restaurant) => ({ value: restaurant.slug, label: restaurant.name })),
  ];

  const selectedBrandLabel =
    filters.brand === "todas"
      ? null
      : (brands.find((brand) => brand.id === filters.brand)?.name ?? filters.brand);

  const selectedRestaurantName =
    filters.restaurant === "todos"
      ? null
      : restaurantPool.find((restaurant) => restaurant.slug === filters.restaurant)?.name ??
        restaurantList.find((restaurant) => restaurant.slug === filters.restaurant)?.name ??
        null;

  const activeStatusLabel = STATUS_OPTIONS.find((option) => option.value === filters.status)?.label;

  return (
    <header className={`${shellPremiumHeader} relative mb-8 overflow-hidden px-6 py-7 lg:px-8 lg:py-8`}>
      <div className={ambientLayer}>
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-violet-600/15 blur-3xl" />
        <div className="absolute -bottom-16 left-1/4 h-40 w-40 rounded-full bg-rose-600/10 blur-3xl" />
      </div>

      <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--nexo-text-tertiary)]">
          Centro de alertas
        </p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-[var(--nexo-text)] lg:text-[32px]">
          Qué requiere atención
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[var(--nexo-text-secondary)]">
          Filtra por marca, local y periodo para ver solo lo que importa ahora.
        </p>

        <div className="mt-8 space-y-5">
          <AlertasBrandRail
            selectedBrand={filters.brand}
            onBrandChange={(brand) => onFiltersChange({ brand, restaurant: "todos" })}
          />

          <div className="rounded-2xl border border-[var(--nexo-border)] bg-[var(--nexo-card)]/80 p-4 shadow-[var(--nexo-shadow-sm)] backdrop-blur-sm lg:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--nexo-text-tertiary)]">
                Filtros activos
              </p>
              <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-[11px] font-medium text-violet-200">
                {periodLabel}
              </span>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <button
                type="button"
                onClick={openPanel}
                className={`${filterToggle} ${filterToggleIdle} min-h-[72px] justify-start gap-3 px-4 py-3.5`}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-500/10">
                  <IconCalendar />
                </span>
                <span className="text-left">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--nexo-text-tertiary)]">
                    Periodo
                  </span>
                  <span className="mt-1 block text-[13px] font-medium text-[var(--nexo-text)]">{periodLabel}</span>
                </span>
              </button>

              <div className="rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)]/70 px-3 py-2.5">
                <FilterSelect
                  label="Local"
                  value={filters.restaurant}
                  defaultValue="todos"
                  options={restaurantOptions}
                  onChange={(restaurant) => onFiltersChange({ restaurant })}
                  compact
                  disabled={restaurantPool.length === 0}
                />
              </div>

              <div className="rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)]/70 px-3 py-2.5">
                <FilterSelect
                  label="Estado"
                  value={filters.status}
                  defaultValue="todos"
                  options={STATUS_OPTIONS}
                  onChange={(status) => onFiltersChange({ status: status as AlertFilters["status"] })}
                  compact
                />
              </div>
            </div>

            <div className="mt-4 border-t border-[var(--nexo-border)] pt-4">
              <p className="text-[13px] text-[var(--nexo-text-secondary)]">
                {selectedRestaurantName ? (
                  <>
                    Mostrando alertas de{" "}
                    <span className="font-medium text-[var(--nexo-text)]">{selectedRestaurantName}</span>
                    {selectedBrandLabel ? (
                      <>
                        {" "}
                        · <span className="text-[var(--nexo-text-tertiary)]">{selectedBrandLabel}</span>
                      </>
                    ) : null}
                    {" "}
                    · <span className="text-[var(--nexo-text-tertiary)]">{periodLabel}</span>
                  </>
                ) : selectedBrandLabel ? (
                  <>
                    Mostrando alertas de{" "}
                    <span className="font-medium text-[var(--nexo-text)]">{selectedBrandLabel}</span>
                    {" "}
                    · <span className="text-[var(--nexo-text-tertiary)]">{periodLabel}</span>
                  </>
                ) : (
                  <>
                    Todas las marcas y locales ·{" "}
                    <span className="font-medium text-[var(--nexo-text)]">{periodLabel}</span>
                    {activeStatusLabel && filters.status !== "todos" ? (
                      <>
                        {" "}
                        · estado <span className="text-[var(--nexo-text)]">{activeStatusLabel}</span>
                      </>
                    ) : null}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
