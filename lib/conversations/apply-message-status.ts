import type { ChannelProvider, MessageStatusUpdate } from "@/lib/conversations/types";

/**
 * Caso de uso: aplicar UN estado de entrega (sent/delivered/read/failed/deleted)
 * notificado por el proveedor a un mensaje saliente ya guardado.
 *
 *   resolver canal (provider + phone_number_id) → localizar mensaje por
 *   (canal_id + wamid) → avanzar su estado según `status-transitions.ts`
 *
 * No conoce el JSON de ningún proveedor ni a Supabase. Reglas:
 *  - El mensaje se localiza SOLO por canal + id externo (wamid); nunca por
 *    teléfono ni por texto.
 *  - Un wamid desconocido (p. ej. enviado por Make u otro flujo) o un canal
 *    desconocido son resultados normales: no se crea nada y no hay error.
 *  - Idempotente: repetir un estado, o recibir uno más antiguo, no cambia nada.
 *  - Solo se actualiza `status`; el teléfono, el texto y el error del proveedor
 *    no se usan ni se guardan.
 */

export type StatusRepository = {
  resolveChannel(
    provider: ChannelProvider,
    externalAccountId: string
  ): Promise<{ status: "found" | "inactive"; channel: { id: string } } | { status: "not_found" }>;
  /** Una única actualización condicional por (canal, wamid, saliente). */
  applyStatus(input: {
    canalId: string;
    externalMessageId: string;
    incoming: MessageStatusUpdate["status"];
  }): Promise<"updated" | "unchanged" | "not_found">;
};

export type ApplyStatusResult =
  | { status: "updated" }
  /** El mensaje existe pero el estado ya estaba aplicado o es más antiguo. */
  | { status: "unchanged" }
  | { status: "message_not_found" }
  | { status: "channel_not_found" };

export async function applyWhatsAppMessageStatus(
  repository: StatusRepository,
  provider: ChannelProvider,
  update: MessageStatusUpdate
): Promise<ApplyStatusResult> {
  // El canal puede estar desactivado para mensajes entrantes y aun así tener
  // mensajes salientes antiguos: el estado se aplica igualmente.
  const channel = await repository.resolveChannel(provider, update.externalChannelId);
  if (channel.status === "not_found") return { status: "channel_not_found" };

  const outcome = await repository.applyStatus({
    canalId: channel.channel.id,
    externalMessageId: update.externalMessageId,
    incoming: update.status,
  });

  return outcome === "not_found" ? { status: "message_not_found" } : { status: outcome };
}
