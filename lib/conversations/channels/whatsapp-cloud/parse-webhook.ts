import { normalizeProviderPhone } from "@/lib/conversations/normalize-phone";
import type {
  DeliveryStatus,
  InboundMessage,
  MessageContentType,
  MessageDeliveryError,
  MessageMedia,
  MessageStatusUpdate,
} from "@/lib/conversations/types";

/**
 * Traductor puro del webhook de WhatsApp Cloud API al modelo interno de Nexo.
 * Es el único sitio que conoce la forma del JSON de Meta. Recibe `unknown` y
 * nunca lanza: lo que no se puede representar se omite.
 */

export type ParsedWhatsAppWebhook = {
  messages: InboundMessage[];
  statuses: MessageStatusUpdate[];
};

type UnknownRecord = Record<string, unknown>;

const MEDIA_TYPES = ["image", "audio", "video", "document", "sticker"] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

const DELIVERY_STATUSES: readonly DeliveryStatus[] = [
  "sent",
  "delivered",
  "read",
  "failed",
  "deleted",
];

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** Meta entrega segundos Unix como texto. Sin valor válido no se inventa fecha. */
function parseTimestamp(value: unknown): Date | null {
  let seconds: number;
  if (typeof value === "string" && /^\d{1,11}$/.test(value)) {
    seconds = Number(value);
  } else if (typeof value === "number" && Number.isInteger(value)) {
    seconds = value;
  } else {
    return null;
  }
  if (seconds <= 0 || seconds > 99_999_999_999) return null;
  return new Date(seconds * 1000);
}

function isMediaType(type: string): type is MediaType {
  return (MEDIA_TYPES as readonly string[]).includes(type);
}

function parseMedia(type: MediaType, body: unknown): MessageMedia | null {
  if (!isRecord(body)) return null;
  const externalMediaId = asNonEmptyString(body.id);
  const mimeType = asNonEmptyString(body.mime_type);
  if (!externalMediaId || !mimeType) return null;

  const media: MessageMedia = { externalMediaId, mimeType };
  const filename = asNonEmptyString(body.filename);
  const caption = asNonEmptyString(body.caption);
  if (filename) media.filename = filename;
  if (caption) media.caption = caption;
  // Solo el indicador explícito del proveedor; nunca se infiere del mime type.
  if (type === "audio" && body.voice === true) media.isVoiceMessage = true;
  return media;
}

/**
 * Respuesta a un botón. Meta usa dos formas:
 *  - `type: "button"` → quick reply de una PLANTILLA: `button.payload` y `button.text`.
 *  - `type: "interactive"` → `button_reply` / `list_reply` con `id` y `title`.
 */
function parseButtonReply(type: string, raw: UnknownRecord): { id?: string; title?: string } | null {
  let id: string | undefined;
  let title: string | undefined;

  if (type === "button" && isRecord(raw.button)) {
    id = asNonEmptyString(raw.button.payload);
    title = asNonEmptyString(raw.button.text);
  } else if (type === "interactive" && isRecord(raw.interactive)) {
    const reply = isRecord(raw.interactive.button_reply)
      ? raw.interactive.button_reply
      : isRecord(raw.interactive.list_reply)
        ? raw.interactive.list_reply
        : null;
    if (reply) {
      id = asNonEmptyString(reply.id);
      title = asNonEmptyString(reply.title);
    }
  }

  if (!id && !title) return null;
  return { ...(id ? { id } : {}), ...(title ? { title } : {}) };
}

