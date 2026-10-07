import { buildMessagePreview } from "@/lib/conversations/message-preview";
import type { MessageReadRow } from "@/lib/conversations/read-model";
import type { RejectionReason, SendTextInput, SendTextResult } from "@/lib/whatsapp/cloud-api.server";

/**
 * Caso de uso: enviar un mensaje de texto desde Nexo a un contacto de WhatsApp.
 * Sin dependencia de Next, Supabase ni Meta: la persistencia (`repository`) y el
 * proveedor (`sendText`) se inyectan, igual que en `ingest-inbound.ts`.
 *
 * IDEMPOTENCIA (reserva antes de enviar)
 *  1. `claim` inserta el saliente con `client_request_id` único y estado `pending`
 *     ANTES de llamar a Meta. Un reintento con el mismo id encuentra la fila y NO
 *     vuelve a enviar.
 *  2. Meta acepta → `markSent` (wamid + `sent`). Rechazo 4xx → `markFailed`.
 *  3. Resultado incierto (timeout, red, 5xx) → la fila queda `pending` y cualquier
 *     reintento con el mismo id devuelve `in_progress`: nunca se reenvía a ciegas.
 *  4. Meta acepta pero falla guardar → la fila sigue `pending`; el reintento tampoco
 *     reenvía. Se registra el id de la fila y el wamid (no son datos personales)
 *     para conciliarlo.
 */

/** Mensaje saliente tal como lo devuelve la reserva/actualización. */
export type OutboundRecord = MessageReadRow & {
  conversacion_id: string;
  external_id: string | null;
};

export type SendContext = {
  conversationId: string;
  canal: { id: string; provider: string; externalAccountId: string; status: string };
  /** Teléfono E.164 del contacto, resuelto en servidor. */
  contactPhone: string;
};

export type ClaimResult =
  | { status: "claimed"; message: OutboundRecord }
  | { status: "existing"; message: OutboundRecord };

export interface OutboundRepository {
  loadContext(conversationId: string): Promise<SendContext | null>;
  claim(input: {
    conversationId: string;
    canalId: string;
    requestId: string;
    text: string;
    now: Date;
  }): Promise<ClaimResult>;
  /** `failed` → `pending` de forma atómica. `false` si otra petición ya lo hizo. */
  reclaimFailed(messageId: string): Promise<boolean>;
  markSent(input: { messageId: string; wamid: string; sentAt: Date }): Promise<OutboundRecord>;
  markFailed(messageId: string): Promise<void>;
  touchConversation(input: {
    conversationId: string;
    canalId: string;
    at: Date;
    preview: string;
  }): Promise<boolean>;
}

export type SendTextDeps = {
  repository: OutboundRepository;
  sendText: (input: SendTextInput) => Promise<SendTextResult>;
  isConfigured: () => boolean;
  now?: () => Date;
  /** Solo ids técnicos: nunca teléfonos, textos ni tokens. */
  logger?: { error: (message: string) => void };
};

export type SendTextOutcome =
  | { status: "sent"; message: OutboundRecord; deduplicated: boolean }
  | { status: "not_found" }
  | { status: "channel_inactive" }
  | { status: "misconfigured" }
  /** Misma petición ya reservada con resultado aún no confirmado. */
  | { status: "in_progress" }
  /** El mismo requestId se usó con otra conversación u otro texto. */
  | { status: "request_conflict" }
  | { status: "rejected"; reason: RejectionReason }
  | { status: "unconfirmed" }
  /** Meta aceptó el mensaje pero no se pudo guardar el resultado. */
  | { status: "sent_not_saved" };

const MARK_SENT_ATTEMPTS = 3;
const SENT_STATES = new Set(["sent", "delivered", "read"]);

