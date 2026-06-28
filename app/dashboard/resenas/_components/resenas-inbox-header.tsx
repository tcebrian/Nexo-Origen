"use client";

import type { BrandId } from "@/app/dashboard/restaurantes/data";
import { brands } from "@/app/dashboard/restaurantes/data";
import { formatDateRangeLabel, useDateRange } from "@/app/dashboard/_components/date-range-context";
import { useDashboardControls } from "@/app/dashboard/_components/dashboard-controls";
import type { ReviewFilters } from "@/lib/reviews/types";
import { ResenasBrandRail } from "./resenas-brand-rail";
import { FilterSelect } from "./ui/review-primitives";
import {
  ambientLayer,
  filterToggle,
  filterToggleActive,
  filterToggleIdle,
  inputField,
  shellPremiumHeader,
} from "./ui/resenas-styles";

type RestaurantOption = {
  name: string;
  slug: string;
  brand: BrandId;
};

type ResenasInboxHeaderProps = {
  filters: ReviewFilters;
  onFiltersChange: (patch: Partial<ReviewFilters>) => void;
  restaurantList?: RestaurantOption[];
  exporting?: boolean;
  onExport?: () => void;
};

function IconCalendar() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg className="h-4 w-4 text-[var(--nexo-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" strokeLinecap="round" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 3v12M7 10l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 21h14" strokeLinecap="round" />
    </svg>
  );
}

export function ResenasInboxHeader({
  filters,
  onFiltersChange,
  restaurantList = [],
  exporting = false,
  onExport,
}: ResenasInboxHeaderProps) {
  const { range } = useDateRange();
  const periodLabel = formatDateRangeLabel(range);
  const { openPanel } = useDashboardControls();

  const restaurantPool =
    filters.brand === "todas"
      ? restaurantList
      : restaurantList.filter((restaurant) => restaurant.brand === filters.brand);

  const restaurantOptions = [
    { value: "todos", label: "Todos los restaurantes" },
    ...restaurantPool.map((restaurant) => ({ value: restaurant.slug, label: restaurant.name })),
  ];

  const selectedRestaurantName =
    filters.restaurant === "todos"
      ? null
      : restaurantPool.find((restaurant) => restaurant.slug === filters.restaurant)?.name ??
        restaurantList.find((restaurant) => restaurant.slug === filters.restaurant)?.name ??
        null;

  const selectedBrandLabel =
    filters.brand === "todas"
      ? null
      : (brands.find((brand) => brand.id === filters.brand)?.name ?? filters.brand);

  const starOptions = [
    { value: "todas", label: "Todas" },
    ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} estrella${n === 1 ? "" : "s"}` })),
  ];

  return (
    <header className={`${shellPremiumHeader} mb-8 px-6 py-7 lg:px-8 lg:py-8`}>
      <div className={ambientLayer}>
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-violet-600/15 blur-3xl" />
        <div className="absolute -bottom-16 left-1/4 h-40 w-40 rounded-full bg-rose-600/10 blur-3xl" />
      </div>

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--nexo-text-tertiary)]">
            ¿Qué opiniones requieren revisión?
          </p>
          <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-[var(--nexo-text)] lg:text-[32px]">
            Bandeja de reseñas
          </h1>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[var(--nexo-text-secondary)]">
            Opiniones priorizadas por motivo, urgencia y acción recomendada.
          </p>
        </div>

        {onExport && (
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-4 py-2.5 text-[12px] font-medium text-[var(--nexo-text-secondary)] transition hover:border-[var(--nexo-border-strong)] hover:text-[var(--nexo-text)] disabled:opacity-40 lg:self-auto"
          >
            <IconDownload />
            {exporting ? "Exportando…" : "Exportar Excel"}
          </button>
        )}
      </div>

      <div className="relative mt-8 space-y-5">
        <ResenasBrandRail
          selectedBrand={filters.brand}
          onBrandChange={(brand) => onFiltersChange({ brand, restaurant: "todos" })}
          sourceBrands={restaurantList.map((restaurant) => restaurant.brand)}
        />

        <div className="rounded-2xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)]/60 px-4 py-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--nexo-text-tertiary)]">
            Restaurante
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-[220px] flex-1 sm:max-w-md">
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
            {selectedRestaurantName ? (
              <p className="text-[13px] text-[var(--nexo-text-secondary)]">
                Mostrando reseñas de{" "}
                <span className="font-medium text-[var(--nexo-text)]">{selectedRestaurantName}</span>
                {selectedBrandLabel ? (
                  <>
                    {" "}
                    · <span className="text-[var(--nexo-text-tertiary)]">{selectedBrandLabel}</span>
                  </>
                ) : null}
              </p>
            ) : selectedBrandLabel ? (
              <p className="text-[13px] text-[var(--nexo-text-secondary)]">
                Mostrando reseñas de{" "}
                <span className="font-medium text-[var(--nexo-text)]">{selectedBrandLabel}</span>
              </p>
            ) : (
              <p className="text-[13px] text-[var(--nexo-text-tertiary)]">
                Todas las marcas y restaurantes del periodo
              </p>
            )}
          </div>
        </div>

        <div className="relative max-w-lg">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
            <IconSearch />
          </span>
          <input
            type="search"
            value={filters.query}
            onChange={(e) => onFiltersChange({ query: e.target.value })}
            placeholder="Buscar por autor, local o comentario…"
            className={inputField}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-center">
          <button
            type="button"
            onClick={openPanel}
            className={`${filterToggle} ${filterToggleIdle} gap-2`}
          >
            <IconCalendar />
            <span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--nexo-text-tertiary)]">
                Fecha
              </span>
              <span className="mt-0.5 block text-[12px] text-[var(--nexo-text)]">{periodLabel}</span>
            </span>
          </button>
          <FilterSelect
            label="Estrellas"
            value={filters.stars}
            defaultValue="todas"
            options={starOptions}
            onChange={(stars) => onFiltersChange({ stars })}
            compact
          />
          <button
            type="button"
            onClick={() => onFiltersChange({ negativesOnly: !filters.negativesOnly })}
            className={`${filterToggle} ${filters.negativesOnly ? filterToggleActive : filterToggleIdle}`}
          >
            Solo negativas
          </button>
          <button
            type="button"
            onClick={() => onFiltersChange({ unreviewedOnly: !filters.unreviewedOnly })}
            className={`${filterToggle} ${filters.unreviewedOnly ? filterToggleActive : filterToggleIdle}`}
          >
            Solo sin revisar
          </button>
        </div>
      </div>
    </header>
  );
}
