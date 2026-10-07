import { buildMessagePreview } from "@/lib/conversations/message-preview";
import type { MessageReadRow } from "@/lib/conversations/read-model";
import { deriveMessageRequestId } from "@/lib/conversations/request-ids";
import {
  MAX_OUTBOUND_TEXT_CHARS,
  splitText,
  textLength,
} from "@/lib/conversations/text-chunks";
import type {
  RejectionReason,
  SendDocumentInput,
  SendImageInput,
  SendMessageResult,
  SendTextInput,
  UploadMediaInput,
  UploadMediaResult,
} from "@/lib/whatsapp/cloud-api.server";

/**
 * Caso de uso: enviar desde Nexo a un contacto de WhatsApp una OPERACIÓN, que es
 *   · un texto (si supera 4096 caracteres se divide en varios mensajes), o
 *   · uno o varios archivos (PDF o imagen) generados por Nexo en servidor, p. ej.
 *     un informe: se envían en orden, uno por mensaje de WhatsApp.
 * Sin dependencia de Next, Supabase ni Meta: persistencia y proveedor se inyectan.
 *
 * IDEMPOTENCIA (reserva antes de enviar, un id estable por mensaje)
 *  El cliente manda UN `requestId` por operación. Cada mensaje de la operación
 *  tiene su propio id derivado y estable (`deriveMessageRequestId`): el mensaje 0
 *  usa el requestId tal cual y los demás un UUID derivado de (requestId, índice).
 *  Para cada mensaje, en orden:
 *   1. `claim` inserta la fila `pending` con su id único ANTES de llamar a Meta.
 *      Si ya existe, es un reintento y NO se envía a ciegas:
 *        · `sent|delivered|read` → ya entregado a Meta: se salta (no se reenvía).
 *        · `failed`              → rechazo definitivo: se reintenta la MISMA fila.
 *        · `pending`             → resultado incierto: se DETIENE la operación.
 *   2. Meta acepta → `markSent` (wamid + `sent`). 4xx → `markFailed`.
 *      Timeout/red/5xx → la fila queda `pending` (incierto).
 *   3. Para archivos, la reserva ocurre ANTES de generarlos y de subirlos: un
 *      reintento ya enviado o pendiente no vuelve a generar ni a subir nada. Generar
 *      o subir NO entrega nada, así que un fallo ahí marca `failed` y se puede
 *      reintentar sin riesgo.
 *  Resultado: tras "chunk 1 y 2 enviados, chunk 3 incierto", el reintento salta
 *  1 y 2 (ya `sent`) y se detiene en 3 (`pending`) sin reenviar nada.
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

/** Metadatos persistidos de un documento saliente. Nunca token ni URL de descarga. */
export type OutboundMedia = {
  mime_type: string;
  filename: string;
  /** Se completa al enviar: el PDF se genera después de reservar la fila. */
  size?: number;
  /** Se completa cuando Meta acepta el archivo. */
  provider_media_id?: string;
  /** Origen del archivo (p. ej. "nexo_report") y datos para reconocer la misma operación. */
  source?: string;
  report_type?: string;
  report_format?: string;
  /** Posición (desde 0) del archivo dentro de la operación. */
  page_index?: number;
  restaurant_id?: number;
  /** Grupo/red del informe (informes de red). */
  group_id?: string;
  period?: string;
};

export type OutboundContent =
  | { contentType: "text"; text: string }
  | { contentType: "document" | "image"; text: string | null; media: OutboundMedia };

export type ClaimResult =
  | { status: "claimed"; message: OutboundRecord }
  | { status: "existing"; message: OutboundRecord };

