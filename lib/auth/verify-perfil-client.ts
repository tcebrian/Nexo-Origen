import { normalizeRole } from "@/lib/auth/permissions";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PerfilVerifyResult =
  | { ok: true }
  | { ok: false; reason: "missing" | "invalid_rol" | "forbidden" };

/** Comprueba perfiles.id = auth.users.id con la sesión ya autenticada. */
export async function verifyPerfilForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<PerfilVerifyResult> {
  const { data, error } = await supabase
    .from(SUPABASE_TABLES.perfiles)
    .select("id,rol")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[verifyPerfilForUser]", error.code, error.message);
    if (error.code === "42501" || /permission|policy/i.test(error.message)) {
      return { ok: false, reason: "forbidden" };
    }
    return { ok: false, reason: "missing" };
  }

  if (!data) {
    console.warn("[verifyPerfilForUser] Sin fila en perfiles para id:", userId);
    return { ok: false, reason: "missing" };
  }

  if (!normalizeRole(String(data.rol ?? ""))) {
    return { ok: false, reason: "invalid_rol" };
  }

  return { ok: true };
}

export function perfilVerifyErrorMessage(
  reason: "missing" | "invalid_rol" | "forbidden"
): string {
  switch (reason) {
    case "forbidden":
      return "No se puede leer la tabla perfiles. Ejecuta supabase/fix-perfiles-access.sql en Supabase o añade SUPABASE_SERVICE_ROLE_KEY al .env.local.";
    case "invalid_rol":
      return "Tu perfil no tiene un rol válido.";
    case "missing":
    default:
      return "Tu cuenta no tiene un perfil autorizado.";
  }
}
