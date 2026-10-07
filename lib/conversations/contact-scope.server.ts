import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";
import { resolveRestaurantIds, type ContactGrants } from "@/lib/conversations/contact-access";

/**
 * Alcance de datos de un CONTACTO de WhatsApp: qué restaurantes puede consultar o
 * recibir (informes diarios, alertas, bot). Es la fuente de verdad de todos esos
 * canales y NO depende de ninguna cuenta web: sale solo de
 *
 *   conv_contacto_empresas      (empresa + todos_restaurantes)
 *   conv_contacto_restaurantes  (restaurantes concretos)
 *
 * `conv_contactos.usuario_id` (vínculo opcional con una cuenta web) no interviene.
 * Se resuelve en cada llamada (nunca se copia ni se cachea): si ayer tenía 4
 * restaurantes y hoy 3, hoy son 3; con "todos", los restaurantes nuevos entran solos.
 *
 * DENY BY DEFAULT: contacto inexistente, sin empresa ni asignaciones, o cualquier
 * error de lectura ⇒ ningún restaurante.
 */

type EmpresaRow = { contacto_id: string; empresa_id: number; todos_restaurantes: boolean };
type RestauranteRow = { contacto_id: string; empresa_id: number; restaurante_id: number };

async function loadGrants(contactIds: string[]) {
  const client = getSupabaseAdmin();
  if (!client || contactIds.length === 0) return null;

  const [empresas, restaurantes, catalog] = await Promise.all([
    client.from(SUPABASE_TABLES.conv_contacto_empresas).select("contacto_id,empresa_id,todos_restaurantes").in("contacto_id", contactIds),
    client.from(SUPABASE_TABLES.conv_contacto_restaurantes).select("contacto_id,empresa_id,restaurante_id").in("contacto_id", contactIds),
    client.from(SUPABASE_TABLES.restaurantes).select("id,empresa_id"),
  ]);
  if (empresas.error || restaurantes.error || catalog.error) return null;

  return {
    empresas: (empresas.data ?? []) as EmpresaRow[],
    restaurantes: (restaurantes.data ?? []) as RestauranteRow[],
    catalog: ((catalog.data ?? []) as { id: number; empresa_id: number | null }[]).map((row) => ({
      id: Number(row.id),
      empresaId: row.empresa_id === null ? null : Number(row.empresa_id),
    })),
  };
}

function grantsOf(contactId: string, data: NonNullable<Awaited<ReturnType<typeof loadGrants>>>): ContactGrants {
  return {
    empresas: data.empresas
      .filter((row) => row.contacto_id === contactId)
      .map((row) => ({ empresaId: Number(row.empresa_id), todosRestaurantes: row.todos_restaurantes === true })),
    restaurantes: data.restaurantes
      .filter((row) => row.contacto_id === contactId)
      .map((row) => ({ empresaId: Number(row.empresa_id), restauranteId: Number(row.restaurante_id) })),
  };
}

/** Restaurantes que cada contacto puede consultar HOY (en 3 consultas, para listados). Sin acceso = lista vacía. */
export async function resolveContactsRestaurantIds(contactIds: string[]): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>(contactIds.map((id) => [id, []]));
  try {
    const data = await loadGrants(contactIds);
    if (!data) return result;
    for (const id of contactIds) result.set(id, resolveRestaurantIds(grantsOf(id, data), data.catalog));
  } catch {
    // Cualquier error → sin acceso.
  }
  return result;
}

/** Ids de restaurante que el contacto puede consultar HOY (lista vacía = ninguno). */
export async function resolveContactRestaurantIds(contactoId: string): Promise<number[]> {
  return (await resolveContactsRestaurantIds([contactoId])).get(contactoId) ?? [];
}

export type ContactAccessSelection = {
  empresaId: number | null;
  todosRestaurantes: boolean;
  /** Selección explícita guardada (vacía con "todos"). */
  restaurantIds: number[];
};

/** Lo que está guardado (para editar): empresa, "todos" y selección explícita. */
export async function getContactAccessSelection(contactoId: string): Promise<ContactAccessSelection> {
  const empty: ContactAccessSelection = { empresaId: null, todosRestaurantes: false, restaurantIds: [] };
  try {
    const data = await loadGrants([contactoId]);
    if (!data) return empty;
    const grants = grantsOf(contactoId, data);
    const empresa = grants.empresas[0];
    if (!empresa) return empty;
    return {
      empresaId: empresa.empresaId,
      todosRestaurantes: empresa.todosRestaurantes,
      restaurantIds: grants.restaurantes
        .filter((row) => row.empresaId === empresa.empresaId)
        .map((row) => row.restauranteId)
        .sort((a, b) => a - b),
    };
  } catch {
    return empty;
  }
}