export interface OutboundRepository {
  loadContext(conversationId: string): Promise<SendContext | null>;
  claim(input: {
    conversationId: string;
    canalId: string;
    requestId: string;
    content: OutboundContent;
    now: Date;
  }): Promise<ClaimResult>;
  /** `failed` → `pending` de forma atómica. `false` si otra petición ya lo hizo. */
  reclaimFailed(messageId: string): Promise<boolean>;
  markSent(input: {
    messageId: string;
    wamid: string;
    sentAt: Date;
    /** Metadatos finales del archivo (con `provider_media_id`). */
    media?: OutboundMedia;
  }): Promise<OutboundRecord>;
  markFailed(messageId: string): Promise<void>;
  touchConversation(input: {
    conversationId: string;
    canalId: string;
    at: Date;
    preview: string;
  }): Promise<boolean>;
}

/** Archivo (PDF o imagen) que Nexo genera en servidor (nunca bytes recibidos del navegador). */
export type SendFile = {
  kind: "document" | "image";
  /** Metadatos que se guardan al reservar (sin size ni provider_media_id). */
  media: Omit<OutboundMedia, "size" | "provider_media_id">;
  /** Pie de foto (se guarda en `text`). Opcional. */
  caption?: string | null;
  /** Vista previa de la conversación, p. ej. "📊 Informe mensual · BK Zizur". */
  preview: string;
  /**
   * Genera los bytes SOLO cuando el mensaje se va a enviar: un reintento de una
   * operación ya enviada o pendiente no llega a llamarla.
   */
  produce: () => Promise<Uint8Array>;
};

export type SendDeps = {
  repository: OutboundRepository;
  sendText: (input: SendTextInput) => Promise<SendMessageResult>;
  uploadMedia: (input: UploadMediaInput) => Promise<UploadMediaResult>;
  sendDocument: (input: SendDocumentInput) => Promise<SendMessageResult>;
  sendImage: (input: SendImageInput) => Promise<SendMessageResult>;
  isConfigured: () => boolean;
  now?: () => Date;
  /** Solo ids técnicos: nunca teléfonos, textos, nombres de archivo ni tokens. */
  logger?: { error: (message: string) => void };
};

export type SendFailureStatus =
  | "not_found"
  | "channel_inactive"
  | "misconfigured"
  /** Mensaje ya reservado con resultado aún no confirmado: no se reenvía. */
  | "in_progress"
  /** El mismo requestId se usó con otra conversación u otro contenido. */
  | "request_conflict"
  | "rejected"
  | "unconfirmed"
  /** La subida del archivo a Meta falló (no se envió nada; reintentable). */
  | "upload_failed"
  /** No se pudo generar el PDF (no se envió nada; reintentable). */
  | "generation_failed"
  /** Meta aceptó el mensaje pero no se pudo guardar el resultado. */
  | "sent_not_saved";

export type SendOutcome =
  | { status: "sent"; messages: OutboundRecord[]; deduplicated: boolean }
  | {
      status: SendFailureStatus;
      reason?: RejectionReason;
      /** Mensajes de la operación que SÍ quedaron enviados antes del fallo. */
      sent: OutboundRecord[];
    };

const MARK_SENT_ATTEMPTS = 3;
const SENT_STATES = new Set(["sent", "delivered", "read"]);

type StepResult = {
  result: SendMessageResult | { status: "upload_failed" } | { status: "generation_failed" };
  media?: OutboundMedia;
};
type Step =
  | { kind: "done"; message: OutboundRecord; deduplicated: boolean }
  | { kind: "stop"; status: SendFailureStatus; reason?: RejectionReason };

function sameContent(record: OutboundRecord, content: OutboundContent): boolean {
  if (record.content_type !== content.contentType) return false;
  if (content.contentType === "text") return record.text === content.text;
  const stored = (record.media ?? {}) as Record<string, unknown>;
  // `size` y `provider_media_id` se completan al enviar: no identifican la operación.
  const { size: _size, provider_media_id: _id, ...identity } = content.media;
  void _size;
  void _id;
  return (
    (record.text ?? null) === content.text &&
    Object.entries(identity).every(([key, value]) => stored[key] === value)
  );
}

