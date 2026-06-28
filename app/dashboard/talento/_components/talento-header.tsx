"use client";

import { formatDateRangeLabel, useDateRange } from "@/app/dashboard/_components/date-range-context";
import { useDashboardControls } from "@/app/dashboard/_components/dashboard-controls";
import type { TalentoFilters } from "@/lib/talento/filters";
import { FilterSelect } from "../../resenas/_components/ui/review-primitives";
import {
  ambientLayer,
  btnPrimary,
  filterToggle,
  filterToggleIdle,
  shellPremiumHeader,
} from "./ui/talento-styles";

type TalentoHeaderProps = {
  filters: TalentoFilters;
  restaurantOptions: { slug: string; name: string }[];
  onFiltersChange: (patch: Partial<TalentoFilters>) => void;
};

function IconCalendar() {
  return (
    <svg className="h-4 w-4 shrink-0 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

function IconExport() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 3v12M8 11l4 4 4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TalentoHeader({ filters, restaurantOptions, onFiltersChange }: TalentoHeaderProps) {
  const { range } = useDateRange();
  const periodLabel = formatDateRangeLabel(range);
  const { openPanel } = useDashboardControls();

  const restaurantSelectOptions = [
    { value: "todos", label: "Todos los locales" },
    ...restaurantOptions.map((r) => ({ value: r.slug, label: r.name })),
  ];

  return (
    <header className={`${shellPremiumHeader} relative mb-8 overflow-hidden px-6 py-8 lg:px-9 lg:py-10`}>
      <div className={ambientLayer}>
        <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-violet-600/[0.07] blur-3xl" />
        <div className="absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-indigo-500/[0.05] blur-3xl" />
      </div>

      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/50">
            Reputación · Equipo
          </p>
          <h1 className="mt-2 text-[30px] font-light tracking-tight text-white lg:text-[34px]">
            Talento
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-gray-400">
            Descubre qué empleados generan impacto en la experiencia de tus clientes.
          </p>
        </div>

        <div className="flex w-full flex-col gap-4 lg:max-w-3xl">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
          <FilterSelect
            label="Local"
            value={filters.restaurant}
            defaultValue="todos"
            options={restaurantSelectOptions}
            onChange={(restaurant) => onFiltersChange({ restaurant })}
            compact
          />
          <button
            type="button"
            onClick={openPanel}
            className={`${filterToggle} ${filterToggleIdle} gap-2.5`}
          >
            <IconCalendar />
            <span className="text-left">
              <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-gray-600">
                Periodo
              </span>
              <span className="mt-0.5 block text-[12px] text-gray-200">{periodLabel}</span>
            </span>
          </button>
          <button type="button" className={`${btnPrimary} gap-2 px-4`}>
            <IconExport />
            Exportar
          </button>
          </div>
        </div>
      </div>
    </header>
  );
}
