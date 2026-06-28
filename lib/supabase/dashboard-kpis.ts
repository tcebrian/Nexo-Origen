import { getSupabaseDataClientForServer } from "@/lib/supabase/data-client";

export type DashboardKpisSnapshot = {
  mediaGlobal: number;
  totalResenas: number;
  totalNegativas: number;
  totalPositivas: number;
  totalRestaurantes: number;
  resumenIA: string | null;
};

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function pickString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim()) return String(value);
  }
  return null;
}

function pickNumber(row: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    if (row[key] != null) return toNumber(row[key]);
  }
  return 0;
}

function normalizeDashboardKpisRow(row: Record<string, unknown>): DashboardKpisSnapshot {
  return {
    mediaGlobal: pickNumber(row, ["media_global", "media", "media_total", "media_red"]),
    totalResenas: pickNumber(row, ["total_resenas", "resenas", "total_reviews"]),
    totalNegativas: pickNumber(row, ["total_negativas", "negativas", "resenas_negativas"]),
    totalPositivas: pickNumber(row, ["total_positivas", "positivas", "resenas_positivas"]),
    totalRestaurantes: pickNumber(row, ["total_restaurantes", "restaurantes", "locales"]),
    resumenIA: pickString(row, ["resumen_ia", "resumen", "insight_ia", "insight"]),
  };
}

function aggregateSnapshots(rows: DashboardKpisSnapshot[]): DashboardKpisSnapshot | null {
  if (rows.length === 0) return null;
  if (rows.length === 1) return rows[0];

  const totalResenas = rows.reduce((sum, row) => sum + row.totalResenas, 0);
  const totalNegativas = rows.reduce((sum, row) => sum + row.totalNegativas, 0);
  const totalPositivas = rows.reduce((sum, row) => sum + row.totalPositivas, 0);
  const weightedMedia =
    totalResenas > 0
      ? rows.reduce((sum, row) => sum + row.mediaGlobal * row.totalResenas, 0) / totalResenas
      : rows.reduce((sum, row) => sum + row.mediaGlobal, 0) / rows.length;

  const resumenIA = rows.map((row) => row.resumenIA).find(Boolean) ?? null;

  return {
    mediaGlobal: weightedMedia,
    totalResenas,
    totalNegativas,
    totalPositivas,
    totalRestaurantes: Math.max(...rows.map((row) => row.totalRestaurantes)),
    resumenIA,
  };
}

async function queryByDateColumn(
  column: string,
  startKey: string,
  endKey: string
): Promise<DashboardKpisSnapshot | null | "unavailable"> {
  const client = await getSupabaseDataClientForServer();
  const { data, error } = await client
    .from("dashboard_kpis")
    .select("*")
    .gte(column, startKey)
    .lte(column, endKey);

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("column") || message.includes("does not exist")) {
      return "unavailable";
    }
    console.error(`[fetchDashboardKpisForPeriod] Error (${column}):`, error.message);
    return null;
  }

  const snapshots = (data ?? []).map((row) =>
    normalizeDashboardKpisRow(row as Record<string, unknown>)
  );
  return aggregateSnapshots(snapshots);
}

let dashboardKpisTableUnavailable = false;

/** Lee KPIs pre-agregados de dashboard_kpis para el periodo (si la tabla existe y tiene datos). */
export async function fetchDashboardKpisForPeriod(
  startKey: string,
  endKey: string
): Promise<DashboardKpisSnapshot | null> {
  if (dashboardKpisTableUnavailable) return null;

  const strategies = ["fecha", "fecha_inicio", "periodo", "dia"] as const;

  for (const column of strategies) {
    const snapshot = await queryByDateColumn(column, startKey, endKey);
    if (snapshot === "unavailable") {
      dashboardKpisTableUnavailable = true;
      return null;
    }
    if (snapshot && (snapshot.totalResenas > 0 || snapshot.mediaGlobal > 0)) {
      return snapshot;
    }
  }

  return null;
}
