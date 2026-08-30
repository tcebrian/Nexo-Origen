import { REPUTATION_TARGET } from "@/lib/restaurants/metrics";
import { dedupeResenas } from "@/lib/review-metrics";
import { marcaToBrandId } from "@/lib/supabase/kpi-mappers";
import type { KpiRestaurantRow } from "@/lib/supabase/kpi-restaurantes";
import type { ResenaRow } from "@/lib/supabase/resenas";
import { categoriaMotivoLabel, getMotivoForResena, type ResenaMotivoIndex } from "@/lib/supabase/resena-motivos";
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

/**
 * Motivos de reseñas negativas agrupados por `resena_motivos.categoria` —
 * la categoría que ya viene clasificada en Supabase, tal cual, sin pasar por
 * la heurística de palabras clave de lib/reviews/classify-reason.ts.
 */
function topMotivosFromIndex(
  resenas: ResenaRow[],
  motivoIndex: ResenaMotivoIndex,
  options: { restauranteId?: number; limit?: number; groupRestAsOtro?: boolean } = {}
): { label: string; categoria: string; count: number; percent: number }[] {
  const negatives = dedupeResenas(resenas).filter((row) => {
    if (row.estrellas > 3) return false;
    if (options.restauranteId != null && row.restaurante_id !== options.restauranteId) return false;
    return true;
  });

  // Se cuenta por categoria (la clave SNAKE_CASE de Supabase), no por label
  // ya formateado — así se conserva la categoría real para poder buscarle un
  // emoji de referencia en la plantilla, en vez de perderla al convertirla a
  // texto legible.
  const counts = new Map<string, number>();
  let withMotivo = 0;

  for (const row of negatives) {
    const motivo = getMotivoForResena(motivoIndex, row);
    if (!motivo) continue;
    withMotivo += 1;
    const key = motivo.categoria.trim().toUpperCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const ranked = [...counts.entries()]
    .map(([categoria, count]) => ({ categoria, label: categoriaMotivoLabel(categoria), count }))
    .sort((a, b) => b.count - a.count);

  // Si hay más categorías que el límite, las que sobran se agrupan en un
  // único "Otros" (sumando sus recuentos) en vez de descartarlas sin más —
  // así el donut siempre representa el 100% de las reseñas negativas, sin
  // huecos en blanco por categorías que se quedaron fuera del top.
  let grouped = ranked;
  if (options.groupRestAsOtro && options.limit && ranked.length > options.limit) {
    const kept = ranked.slice(0, options.limit - 1);
    const rest = ranked.slice(options.limit - 1);
    const restCount = rest.reduce((sum, item) => sum + item.count, 0);
    const otrosIndex = kept.findIndex((item) => item.categoria === "OTRO");
    if (otrosIndex >= 0) {
      kept[otrosIndex] = { categoria: "OTRO", label: categoriaMotivoLabel("OTRO"), count: kept[otrosIndex].count + restCount };
    } else {
      kept.push({ categoria: "OTRO", label: categoriaMotivoLabel("OTRO"), count: restCount });
    }
    grouped = kept.sort((a, b) => b.count - a.count);
  } else if (options.limit) {
    grouped = ranked.slice(0, options.limit);
  }

  if (withMotivo === 0) {
    return grouped.map((item) => ({ ...item, percent: 0 }));
  }

  // Redondear cada % de forma independiente puede dejar la suma en 99.9 o
  // 100.1 (p.ej. tres tercios: 33.3+33.3+33.3=99.9) — un hueco o solape
  // diminuto pero real en el donut. Se redondean todos menos el último, y al
  // último se le asigna el resto exacto hasta 100, para que la suma sea
  // siempre 100% clavado.
  const withPercent = grouped.map((item) => ({
    ...item,
    percent: Math.round((item.count / withMotivo) * 1000) / 10,
  }));
  const roundedSum = withPercent.slice(0, -1).reduce((sum, item) => sum + item.percent, 0);
  const last = withPercent[withPercent.length - 1];
  if (last) last.percent = Math.round((100 - roundedSum) * 10) / 10;

  return withPercent;
}

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
  motivoIndex: ResenaMotivoIndex,
  period: { start: Date; end: Date }
): NetworkSummaryData {
  const brandIdSet = new Set(group.brandIds);
  const rows = allRows
    .filter((row) => brandIdSet.has(marcaToBrandId(row.marca)))
    .filter((row) => !group.restaurantFilter || group.restaurantFilter(row));
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

  // Ordenados de peor a mejor media — así el peor local sale primero en la
  // lista de "fuera de objetivo", que es lo más útil para leer de un vistazo.
  const belowTarget = rows
    .filter((row) => row.total_resenas > 0 && row.media_total < REPUTATION_TARGET)
    .sort((a, b) => a.media_total - b.media_total);

  const locations: NetworkSummaryLocationRow[] = rows
    .map((row) => {
      const { status, label } = toStatus(row);
      const topNegative = topMotivosFromIndex(resenas, motivoIndex, {
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
        mainNegativeMotive: topNegative[0]?.label ?? "Sin reseñas negativas",
      };
    })
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  const negativeReasons: NetworkSummaryReasonSegment[] = topMotivosFromIndex(resenas, motivoIndex, {
    limit: 6,
    groupRestAsOtro: true,
  });

  const citiesLabel = [...new Set(rows.map((row) => row.ciudad.trim()).filter(Boolean))]
    .sort()
    .join(" + ")
    .toUpperCase();

  return {
    groupId: group.id,
    groupLabel: group.label,
    groupSublabel: group.sublabel,
    periodLabel: formatPeriodLabel(period.start, period.end),
    periodStart: period.start.toISOString(),
    periodEnd: period.end.toISOString(),
    citiesLabel,
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
    negativeReasonsTotal: negativeReasons.reduce((sum, item) => sum + item.count, 0),
  };
}
