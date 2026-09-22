import "server-only";

import { tenant } from "@/app/dashboard/tenant";
import { getInformeQueryBounds } from "@/lib/informes/informe-kpi-utils";
import {
  formatInformePeriodRange,
  formatInformePeriodTitle,
  formatVariacionPeriodLabel,
  getPreviousPeriodBounds,
} from "@/lib/informes/informe-period-format";
import { formatInformeVariationLabel } from "@/lib/informes/informe-cover-assets";
import type { InformeMarcaDatos } from "@/lib/informes/types";
import { resolveInformeEstado } from "@/lib/informes/resolve-informe-estado";
import { marcaToBrandId } from "@/lib/restaurants/brand-resolve";
import { fetchAllKpiRows } from "@/lib/supabase/kpi-restaurantes";
import {
  fetchSupabaseCanonicalReputationMetrics,
  type SupabaseMetricRow,
} from "@/lib/supabase/reputation-metrics.server";

function n(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function networkKpis(rows: SupabaseMetricRow[]) {
  const first = rows[0];
  return {
    media: n(first?.network_media_exacta),
    resenas: n(first?.network_total_resenas),
    negativas: n(first?.network_negativas),
    restaurantes: rows.filter((row) => n(row.total_resenas) > 0).length,
  };
}

/**
 * Informe por marca usando el mismo cálculo SQL que web, ranking y WhatsApp.
 */
export async function fetchInformeMarcaDatos(
  marca: string,
  startKey?: string,
  endKey?: string
): Promise<InformeMarcaDatos> {
  const marcaLabel = marca.trim();
  const { bounds } = getInformeQueryBounds(startKey, endKey, 7);
  const targetBrand = marcaToBrandId(marcaLabel);
  const catalog = (await fetchAllKpiRows()).filter(
    (row) => marcaToBrandId(row.marca) === targetBrand
  );
  const restaurantIds = catalog.map((row) => row.restaurante_id);

  const previousBounds = getPreviousPeriodBounds(bounds);

  const [currentRows, previousRows] = await Promise.all([
    fetchSupabaseCanonicalReputationMetrics(
      bounds.startKey,
      bounds.endKey,
      restaurantIds
    ),
    fetchSupabaseCanonicalReputationMetrics(
      previousBounds.startKey,
      previousBounds.endKey,
      restaurantIds
    ),
  ]);

  const kpis = networkKpis(currentRows);
  const previousKpis = networkKpis(previousRows);
  const { estado, estadoLabel } = resolveInformeEstado(kpis.media);

  const currentById = new Map(
    currentRows.map((row) => [Number(row.restaurante_id), row])
  );
  const topRestaurant = [...catalog]
    .sort(
      (a, b) =>
        n(currentById.get(b.restaurante_id)?.total_resenas) -
        n(currentById.get(a.restaurante_id)?.total_resenas)
    )[0];

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
      restauranteDisplay: (topRestaurant?.restaurante || marcaLabel).toUpperCase(),
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
