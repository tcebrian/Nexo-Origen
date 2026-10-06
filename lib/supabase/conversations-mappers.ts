import type {
  ChannelProvider,
  ChannelStatus,
  InboundMessage,
  MessageContentType,
  MessageMedia,
} from "@/lib/conversations/types";

/**
 * Piezas puras de la persistencia de Nexo Conversations: mapeo de filas,
 * reglas de actualización y clasificación de errores. Sin acceso a datos ni
 * `server-only`, para poder probarlas. La E/S vive en `conversations.server.ts`.
 */

/** Nombres de las restricciones únicas de las que depende la idempotencia. */
export const CONV_CONSTRAINTS = {
  contactoTelefono: "conv_contactos_telefono_e164_key",
  conversacionCanalContacto: "conv_conversaciones_canal_id_contacto_id_key",
  mensajeCanalExternalId: "conv_mensajes_canal_id_external_id_key",
} as const;

type DbErrorLike = { code?: string; message?: string } | null | undefined;

/** Violación de unicidad (23505) de una restricción concreta. */
export function isUniqueViolation(error: DbErrorLike, constraint: string): boolean {
  return (
    error?.code === "23505" &&
    typeof error.message === "string" &&
    error.message.includes(constraint)
  );
}

// Canal -------------------------------------------------------------------------

export type ChannelRow = {
  id: string;
  provider: string;
  external_account_id: string;
  waba_id: string | null;
  display_phone: string | null;
  status: string;
};

/** El canal central de Nexo. No pertenece a ninguna empresa. */
export type ConversationChannel = {
  id: string;
  provider: ChannelProvider;
  externalAccountId: string;
  wabaId: string | null;
  displayPhone: string | null;
  status: ChannelStatus;
};

export function mapChannelRow(row: ChannelRow): ConversationChannel {
  return {
    id: row.id,
    provider: row.provider as ChannelProvider,
    externalAccountId: row.external_account_id,
    wabaId: row.waba_id,
    displayPhone: row.display_phone,
    status: row.status as ChannelStatus,
  };
}

// Contacto ----------------------------------------------------------------------

export type ContactRow = {
  id: string;
  telefono_e164: string;
  nombre: string | null;
  nombre_perfil: string | null;
  external_contact_id: string | null;
};

/** Persona global, identificada por su teléfono. Sin empresa: los permisos viven en conv_contacto_*. */
export type Contact = {
  id: string;
  telefonoE164: string;
  /** Nombre interno editable. Solo lo cambia un usuario de Nexo, nunca el proveedor. */
  nombre: string | null;
  /** Nombre de perfil declarado en WhatsApp. */
  nombrePerfil: string | null;
  externalContactId: string | null;
};

export function mapContactRow(row: ContactRow): Contact {
  return {
    id: row.id,
    telefonoE164: row.telefono_e164,
    nombre: row.nombre,
    nombrePerfil: row.nombre_perfil,
    externalContactId: row.external_contact_id,
  };
}

/**
 * Cambios que un mensaje entrante puede aplicar a un contacto existente.
 * El tipo no incluye `nombre` a propósito: el proveedor no puede tocarlo.
 */
export type ContactPatch = {
  nombre_perfil?: string;
  external_contact_id?: string;
};

function cleaned(value: string | null | undefined): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed === "" ? undefined : trimmed;
}

/** Solo informa de lo que llega nuevo, válido y distinto; `null` si no hay nada que cambiar. */
export function buildContactPatch(
  existing: Pick<Contact, "nombrePerfil" | "externalContactId">,
  incoming: { profileName?: string | null; externalContactId?: string | null }
): ContactPatch | null {
  const patch: ContactPatch = {};

  const profileName = cleaned(incoming.profileName);
  if (profileName && profileName !== existing.nombrePerfil) {
    patch.nombre_perfil = profileName;
  }

  const externalContactId = cleaned(incoming.externalContactId);
  if (externalContactId && externalContactId !== existing.externalContactId) {
    patch.external_contact_id = externalContactId;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

// Conversación ------------------------------------------------------------------

export type ConversationRow = {
  id: string;
  canal_id: string;
  contacto_id: string;
  estado: string;
  ultimo_mensaje_at: string | null;
  ultimo_mensaje_preview: string | null;
};

export type Conversation = {
  id: string;
  canalId: string;
  contactoId: string;
  estado: "open" | "closed";
  ultimoMensajeAt: Date | null;
  ultimoMensajePreview: string | null;
};

export function mapConversationRow(row: ConversationRow): Conversation {
  return {
    id: row.id,
    canalId: row.canal_id,
    contactoId: row.contacto_id,
    estado: row.estado === "closed" ? "closed" : "open",
    ultimoMensajeAt: row.ultimo_mensaje_at ? new Date(row.ultimo_mensaje_at) : null,
    ultimoMensajePreview: row.ultimo_mensaje_preview,
  };
}

/**
 * Condición del UPDATE que impide que `ultimo_mensaje_at` retroceda: solo se
 * actualiza si la conversación no tiene fecha o la tiene estrictamente anterior.
 * La evalúa PostgreSQL de forma atómica junto con la escritura.
 */
export function lastMessageGuardFilter(candidate: Date): string {
  return `ultimo_mensaje_at.is.null,ultimo_mensaje_at.lt.${candidate.toISOString()}`;
}

// Mensaje entrante --------------------------------------------------------------

export type InboundMessageRow = {
  conversacion_id: string;
  canal_id: string;
  external_id: string;
  direction: "inbound";
  sender_type: "contact";
  content_type: MessageContentType;
  text: string | null;
  media: MessageMedia | null;
  status: "received";
  provider_timestamp: string;
};

/**
 * Fila de `conv_mensajes` para un mensaje entrante. Sin empresa (modelo de canal
 * central) y sin `raw_payload` a propósito (queda NULL) hasta definir la
 * política de retención.
 */
export function buildInboundMessageRow(input: {
  message: InboundMessage;
  canalId: string;
  conversacionId: string;
}): InboundMessageRow {
  const { message } = input;
  return {
    conversacion_id: input.conversacionId,
    canal_id: input.canalId,
    external_id: message.externalMessageId,
    direction: "inbound",
    sender_type: "contact",
    content_type: message.contentType,
    text: message.text ?? null,
    media: message.media ?? null,
    status: "received",
    provider_timestamp: message.providerTimestamp.toISOString(),
  };
}

export type InsertMessageOutcome = { status: "inserted" } | { status: "duplicate" } | { status: "error" };

/** Un duplicado (mismo canal + external_id) es un resultado normal, no un error. */
export function classifyMessageInsertError(error: DbErrorLike): InsertMessageOutcome {
  if (!error) return { status: "inserted" };
  return isUniqueViolation(error, CONV_CONSTRAINTS.mensajeCanalExternalId)
    ? { status: "duplicate" }
    : { status: "error" };
}
