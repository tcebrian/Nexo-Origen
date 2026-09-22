import "server-only";

import { restaurantSlug } from "@/app/dashboard/restaurantes/utils";
import { marcaToBrandId } from "@/lib/restaurants/brand-resolve";
import type {
  NetworkPeriodMetrics,
  PeriodMetricsResult,
  ProblemDistributionItem,
  RestaurantPeriodMetrics,
} from "@/lib/review-metrics";
import type { KpiRestaurantRow } from "@/lib/supabase/kpi-restaurantes";
import { getSupabaseDataClientForServer } from "@/lib/supabase/data-client";

export type SupabaseMetricRow = {
  restaurante_id: number | string;
  total_resenas: number | string;
  rating_sum: number | string;
  media_exacta: number | string;
  positivas: number | string;
  neutras: number | string;
  negativas: number | string;
  atencion: number | string;
  stars_1: number | string;
  stars_2: number | string;
  stars_3: number | string;
  stars_4: number | string;
  stars_5: number | string;
  ultima_resena: string | null;
  operational_status: string;
  source: string;
  network_total_resenas: number | string;
  network_rating_sum: number | string;
  network_media_exacta: number | string;
  network_positivas: number | string;
  network_neutras: number | string;
  network_negativas: number | string;
  network_atencion: number | string;
  network_total_restaurantes: number | string;
  network_positive_pct: number | string;
  network_negative_pct: number | string;
  network_ultima_resena: string | null;
};

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function operationalStatus(
  value: string
): RestaurantPeriodMetrics["operationalStatus"] {
  if (value === "on_target" || value === "critical") return value;
  return "watch";
}

function statusLabel(
  value: RestaurantPeriodMetrics["operationalStatus"]
): RestaurantPeriodMetrics["statusLabel"] {
  if (value === "on_target") return "Óptimo";
  if (value === "critical") return "Crítico";
  return "En riesgo";
}

function metricSource(value: string): NetworkPeriodMetrics["source"] {
  if (value === "resenas" || value === "kpi_diario") return value;
  return "empty";
}

export async function fetchSupabaseCanonicalReputationMetrics(
  startKey: string,
  endKey: string,
  restaurantIds: number[]
): Promise<SupabaseMetricRow[]> {
  if (restaurantIds.length === 0) return [];

  const client = await getSupabaseDataClientForServer();
  const { data, error } = await client.rpc("nexo_reputation_period_metrics", {
    p_start: startKey,
    p_end: endKey,
    p_restaurant_ids: restaurantIds,
  });

  if (error) {
    throw new Error(
      `Supabase canonical reputation metrics failed: ${error.message}`
    );
  }

  return (data ?? []) as SupabaseMetricRow[];
}

export function mapSupabaseCanonicalMetrics(input: {
  catalog: KpiRestaurantRow[];
  rows: SupabaseMetricRow[];
  problemDistribution?: ProblemDistributionItem[];
}): PeriodMetricsResult {
  const rowByRestaurant = new Map(
    input.rows.map((row) => [num(row.restaurante_id), row])
  );

  const byRestaurante = new Map<number, RestaurantPeriodMetrics>();

  for (const catalog of input.catalog) {
    const row = rowByRestaurant.get(catalog.restaurante_id);
    const operational = row
      ? operationalStatus(row.operational_status)
      : "watch";

    byRestaurante.set(catalog.restaurante_id, {
      restauranteId: catalog.restaurante_id,
      restaurante: catalog.restaurante,
      ciudad: catalog.ciudad,
      marca: catalog.marca,
      brand: marcaToBrandId(catalog.marca),
      slug: restaurantSlug(catalog.restaurante),
      totalResenas: row ? num(row.total_resenas) : 0,
      media: row ? num(row.media_exacta) : 0,
      resenasPositivas: row ? num(row.positivas) : 0,
      resenasNegativas: row ? num(row.negativas) : 0,
      stars: {
        stars1: row ? num(row.stars_1) : 0,
        stars2: row ? num(row.stars_2) : 0,
        stars3: row ? num(row.stars_3) : 0,
        stars4: row ? num(row.stars_4) : 0,
        stars5: row ? num(row.stars_5) : 0,
      },
      statusLabel: statusLabel(operational),
      operationalStatus: operational,
      ultimaResena: row?.ultima_resena ?? null,
    });
  }

  const first = input.rows[0];
  const network: NetworkPeriodMetrics = first
    ? {
        mediaGlobal: num(first.network_media_exacta),
        totalResenas: num(first.network_total_resenas),
        totalPositivas: num(first.network_positivas),
        totalNegativas: num(first.network_negativas),
        totalRestaurantes: num(first.network_total_restaurantes),
        positivePct: num(first.network_positive_pct),
        negativePct: num(first.network_negative_pct),
        ultimaActualizacion: first.network_ultima_resena,
        source: metricSource(first.source),
      }
    : {
        mediaGlobal: 0,
        totalResenas: 0,
        totalPositivas: 0,
        totalNegativas: 0,
        totalRestaurantes: input.catalog.length,
        positivePct: 0,
        negativePct: 0,
        ultimaActualizacion: null,
        source: "empty",
      };

  return {
    byRestaurante,
    network,
    problemDistribution: input.problemDistribution ?? [],
  };
}

