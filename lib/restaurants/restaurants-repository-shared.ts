import { restaurantSlug } from "@/app/dashboard/restaurantes/utils";
import {
  buildPreventRecommendation,
  buildPrimaryAction,
  getHealthFromOperational,
} from "./detail-helpers";
import { catalogRowToOperational } from "@/lib/supabase/kpi-mappers";
import { buildRestaurantSparkline, getRestaurantChartSeries } from "@/lib/supabase/chart-series";
import { mapResenaToReview } from "@/lib/supabase/resenas";
import type { ResenaRow } from "@/lib/supabase/resenas";
import type { AnalisisIaIndex } from "@/lib/supabase/analisis-ia";
import { getAnalisisForResena } from "@/lib/supabase/analisis-ia";
import type { PeriodData } from "@/lib/supabase/period-types";
import { getTopReasons } from "@/lib/review-metrics";
import { dedupeResenas, getReviewDedupKey } from "@/lib/review-metrics";
import { buildMediaImpactIndex } from "@/lib/reviews/media-impact";
import {
  computeNpsFromResenas,
  sortResenasByDateDesc,
} from "@/lib/restaurants/reputation-metrics";
import { buildPeriodDayBreakdown, buildStarDistribution } from "@/lib/restaurants/period-breakdown";
import type { RestaurantDetail, RestaurantsQuery } from "./types";
import type { RestaurantsRepository } from "./repository";

export type PeriodLoader = (start: Date, end: Date) => Promise<PeriodData>;

function buildDetectedIssues(
  restauranteId: number,
  resenas: ResenaRow[],
  analisisByResenaId: AnalisisIaIndex
) {
  return getTopReasons(resenas, analisisByResenaId, {
    negativesOnly: true,
    restauranteId,
    limit: 5,
  }).map((item, index) => ({
    id: `issue-${index}`,
    label: item.motivo,
    intensity: item.percent,
  }));
}

function buildPeriodStats(
  metrics: {
    totalResenas: number;
    resenasPositivas: number;
    resenasNegativas: number;
    media: number;
  } | undefined,
  mediaChange: number,
  nps: number
) {
  const periodReviews = metrics?.totalResenas ?? 0;
  const periodPositives = metrics?.resenasPositivas ?? 0;
  const periodNegatives = metrics?.resenasNegativas ?? 0;
  const periodMedia = metrics?.media ?? 0;

  return {
    periodReviews,
    periodPositives,
    periodNegatives,
    periodMedia,
    mediaChange:
      Math.abs(mediaChange) < 0.01
        ? "0.00"
        : mediaChange >= 0
          ? `+${mediaChange.toFixed(2)}`
          : mediaChange.toFixed(2),
    mediaTrend:
      Math.abs(mediaChange) < 0.01
        ? ("flat" as const)
        : mediaChange > 0
          ? ("up" as const)
          : ("down" as const),
    nps,
  };
}

