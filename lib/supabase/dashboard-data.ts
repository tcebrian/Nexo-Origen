import { restaurantSlug } from "@/app/dashboard/restaurantes/utils";
import { brandBucket, marcaToBrandId, resolveBrandId } from "./kpi-mappers";
import type { KpiRestaurantRow } from "./kpi-restaurantes";
import { getPeriodData } from "./period-stats";
import type { ResenaRow } from "./resenas";
import { IA_NO_DATA } from "@/lib/reviews/analisis-ia-constants";
import { aggregateResumenFromAnalisis } from "@/lib/reviews/map-analisis-ia";
import { classifyReviewReason } from "@/lib/reviews/classify-reason";
import { dedupeResenas, getReviewDedupKey } from "@/lib/review-metrics";
import { buildMediaImpactIndex } from "@/lib/reviews/media-impact";
import { getAnalisisForResena, type AnalisisIaIndex } from "@/lib/supabase/analisis-ia";
import { unstable_noStore as noStore } from "next/cache";
import type { UserScope } from "@/lib/auth/types";

export type {
  DashboardAlertItem,
  DashboardData,
  DashboardRankingItem,
  DashboardRiskItem,
  DistribucionMarcaItem,
  RestauranteDestacado,
} from "./dashboard-data.types";
import type {
  DashboardAlertItem,
  DashboardData,
  DashboardRankingItem,
  DashboardRiskItem,
  DistribucionMarcaItem,
  RestauranteDestacado,
} from "./dashboard-data.types";

const ALERT_DOT_COLORS = ["bg-red-500", "bg-orange-500", "bg-yellow-500"];

const BRAND_BUCKET_COLORS: Record<string, string> = {
  "Burger King": "bg-purple-500",
  Popeyes: "bg-orange-500",
  "Santa Gloria": "bg-emerald-500",
  "Tim Hortons": "bg-blue-500",
  Vault: "bg-yellow-400",
  Otros: "bg-gray-500",
};

const STATUS_ORDER: Record<string, number> = {
  critico: 0,
  crítico: 0,
  "en riesgo": 1,
  óptimo: 2,
  optimo: 2,
};

const EMPTY_DASHBOARD_DATA: DashboardData = {
  mediaGlobal: 0,
  totalResenas: 0,
  totalPositivas: 0,
  totalNegativas: 0,
  positivePct: 0,
  negativePct: 0,
  ultimaActualizacion: null,
  totalRestaurantes: 0,
  ranking: [],
  restaurantesRiesgo: [],
  alertas: [],
  distribucionMarca: [],
  resumenIA: "Sin datos disponibles.",
  peorRestaurante: null,
  restauranteMasNegativas: null,
  chartPending: true,
  chartLabels: [],
  chartValues: [],
  chartSource: "empty",
  problemDistribution: [],
};

function statusOrder(estado: string): number {
  return STATUS_ORDER[estado.toLowerCase().trim()] ?? 2;
}

function statusStyles(estado: string): { color: string; bg: string } {
  const e = estado.toLowerCase();
  if (e.includes("crit")) {
    return { color: "text-red-300", bg: "bg-red-500/15" };
  }
  if (e.includes("riesgo") || e === "regular") {
    return { color: "text-yellow-300", bg: "bg-yellow-500/15" };
  }
  return { color: "text-emerald-300", bg: "bg-emerald-500/15" };
}

function toDestacado(row: KpiRestaurantRow): RestauranteDestacado {
  return {
    restaurante: row.restaurante,
    media_total: row.media_total,
    marca: row.marca,
    resenas_negativas: row.resenas_negativas,
  };
}

function buildRanking(rows: KpiRestaurantRow[], limit = 5): DashboardRankingItem[] {
  return [...rows]
    .filter((row) => row.total_resenas > 0)
    .sort((a, b) => {
      if (b.media_total !== a.media_total) return b.media_total - a.media_total;
      return b.total_resenas - a.total_resenas;
    })
    .slice(0, limit)
    .map((row, index) => ({
      restaurante: row.restaurante,
      media_total: row.media_total,
      marca: row.marca,
      slug: restaurantSlug(row.restaurante),
      brand: marcaToBrandId(row.marca),
      position: index + 1,
    }));
}

function buildRestaurantesRiesgo(rows: KpiRestaurantRow[], limit = 5): DashboardRiskItem[] {
  return [...rows]
    .filter((row) => {
      const estado = row.estado.toLowerCase();
      return estado.includes("riesgo") || estado.includes("crit") || estado.includes("crít");
    })
    .sort((a, b) => {
      const statusDiff = statusOrder(a.estado) - statusOrder(b.estado);
      if (statusDiff !== 0) return statusDiff;
      return a.media_total - b.media_total;
    })
    .slice(0, limit)
    .map((row) => {
      const styles = statusStyles(row.estado);
      return {
        restaurante: row.restaurante,
        media_total: row.media_total,
        estado: row.estado,
        marca: row.marca,
        slug: restaurantSlug(row.restaurante),
        brand: marcaToBrandId(row.marca),
        color: styles.color,
        bg: styles.bg,
      };
    });
}