export type MetricMismatch = {
  restaurantId: number;
  field: string;
  supabase: number | string;
  legacy: number | string;
};

export function compareReputationMetricResults(
  canonical: PeriodMetricsResult,
  legacy: PeriodMetricsResult
): MetricMismatch[] {
  const mismatches: MetricMismatch[] = [];
  const epsilon = 1e-9;

  for (const [restaurantId, canonicalRow] of canonical.byRestaurante) {
    const legacyRow = legacy.byRestaurante.get(restaurantId);
    if (!legacyRow) {
      mismatches.push({
        restaurantId,
        field: "missing_legacy_row",
        supabase: canonicalRow.totalResenas,
        legacy: "missing",
      });
      continue;
    }

    const numericPairs: Array<
      [string, number, number]
    > = [
      ["total_resenas", canonicalRow.totalResenas, legacyRow.totalResenas],
      ["media", canonicalRow.media, legacyRow.media],
      ["positivas", canonicalRow.resenasPositivas, legacyRow.resenasPositivas],
      ["negativas", canonicalRow.resenasNegativas, legacyRow.resenasNegativas],
      ["stars_1", canonicalRow.stars.stars1, legacyRow.stars.stars1],
      ["stars_2", canonicalRow.stars.stars2, legacyRow.stars.stars2],
      ["stars_3", canonicalRow.stars.stars3, legacyRow.stars.stars3],
      ["stars_4", canonicalRow.stars.stars4, legacyRow.stars.stars4],
      ["stars_5", canonicalRow.stars.stars5, legacyRow.stars.stars5],
    ];

    for (const [field, supabaseValue, legacyValue] of numericPairs) {
      if (Math.abs(supabaseValue - legacyValue) > epsilon) {
        mismatches.push({
          restaurantId,
          field,
          supabase: supabaseValue,
          legacy: legacyValue,
        });
      }
    }

    if (canonicalRow.operationalStatus !== legacyRow.operationalStatus) {
      mismatches.push({
        restaurantId,
        field: "operational_status",
        supabase: canonicalRow.operationalStatus,
        legacy: legacyRow.operationalStatus,
      });
    }
  }

  const networkPairs: Array<[string, number, number]> = [
    [
      "network_total_resenas",
      canonical.network.totalResenas,
      legacy.network.totalResenas,
    ],
    [
      "network_media",
      canonical.network.mediaGlobal,
      legacy.network.mediaGlobal,
    ],
    [
      "network_positivas",
      canonical.network.totalPositivas,
      legacy.network.totalPositivas,
    ],
    [
      "network_negativas",
      canonical.network.totalNegativas,
      legacy.network.totalNegativas,
    ],
  ];

  for (const [field, supabaseValue, legacyValue] of networkPairs) {
    if (Math.abs(supabaseValue - legacyValue) > epsilon) {
      mismatches.push({
        restaurantId: 0,
        field,
        supabase: supabaseValue,
        legacy: legacyValue,
      });
    }
  }

  return mismatches;
}

export async function recordMetricValidationMismatch(input: {
  startKey: string;
  endKey: string;
  restaurantCount: number;
  mismatches: MetricMismatch[];
}): Promise<void> {
  if (input.mismatches.length === 0) return;

  try {
    const client = await getSupabaseDataClientForServer();
    await client.from("nexo_metric_validation_events").insert({
      metric_domain: "reputation",
      start_date: input.startKey,
      end_date: input.endKey,
      restaurant_count: input.restaurantCount,
      mismatch_count: input.mismatches.length,
      details: {
        mismatches: input.mismatches.slice(0, 100),
      },
    });
  } catch (error) {
    console.error("[recordMetricValidationMismatch]", error);
  }
}


type MotiveRpcRow = {
  categoria: string;
  total: number | string;
  percent: number | string;
  restaurantes_afectados: number | string;
};

const MOTIVE_LABELS: Record<string, string> = {
  TIEMPO_ESPERA: "Tiempo de espera",
  ATENCION_PERSONAL: "Atención",
  CALIDAD_PRODUCTO: "Calidad producto",
  LIMPIEZA: "Limpieza",
  PEDIDO_INCORRECTO: "Error pedido",
  AMBIENTE_RUIDO: "Ruido/Saturación",
  AMBIENTE_LOCAL: "Ruido/Saturación",
  OTRO: "Otros",
};

export async function fetchSupabaseCanonicalMotives(
  startKey: string,
  endKey: string,
  restaurantIds: number[]
): Promise<ProblemDistributionItem[]> {
  if (restaurantIds.length === 0) return [];

  const client = await getSupabaseDataClientForServer();
  const { data, error } = await client.rpc("nexo_reputation_period_motives", {
    p_start: startKey,
    p_end: endKey,
    p_restaurant_ids: restaurantIds,
  });

  if (error) {
    console.error("[fetchSupabaseCanonicalMotives]", error.message);
    return [];
  }

  return ((data ?? []) as MotiveRpcRow[]).map((row) => ({
    label: MOTIVE_LABELS[row.categoria] ?? row.categoria,
    count: num(row.total),
    percent: Math.round(num(row.percent) * 10) / 10,
    provisional: false,
  }));
}
