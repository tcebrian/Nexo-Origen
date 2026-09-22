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
import { fetchAllKpiRows } from "@/lib/supabase/kpi-restaurantes";
import { fetchSupabaseCanonicalReputationMetrics } from "@/lib/supabase/reputation-metrics.server";

function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("es-ES")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function metricNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Informe por marca desde la única calculadora canónica de Supabase.
 * La marca se resuelve desde restaurantes + marcas; nunca por texto de resenas.
 */
export async function fetchInformeMarcaDatos(
  marca: string,
  startKey?: string,
  endKey?: string
): Promise<InformeMarcaDatos> {
  const marcaLabel = marca.trim();
  const { bounds } = getInformeQueryBounds(startKey, endKey, 7);
  const catalog = await fetchAllKpiRows();
  const normalizedBrand = normalize(marcaLabel);
  const brandRows = catalog.filter((row) => normalize(row.marca) === normalizedBrand);
  const ids = brandRows.map((row) => row.restaurante_id);

  if (ids.length === 0) {
    throw new Error(`No hay restaurantes activos para la marca ${marcaLabel}.`);
  }

  const [currentRows, previousBounds] = await Promise.all([
    fetchSupabaseCanonicalReputationMetrics(bounds.startKey, bounds.endKey, ids),
    Promise.resolve(getPreviousPeriodBounds(bounds)),
  ]);

  const previousRows = await fetchSupabaseCanonicalReputationMetrics(
    previousBounds.startKey,
    previousBounds.endKey,
    ids
  );

  const current = currentRows[0];
  const previous = previousRows[0];

  const media = metricNumber(current?.network_media_exacta);
  const resenas = metricNumber(current?.network_total_resenas);
  const negativas = metricNumber(current?.network_negativas);
  const target = brandRows[0]?.objetivo_media ?? 4.4;
  const { estado, estadoLabel } = resolveInformeEstado(media, target);

  const currentByRestaurant = new Map(
    currentRows.map((row) => [Number(row.restaurante_id), row])
  );
  const topRestaurant =
    [...brandRows]
      .sort((a, b) => {
        const aCount = metricNumber(currentByRestaurant.get(a.restaurante_id)?.total_resenas);
        const bCount = metricNumber(currentByRestaurant.get(b.restaurante_id)?.total_resenas);
        if (bCount !== aCount) return bCount - aCount;
        return a.restaurante.localeCompare(b.restaurante, "es");
      })[0]?.restaurante ?? marcaLabel;

  const previousCount = metricNumber(previous?.network_total_resenas);
  const previousMedia = metricNumber(previous?.network_media_exacta);
  const variacionMedia = previousCount > 0 ? media - previousMedia : null;

  const spanMs = bounds.end.getTime() - bounds.start.getTime();
  const spanDays = Math.round(spanMs / 86400000) + 1;
  const analisisTipo =
    spanDays >= 28 ? "mensual" : spanDays >= 14 ? "quincenal" : "semanal";

  return {
    media,
    resenas,
    negativas,
    restaurantes: ids.length,
    marca: marcaLabel,
    estado,
    estadoLabel,
    cover: {
      restauranteDisplay: topRestaurant.toUpperCase(),
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
