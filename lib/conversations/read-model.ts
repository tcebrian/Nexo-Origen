import type { MessageContentType, MessageDirection } from "@/lib/conversations/types";

/**
 * Modelo de lectura de Nexo Conversations: lo que la interfaz necesita ver.
 * Funciones puras (sin acceso a datos ni `server-only`) para poder probarlas y
 * reutilizarlas desde el cliente (buscador). La E/S vive en `read.server.ts`.
 *
 * Los DTO solo contienen campos de presentación: nunca `raw_payload`, ni IDs
 * externos del proveedor (`external_id`, `externalMediaId`).
 */

// Filas tal como llegan de la base de datos ------------------------------------

export type ContactReadRow = {
  telefono_e164: string;
  nombre: string | null;
  nombre_perfil: string | null;
  /** Id del contacto: solo se usa en servidor para resolver su acceso; no viaja al navegador. */
  id?: string;
  /** Tipo descriptivo (dirección, operaciones…). */
  tipo?: string | null;
};

export type ConversationReadRow = {
  id: string;
  estado: string;
  ultimo_mensaje_at: string | null;
  ultimo_mensaje_preview: string | null;
  /** El embed de PostgREST puede devolver objeto o lista de un elemento. */
  conv_contactos: ContactReadRow | ContactReadRow[] | null;
};

export type MessageReadRow = {
  id: string;
  direction: string;
  sender_type: string;
  content_type: string;
  text: string | null;
  media: unknown;
  status: string;
  provider_timestamp: string;
  received_at: string | null;
};

// DTO que viajan al navegador --------------------------------------------------

export type ConversationStatus = "open" | "closed";

/**
 * Acceso del contacto a datos de Nexo, resuelto desde SUS permisos (empresa y
 * restaurantes del contacto; no depende de ninguna cuenta web). Sin permisos NO hay
 * acceso (deny by default).
 */
export type ConversationAccess =
  | { state: "none" }
  | { state: "granted"; restaurantCount: number; tipo: string | null };

export type ConversationListItem = {
  id: string;
  displayName: string;
  /** Nombre de perfil de WhatsApp, solo si aporta algo distinto al nombre mostrado. */
  profileName: string | null;
  phone: string;
  status: ConversationStatus;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  access: ConversationAccess;
};

export type ConversationMessage = {
  id: string;
  direction: MessageDirection;
  contentType: MessageContentType;
  /** Texto del mensaje (solo `text`). */
  text: string | null;
  /** Etiqueta visible para medios y mensajes no compatibles; `null` en texto. */
  label: string | null;
  filename: string | null;
  caption: string | null;
  status: string;
  timestamp: string;
};

// Contacto ---------------------------------------------------------------------

function clean(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed === "" ? null : trimmed;
}

/** nombre → nombre_perfil → teléfono. */
export function resolveContactDisplayName(contact: ContactReadRow): string {
  return clean(contact.nombre) ?? clean(contact.nombre_perfil) ?? contact.telefono_e164;
}

// Conversaciones ---------------------------------------------------------------

function timeOf(value: string | null): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const t = Date.parse(value);
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

/** Más reciente primero; las conversaciones sin mensajes van al final. */
export function sortConversations(items: ConversationListItem[]): ConversationListItem[] {
  return [...items].sort((a, b) => {
    const diff = timeOf(b.lastMessageAt) - timeOf(a.lastMessageAt);
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });
}

export function mapConversationRow(row: ConversationReadRow): ConversationListItem | null {
  const contact = Array.isArray(row.conv_contactos) ? row.conv_contactos[0] : row.conv_contactos;
  if (!contact) return null;

  const displayName = resolveContactDisplayName(contact);
  const profileName = clean(contact.nombre_perfil);

  return {
    id: row.id,
    displayName,
    profileName: profileName && profileName !== displayName ? profileName : null,
    phone: contact.telefono_e164,
    status: row.estado === "closed" ? "closed" : "open",
    lastMessageAt: row.ultimo_mensaje_at,
    lastMessagePreview: clean(row.ultimo_mensaje_preview),
    // Se completa en servidor con los restaurantes que el contacto puede consultar hoy.
    access: { state: "none" },
  };
}

