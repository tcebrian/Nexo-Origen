import type { KpiRestaurantRow } from "@/lib/supabase/kpi-restaurantes";

const TTL_MS = 60_000;

let cachedRows: KpiRestaurantRow[] | null = null;
let cachedAt = 0;
let inflight: Promise<KpiRestaurantRow[]> | null = null;

export async function fetchAllKpiRowsCached(
  loader: () => Promise<KpiRestaurantRow[]>
): Promise<KpiRestaurantRow[]> {
  const now = Date.now();
  if (cachedRows && now - cachedAt < TTL_MS) {
    return cachedRows;
  }

  if (!inflight) {
    inflight = loader()
      .then((rows) => {
        cachedRows = rows;
        cachedAt = Date.now();
        return rows;
      })
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}

export function invalidateKpiCatalogCache() {
  cachedRows = null;
  cachedAt = 0;
}
