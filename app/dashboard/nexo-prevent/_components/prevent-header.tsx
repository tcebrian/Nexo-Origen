"use client";

import type { BrandId } from "@/app/dashboard/restaurantes/data";
import { brands } from "@/app/dashboard/restaurantes/data";
import { formatDateRangeLabel, useDateRange } from "@/app/dashboard/_components/date-range-context";
import { useDashboardControls } from "@/app/dashboard/_components/dashboard-controls";
import type { PreventFilters } from "@/lib/prevent/filters";
import { PreventBrandRail } from "./prevent-brand-rail";
import { ambientLayer, filterToggle, filterToggleIdle, shellPremiumHeader } from "./ui/prevent-styles";

type PreventHeaderProps = {
  filters: PreventFilters;
  sourceBrands: readonly BrandId[];
  onFiltersChange: (patch: Partial<PreventFilters>) => void;
};

function IconCalendar() {
  return (
    <svg className="h-4 w-4 shrink-0 text-violet-300/90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg className="h-7 w-7 text-violet-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 3l8 3v6c0 5.2-3.4 9.9-8 11-4.6-1.1-8-5.8-8-11V6l8-3z" strokeLinejoin="round" />
    </svg>
  );
}

export function PreventHeader({ filters, sourceBrands, onFiltersChange }: PreventHeaderProps) {
  const { range } = useDateRange();
  const periodLabel = formatDateRangeLabel(range);
  const { openPanel } = useDashboardControls();

  const selectedBrandLabel =
    filters.brand === "todas"
      ? null
      : (brands.find((brand) => brand.id === filters.brand)?.name ?? filters.brand);

  return (
    <header className={`${shellPremiumHeader} relative mb-8 overflow-hidden px-6 py-7 lg:px-8 lg:py-8`}>
      <div className={ambientLayer}>
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-fuchsia-600/10 blur-3xl" />
      </div>

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200/70">
            Reputation intelligence · prevención semanal
          </p>
          <h1 className="mt-3 flex items-center gap-3 text-[30px] font-semibold tracking-tight text-white lg:text-[34px]">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/15 shadow-[0_0_32px_rgba(124,58,237,0.25)]">
              <IconShield />
            </span>
            Nexo Prevent
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--nexo-text-secondary)]">
            Protegemos la reputación de tus restaurantes semana a semana. Calculamos cuántas reseñas positivas hacen
            falta para volver al objetivo y cuántas negativas puede absorber cada local.
          </p>
        </div>

        <button
          type="button"
          onClick={openPanel}
          className={`${filterToggle} ${filterToggleIdle} shrink-0 gap-3 self-start px-4 py-3 lg:self-auto`}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-500/10">
            <IconCalendar />
          </span>
          <span className="text-left">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--nexo-text-tertiary)]">
              Periodo activo
            </span>
            <span className="mt-1 block text-[13px] font-medium text-[var(--nexo-text)]">{periodLabel}</span>
          </span>
        </button>
      </div>

      <div className="relative mt-8 rounded-2xl border border-[var(--nexo-border)] bg-[var(--nexo-card)]/80 px-4 py-4 backdrop-blur-sm lg:px-5 lg:py-5">
        <PreventBrandRail
          selectedBrand={filters.brand}
          sourceBrands={sourceBrands}
          onBrandChange={(brand) => onFiltersChange({ brand })}
        />
        <p className="mt-3 border-t border-[var(--nexo-border)] pt-3 text-[13px] text-[var(--nexo-text-secondary)]">
          {selectedBrandLabel ? (
            <>
              Mostrando datos de{" "}
              <span className="font-medium text-[var(--nexo-text)]">{selectedBrandLabel}</span>
              {" · "}
              <span className="text-[var(--nexo-text-tertiary)]">{periodLabel}</span>
            </>
          ) : (
            <>
              Todas las marcas del periodo{" "}
              <span className="text-[var(--nexo-text-tertiary)]">· {periodLabel}</span>
            </>
          )}
        </p>
      </div>
    </header>
  );
}
