import "server-only";

/**
 * Cliente mínimo de la WhatsApp Cloud API de Meta (Graph API), solo servidor.
 *
 * Nunca registra ni devuelve el token, el teléfono, el texto ni la respuesta de
 * Meta: el resultado es una unión cerrada con información segura.
 *
 * Semántica del resultado (clave para la idempotencia del envío):
 *  - `sent`:          Meta aceptó el mensaje y devolvió su wamid.
 *  - `rejected`:      Meta respondió 4xx → el mensaje NO se envió (definitivo).
 *  - `unconfirmed`:   timeout, error de red, 5xx o respuesta ilegible → puede que
 *                     Meta SÍ lo haya enviado. Quien llama no debe reintentar solo.
 *  - `misconfigured`: falta el token; no se llamó a Meta.
 */

import { WHATSAPP_TEXT_MAX_CHARS } from "@/lib/conversations/text-chunks";

export { WHATSAPP_TEXT_MAX_CHARS };
export const GRAPH_API_VERSION = "v26.0";
const GRAPH_BASE_URL = "https://graph.facebook.com";
const REQUEST_TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 60_000;

/** Causa segura de un rechazo, derivada del código de error de Meta (lista cerrada). */
export type RejectionReason = "window_closed" | "invalid_recipient" | "auth" | "rate_limited" | "other";

export type SendMessageResult =
  | { status: "sent"; wamid: string }
  | { status: "rejected"; reason: RejectionReason }
  | { status: "unconfirmed" }
  | { status: "misconfigured" };

/** Compatibilidad con el nombre anterior. */
export type SendTextResult = SendMessageResult;

export type SendTextInput = {
  /** `conv_canales.external_account_id` (phone_number_id de Meta). */
  phoneNumberId: string;
  /** Teléfono E.164 del destinatario. */
  to: string;
  text: string;
};

type SendDeps = {
  fetchImpl?: typeof fetch;
  accessToken?: string | undefined;
  timeoutMs?: number;
};

const PHONE_NUMBER_ID_RE = /^[0-9]{5,30}$/;
const E164_RE = /^\+[1-9][0-9]{7,14}$/;

