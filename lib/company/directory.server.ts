import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";
import type { CompanyRecord, RestaurantRecord } from "./access";

export type CompanyDirectory = {
  companies: CompanyRecord[];
  restaurants: RestaurantRecord[];
  brandNameById: Map<number, string>;
};

/**
 * Empresas, restaurantes y marcas tal como están HOY en la base de datos (service role, solo servidor).
 * Nada está escrito en el código: una empresa nueva aparece sola en cuanto existe en `empresas`.
 */
export async function loadCompanyDirectory(): Promise<CompanyDirectory> {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase admin client is not configured.");

  const [companies, restaurants, brands] = await Promise.all([
    client.from(SUPABASE_TABLES.empresas).select("id,nombre,activo"),
    client.from(SUPABASE_TABLES.restaurantes).select("id,empresa_id,marca_id"),
    client.from(SUPABASE_TABLES.marcas).select("id,nombre"),
  ]);
  // Solo la operación y el SQLSTATE: nunca valores de filas.
  if (companies.error) throw new Error(`company-directory empresas failed (${companies.error.code ?? "unknown"})`);
  if (restaurants.error) throw new Error(`company-directory restaurantes failed (${restaurants.error.code ?? "unknown"})`);
  if (brands.error) throw new Error(`company-directory marcas failed (${brands.error.code ?? "unknown"})`);

  return {
    companies: ((companies.data ?? []) as { id: number; nombre: string | null; activo: boolean | null }[]).map((row) => ({
      id: Number(row.id),
      name: (row.nombre ?? "").trim() || `Empresa ${row.id}`,
      active: row.activo !== false,
    })),
    restaurants: ((restaurants.data ?? []) as { id: number; empresa_id: number | null; marca_id: number | null }[]).map((row) => ({
      id: Number(row.id),
      companyId: row.empresa_id === null ? null : Number(row.empresa_id),
      brandId: row.marca_id === null ? null : Number(row.marca_id),
    })),
    brandNameById: new Map(((brands.data ?? []) as { id: number; nombre: string }[]).map((row) => [Number(row.id), String(row.nombre)])),
  };
}
