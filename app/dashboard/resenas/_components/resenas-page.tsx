"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDateRangeLabel, getSelectedRange, useDateRange } from "../../_components/date-range-context";
import { tenant } from "../../tenant";
import { exportReviewsToExcel } from "@/lib/reviews/export-excel";
import { filterReviews, getReviewStats, sortReviewsByPriority } from "@/lib/reviews/filters";
import type { ReviewFilters } from "@/lib/reviews/types";
import { useRestaurants } from "@/app/dashboard/restaurantes/_hooks/use-restaurants";
import { useReviewAi } from "../_hooks/use-review-ai";
import { useReviews } from "../_hooks/use-reviews";
import { PageErrorState } from "../../_components/page-error-state";
import { ResenasInboxHeader } from "./resenas-inbox-header";
import { ResenasInboxList } from "./resenas-inbox-list";
import { ResenasSummary } from "./resenas-summary";
import { ambientLayer, inboxGrid, inboxShell } from "./ui/resenas-styles";

const TENANT_ID = "grupo-hambar";

const DEFAULT_FILTERS: ReviewFilters = {
  brand: "todas",
  restaurant: "todos",
  stars: "todas",
  negativesOnly: false,
  unreviewedOnly: false,
  query: "",
};

type SummaryFilter = "all" | "positives" | "negatives" | "unreviewed";

export function ResenasPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { range: activeRange } = useDateRange();
  const range = useMemo(() => getSelectedRange(activeRange), [activeRange]);
  const periodLabel = formatDateRangeLabel(activeRange);

  const { reviews: baseReviews, loading, error, refetch } = useReviews({
    tenantId: TENANT_ID,
    start: range.start,
    end: range.end,
  });

  const { restaurants: operationalRestaurants } = useRestaurants({
    tenantId: TENANT_ID,
    start: range.start,
    end: range.end,
  });

  const restaurantList = useMemo(
    () =>
      operationalRestaurants.map((restaurant) => ({
        name: restaurant.name,
        brand: restaurant.brand,
        slug: restaurant.slug,
      })),
    [operationalRestaurants]
  );

  const { mergeReviews } = useReviewAi();
  const mergedReviews = useMemo(() => mergeReviews(baseReviews), [baseReviews, mergeReviews]);

  const [filters, setFilters] = useState<ReviewFilters>(DEFAULT_FILTERS);
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>("all");
  const [exporting, setExporting] = useState(false);
  const didInitParams = useRef(false);

  const allReviews = mergedReviews;

  const scopedReviews = useMemo(
    () =>
      filterReviews(allReviews, {
        ...DEFAULT_FILTERS,
        brand: filters.brand,
        restaurant: filters.restaurant,
      }),
    [allReviews, filters.brand, filters.restaurant]
  );

  const effectiveFilters = useMemo(() => {
    if (summaryFilter === "negatives") return { ...filters, negativesOnly: true, unreviewedOnly: false };
    if (summaryFilter === "unreviewed") return { ...filters, unreviewedOnly: true, negativesOnly: false };
    if (summaryFilter === "positives") {
      return { ...filters, negativesOnly: false, unreviewedOnly: false };
    }
    return filters;
  }, [filters, summaryFilter]);

  const filteredReviews = useMemo(() => {
    let filtered = filterReviews(allReviews, effectiveFilters);
    if (summaryFilter === "positives") {
      filtered = filtered.filter((r) => r.sentiment === "positiva");
    }
    return sortReviewsByPriority(filtered);
  }, [allReviews, effectiveFilters, summaryFilter]);

  const stats = useMemo(() => getReviewStats(scopedReviews), [scopedReviews]);

  useEffect(() => {
    if (didInitParams.current || loading) return;

    const localSlug = searchParams.get("local");
    const reviewId = searchParams.get("review");

    if (reviewId) {
      router.replace(`/dashboard/resenas/${reviewId}`);
      return;
    }

    if (localSlug) {
      const match = allReviews.find((review) => review.restaurantSlug === localSlug);
      if (match) {
        setFilters((prev) => ({
          ...prev,
          brand: match.brand,
          restaurant: match.restaurantSlug,
        }));
      }
    }

    didInitParams.current = true;
  }, [loading, searchParams, allReviews, router]);

  useEffect(() => {
    didInitParams.current = false;
  }, [range.start, range.end]);

  function handleFiltersChange(patch: Partial<ReviewFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setSummaryFilter("all");
  }

  function handleSummaryFilter(filter: SummaryFilter) {
    setSummaryFilter((prev) => (prev === filter ? "all" : filter));
  }

  async function handleExport() {
    if (exporting || filteredReviews.length === 0) return;

    setExporting(true);
    try {
      await exportReviewsToExcel({
        reviews: filteredReviews,
        stats,
        tenantName: tenant.name,
        periodLabel,
      });
    } finally {
      setExporting(false);
    }
  }

  if (error) {
    return (
      <PageErrorState
        title="No se pudieron cargar las reseñas"
        message={error}
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="pb-10">
      <ResenasInboxHeader
        filters={filters}
        onFiltersChange={handleFiltersChange}
        restaurantList={restaurantList}
        exporting={exporting}
        onExport={handleExport}
      />

      <div className="relative z-20 mb-8">
        <ResenasSummary
          stats={stats}
          loading={loading}
          activeFilter={summaryFilter}
          onFilter={handleSummaryFilter}
        />
      </div>

      <div className={`relative z-0 ${inboxShell} ${inboxGrid}`}>
        <div className={ambientLayer}>
          <div className="absolute -left-16 top-1/3 h-48 w-48 rounded-full bg-violet-600/10 blur-3xl" />
        </div>

        <div className="relative min-h-[520px] overflow-y-auto">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-36 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
              ))}
            </div>
          ) : (
            <ResenasInboxList reviews={filteredReviews} />
          )}
        </div>
      </div>
    </div>
  );
}
