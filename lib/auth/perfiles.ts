import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";
import type { Perfil } from "@/lib/auth/types";
import { normalizeRole } from "@/lib/auth/permissions";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** Columnas reales de public.perfiles (id = auth.users.id). */
const PERFIL_COLUMNS = "id,nombre,email,rol,empresa_id,created_at";

function normalizeUserId(userId: string): string {
  return userId.trim().toLowerCase();
}

function readText(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

/** empresa_id en Supabase es int8; lo guardamos como string en la app. */
function readEmpresaId(row: Record<string, unknown>): string | null {
  const value = row.empresa_id ?? row.empresaId;
  if (value == null || value === "") return null;
  return String(value);
}

function mapPerfilRow(row: Record<string, unknown>, authUserId: string): Perfil | null {
  const id = readText(row, "id") ?? authUserId;
  const rol = normalizeRole(readText(row, "rol", "role") ?? "");
  if (!rol) {
    console.warn("[fetchPerfil] Fila sin rol válido para id:", id, "rol:", row.rol);
    return null;
  }

  return {
    id,
    userId: id,
    rol,
    nombre: readText(row, "nombre", "name"),
    email: readText(row, "email"),
    empresaId: readEmpresaId(row),
  };
}

/** perfiles.id = auth.users.id */
async function queryPerfil(
  client: SupabaseClient,
  userId: string
): Promise<{ perfil: Perfil | null; denied: boolean }> {
  const authUserId = normalizeUserId(userId);

  const { data, error } = await client
    .from(SUPABASE_TABLES.perfiles)
    .select(PERFIL_COLUMNS)
    .eq("id", authUserId)
    .maybeSingle();

  if (error) {
    console.error(
      `[fetchPerfil] Error Supabase (id=${authUserId}):`,
      error.message,
      error.code,
      error.details
    );
    const denied =
      error.code === "42501" || /permission|policy|row-level security/i.test(error.message);
    return { perfil: null, denied };
  }

  if (!data) {
    return { perfil: null, denied: false };
  }

  return { perfil: mapPerfilRow(data as Record<string, unknown>, authUserId), denied: false };
}

const perfilCache = new Map<string, { perfil: Perfil | null; denied: boolean; expires: number }>();
const PERFIL_CACHE_MS = 30_000;

function getCachedPerfil(userId: string) {
  const hit = perfilCache.get(normalizeUserId(userId));
  if (!hit || hit.expires < Date.now()) return null;
  return hit;
}

function setCachedPerfil(userId: string, perfil: Perfil | null, denied: boolean) {
  perfilCache.set(normalizeUserId(userId), {
    perfil,
    denied,
    expires: Date.now() + PERFIL_CACHE_MS,
  });
}

export function invalidatePerfilCache(userId?: string) {
  if (userId) {
    perfilCache.delete(normalizeUserId(userId));
    return;
  }
  perfilCache.clear();
}

/** Lectura con cliente Supabase (p. ej. middleware con cookies de sesión). */
export async function fetchPerfilByUserId(
  supabase: SupabaseClient,
  userId: string
): Promise<Perfil | null> {
  const { perfil } = await queryPerfil(supabase, userId);
  return perfil;
}

export type PerfilAuthResult = {
  perfil: Perfil | null;
  /** true si Supabase bloqueó la lectura (RLS / permisos). */
  denied: boolean;
};

/**
 * Lectura de perfil para auth en servidor.
 * 1) service role (omite RLS)  2) cliente con sesión del usuario (requiere policy o RLS off)
 */
export async function fetchPerfilForAuth(
  userId: string,
  supabase?: SupabaseClient
): Promise<PerfilAuthResult> {
  const authUserId = normalizeUserId(userId);
  const cached = getCachedPerfil(authUserId);
  if (cached) {
    return { perfil: cached.perfil, denied: cached.denied };
  }

  const clients: SupabaseClient[] = [];

  if (typeof window === "undefined") {
    const admin = getSupabaseAdmin();
    if (admin) {
      clients.push(admin);
    } else if (!supabase) {
      console.warn(
        "[fetchPerfilForAuth] SUPABASE_SERVICE_ROLE_KEY no configurada; lectura de perfiles depende de RLS/policies."
      );
    }
  }

  if (supabase) {
    clients.push(supabase);
  }

  let denied = false;
  for (const client of clients) {
    const result = await queryPerfil(client, authUserId);
    if (result.denied) denied = true;
    if (result.perfil) {
      setCachedPerfil(authUserId, result.perfil, false);
      return { perfil: result.perfil, denied: false };
    }
  }

  if (!denied) {
    console.warn(
      `[fetchPerfilForAuth] No se encontró perfil con id=${authUserId}. Verifica que perfiles.id coincida con auth.users.id.`
    );
  }

  setCachedPerfil(authUserId, null, denied);
  return { perfil: null, denied };
}
