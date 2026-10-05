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

/** Ciclo de vida de un mensaje. Un mensaje entrante nace en `received`. */
export const MESSAGE_STATUSES = [
  "received",
  "sent",
  "delivered",
  "read",
  "failed",
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
  /** Momento del evento según el proveedor, no el de recepción. */
  providerTimestamp: Date;
  /** Fragmento original del proveedor, opcional, para depuración/reproceso. */
  raw?: unknown;
};
