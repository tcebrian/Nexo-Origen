/**
 * Modelo interno de Nexo Conversations.
 *
 * Estos tipos no conocen a ningún proveedor: los adaptadores (p. ej. el de
 * WhatsApp Cloud API) traducen su formato a este vocabulario.
 */

export const MESSAGE_DIRECTIONS = ["inbound", "outbound"] as const;
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number];

export const MESSAGE_CONTENT_TYPES = [
  "text",
  "image",
  "audio",
  "video",
  "document",
  "sticker",
  "unsupported",
] as const;
export type MessageContentType = (typeof MESSAGE_CONTENT_TYPES)[number];

/** Quién origina el mensaje. */
export const MESSAGE_SENDER_TYPES = ["contact", "human", "ai", "system"] as const;
export type MessageSenderType = (typeof MESSAGE_SENDER_TYPES)[number];

/**
 * Ciclo de vida de un mensaje. Un mensaje entrante nace en `received`.
 * `pending`: saliente reservado cuyo envío a Meta aún no está confirmado (sin wamid).
 * `deleted`: el proveedor informa de que el mensaje fue eliminado.
 */
export const MESSAGE_STATUSES = [
  "received",
  "pending",
  "sent",
  "delivered",
  "read",
  "failed",
  "deleted",
] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

/**
 * Metadatos de un medio. Nunca contiene el binario: solo la referencia
 * externa necesaria para descargarlo más adelante.
 */
export type MessageMedia = {
  /** ID del medio en el proveedor (no es una URL). */
  externalMediaId: string;
  mimeType: string;
  filename?: string;
  caption?: string;
  /**
   * `true` solo si el proveedor lo indica de forma explícita. Si no hay
   * indicador queda sin definir: nunca se deduce del formato del archivo.
   */
  isVoiceMessage?: boolean;
};

/**
 * Mensaje entrante ya normalizado. Es lo que devolverá el parser de un
 * proveedor; no replica la estructura del payload original.
 */
export type InboundMessage = {
  /** ID del mensaje en el proveedor. Base de la idempotencia. */
  externalMessageId: string;
  /** ID externo del canal/número que recibe (no el teléfono visible). */
  channelExternalId: string;
  /** Teléfono del remitente en formato E.164 (ver normalize-phone.ts). */
  senderPhone: string;
  senderProfileName?: string;
  contentType: MessageContentType;
  /** Solo para `text`. El pie de un medio va en `media.caption`. */
  text?: string;
  media?: MessageMedia;
  /**
   * Respuesta a un botón (quick reply de una plantilla o botón interactivo). `id` es el payload
   * que Nexo puso en el botón al enviarlo; `title` el texto visible. El mensaje se guarda como
   * texto (`text` = título) y esto solo sirve para reconocer la acción.
   */
  interactive?: { id?: string; title?: string };
  /** Momento del evento según el proveedor, no el de recepción. */
  providerTimestamp: Date;
  /** Fragmento original del proveedor, opcional, para depuración/reproceso. */
  raw?: unknown;
};

/** Estados que un proveedor puede notificar sobre un mensaje saliente. */
export type DeliveryStatus = Extract<
  MessageStatus,
  "sent" | "delivered" | "read" | "failed" | "deleted"
>;

/** Error normalizado de un envío fallido. */
export type MessageDeliveryError = {
  code?: string;
  message?: string;
};

/**
 * Cambio de estado de un mensaje saliente ya normalizado. Se aplica sobre el
 * mensaje existente identificado por `externalMessageId`.
 */
export type MessageStatusUpdate = {
  externalMessageId: string;
  /** ID externo del canal/número desde el que se envió. */
  externalChannelId: string;
  /** Teléfono del destinatario en formato E.164. */
  recipientPhone: string;
  status: DeliveryStatus;
  providerTimestamp: Date;
  /** Solo presente en `failed`, si el proveedor informa de la causa. */
  error?: MessageDeliveryError;
};

/** Proveedores de canal admitidos. Hoy solo la API oficial de Meta. */
export const CHANNEL_PROVIDERS = ["whatsapp_cloud"] as const;
export type ChannelProvider = (typeof CHANNEL_PROVIDERS)[number];

export const CHANNEL_STATUSES = ["connected", "disabled", "error"] as const;
export type ChannelStatus = (typeof CHANNEL_STATUSES)[number];
