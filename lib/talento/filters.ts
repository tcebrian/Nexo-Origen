import type { BrandId } from "@/app/dashboard/restaurantes/data";
import { buildTalentoView } from "./build";
import type { EmployeeRecord, TalentoView } from "./types";

export type TalentoFilters = {
  brand: "todas" | BrandId;
  restaurant: "todos" | string;
};

export function filterTalentoEmployees(
  employees: EmployeeRecord[],
  filters: TalentoFilters
): EmployeeRecord[] {
  return employees.filter((e) => {
    if (filters.brand !== "todas" && e.brand !== filters.brand) return false;
    if (filters.restaurant !== "todos" && e.restaurantSlug !== filters.restaurant) return false;
    return true;
  });
}

export function getRestaurantOptions(employees: EmployeeRecord[]) {
  const seen = new Map<string, string>();
  for (const e of employees) {
    if (!seen.has(e.restaurantSlug)) seen.set(e.restaurantSlug, e.restaurant);
  }
  return [...seen.entries()].map(([slug, name]) => ({ slug, name }));
}

export function buildTalentoPageView(
  employees: EmployeeRecord[],
  filters: TalentoFilters,
  summaryTrends?: TalentoView["summaryTrends"]
): TalentoView {
  const filtered = filterTalentoEmployees(employees, filters);
  return buildTalentoView(filtered, summaryTrends);
}
