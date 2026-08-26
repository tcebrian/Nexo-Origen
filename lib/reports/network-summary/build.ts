import { REPUTATION_TARGET } from "@/lib/restaurants/metrics";
import { getTopReasons } from "@/lib/review-metrics";
import { marcaToBrandId } from "@/lib/supabase/kpi-mappers";
import type { KpiRestaurantRow } from "@/lib/supabase/kpi-restaurantes";
import type { ResenaRow } from "@/lib/supabase/resenas";
import type { AnalisisIaIndex } from "@/lib/supabase/analisis-ia";
import type { NetworkReportGroup } from "./brand-groups";
import type {
  NetworkSummaryData,
  NetworkSummaryLocationRow,
  NetworkSummaryLocationStatus,
  NetworkSummaryReasonSegment,
} from "./types";

function formatPeriodLabel(start: Date, end: Date): string {
  const fmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

function shortLocationName(name: string): string {
  return (
    name
      .replace(/^(BK|Burger King|Popeyes|Santa Gloria|Tim Hortons|Ribs|Sibuya|Taberna Volapi[eé]|Volapi[eé]|Vault)\s+/i, "")
      .trim() || name
  );
}

// Mismo umbral de "vigilancia" que lib/informes/resolve-informe-estado.ts.
// Se deriva directamente de media_total vs REPUTATION_TARGET (no del campo
// `estado` de Supabase) para que la tabla nunca contradiga a la tarjeta de
// "Locales por debajo del objetivo", que sí compara la media directamente.
const WATCH_THRESHOLD = 4.0;

function toStatus(row: KpiRestaurantRow): { status: NetworkSummaryLocationStatus; label: string } {
  if (row.total_resenas === 0) return { status: "no_reviews", label: "Sin reseñas" };
  if (row.media_total >= REPUTATION_TARGET) return { status: "on_target", label: "Sobre el objetivo" };
  if (row.media_total >= WATCH_THRESHOLD) return { status: "watch", label: "Cerca del objetivo" };
  return { status: "risk", label: "Bajo objetivo" };
}

/**
 * Construye el resumen de red de un grupo de marcas (una marca sola, o
 * varias combinadas como "Grupo Hámbar") para un periodo dado. Reutiliza
 * los mismos bloques ya probados que usa el resto de la app para KPIs de
 * reseñas (getTopReasons, REPUTATION_TARGET, marcaToBrandId) en vez de
 * reinventar el cálculo — ver lib/reports/weekly/build-from-kpi.ts, del que
 * está adaptada esta función (esa vive sin usar en la app, pensada para PDF
 * con una plantilla fija por marca; aquí hace falta agrupar por una lista
 * arbitraria de marcas, así que se reescribe en vez de reutilizarla tal cual).
 */
export function buildNetworkSummaryReport(
  group: NetworkReportGroup,
  allRows: KpiRestaurantRow[],
  allResenas: ResenaRow[],
  analisisByResenaId: AnalisisIaIndex,
  period: { start: Date; end: Date }
): NetworkSummaryData {
  const brandIdSet = new Set(group.brandIds);
  const rows = allRows.filter((row) => brandIdSet.has(marcaToBrandId(row.marca)));
  // Se filtra por restaurante_id (fiable, viene de kpi_restaurantes) en vez
  // de por resenas.marca — ese campo no siempre viene poblado en la tabla
  // resenas, y filtrar por él dejaba el donut de motivos vacío aunque la
  // marca sí tuviera reseñas negativas reales en el periodo.
  const restauranteIds = new Set(rows.map((row) => row.restaurante_id));
  const resenas = allResenas.filter((row) => row.restaurante_id != null && restauranteIds.has(row.restaurante_id));

  const totalReviews = rows.reduce((sum, row) => sum + row.total_resenas, 0);
  const negativeReviews = rows.reduce((sum, row) => sum + row.resenas_negativas, 0);
  const positiveReviews = rows.reduce((sum, row) => sum + row.resenas_positivas, 0);
  const weightedAverage =
    totalReviews > 0 ? rows.reduce((sum, row) => sum + row.media_total * row.total_resenas, 0) / totalReviews : 0;

  const belowTarget = rows.filter((row) => row.total_resenas > 0 && row.media_total < REPUTATION_TARGET);

  const locations: NetworkSummaryLocationRow[] = rows
    .map((row) => {
      const { status, label } = toStatus(row);
      const topNegative = getTopReasons(resenas, analisisByResenaId, {
        negativesOnly: true,
        restauranteId: row.restaurante_id,
        limit: 1,
      });

      return {
        name: shortLocationName(row.restaurante),
        brandLabel: row.marca,
        rating: row.total_resenas > 0 ? row.media_total : null,
        reviewCount: row.total_resenas,
        status,
        statusLabel: label,
        mainNegativeMotive: topNegative[0]?.motivo ?? "Sin reseñas negativas",
      };
    })
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  const negativeReasons: NetworkSummaryReasonSegment[] = getTopReasons(resenas, analisisByResenaId, {
    negativesOnly: true,
    limit: 6,
  }).map((item) => ({ label: item.motivo, count: item.count, percent: item.percent }));

  return {
    groupId: group.id,
    groupLabel: group.label,
    groupSublabel: group.sublabel,
    periodLabel: formatPeriodLabel(period.start, period.end),
    periodStart: period.start.toISOString(),
    periodEnd: period.end.toISOString(),
    totalLocations: rows.length,
    totalReviews,
    positiveReviews,
    positivePercent: totalReviews > 0 ? Math.round((positiveReviews / totalReviews) * 1000) / 10 : 0,
    negativeReviews,
    negativePercent: totalReviews > 0 ? Math.round((negativeReviews / totalReviews) * 1000) / 10 : 0,
    weightedAverage: Math.round(weightedAverage * 100) / 100,
    targetAverage: REPUTATION_TARGET,
    belowTargetCount: belowTarget.length,
    belowTargetLocations: belowTarget.map((row) => shortLocationName(row.restaurante)),
    locations,
    negativeReasons,
  };
}
