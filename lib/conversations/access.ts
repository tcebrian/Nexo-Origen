import { isSuperAdmin, normalizeRole } from "@/lib/auth/permissions";

/**
 * Decisión de producto: de momento solo super_admin puede leer Conversations.
 * Esta es la única regla; el menú, la página y las APIs la consumen de aquí.
 * Las tablas conv_* no tienen políticas RLS y se leen con service role, así que
 * esta comprobación en servidor es la barrera real.
 */
export function canReadConversations(rol: string | null | undefined): boolean {
  return isSuperAdmin(normalizeRole(rol));
}

export type ConversationsAccess =
  | { ok: true }
  | { ok: false; status: 401 | 403; error: string };

/** Autoriza una sesión (o su ausencia) para leer Conversations. */
export function authorizeConversationsAccess(
  session: { perfil: { rol: string | null | undefined } } | null | undefined
): ConversationsAccess {
  if (!session) return { ok: false, status: 401, error: "No autenticado" };
  if (!canReadConversations(session.perfil.rol)) {
    return { ok: false, status: 403, error: "No autorizado" };
  }
  return { ok: true };
}
