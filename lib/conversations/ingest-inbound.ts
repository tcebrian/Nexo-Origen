import { buildMessagePreview } from "@/lib/conversations/message-preview";
import type { ChannelProvider, InboundMessage } from "@/lib/conversations/types";

/**
 * Caso de uso: procesar UN mensaje entrante ya normalizado.
 *
 *   resolver canal → contacto → conversación → insertar mensaje → último mensaje
 *
 * No conoce el JSON de ningún proveedor (llega ya traducido a `InboundMessage`)
 * ni a Supabase: recibe un repositorio mínimo, que en producción es
 * `conversationsRepository` de `lib/supabase/conversations.server.ts`.
 *
 * Decisiones:
 *  - Modelo de canal central: el canal (el WhatsApp de Nexo) y el contacto (la
 *    persona, por teléfono) son GLOBALES. La ingesta NO resuelve ni crea permisos
 *    de empresa/restaurante: un contacto nuevo puede existir con 0 empresas y 0
 *    restaurantes. DENY BY DEFAULT: los permisos (conv_contacto_empresas /
 *    conv_contacto_restaurantes) los consultará el futuro bot al acceder a datos,
 *    nunca deduciéndolos del texto del mensaje.
 *  - Canal inexistente o inactivo son resultados normales (no se crea nada).
 *  - Contacto, conversación y mensaje duplicados los decide la base de datos
 *    (restricciones únicas); aquí no hay consultas previas "por si acaso".
 *  - Una conversación `closed` se mantiene `closed`: no hay reapertura automática.
 *  - Sin transacción SQL/RPC: el flujo es idempotente, así que un fallo a mitad
 *    se repara reintentando (ver `ingestInboundMessage`). Los errores reales de
 *    base de datos se propagan para que el llamador pueda pedir un reintento.
 *  - `message.raw` no llega a la persistencia (retención pendiente de definir).
 */

/** Operaciones de persistencia que necesita este caso de uso. */
export type InboundConversationRepository = {
  resolveChannel(
    provider: ChannelProvider,
    externalAccountId: string
  ): Promise<
    | { status: "found" | "inactive"; channel: { id: string } }
    | { status: "not_found" }
  >;
  findOrCreateContact(input: {
    telefonoE164: string;
    profileName?: string;
  }): Promise<{ contact: { id: string }; created: boolean }>;
  findOrCreateConversation(input: {
    canalId: string;
    contactoId: string;
  }): Promise<{ conversation: { id: string }; created: boolean }>;
  insertInboundMessage(input: {
    message: InboundMessage;
    canalId: string;
    conversacionId: string;
  }): Promise<{ status: "inserted" | "duplicate" }>;
  touchConversationLastMessage(input: {
    conversacionId: string;
    canalId: string;
    lastMessageAt: Date;
    preview: string;
  }): Promise<boolean>;
};

export type IngestInboundResult =
  | {
      /** `stored`: mensaje nuevo guardado. `duplicate`: ya existía (resultado normal). */
      status: "stored" | "duplicate";
      channelId: string;
      contactId: string;
      conversationId: string;
      contactCreated: boolean;
      conversationCreated: boolean;
      /** `true` si este mensaje hizo avanzar `ultimo_mensaje_at`. */
      lastMessageUpdated: boolean;
    }
  | { status: "channel_not_found" }
  | { status: "channel_inactive"; channelId: string };

export async function ingestInboundMessage(
  repository: InboundConversationRepository,
  provider: ChannelProvider,
  message: InboundMessage
): Promise<IngestInboundResult> {
  const resolved = await repository.resolveChannel(provider, message.channelExternalId);
  if (resolved.status === "not_found") return { status: "channel_not_found" };
  if (resolved.status === "inactive") {
    return { status: "channel_inactive", channelId: resolved.channel.id };
  }

  const channelId = resolved.channel.id;

  // Persona global por teléfono. Sin empresas ni restaurantes: no se crea ningún permiso.
  const { contact, created: contactCreated } = await repository.findOrCreateContact({
    telefonoE164: message.senderPhone,
    profileName: message.senderProfileName,
  });

  const { conversation, created: conversationCreated } = await repository.findOrCreateConversation({
    canalId: channelId,
    contactoId: contact.id,
  });

  // El fragmento original del proveedor no se persiste.
  const persistable: InboundMessage = { ...message };
  delete persistable.raw;

  const inserted = await repository.insertInboundMessage({
    message: persistable,
    canalId: channelId,
    conversacionId: conversation.id,
  });

  // También tras un duplicado: si una ejecución anterior guardó el mensaje pero
  // falló antes de esto, repetir el webhook repara la conversación. La condición
  // temporal de la actualización impide que retroceda.
  const lastMessageUpdated = await repository.touchConversationLastMessage({
    conversacionId: conversation.id,
    canalId: channelId,
    lastMessageAt: message.providerTimestamp,
    preview: buildMessagePreview(message),
  });

  return {
    status: inserted.status === "inserted" ? "stored" : "duplicate",
    channelId,
    contactId: contact.id,
    conversationId: conversation.id,
    contactCreated,
    conversationCreated,
    lastMessageUpdated,
  };
}
