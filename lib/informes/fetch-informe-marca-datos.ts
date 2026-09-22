import "server-only";

import { tenant } from "@/app/dashboard/tenant";
import {
  formatInformePeriodRange,
  formatInformePeriodTitle,
  formatVariacionPeriodLabel,
  getPreviousPeriodBounds,
} from "@/lib/informes/informe-period-format";
import { formatInformeVariationLabel } from "@/lib/informes/informe-cover-assets";
import type { InformeKpiDatos, InformeMarcaDatos } from "@/lib/informes/types";
import { resolveInformeEstado } from "@/lib/informes/resolve-informe-estado";
import { getInformeQueryBounds } from "@/lib/informes/informe-kpi-utils";
import { getSupabaseDataClientForServer } from "@/lib/supabase/data-client";

type CatalogRow = {
  restaurante_id: number | string;
  restaurante: string;
  marca: string;
};

type MetricRow = {
  restaurante_id: number | string;
  total_resenas: number | string;
  rating_sum: number | string;
  negativas: number | string;
};

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("es-ES");
}

function buildInformeKpis(rows: MetricRow[]): InformeKpiDatos {
  const totalResenas = rows.reduce((sum, row) => sum + num(row.total_resenas), 0);
  const ratingSum = rows.reduce((sum, row) => sum + num(row.rating_sum), 0);
  const negativas = rows.reduce((sum, row) => sum + num(row.negativas), 0);
  const restaurantes = rows.filter((row) => num(row.total_resenas) > 0).length;

  return {
    media: totalResenas > 0 ? ratingSum / totalResenas : 0,
    resenas: totalResenas,
    negativas,
    restaurantes,
  };
}

function resolveTopRestaurantDisplay(
  metrics: MetricRow[],
  catalogById: Map<number, CatalogRow>,
  marcaLabel: string
): string {
  const top = [...metrics]
    .filter((row) => num(row.total_resenas) > 0)
    .sort((a, b) => num(b.total_resenas) - num(a.total_resenas))[0];

  if (!top) return marcaLabel.toUpperCase();

  return (
    catalogById.get(num(top.restaurante_id))?.restaurante?.trim() ||
    marcaLabel
  ).toUpperCase();
}

async function fetchCanonicalMetrics(
  startKey: string,
  endKey: string,
  restaurantIds: number[]
): Promise<MetricRow[]> {
  if (restaurantIds.length === 0) return [];

  const client = await getSupabaseDataClientForServer();
  const { data, error } = await client.rpc("nexo_reputation_period_metrics", {
    p_start: startKey,
    p_end: endKey,
    p_restaurant_ids: restaurantIds,
  });

  if (error) {
    throw new Error(
      `No se pudieron cargar métricas canónicas del informe: ${error.message}`
    );
  }

  return (data ?? []) as MetricRow[];
}

/**
 * Informe por marca usando una única fuente de verdad:
 * - catálogo: nexo_reputation_restaurant_catalog()
 * - KPIs: nexo_reputation_period_metrics()
 *
 * No calcula media/negativas desde arrays en TypeScript.
 */
export async function fetchInformeMarcaDatos(
  marca: string,
  startKey?: string,
  endKey?: string
): Promise<InformeMarcaDatos> {
  const marcaLabel = marca.trim();
  const { bounds } = getInformeQueryBounds(startKey, endKey, 7);
  const client = await getSupabaseDataClientForServer();

  const { data: catalogData, error: catalogError } = await client.rpc(
    "nexo_reputation_restaurant_catalog",
    { p_restaurant_ids: null }
  );

  if (catalogError) {
    throw new Error(
      `No se pudo cargar el catálogo canónico: ${catalogError.message}`
    );
  }

  const catalog = (catalogData ?? []) as CatalogRow[];
  const brandRows = catalog.filter(
    (row) => normalize(String(row.marca ?? "")) === normalize(marcaLabel)
  );

  const restaurantIds = brandRows
    .map((row) => num(row.restaurante_id))
    .filter((id) => id > 0);

  if (restaurantIds.length === 0) {
    throw new Error(`No se encontraron restaurantes activos para la marca ${marcaLabel}`);
  }

  const currentMetrics = await fetchCanonicalMetrics(
    bounds.startKey,
    bounds.endKey,
    restaurantIds
  );
  const kpis = buildInformeKpis(currentMetrics);
  const { estado, estadoLabel } = resolveInformeEstado(kpis.media);

  const previousBounds = getPreviousPeriodBounds(bounds);
  const previousMetrics = await fetchCanonicalMetrics(
    previousBounds.startKey,
    previousBounds.endKey,
    restaurantIds
  );
  const previousKpis = buildInformeKpis(previousMetrics);

  const variacionMedia =
    previousKpis.resenas > 0 ? kpis.media - previousKpis.media : null;

  const spanMs = bounds.end.getTime() - bounds.start.getTime();
  const spanDays = Math.round(spanMs / 86400000) + 1;
  const analisisTipo =
    spanDays >= 28 ? "mensual" : spanDays >= 14 ? "quincenal" : "semanal";

  const catalogById = new Map(
    brandRows.map((row) => [num(row.restaurante_id), row])
  );

  return {
    ...kpis,
    marca: marcaLabel,
    estado,
    estadoLabel,
    cover: {
      restauranteDisplay: resolveTopRestaurantDisplay(
        currentMetrics,
        catalogById,
        marcaLabel
      ),
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
