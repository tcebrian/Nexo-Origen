import { toDateKey } from "@/lib/dates/period";
import type { AnalisisIaRow } from "./analisis-ia";
import type { PeriodData, RestaurantPeriodMetrics } from "./period-types";

type SerializedPeriodPayload = Omit<PeriodData, "aggregates" | "fetchedAt" | "analisisByResenaId" | "impactByResenaId"> & {
  fetchedAt: string;
  analisisByResenaId: Record<string, AnalisisIaRow>;
  impactByResenaId: Record<string, PeriodData["impactByResenaId"] extends Map<number, infer V> ? V : never>;
  aggregates: Omit<PeriodData["aggregates"], "byRestaurante"> & {
    byRestaurante: Record<string, RestaurantPeriodMetrics>;
  };
};

export function serializePeriodData(data: PeriodData): SerializedPeriodPayload {
  return {
    ...data,
    fetchedAt: data.fetchedAt.toISOString(),
    analisisByResenaId: Object.fromEntries(data.analisisByResenaId),
    impactByResenaId: Object.fromEntries(
      [...data.impactByResenaId.entries()].map(([key, value]) => [String(key), value])
    ),
    aggregates: {
      ...data.aggregates,
      byRestaurante: Object.fromEntries(data.aggregates.byRestaurante),
    },
  };
}

export function deserializePeriodData(raw: SerializedPeriodPayload): PeriodData {
  return {
    ...raw,
    fetchedAt: new Date(raw.fetchedAt),
    analisisByResenaId: new Map(Object.entries(raw.analisisByResenaId ?? {})),
    impactByResenaId: new Map(
      Object.entries(raw.impactByResenaId ?? {}).map(([key, value]) => [Number(key), value])
    ),
    aggregates: {
      ...raw.aggregates,
      byRestaurante: new Map(
        Object.entries(raw.aggregates.byRestaurante).map(([key, value]) => [
          Number(key),
          value,
        ])
      ),
    },
  };
}

/** Carga periodo en el navegador vía API autenticada (sin imports de servidor). */
export async function loadPeriodData(start: Date, end: Date): Promise<PeriodData> {
  const startKey = toDateKey(start);
  const endKey = toDateKey(end);
  const params = new URLSearchParams({ start: startKey, end: endKey });
  const response = await fetch(`/api/period?${params.toString()}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("No se pudieron cargar los datos del periodo");
  }

  const json = (await response.json()) as SerializedPeriodPayload;
  return deserializePeriodData(json);
}