/** Mapea el `error.code` de Meta a un motivo seguro. 131047 = fuera de la ventana de 24 h. */
function classifyRejection(httpStatus: number, metaCode: unknown): RejectionReason {
  if (metaCode === 131047 || metaCode === 131051) return "window_closed";
  if (metaCode === 131030 || metaCode === 131021 || metaCode === 100) return "invalid_recipient";
  if (metaCode === 190 || httpStatus === 401 || httpStatus === 403) return "auth";
  if (metaCode === 130429 || metaCode === 131056 || httpStatus === 429) return "rate_limited";
  return "other";
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractWamid(body: unknown): string | null {
  const messages = (body as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(messages)) return null;
  const id = (messages[0] as { id?: unknown } | undefined)?.id;
  return typeof id === "string" && id.trim() !== "" ? id : null;
}

/** ¿Está configurado el token? Permite comprobarlo antes de reservar nada en la base. */
export function isWhatsAppSenderConfigured(accessToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN): boolean {
  return typeof accessToken === "string" && accessToken.trim() !== "";
}

type MessagePayload = { type: "text" | "document" } & Record<string, unknown>;

/** POST /{phone_number_id}/messages con la semántica sent / rejected / unconfirmed. */
async function postMessage(
  phoneNumberId: string,
  to: string,
  payload: MessagePayload,
  deps: SendDeps
): Promise<SendMessageResult> {
  const accessToken = (deps.accessToken ?? process.env.WHATSAPP_CLOUD_ACCESS_TOKEN)?.trim();
  if (!accessToken) return { status: "misconfigured" };

  // Los argumentos los resuelve el servidor; si no son válidos es un error de programación.
  if (!PHONE_NUMBER_ID_RE.test(phoneNumberId)) throw new Error("WhatsApp: phoneNumberId inválido");
  if (!E164_RE.test(to)) throw new Error("WhatsApp: destinatario inválido");

  const fetchImpl = deps.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(`${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        // Meta espera el número sin "+".
        to: to.slice(1),
        ...payload,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const body = await readJson(response);

    if (response.ok) {
      const wamid = extractWamid(body);
      // 2xx sin wamid legible: Meta pudo aceptarlo; no se puede afirmar nada.
      return wamid ? { status: "sent", wamid } : { status: "unconfirmed" };
    }

    if (response.status >= 400 && response.status < 500) {
      const metaCode = (body as { error?: { code?: unknown } } | null)?.error?.code;
      return { status: "rejected", reason: classifyRejection(response.status, metaCode) };
    }

    return { status: "unconfirmed" };
  } catch {
    // Timeout o fallo de red: el mensaje pudo haber salido.
    return { status: "unconfirmed" };
  } finally {
    clearTimeout(timer);
  }
}

export async function sendTextMessage(
  input: SendTextInput,
  deps: SendDeps = {}
): Promise<SendMessageResult> {
  if (input.text.trim() === "" || Array.from(input.text).length > WHATSAPP_TEXT_MAX_CHARS) {
    throw new Error("sendTextMessage: texto inválido");
  }
  return postMessage(
    input.phoneNumberId,
    input.to,
    { type: "text", text: { preview_url: false, body: input.text } },
    deps
  );
}

// Media -------------------------------------------------------------------------

export type UploadMediaInput = {
  phoneNumberId: string;
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
};

/**
 * `uploaded`: Meta devolvió un media_id.
 * `failed`: la subida no se completó. Subir un archivo NO entrega nada al
 * contacto, así que es siempre seguro reintentar.
 */
export type UploadMediaResult =
  | { status: "uploaded"; mediaId: string }
  | { status: "failed" }
  | { status: "misconfigured" };

/** POST /{phone_number_id}/media (multipart). Devuelve el media_id de Meta. */
export async function uploadMedia(
  input: UploadMediaInput,
  deps: SendDeps = {}
): Promise<UploadMediaResult> {
  const accessToken = (deps.accessToken ?? process.env.WHATSAPP_CLOUD_ACCESS_TOKEN)?.trim();
  if (!accessToken) return { status: "misconfigured" };

  if (!PHONE_NUMBER_ID_RE.test(input.phoneNumberId)) throw new Error("uploadMedia: phoneNumberId inválido");
  if (input.bytes.length === 0) throw new Error("uploadMedia: archivo vacío");

  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", input.mimeType);
  // Copia a un ArrayBuffer propio: evita compartir memoria con la petición entrante.
  form.append("file", new Blob([new Uint8Array(input.bytes)], { type: input.mimeType }), input.filename);

  const fetchImpl = deps.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? UPLOAD_TIMEOUT_MS);

  try {
    const response = await fetchImpl(`${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${input.phoneNumberId}/media`, {
      method: "POST",
      // Sin Content-Type: fetch añade el boundary del multipart.
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return { status: "failed" };

    const id = ((await readJson(response)) as { id?: unknown } | null)?.id;
    return typeof id === "string" && id.trim() !== "" ? { status: "uploaded", mediaId: id } : { status: "failed" };
  } catch {
    return { status: "failed" };
  } finally {
    clearTimeout(timer);
  }
}

const MEDIA_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

export type SendDocumentInput = {
  phoneNumberId: string;
  to: string;
  /** media_id devuelto por `uploadMedia`. */
  mediaId: string;
  /** Nombre que verá el contacto (ya saneado). */
  filename: string;
  caption?: string | null;
};

/** Envía un documento ya subido a Meta (`uploadMedia`) usando su media_id. */
export async function sendDocumentMessage(
  input: SendDocumentInput,
  deps: SendDeps = {}
): Promise<SendMessageResult> {
  if (!MEDIA_ID_RE.test(input.mediaId)) throw new Error("sendDocumentMessage: mediaId inválido");
  const caption = input.caption?.trim();
  return postMessage(
    input.phoneNumberId,
    input.to,
    {
      type: "document",
      document: { id: input.mediaId, filename: input.filename, ...(caption ? { caption } : {}) },
    },
    deps
  );
}