function parseMessage(
  raw: unknown,
  channelExternalId: string,
  profileNames: Map<string, string>
): InboundMessage | null {
  if (!isRecord(raw)) return null;

  const externalMessageId = asNonEmptyString(raw.id);
  const senderPhone = normalizeProviderPhone(asNonEmptyString(raw.from));
  const providerTimestamp = parseTimestamp(raw.timestamp);
  if (!externalMessageId || !senderPhone || !providerTimestamp) return null;

  const message: InboundMessage = {
    externalMessageId,
    channelExternalId,
    senderPhone,
    contentType: "unsupported",
    providerTimestamp,
    raw,
  };

  const profileName = profileNames.get(senderPhone);
  if (profileName) message.senderProfileName = profileName;

  const type = typeof raw.type === "string" ? raw.type : "";

  if (type === "text") {
    const body = isRecord(raw.text) ? raw.text.body : undefined;
    if (typeof body === "string") {
      message.contentType = "text";
      message.text = body;
    }
  } else if (type === "button" || type === "interactive") {
    const reply = parseButtonReply(type, raw);
    if (reply) {
      message.contentType = "text";
      message.text = reply.title ?? reply.id;
      message.interactive = reply;
    }
  } else if (isMediaType(type)) {
    const media = parseMedia(type, raw[type]);
    if (media) {
      message.contentType = type satisfies MessageContentType;
      message.media = media;
    }
  }

  return message;
}

function parseStatusError(errors: unknown): MessageDeliveryError | undefined {
  const first = asArray(errors).find(isRecord);
  if (!first) return undefined;

  const error: MessageDeliveryError = {};
  if (typeof first.code === "number" || typeof first.code === "string") {
    error.code = String(first.code);
  }
  const errorData = isRecord(first.error_data) ? first.error_data : undefined;
  const message =
    asNonEmptyString(first.message) ??
    asNonEmptyString(first.title) ??
    asNonEmptyString(errorData?.details);
  if (message) error.message = message;

  return error.code || error.message ? error : undefined;
}

function parseStatus(raw: unknown, externalChannelId: string): MessageStatusUpdate | null {
  if (!isRecord(raw)) return null;

  const externalMessageId = asNonEmptyString(raw.id);
  const recipientPhone = normalizeProviderPhone(asNonEmptyString(raw.recipient_id));
  const providerTimestamp = parseTimestamp(raw.timestamp);
  const status = DELIVERY_STATUSES.find((candidate) => candidate === raw.status);
  if (!externalMessageId || !recipientPhone || !providerTimestamp || !status) return null;

  const update: MessageStatusUpdate = {
    externalMessageId,
    externalChannelId,
    recipientPhone,
    status,
    providerTimestamp,
  };

  if (status === "failed") {
    const error = parseStatusError(raw.errors);
    if (error) update.error = error;
  }

  return update;
}

/** Nombres de perfil por teléfono, relacionados por `wa_id` (no por posición). */
function buildProfileNames(contacts: unknown): Map<string, string> {
  const names = new Map<string, string>();
  for (const contact of asArray(contacts)) {
    if (!isRecord(contact)) continue;
    const phone = normalizeProviderPhone(asNonEmptyString(contact.wa_id));
    const profile = isRecord(contact.profile) ? contact.profile : undefined;
    const name = asNonEmptyString(profile?.name);
    if (phone && name) names.set(phone, name);
  }
  return names;
}

function collect<T>(items: unknown, parse: (item: unknown) => T | null, into: T[]): void {
  for (const item of asArray(items)) {
    try {
      const parsed = parse(item);
      if (parsed) into.push(parsed);
    } catch {
      // Un elemento roto no debe impedir procesar el resto.
    }
  }
}

export function parseWhatsAppWebhook(payload: unknown): ParsedWhatsAppWebhook {
  const result: ParsedWhatsAppWebhook = { messages: [], statuses: [] };

  try {
    if (!isRecord(payload) || payload.object !== "whatsapp_business_account") return result;

    for (const entry of asArray(payload.entry)) {
      if (!isRecord(entry)) continue;

      for (const change of asArray(entry.changes)) {
        if (!isRecord(change) || change.field !== "messages") continue;
        const value = change.value;
        if (!isRecord(value)) continue;

        const metadata = isRecord(value.metadata) ? value.metadata : undefined;
        const channelId = asNonEmptyString(metadata?.phone_number_id);
        if (!channelId) continue;

        const profileNames = buildProfileNames(value.contacts);
        collect(
          value.messages,
          (raw) => parseMessage(raw, channelId, profileNames),
          result.messages
        );
        collect(value.statuses, (raw) => parseStatus(raw, channelId), result.statuses);
      }
    }
  } catch {
    // Contrato: un payload externo malformado nunca lanza hacia el llamador.
  }

  return result;
}
