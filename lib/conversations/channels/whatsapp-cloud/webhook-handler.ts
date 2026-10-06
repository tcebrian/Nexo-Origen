import { createHash, timingSafeEqual } from "node:crypto";
import type { IngestInboundResult } from "@/lib/conversations/ingest-inbound";
import type { InboundMessage } from "@/lib/conversations/types";
import { parseWhatsAppWebhook } from "./parse-webhook";
import { verifyMetaSignature } from "./verify-signature";

/**
 * Lógica HTTP del webhook de WhatsApp Cloud API, sin depender de Next ni de
 * Supabase: el route handler solo lee el entorno y la petición, y convierte el
 * resultado en una `Response`. La ingesta se inyecta (`ingest`).
 *
 * Autenticación (no hay sesión de usuario; Meta no la tiene):
 *  - GET: token de verificación.
 *  - POST: firma HMAC `X-Hub-Signature-256` sobre el cuerpo en bruto.
 * Ninguna empresa ni permiso se toma del cuerpo: el canal (global) se resuelve
 * por `phone_number_id` en `conv_canales`, y los permisos de cada persona viven en
 * `conv_contacto_empresas` / `conv_contacto_restaurantes` (DENY BY DEFAULT).
 */

export type WebhookHttpResult = {
  status: number;
  body: string;
  contentType: "text/plain" | "application/json";
};

export type WebhookLogger = {
  info: (message: string) => void;
  error: (message: string) => void;
};

const text = (status: number, body: string): WebhookHttpResult => ({
  status,
  body,
  contentType: "text/plain",
});
const json = (status: number, body: Record<string, unknown>): WebhookHttpResult => ({
  status,
  body: JSON.stringify(body),
  contentType: "application/json",
});

/**
 * Descripción segura de un fallo para los logs: solo tipo, fase y código SQLSTATE,
 * cada uno validado con una lista blanca de caracteres. NUNCA `error.message` ni
 * `details`: pueden contener valores de filas o del mensaje (teléfonos, ids, texto).
 */
function describeFailure(error: unknown): string {
  const fields =
    typeof error === "object" && error !== null
      ? (error as { name?: unknown; operation?: unknown; code?: unknown })
      : {};
  const pick = (value: unknown, pattern: RegExp): string | undefined =>
    typeof value === "string" && pattern.test(value) ? value : undefined;

  const parts = [`type=${pick(fields.name, /^[A-Za-z][A-Za-z0-9]{0,39}$/) ?? "UnknownError"}`];
  const operation = pick(fields.operation, /^[A-Za-z]+(\.[A-Za-z]+)?$/);
  if (operation) parts.push(`operation=${operation}`);
  const code = pick(fields.code, /^[0-9A-Z]{5}$/);
  if (code) parts.push(`code=${code}`);
  return parts.join(" ");
}

/** Comparación en tiempo constante, sin filtrar la longitud del secreto. */
function safeEqual(a: string, b: string): boolean {
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(a), hash(b));
}

// GET — verificación inicial de Meta ----------------------------------------------

export function handleWebhookVerification(
  query: { mode: string | null; token: string | null; challenge: string | null },
  config: { verifyToken: string | undefined },
  logger: WebhookLogger = console
): WebhookHttpResult {
  if (!config.verifyToken) {
    logger.error("[whatsapp-webhook] verificación imposible: falta WHATSAPP_CLOUD_VERIFY_TOKEN");
    return text(500, "Webhook no configurado");
  }

  const valid =
    query.mode === "subscribe" &&
    !!query.token &&
    !!query.challenge &&
    safeEqual(query.token, config.verifyToken);

  // Misma respuesta para cualquier fallo: no se revela cuál de los datos era el incorrecto.
  return valid ? text(200, query.challenge as string) : text(403, "Forbidden");
}

// POST — eventos ----------------------------------------------------------------------

export async function handleWebhookEvent(
  input: { rawBody: Uint8Array; signature: string | null },
  deps: {
    appSecret: string | undefined;
    ingest: (message: InboundMessage) => Promise<IngestInboundResult>;
    logger?: WebhookLogger;
  }
): Promise<WebhookHttpResult> {
  const logger = deps.logger ?? console;

  if (!deps.appSecret) {
    logger.error("[whatsapp-webhook] evento rechazado: falta WHATSAPP_CLOUD_APP_SECRET");
    return json(500, { ok: false });
  }

  // 1) Origen: firma sobre el cuerpo EXACTO. Sin firma válida no se parsea nada.
  if (!verifyMetaSignature(input.rawBody, input.signature, deps.appSecret)) {
    logger.error("[whatsapp-webhook] firma inválida o ausente");
    return json(401, { ok: false });
  }

  // 2) Formato.
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(input.rawBody));
  } catch {
    return json(400, { ok: false });
  }

  // 3) Traducción al modelo interno.
  const { messages, statuses } = parseWhatsAppWebhook(payload);

  // 4) Ingesta secuencial. Un fallo no bloquea a los demás mensajes del lote:
  //    se procesan todos y, si alguno falló, se responde 500 para que Meta
  //    reintente el lote entero (la ingesta es idempotente).
  const counts = { stored: 0, duplicate: 0, channel_not_found: 0, channel_inactive: 0, failed: 0 };
  for (const [index, message] of messages.entries()) {
    try {
      const result = await deps.ingest(message);
      counts[result.status] += 1;
    } catch (error) {
      counts.failed += 1;
      logger.error(
        `[whatsapp-webhook] fallo en ingesta (mensaje ${index + 1}/${messages.length}): ${describeFailure(error)}`
      );
    }
  }

  // Los estados (sent/delivered/read/failed) todavía no se procesan.
  logger.info(
    `[whatsapp-webhook] mensajes=${messages.length} stored=${counts.stored} duplicate=${counts.duplicate} ` +
      `channel_not_found=${counts.channel_not_found} channel_inactive=${counts.channel_inactive} ` +
      `failed=${counts.failed} statuses_ignorados=${statuses.length}`
  );

  return counts.failed > 0 ? json(500, { ok: false }) : json(200, { ok: true });
}
