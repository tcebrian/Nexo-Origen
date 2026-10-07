import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";
import { ConversationsDbError, resolveChannel } from "@/lib/supabase/conversations.server";
import { statusesAllowedBefore } from "@/lib/conversations/status-transitions";
import type { StatusRepository } from "@/lib/conversations/apply-message-status";

/**
 * Persistencia de los estados de entrega (solo servidor, service role).
 * Una sola actualización condicional y atómica: la fila solo cambia si su estado
 * actual permite la transición (`status-transitions.ts`), así que dos webhooks
 * simultáneos o desordenados no pueden degradar un mensaje ni duplicarlo.
 * No crea filas, no toca `raw_payload` ni guarda el error del proveedor.
 */

function requireAdminClient() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase admin client is not configured.");
  return client;
}

const applyStatus: StatusRepository["applyStatus"] = async ({ canalId, externalMessageId, incoming }) => {
  const client = requireAdminClient();

  const { data: updated, error: updateError } = await client
    .from(SUPABASE_TABLES.conv_mensajes)
    .update({ status: incoming, updated_at: new Date().toISOString() })
    .eq("canal_id", canalId)
    .eq("external_id", externalMessageId)
    .eq("direction", "outbound")
    .in("status", [...statusesAllowedBefore(incoming)])
    .select("id");

  if (updateError) throw new ConversationsDbError("applyStatus.update", updateError.code);
  if ((updated?.length ?? 0) > 0) return "updated";

  // Sin cambios: ¿el mensaje no existe, o ya tenía un estado igual o posterior?
  const { data: existing, error: lookupError } = await client
    .from(SUPABASE_TABLES.conv_mensajes)
    .select("id")
    .eq("canal_id", canalId)
    .eq("external_id", externalMessageId)
    .eq("direction", "outbound")
    .maybeSingle();

  if (lookupError) throw new ConversationsDbError("applyStatus.lookup", lookupError.code);
  return existing ? "unchanged" : "not_found";
};

export const messageStatusRepository: StatusRepository = { resolveChannel, applyStatus };