export function createRestaurantsRepository(loadPeriod: PeriodLoader): RestaurantsRepository {
  return {
    async listOperational(query) {
      try {
        const periodMs = query.end.getTime() - query.start.getTime();
        const prevEnd = new Date(query.start.getTime() - 1);
        const prevStart = new Date(prevEnd.getTime() - periodMs);

        const [period, previous] = await Promise.all([
          loadPeriod(query.start, query.end),
          loadPeriod(prevStart, prevEnd).catch(() => null),
        ]);

        return period.catalog.map((catalogRow) => {
          const periodMetrics = period.aggregates.byRestaurante.get(catalogRow.restaurante_id);
          const prev = previous?.aggregates.byRestaurante.get(catalogRow.restaurante_id);
          const mediaChange =
            periodMetrics && prev && periodMetrics.totalResenas > 0 && prev.totalResenas > 0
              ? periodMetrics.media - prev.media
              : 0;
          const sparkline = buildRestaurantSparkline(
            period.kpiDiarioRows,
            period.resenas,
            catalogRow.restaurante_id
          );
          return catalogRowToOperational(catalogRow, periodMetrics, { mediaChange, sparkline });
        });
      } catch (error) {
        console.error("[restaurantsRepository.listOperational]", error);
        return [];
      }
    },

    async getDetail(slug, query) {
      try {
        const period = await loadPeriod(query.start, query.end);
        const baseRow = period.catalog.find((item) => restaurantSlug(item.restaurante) === slug);
        if (!baseRow) return null;

        const metrics = period.aggregates.byRestaurante.get(baseRow.restaurante_id);

        const prevPeriodMs = query.end.getTime() - query.start.getTime();
        const prevEnd = new Date(query.start.getTime() - 1);
        const prevStart = new Date(prevEnd.getTime() - prevPeriodMs);
        let mediaChange = 0;
        try {
          const previous = await loadPeriod(prevStart, prevEnd);
          const prevMetrics = previous.aggregates.byRestaurante.get(baseRow.restaurante_id);
          if (prevMetrics && metrics && metrics.totalResenas > 0 && prevMetrics.totalResenas > 0) {
            mediaChange = metrics.media - prevMetrics.media;
          }
        } catch {
          mediaChange = 0;
        }

        const sparkline = buildRestaurantSparkline(
          period.kpiDiarioRows,
          period.resenas,
          baseRow.restaurante_id
        );
        const operational = catalogRowToOperational(baseRow, metrics, { mediaChange, sparkline });
        const health = getHealthFromOperational(operational.status);

        const daily = getRestaurantChartSeries(
          period.kpiDiarioRows,
          period.resenas,
          baseRow.restaurante_id
        );

        const restaurantResenas = sortResenasByDateDesc(
          dedupeResenas(period.resenas).filter((row) => row.restaurante_id === baseRow.restaurante_id)
        );

        const impactIndex = buildMediaImpactIndex(period.resenas);
        const detectedIssues = buildDetectedIssues(
          baseRow.restaurante_id,
          period.resenas,
          period.analisisByResenaId
        );
        const topIssueLabel = detectedIssues[0]?.label;
        const periodNps = computeNpsFromResenas(restaurantResenas);
        const starDistribution = buildStarDistribution(period.resenas, baseRow.restaurante_id);
        const { days: dayBreakdown, mode: dayBreakdownMode } = buildPeriodDayBreakdown(
          period.resenas,
          baseRow.restaurante_id,
          query.start,
          query.end
        );

        const detail: RestaurantDetail = {
          ...operational,
          lastUpdatedAt: period.fetchedAt,
          googleMedia: baseRow.media_google,
          googleReviewsTotal: baseRow.total_resenas_google,
          healthStatus: health.status,
          healthStatusLabel: health.label,
          primaryAction: buildPrimaryAction({
            status: operational.status,
            activeAlerts: metrics?.resenasNegativas ?? operational.activeAlerts,
            recommendedPositiveReviews: operational.recommendedPositiveReviews,
            topIssueLabel,
          }),
          recentActivity: restaurantResenas
            .filter((row) => row.estrellas <= 3)
            .slice(0, 5)
            .map((resena) => {
              const analisis = getAnalisisForResena(period.analisisByResenaId, resena);
              const review = mapResenaToReview(
                resena,
                baseRow.restaurante,
                baseRow.marca,
                undefined,
                impactIndex.get(getReviewDedupKey(resena)),
                analisis
              );
              return {
                id: `activity-${review.id}`,
                occurredAt: review.date,
                description: review.text,
                type: resena.estrellas <= 2 ? ("alert" as const) : ("warning" as const),
                reviewId: review.id,
              };
            }),
          detectedIssues,
          preventHealthStatus: health.status,
          preventHealthLabel: health.label,
          preventRecommendation: buildPreventRecommendation(
            health.label,
            operational.recommendedPositiveReviews
          ),
          recentReviews: restaurantResenas.slice(0, 8).map((resena) => {
            const analisis = getAnalisisForResena(period.analisisByResenaId, resena);
            const review = mapResenaToReview(
              resena,
              baseRow.restaurante,
              baseRow.marca,
              undefined,
              impactIndex.get(getReviewDedupKey(resena)),
              analisis
            );
            return {
              id: review.id,
              author: review.author,
              date: review.date,
              rating: review.rating,
              text: review.text,
              sentiment:
                review.sentiment === "negativa"
                  ? ("negative" as const)
                  : review.sentiment === "positiva"
                    ? ("positive" as const)
                    : ("neutral" as const),
              motive: review.motiveLabel,
              editada: review.editada,
            };
          }),
          reportHref: "/dashboard/informes",
          reviewsHref: `/dashboard/resenas?local=${encodeURIComponent(operational.slug)}`,
          alertsHref: "/dashboard/alertas",
          preventHref: "/dashboard/nexo-prevent",
          periodStats: buildPeriodStats(metrics, mediaChange, periodNps),
          chartLabels: daily.labels,
          chartValues: daily.values,
          volumeSeries: daily.volumeSeries,
          periodBreakdown: {
            starDistribution,
            dayBreakdown,
            dayBreakdownMode,
          },
        };

        return detail;
      } catch (error) {
        console.error("[restaurantsRepository.getDetail]", error);
        return null;
      }
    },
  };
}