function buildAlertasFromResenas(
  resenas: ResenaRow[],
  catalogById: Map<number, KpiRestaurantRow>,
  analisisByResenaId: AnalisisIaIndex = new Map(),
  limit = 3
): DashboardAlertItem[] {
  const impactIndex = buildMediaImpactIndex(resenas);

  return dedupeResenas(resenas)
    .filter((row) => row.estrellas <= 3)
    .sort((a, b) => {
      const ta = new Date(a.fecha_resena ?? a.created_at ?? 0).getTime();
      const tb = new Date(b.fecha_resena ?? b.created_at ?? 0).getTime();
      return tb - ta;
    })
    .slice(0, limit)
    .map((row, index) => {
      const catalog = row.restaurante_id != null ? catalogById.get(row.restaurante_id) : undefined;
      const restaurante =
        catalog?.restaurante?.trim() ||
        row.restaurante_nombre?.trim() ||
        row.restaurante?.trim() ||
        "Restaurante";
      const marca = catalog?.marca ?? row.marca ?? "";
      const brand = resolveBrandId(row.restaurante_id, marca, catalogById);
      const impact = impactIndex.get(getReviewDedupKey(row));
      const analisis = getAnalisisForResena(analisisByResenaId, row);
      const motivoPrincipal = classifyReviewReason(row, analisis);

      return {
        restaurante,
        marca: marca || "—",
        slug: restaurantSlug(restaurante),
        brand,
        ultima_resena: row.fecha_resena ?? row.created_at ?? null,
        estrellas: row.estrellas,
        resenas_negativas: 1,
        impacto: impact?.impact ?? 0,
        mediaBefore: impact?.mediaBefore ?? null,
        mediaAfter: impact?.mediaAfter ?? catalog?.media_total ?? 0,
        color: ALERT_DOT_COLORS[index] ?? "bg-yellow-500",
        texto: row.comentario?.trim() || "Sin comentario",
        reviewId: String(row.review_id ?? row.id),
        motivoPrincipal,
      };
    });
}

function buildDistribucionMarca(rows: KpiRestaurantRow[]): DistribucionMarcaItem[] {
  const totals = new Map<string, number>();

  for (const row of rows) {
    const bucket = brandBucket(row.marca);
    totals.set(bucket, (totals.get(bucket) ?? 0) + row.total_resenas);
  }

  const sum = Array.from(totals.values()).reduce((acc, n) => acc + n, 0) || 1;
  const order = ["Burger King", "Popeyes", "Santa Gloria", "Tim Hortons", "Vault", "Otros"];

  return order
    .filter((name) => totals.has(name))
    .map((name) => ({
      marca: name,
      porcentaje: Math.round(((totals.get(name) ?? 0) / sum) * 100),
      color: BRAND_BUCKET_COLORS[name] ?? "bg-gray-500",
    }));
}

function resolveResumenIA(
  dashboardResumen: string | null | undefined,
  analisisRows: { resumen: string | null }[]
): string {
  if (dashboardResumen?.trim()) return dashboardResumen.trim();
  const aggregated = aggregateResumenFromAnalisis(analisisRows);
  if (aggregated) return aggregated;
  return IA_NO_DATA;
}

export async function getDashboardData(
  startKey: string,
  endKey: string,
  scope?: UserScope
): Promise<DashboardData> {
  noStore();

  try {
    const period = await getPeriodData(startKey, endKey, scope, {
      skipDashboardKpis: true,
    });
    const {
      activeKpiRows: rows,
      aggregates,
      dailySeries,
      resenas,
      problemDistribution,
      chartSource,
      dashboardKpis,
      analisisByResenaId,
    } = period;
    const chartLabels = dailySeries.map((point) => point.label);
    const chartValues = dailySeries.map((point) => point.media);

    const {
      mediaGlobal,
      totalResenas,
      totalPositivas,
      totalNegativas,
      positivePct,
      negativePct,
      ultimaActualizacion,
    } = aggregates;
    const totalRestaurantes = rows.length;

    if (rows.length === 0) {
      return {
        ...EMPTY_DASHBOARD_DATA,
        resumenIA: "Sin datos para el periodo seleccionado.",
      };
    }

    if (totalResenas === 0 && aggregates.source === "kpi_restaurantes") {
      return {
        mediaGlobal,
        totalResenas: 0,
        totalPositivas: 0,
        totalNegativas: 0,
        positivePct: 0,
        negativePct: 0,
        ultimaActualizacion,
        totalRestaurantes,
        ranking: buildRanking(rows),
        restaurantesRiesgo: buildRestaurantesRiesgo(rows),
        alertas: [],
        distribucionMarca: [],
        resumenIA: "Sin reseñas en el periodo seleccionado. Pendiente de activar histórico diario.",
        peorRestaurante: null,
        restauranteMasNegativas: null,
        chartPending: chartValues.length === 0,
        chartLabels,
        chartValues,
        chartSource,
        problemDistribution,
      };
    }

    const peorRestaurante = toDestacado(
      [...rows].sort((a, b) => a.media_total - b.media_total)[0]
    );
    const restauranteMasNegativas = toDestacado(
      [...rows].sort((a, b) => b.resenas_negativas - a.resenas_negativas)[0]
    );

    return {
      mediaGlobal,
      totalResenas,
      totalPositivas,
      totalNegativas,
      positivePct,
      negativePct,
      ultimaActualizacion,
      totalRestaurantes,
      ranking: buildRanking(rows),
      restaurantesRiesgo: buildRestaurantesRiesgo(rows),
      alertas: buildAlertasFromResenas(
        resenas,
        new Map(rows.map((row) => [row.restaurante_id, row])),
        analisisByResenaId
      ),
      distribucionMarca: buildDistribucionMarca(rows),
      resumenIA: resolveResumenIA(
        dashboardKpis?.resumenIA,
        Array.from(analisisByResenaId.values())
      ),
      peorRestaurante,
      restauranteMasNegativas,
      chartPending: chartValues.length === 0,
      chartLabels,
      chartValues,
      chartSource,
      problemDistribution,
    };
  } catch (error) {
    console.error("[getDashboardData] Error al cargar datos del dashboard:", error);
    return EMPTY_DASHBOARD_DATA;
  }
}
