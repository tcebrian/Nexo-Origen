import { marcaToBrandId } from "@/lib/supabase/kpi-mappers";
import { categoriaMotivoLabel } from "@/lib/supabase/resena-motivos";
import type { NetworkReportGroup } from "./brand-groups";
import type {
  NetworkSummaryData,
  NetworkSummaryLocationRow,
  NetworkSummaryLocationStatus,
  NetworkSummaryPayload,
} from "./types";

/**
 * Convierte el informe YA CALCULADO por Supabase
 * (public.nexo_network_summary_payload) en el objeto que pintan las
 * plantillas. Aquí no se calcula nada de negocio: ni medias, ni porcentajes,
 * ni estados, ni objetivos, ni reparto de motivos. Solo se ponen etiquetas
 * legibles (nombre corto del local, texto de cada motivo y de cada estado) y
 * el formato de las fechas.
 */

const STATUS_LABEL: Record<NetworkSummaryLocationStatus, string> = {
  on_target: "Sobre el objetivo",
  watch: "Cerca del objetivo",
  risk: "Bajo objetivo",
  no_reviews: "Sin reseñas",
};

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

export function buildNetworkSummaryFromPayload(
  group: NetworkReportGroup,
  payload: NetworkSummaryPayload,
  period: { start: Date; end: Date }
): NetworkSummaryData {
  const locations: NetworkSummaryLocationRow[] = payload.locations.map((loc) => {
    const topLabel = loc.top_negative_categoria ? categoriaMotivoLabel(loc.top_negative_categoria) : null;
    return {
      name: shortLocationName(loc.restaurante),
      brandLabel: loc.marca,
      rating: loc.reviews > 0 && loc.rating != null ? Number(loc.rating) : null,
      reviewCount: loc.reviews,
      status: loc.status,
      statusLabel: STATUS_LABEL[loc.status],
      mainNegativeMotive: topLabel ?? "Sin reseñas negativas",
      fullName: loc.restaurante,
      brandId: marcaToBrandId(loc.marca),
      positiveReviews: loc.positive,
      negativeReviews: loc.negative,
      topNegativeMotive: topLabel,
    };
  });

  return {
    groupId: group.id,
    groupLabel: group.label,
    groupSublabel: group.sublabel,
    periodLabel: formatPeriodLabel(period.start, period.end),
    periodStart: period.start.toISOString(),
    periodEnd: period.end.toISOString(),
    citiesLabel: payload.cities_label,
    totalLocations: payload.totals.locations,
    totalReviews: payload.totals.reviews,
    positiveReviews: payload.totals.positive,
    positivePercent: payload.totals.positive_pct,
    negativeReviews: payload.totals.negative,
    negativePercent: payload.totals.negative_pct,
    weightedAverage: payload.totals.weighted_average,
    targetAverage: payload.target_average,
    belowTargetCount: payload.totals.below_target_count,
    belowTargetLocations: payload.below_target_locations.map(shortLocationName),
    locations,
    negativeReasons: payload.negative_reasons.map((reason) => ({
      label: categoriaMotivoLabel(reason.categoria),
      categoria: reason.categoria,
      count: reason.count,
      percent: reason.percent,
    })),
    negativeReasonsTotal: payload.negative_reasons_total,
  };
}
