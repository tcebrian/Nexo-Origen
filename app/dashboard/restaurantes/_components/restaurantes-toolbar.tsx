"use client";

import type { RestaurantFilters } from "@/lib/restaurants/types";
import { inputField, selectField, filterLabel, shell } from "./ui/restaurantes-styles";

const STATUS_OPTIONS: { value: RestaurantFilters["status"]; label: string }[] = [
  { value: "todos", label: "Todos los estados" },
  { value: "on_target", label: "En objetivo" },
  { value: "watch", label: "Vigilancia" },
  { value: "critical", label: "Crítico" },
];

const SORT_OPTIONS: { value: RestaurantFilters["sort"]; label: string }[] = [
  { value: "risk", label: "Mayor riesgo" },
  { value: "alerts-desc", label: "Más alertas" },
  { value: "media-desc", label: "Mejor media" },
  { value: "media-asc", label: "Peor media" },
  { value: "name-asc", label: "Nombre A-Z" },
];

type RestaurantesToolbarProps = {
  filters: RestaurantFilters;
  resultCount: number;
  onStatusChange: (status: RestaurantFilters["status"]) => void;
  onSearchChange: (search: string) => void;
  onSortChange: (sort: RestaurantFilters["sort"]) => void;
};

function IconSearch() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

export function RestaurantesToolbar({
  filters,
  resultCount,
  onStatusChange,
  onSearchChange,
  onSortChange,
}: RestaurantesToolbarProps) {
  return (
    <div className={`${shell} mb-6 flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-end lg:px-6`}>
      <label className="block min-w-0 flex-1">
        <span className={filterLabel}>Buscar restaurante</span>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--nexo-text-tertiary)]">
            <IconSearch />
          </span>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Nombre o ubicación..."
            className={`${inputField} pl-10`}
          />
        </div>
      </label>

      <label className="block w-full lg:w-44">
        <span className={filterLabel}>Estado</span>
        <select
          value={filters.status}
          onChange={(e) => onStatusChange(e.target.value as RestaurantFilters["status"])}
          className={selectField}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block w-full lg:w-48">
        <span className={filterLabel}>Ordenar</span>
        <select
          value={filters.sort}
          onChange={(e) => onSortChange(e.target.value as RestaurantFilters["sort"])}
          className={selectField}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex h-10 items-center rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)] px-4 text-[11px] text-[var(--nexo-text-tertiary)] lg:shrink-0">
        <span className="font-medium text-[var(--nexo-text)]">{resultCount}</span>
        <span className="ml-1.5">visibles</span>
      </div>
    </div>
  );
}