/** Vista previa de la conversación para un mensaje saliente. */
export function buildOutboundPreview(content: OutboundContent): string {
  if (content.contentType === "text") {
    return buildMessagePreview({ contentType: "text", text: content.text });
  }
  return `📄 ${content.media.filename}`;
}

export async function sendConversationOperation(
  input: {
    conversationId: string;
    requestId: string;
    /** Texto completo. Se ignora si hay `files`. */
    text: string;
    /** Archivos en orden de envío (uno por mensaje de WhatsApp). */
    files?: SendFile[];
  },
  deps: SendDeps
): Promise<SendOutcome> {
  const { repository, logger = console } = deps;
  const now = deps.now ?? (() => new Date());
  const sent: OutboundRecord[] = [];
  const fail = (status: SendFailureStatus, reason?: RejectionReason): SendOutcome => ({
    status,
    ...(reason ? { reason } : {}),
    sent,
  });

  const context = await repository.loadContext(input.conversationId);
  if (!context) return fail("not_found");

  if (context.canal.provider !== "whatsapp_cloud" || context.canal.status !== "connected") {
    return fail("channel_inactive");
  }
  // Antes de reservar nada: sin token no hay envío posible ni filas huérfanas.
  if (!deps.isConfigured()) return fail("misconfigured");

  // Garantía de orden: cada mensaje lleva un instante estrictamente mayor.
  let lastAt = 0;
  const nextInstant = (): Date => {
    lastAt = Math.max(now().getTime(), lastAt + 1);
    return new Date(lastAt);
  };

  async function deliver(
    index: number,
    content: OutboundContent,
    perform: () => Promise<StepResult>,
    preview?: string
  ): Promise<Step> {
    const claim = await repository.claim({
      conversationId: context!.conversationId,
      canalId: context!.canal.id,
      requestId: deriveMessageRequestId(input.requestId, index),
      content,
      now: nextInstant(),
    });
    const message = claim.message;

    if (claim.status === "existing") {
      // Reintento: el id solo vale para la misma conversación y el mismo contenido.
      if (message.conversacion_id !== context!.conversationId || !sameContent(message, content)) {
        return { kind: "stop", status: "request_conflict" };
      }
      if (SENT_STATES.has(message.status)) return { kind: "done", message, deduplicated: true };
      // `failed` es definitivo: se reintenta la MISMA fila. `pending`/`deleted`: no se envía.
      if (message.status !== "failed" || !(await repository.reclaimFailed(message.id))) {
        return { kind: "stop", status: "in_progress" };
      }
    }

    const { result, media } = await perform();

    switch (result.status) {
      case "upload_failed":
        await repository.markFailed(message.id);
        return { kind: "stop", status: "upload_failed" };
      case "generation_failed":
        await repository.markFailed(message.id);
        return { kind: "stop", status: "generation_failed" };
      case "rejected":
        await repository.markFailed(message.id);
        return { kind: "stop", status: "rejected", reason: result.reason };
      case "misconfigured":
        await repository.markFailed(message.id);
        return { kind: "stop", status: "misconfigured" };
      case "unconfirmed":
        // La fila queda `pending`: no se sabe si Meta lo envió.
        return { kind: "stop", status: "unconfirmed" };
      case "sent": {
        const sentAt = nextInstant();
        let saved: OutboundRecord | null = null;
        for (let attempt = 0; attempt < MARK_SENT_ATTEMPTS && !saved; attempt++) {
          try {
            saved = await repository.markSent({ messageId: message.id, wamid: result.wamid, sentAt, media });
          } catch {
            saved = null;
          }
        }
        if (!saved) {
          logger.error(`[conversations-send] sent_not_saved messageId=${message.id} wamid=${result.wamid}`);
          return { kind: "stop", status: "sent_not_saved" };
        }
        try {
          await repository.touchConversation({
            conversationId: context!.conversationId,
            canalId: context!.canal.id,
            at: sentAt,
            preview: preview ?? buildOutboundPreview(content),
          });
        } catch {
          // El mensaje ya está guardado; solo la vista previa quedaría atrasada.
          logger.error(`[conversations-send] touch_failed messageId=${saved.id}`);
        }
        return { kind: "done", message: saved, deduplicated: false };
      }
    }
  }

  const steps: Step[] = [];
  const run = async (step: Promise<Step>): Promise<boolean> => {
    const result = await step;
    steps.push(result);
    if (result.kind === "done") {
      sent.push(result.message);
      return true;
    }
    return false;
  };

  if (input.files && input.files.length > 0) {
    // Archivos consecutivos y en orden: se detiene en el primero que no se confirme.
    for (let index = 0; index < input.files.length; index++) {
      const file = input.files[index]!;
      const caption = file.caption?.trim() || null;
      const content: OutboundContent = {
        contentType: file.kind,
        text: caption,
        media: { ...file.media },
      };

      const ok = await run(
        deliver(
          index,
          content,
          async () => {
            let bytes: Uint8Array;
            try {
              bytes = await file.produce();
            } catch {
              return { result: { status: "generation_failed" } };
            }
            if (bytes.length === 0) return { result: { status: "generation_failed" } };

            const upload = await deps.uploadMedia({
              phoneNumberId: context.canal.externalAccountId,
              bytes,
              mimeType: file.media.mime_type,
              filename: file.media.filename,
            });
            if (upload.status === "misconfigured") return { result: { status: "misconfigured" } };
            if (upload.status !== "uploaded") return { result: { status: "upload_failed" } };

            const target = {
              phoneNumberId: context.canal.externalAccountId,
              to: context.contactPhone,
              mediaId: upload.mediaId,
              caption,
            };
            const result =
              file.kind === "image"
                ? await deps.sendImage(target)
                : await deps.sendDocument({ ...target, filename: file.media.filename });
            return {
              result,
              media: { ...file.media, size: bytes.length, provider_media_id: upload.mediaId },
            };
          },
          file.preview
        )
      );
      if (!ok) break;
    }
  } else {
    // Mensajes consecutivos y en orden: se detiene en el primero que no se confirme.
    const chunks = splitText(input.text);
    for (let index = 0; index < chunks.length; index++) {
      const chunk = chunks[index]!;
      const ok = await run(
        deliver(index, { contentType: "text", text: chunk }, async () => ({
          result: await deps.sendText({
            phoneNumberId: context.canal.externalAccountId,
            to: context.contactPhone,
            text: chunk,
          }),
        }))
      );
      if (!ok) break;
    }
  }

  const stop = steps.find((step): step is Extract<Step, { kind: "stop" }> => step.kind === "stop");
  if (stop) return fail(stop.status, stop.reason);

  return {
    status: "sent",
    messages: sent,
    deduplicated: steps.every((step) => step.kind === "done" && step.deduplicated),
  };
}

// Validación del cuerpo ---------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidRequestId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export type ParsedSendFields =
  | { ok: true; text: string; requestId: string }
  | { ok: false; error: string };

/**
 * Valida `requestId` y `text` (obligatorio, máximo 20.000 caracteres; si pasa de
 * 4096 se enviará en varios mensajes). Ignora cualquier otro campo (teléfono,
 * canal, sender…).
 */
export function parseSendFields(body: unknown): ParsedSendFields {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  if (!isValidRequestId(record.requestId)) return { ok: false, error: "requestId no válido" };
  if (typeof record.text !== "string") return { ok: false, error: "El mensaje está vacío" };

  const text = record.text.trim();
  if (text === "") return { ok: false, error: "El mensaje está vacío" };
  if (textLength(text) > MAX_OUTBOUND_TEXT_CHARS) {
    return { ok: false, error: `El mensaje supera los ${MAX_OUTBOUND_TEXT_CHARS} caracteres` };
  }
  return { ok: true, text, requestId: record.requestId };
}
