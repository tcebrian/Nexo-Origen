import { getSupabaseDataClientForServer } from "@/lib/supabase/data-client";
import { fetchMarcasMap } from "./marcas";
import type { KpiRestaurantRow } from "./kpi-restaurantes";

export type RestauranteRow = {
  id: number;
  nombre: string;
  ciudad: string;
  marca_id: number | null;
  marca: string;
  mediaGoogle: number | null;
  totalResenasGoogle: number | null;
};

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeRestaurante(
  row: Record<string, unknown>,
  marcas: Map<number, string>
): RestauranteRow | null {
  const id = row.id ?? row.restaurante_id;
  const nombre = row.nombre ?? row.restaurante ?? row.name;
  if (id == null || !nombre) return null;

  const marcaId = row.marca_id != null ? toNumber(row.marca_id) : null;
  const marca =
    (row.marca ? String(row.marca) : null) ??
    (marcaId != null ? marcas.get(marcaId) : null) ??
    "";

  const mediaGoogleRaw = row.media_google;
  const totalResenasGoogleRaw = row.total_resenas_google;

  return {
    id: toNumber(id),
    nombre: String(nombre),
    ciudad: String(row.ciudad ?? row.city ?? row.ubicacion ?? ""),
    marca_id: marcaId,
    marca,
    mediaGoogle:
      mediaGoogleRaw != null && Number.isFinite(Number(mediaGoogleRaw))
        ? Number(mediaGoogleRaw)
        : null,
    totalResenasGoogle:
      totalResenasGoogleRaw != null && Number.isFinite(Number(totalResenasGoogleRaw))
        ? Number(totalResenasGoogleRaw)
        : null,
  };
}

export async function fetchRestaurantesCatalog(): Promise<RestauranteRow[]> {
  const client = await getSupabaseDataClientForServer();
  const marcas = await fetchMarcasMap();

  const { data, error } = await client.from("restaurantes").select("*").order("nombre");

  if (error) {
    console.error("[fetchRestaurantesCatalog] Error Supabase:", error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => normalizeRestaurante(row as Record<string, unknown>, marcas))
    .filter((row): row is RestauranteRow => row !== null);
}

export async function fetchRestaurantesMap(): Promise<Map<number, RestauranteRow>> {
  const catalog = await fetchRestaurantesCatalog();
  return new Map(catalog.map((r) => [r.id, r]));
}

export function mergeRestauranteIntoKpi(
  row: KpiRestaurantRow,
  catalog: Map<number, RestauranteRow>
): KpiRestaurantRow {
  const meta = catalog.get(row.restaurante_id);
  if (!meta) return row;

  return {
    ...row,
    restaurante: meta.nombre || row.restaurante,
    ciudad: meta.ciudad || row.ciudad,
    marca: meta.marca || row.marca,
    media_google: meta.mediaGoogle,
    total_resenas_google: meta.totalResenasGoogle,
  };
}

export async function enrichKpiRows(rows: KpiRestaurantRow[]): Promise<KpiRestaurantRow[]> {
  const catalog = await fetchRestaurantesMap();
  if (catalog.size === 0) return rows;
  return rows.map((row) => mergeRestauranteIntoKpi(row, catalog));
}