/** Contacto de la fila (id y tipo), si lo hay. */
export function contactOf(row: ConversationReadRow): { id: string | null; tipo: string | null } {
  const contact = Array.isArray(row.conv_contactos) ? row.conv_contactos[0] : row.conv_contactos;
  return { id: contact?.id ?? null, tipo: contact?.tipo ?? null };
}

export function buildConversationList(rows: ConversationReadRow[]): ConversationListItem[] {
  const items: ConversationListItem[] = [];
  for (const row of rows) {
    const item = mapConversationRow(row);
    if (item) items.push(item);
  }
  return sortConversations(items);
}

// Buscador ---------------------------------------------------------------------

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Filtra por nombre, nombre de perfil o teléfono. Insensible a mayúsculas y
 * acentos; el teléfono se compara solo por dígitos (admite "+34 600…" o "600").
 */
export function filterConversations(
  items: ConversationListItem[],
  query: string
): ConversationListItem[] {
  const text = normalizeText(query.trim());
  if (text === "") return items;
  const digits = digitsOnly(text);

  return items.filter((item) => {
    if (normalizeText(item.displayName).includes(text)) return true;
    if (item.profileName && normalizeText(item.profileName).includes(text)) return true;
    return digits !== "" && digitsOnly(item.phone).includes(digits);
  });
}

// Mensajes ---------------------------------------------------------------------

/** Cronológico: el más antiguo arriba. Desempata por recepción e id. */
export function sortMessages(messages: ConversationMessage[]): ConversationMessage[] {
  return [...messages].sort((a, b) => {
    const diff = timeOf(a.timestamp) - timeOf(b.timestamp);
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });
}

type MediaView = {
  filename: string | null;
  caption: string | null;
  isVoiceMessage: boolean;
  /** Documento generado por Nexo (informe), no un archivo del contacto. */
  isReport: boolean;
};

/** Lee solo lo presentable de `media`; ignora cualquier otro campo (IDs externos). */
function readMedia(media: unknown): MediaView {
  const record = media && typeof media === "object" ? (media as Record<string, unknown>) : {};
  const str = (key: string) => (typeof record[key] === "string" ? clean(record[key] as string) : null);
  return {
    filename: str("filename"),
    caption: str("caption"),
    isVoiceMessage: record.isVoiceMessage === true,
    isReport: record.source === "nexo_report",
  };
}

const KNOWN_CONTENT_TYPES: readonly string[] = [
  "text",
  "image",
  "audio",
  "video",
  "document",
  "sticker",
  "unsupported",
];

export function mapMessageRow(row: MessageReadRow): ConversationMessage {
  const contentType = (
    KNOWN_CONTENT_TYPES.includes(row.content_type) ? row.content_type : "unsupported"
  ) as MessageContentType;
  const media = readMedia(row.media);

  let label: string | null = null;
  switch (contentType) {
    case "text":
      break;
    case "audio":
      label = media.isVoiceMessage ? "🎤 Nota de voz" : "🎤 Audio";
      break;
    case "image":
      label = media.isReport ? "🖼️ Informe de Nexo" : "🖼️ Imagen";
      break;
    case "video":
      label = "🎥 Vídeo";
      break;
    case "document":
      label = media.isReport ? "📊 Informe de Nexo" : "📄 Documento";
      break;
    case "sticker":
      label = "Sticker";
      break;
    default:
      label = "Mensaje no compatible";
  }

  return {
    id: row.id,
    direction: row.direction === "outbound" ? "outbound" : "inbound",
    contentType,
    text: contentType === "text" ? (row.text ?? "") : null,
    label,
    filename: contentType === "document" ? media.filename : null,
    // Entrantes: el pie va en media.caption. Salientes: el pie se guarda en `text`.
    caption:
      contentType === "text" || contentType === "audio" ? null : (media.caption ?? clean(row.text)),
    status: row.status,
    timestamp: row.provider_timestamp,
  };
}

export function buildMessageList(rows: MessageReadRow[]): ConversationMessage[] {
  return sortMessages(rows.map(mapMessageRow));
}

// Validación -------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidConversationId(value: string): boolean {
  return UUID_RE.test(value);
}
