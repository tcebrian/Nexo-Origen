"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateRangeLabel, getSelectedRange, useDateRange } from "../../_components/date-range-context";
import { useAuth } from "../../_components/auth-context";
import { buildRankingView, filterRankingRecords } from "@/lib/ranking/filters";
import type { RankingFilters } from "@/lib/ranking/types";
import { useRanking } from "../_hooks/use-ranking";
import { PageErrorState } from "../../_components/page-error-state";
import { glass, skeletonBlock } from "../../_components/ui/nexo-styles";
import { RankingAiInsight } from "./ranking-ai-insight";
import { RankingHallOfFame } from "./ranking-hall-of-fame";
import { RankingHeader } from "./ranking-header";
import { RankingListSection } from "./ranking-list-section";
import { RankingMvpCard } from "./ranking-mvp-card";

const TENANT_ID = "grupo-hambar";

export function RankingPage() {
  const router = useRouter();
  const { canAccessSection } = useAuth();
  const { range: activeRange } = useDateRange();
  const range = useMemo(() => getSelectedRange(activeRange), [activeRange]);
  const periodLabel = formatDateRangeLabel(activeRange);

  const { records, loading, error, refetch } = useRanking({
    tenantId: TENANT_ID,
    start: range.start,
    end: range.end,
  });

  const [filters, setFilters] = useState<RankingFilters>({ brand: "todos" });

  useEffect(() => {
    if (!canAccessSection("ranking")) {
      router.replace("/dashboard");
    }
  }, [canAccessSection, router]);

  const filteredRecords = useMemo(
    () => filterRankingRecords(records, filters),
    [records, filters]
  );

  const view = useMemo(() => buildRankingView(filteredRecords), [filteredRecords]);

  if (!canAccessSection("ranking")) return null;

  if (error) {
    return (
      <PageErrorState title="No se pudo cargar el ranking" message={error} onRetry={refetch} />
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-5 pb-4">
      <RankingHeader
        periodLabel={periodLabel}
        filters={filters}
        onBrandChange={(brand) => setFilters({ brand })}
      />

      {loading ? (
        <div className="space-y-5">
          <div className={`h-56 ${skeletonBlock}`} />
          <div className="grid gap-5 lg:grid-cols-12">
            <div className={`h-72 lg:col-span-6 ${skeletonBlock}`} />
            <div className={`h-72 lg:col-span-3 ${skeletonBlock}`} />
            <div className={`h-72 lg:col-span-3 ${skeletonBlock}`} />
          </div>
          <div className={`h-40 ${skeletonBlock}`} />
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className={`${glass} px-6 py-16 text-center`}>
          <p className="text-sm text-[var(--nexo-text-secondary)]">
            No hay restaurantes para la marca seleccionada.
          </p>
        </div>
      ) : (
        <>
          <RankingMvpCard mvp={view.mvp} aiSummary={view.mvpAiSummary} />

          <div className="grid items-stretch gap-5 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <RankingListSection
                kicker="Líderes de red"
                title="Top rendimiento"
                description="Los 5 mejores locales del periodo."
                items={view.topPerformers}
                variant="top"
                emptyMessage="Sin datos de rendimiento."
                className="h-full"
              />
            </div>

            <div className="lg:col-span-3">
              <RankingListSection
                kicker="Tendencia positiva"
                title="Más mejorados"
                items={view.mostImproved}
                variant="improved"
                emptyMessage="Ningún local mejoró en este periodo."
                className="h-full"
              />
            </div>

            <div className="lg:col-span-3">
              <RankingListSection
                kicker="Atención prioritaria"
                title="Mayor riesgo"
                items={view.highestRisk}
                variant="risk"
                emptyMessage="Sin caídas significativas."
                className="h-full"
              />
            </div>
          </div>

          <RankingHallOfFame items={view.hallOfFame} />

          <RankingAiInsight insight={view.aiInsight} />
        </>
      )}
    </div>
  );
}
