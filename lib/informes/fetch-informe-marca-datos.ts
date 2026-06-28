import "server-only";

import { tenant } from "@/app/dashboard/tenant";
import {
  computeInformeKpiFromResenas,
  getInformeQueryBounds,
} from "@/lib/informes/informe-kpi-utils";
import {
  formatInformePeriodRange,
  formatInformePeriodTitle,
  formatVariacionPeriodLabel,
  getPreviousPeriodBounds,
} from "@/lib/informes/informe-period-format";
import { formatInformeVariationLabel } from "@/lib/informes/informe-cover-assets";
import type { InformeMarcaDatos } from "@/lib/informes/types";
import { resolveInformeEstado } from "@/lib/informes/resolve-informe-estado";
import { dedupeResenas } from "@/lib/review-metrics";
import type { ResenaRow } from "@/lib/supabase/resenas";
import { fetchResenasForPeriodServer } from "@/lib/supabase/resenas.server";
import { getInclusiveQueryBounds } from "@/lib/date-utils";

function resolveTopRestaurantDisplay(
  resenas: ResenaRow[],
  marcaLabel: string
): string {
  const counts = new Map<string, number>();

  for (const row of resenas) {
    const name = row.restaurante_nombre?.trim() || row.restaurante?.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  if (counts.size === 0) {
    return marcaLabel.toUpperCase();
  }

  let topName = "";
  let topCount = -1;
  for (const [name, count] of counts) {
    if (count > topCount) {
      topCount = count;
      topName = name;
    }
  }

  return topName.toUpperCase();
}

/**
 * KPIs del informe por marca desde Supabase (`resenas`).
 * Filtra por `restaurante_nombre` con ilike (%marca%).
 * Periodo por defecto: últimos 7 días (informe semanal).
 */
export async function fetchInformeMarcaDatos(
  marca: string,
  startKey?: string,
  endKey?: string
): Promise<InformeMarcaDatos> {
  const marcaLabel = marca.trim();
  const { bounds, queryBounds } = getInformeQueryBounds(startKey, endKey, 7);

  const raw = await fetchResenasForPeriodServer(
    { start: bounds.start, end: bounds.end },
    { queryBounds, restauranteNombreIlike: marcaLabel }
  );

  const resenas = dedupeResenas(raw);
  const kpis = computeInformeKpiFromResenas(resenas);
  const { estado, estadoLabel } = resolveInformeEstado(kpis.media);

  const previousBounds = getPreviousPeriodBounds(bounds);
  const previousQueryBounds = getInclusiveQueryBounds(
    previousBounds.startKey,
    previousBounds.endKey
  );
  const previousRaw = await fetchResenasForPeriodServer(
    { start: previousBounds.start, end: previousBounds.end },
    { queryBounds: previousQueryBounds, restauranteNombreIlike: marcaLabel }
  );
  const previousKpis = computeInformeKpiFromResenas(dedupeResenas(previousRaw));

  const variacionMedia =
    previousKpis.resenas > 0 ? kpis.media - previousKpis.media : null;

  const spanMs = bounds.end.getTime() - bounds.start.getTime();
  const spanDays = Math.round(spanMs / 86400000) + 1;
  const analisisTipo =
    spanDays >= 28 ? "mensual" : spanDays >= 14 ? "quincenal" : "semanal";

  return {
    ...kpis,
    marca: marcaLabel,
    estado,
    estadoLabel,
    cover: {
      restauranteDisplay: resolveTopRestaurantDisplay(resenas, marcaLabel),
      periodTitle: formatInformePeriodTitle(bounds),
      periodRange: formatInformePeriodRange(bounds),
      cliente: tenant.name,
      variacionMedia,
      variacionLabel: formatInformeVariationLabel(variacionMedia),
      coverImageDataUri: null,
      marcaDisplay: marcaLabel.toUpperCase(),
      variacionPeriodLabel: formatVariacionPeriodLabel(previousBounds),
      analisisTipo,
    },
  };
}
