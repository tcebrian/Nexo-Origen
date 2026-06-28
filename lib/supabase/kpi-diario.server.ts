import "server-only";

import { isDateKeyInRange, type PeriodBounds, toDateKey } from "@/lib/dates/period";
import { getSupabaseDataClientForServer } from "@/lib/supabase/data-client";
import type { KpiDiarioRow } from "./kpi-diario";

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeRow(row: Record<string, unknown>): KpiDiarioRow {
  const fechaRaw = row.fecha ?? row.fecha_dia ?? row.dia;
  return {
    restaurante_id: toNumber(row.restaurante_id),
    fecha: toDateKey(String(fechaRaw ?? "")),
    total_resenas: toNumber(row.total_resenas),
    media: toNumber(row.media ?? row.media_total ?? row.media_con),
    negativas: toNumber(row.negativas ?? row.resenas_negativas),
    positivas: toNumber(row.positivas ?? row.positivo ?? row.resenas_positivas),
  };
}

export async function getKpiDiarioTableCount(): Promise<number> {
  const client = await getSupabaseDataClientForServer();
  const { count, error } = await client
    .from("kpi_diario")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("[getKpiDiarioTableCount] Error:", error.message, error);
    return -1;
  }

  return count ?? 0;
}

const KPI_DIARIO_COLUMNS = "restaurante_id,fecha,total_resenas,media,negativas,positivas";

export async function fetchKpiDiarioForPeriod(bounds: PeriodBounds): Promise<KpiDiarioRow[]> {
  const client = await getSupabaseDataClientForServer();
  let { data, error } = await client
    .from("kpi_diario")
    .select(KPI_DIARIO_COLUMNS)
    .gte("fecha", bounds.startKey)
    .lte("fecha", bounds.endKey)
    .order("fecha", { ascending: true });

  if (error?.code === "42703") {
    ({ data, error } = await client
      .from("kpi_diario")
      .select("*")
      .gte("fecha", bounds.startKey)
      .lte("fecha", bounds.endKey)
      .order("fecha", { ascending: true }));
  }

  if (error) {
    console.error("[fetchKpiDiarioForPeriod] Error Supabase:", error.message, error);
    return [];
  }

  const rows = (data ?? [])
    .map((row) => normalizeRow(row as Record<string, unknown>))
    .filter(
      (row) =>
        row.restaurante_id > 0 &&
        row.fecha &&
        isDateKeyInRange(row.fecha, bounds.startKey, bounds.endKey)
    );

  return rows;
}
