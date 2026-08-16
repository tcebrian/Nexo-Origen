"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReviewFilters } from "@/lib/reviews/types";

export const DEFAULT_REVIEW_FILTERS: ReviewFilters = {
  brand: "todas",
  restaurant: "todos",
  stars: "todas",
  negativesOnly: false,
  unreviewedOnly: false,
  query: "",
};

export type SummaryFilter = "all" | "positives" | "negatives" | "unreviewed";

type ReviewFiltersContextValue = {
  filters: ReviewFilters;
  setFilters: (patch: Partial<ReviewFilters>) => void;
  summaryFilter: SummaryFilter;
  setSummaryFilter: (filter: SummaryFilter) => void;
  /** Scroll de la lista al salir hacia el detalle de una reseña — en un ref (no
   * dispara render en cada píxel), para restaurarlo al volver. */
  getListScrollTop: () => number;
  setListScrollTop: (value: number) => void;
};

const ReviewFiltersContext = createContext<ReviewFiltersContextValue | null>(null);

/**
 * Filtros de la bandeja de Reseñas, en un contexto de sección (provisto en
 * app/dashboard/resenas/layout.tsx) en vez de estado local de la página de listado.
 * Al vivir en el layout, sobreviven a navegar lista → detalle de una reseña → atrás
 * (el layout no se desmonta entre esas dos rutas), pero se pierden al salir de
 * /dashboard/resenas a otra sección o al recargar la página (el layout sí se
 * desmonta/remonta en esos casos) — a propósito, sin sessionStorage.
 */
export function ReviewFiltersProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFiltersState] = useState<ReviewFilters>(DEFAULT_REVIEW_FILTERS);
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>("all");
  const listScrollTop = useRef(0);

  const setFilters = useCallback((patch: Partial<ReviewFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
    setSummaryFilter("all");
  }, []);

  const getListScrollTop = useCallback(() => listScrollTop.current, []);
  const setListScrollTop = useCallback((value: number) => {
    listScrollTop.current = value;
  }, []);

  const value = useMemo(
    () => ({ filters, setFilters, summaryFilter, setSummaryFilter, getListScrollTop, setListScrollTop }),
    [filters, setFilters, summaryFilter, getListScrollTop, setListScrollTop]
  );

  return <ReviewFiltersContext.Provider value={value}>{children}</ReviewFiltersContext.Provider>;
}

export function useReviewFilters() {
  const context = useContext(ReviewFiltersContext);
  if (!context) {
    throw new Error("useReviewFilters must be used within ReviewFiltersProvider");
  }
  return context;
}