export async function sendTextMessageToConversation(
  input: { conversationId: string; requestId: string; text: string },
  deps: SendTextDeps
): Promise<SendTextOutcome> {
  const { repository, logger = console } = deps;
  const now = deps.now ?? (() => new Date());

  const context = await repository.loadContext(input.conversationId);
  if (!context) return { status: "not_found" };

  if (context.canal.provider !== "whatsapp_cloud" || context.canal.status !== "connected") {
    return { status: "channel_inactive" };
  }
  // Antes de reservar nada: sin token no hay envío posible ni filas huérfanas.
  if (!deps.isConfigured()) return { status: "misconfigured" };

  const claim = await repository.claim({
    conversationId: context.conversationId,
    canalId: context.canal.id,
    requestId: input.requestId,
    text: input.text,
    now: now(),
  });

  let message = claim.message;

  if (claim.status === "existing") {
    // Reintento: el id solo vale para la misma conversación y el mismo texto.
    if (message.conversacion_id !== context.conversationId || message.text !== input.text) {
      return { status: "request_conflict" };
    }
    if (SENT_STATES.has(message.status)) {
      return { status: "sent", message, deduplicated: true };
    }
    // `failed` es un rechazo definitivo de Meta: se puede reintentar la MISMA fila.
    // `pending`/`deleted`: resultado incierto o no reintentable → no se envía.
    if (message.status !== "failed" || !(await repository.reclaimFailed(message.id))) {
      return { status: "in_progress" };
    }
  }

  const result = await deps.sendText({
    phoneNumberId: context.canal.externalAccountId,
    to: context.contactPhone,
    text: input.text,
  });

  switch (result.status) {
    case "rejected":
      await repository.markFailed(message.id);
      return { status: "rejected", reason: result.reason };

    case "misconfigured":
      await repository.markFailed(message.id);
      return { status: "misconfigured" };

    case "unconfirmed":
      // La fila queda `pending`: no se sabe si Meta lo envió.
      return { status: "unconfirmed" };

    case "sent": {
      const sentAt = now();
      let saved: OutboundRecord | null = null;
      for (let attempt = 0; attempt < MARK_SENT_ATTEMPTS && !saved; attempt++) {
        try {
          saved = await repository.markSent({ messageId: message.id, wamid: result.wamid, sentAt });
        } catch {
          saved = null;
        }
      }
      if (!saved) {
        logger.error(
          `[conversations-send] sent_not_saved messageId=${message.id} wamid=${result.wamid}`
        );
        return { status: "sent_not_saved" };
      }
      message = saved;

      try {
        await repository.touchConversation({
          conversationId: context.conversationId,
          canalId: context.canal.id,
          at: sentAt,
          preview: buildMessagePreview({ contentType: "text", text: input.text }),
        });
      } catch {
        // El mensaje ya está guardado; solo la vista previa quedaría atrasada.
        logger.error(`[conversations-send] touch_failed messageId=${message.id}`);
      }
      return { status: "sent", message, deduplicated: false };
    }
  }
}

// Validación del cuerpo ---------------------------------------------------------

export const MAX_OUTBOUND_TEXT_CHARS = 4096;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ParsedSendBody =
  | { ok: true; text: string; requestId: string }
  | { ok: false; error: string };

/** Valida el cuerpo del POST. Ignora cualquier otro campo (teléfono, canal, sender…). */
export function parseSendTextBody(body: unknown): ParsedSendBody {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  if (typeof record.requestId !== "string" || !UUID_RE.test(record.requestId)) {
    return { ok: false, error: "requestId no válido" };
  }
  if (typeof record.text !== "string") return { ok: false, error: "El mensaje está vacío" };

  const text = record.text.trim();
  if (text === "") return { ok: false, error: "El mensaje está vacío" };
  if (Array.from(text).length > MAX_OUTBOUND_TEXT_CHARS) {
    return { ok: false, error: `El mensaje supera los ${MAX_OUTBOUND_TEXT_CHARS} caracteres` };
  }
  return { ok: true, text, requestId: record.requestId };
}
