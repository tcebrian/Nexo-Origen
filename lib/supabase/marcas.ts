import { getSupabaseDataClientForServer } from "@/lib/supabase/data-client";

export type MarcaRow = {
  id: number;
  nombre: string;
};

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeMarca(row: Record<string, unknown>): MarcaRow | null {
  const id = row.id ?? row.marca_id;
  const nombre = row.nombre ?? row.marca ?? row.name;
  if (id == null || !nombre) return null;
  return { id: toNumber(id), nombre: String(nombre) };
}

export async function fetchMarcas(): Promise<MarcaRow[]> {
  const client = await getSupabaseDataClientForServer();
  const { data, error } = await client.from("marcas").select("*").order("nombre");

  if (error) {
    console.error("[fetchMarcas] Error Supabase:", error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => normalizeMarca(row as Record<string, unknown>))
    .filter((row): row is MarcaRow => row !== null);
}

export async function fetchMarcasMap(): Promise<Map<number, string>> {
  const marcas = await fetchMarcas();
  return new Map(marcas.map((m) => [m.id, m.nombre]));
}
