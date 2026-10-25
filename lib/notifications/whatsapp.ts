import twilio from "twilio";

export type WhatsAppTextResult =
  | { ok: true; provider: "make" | "twilio"; messageId: string }
  | { ok: false; provider: "make" | "twilio" | "none"; error: string };

/**
 * Envía texto por el transporte configurado para Nexo.
 * Preferencia: webhook de Make conectado al WhatsApp Business actual.
 * Fallback: Twilio legado.
 */
export async function sendWhatsAppText(params: {
  to: string;
  body: string;
  metadata?: Record<string, unknown>;
}): Promise<WhatsAppTextResult> {
  const makeWebhook = process.env.MAKE_DAILY_SUMMARY_WEBHOOK_URL;
  const makeSecret = process.env.MAKE_DAILY_SUMMARY_WEBHOOK_SECRET;

  if (makeWebhook) {
    try {
      const response = await fetch(makeWebhook, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(makeSecret ? { "x-nexo-secret": makeSecret } : {}),
        },
        body: JSON.stringify({
          type: "agent_daily_summary",
          to: params.to.replace(/\D/g, ""),
          message: params.body,
          ...params.metadata,
        }),
        cache: "no-store",
      });

      const text = await response.text();
      let payload: unknown = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        return {
          ok: false,
          provider: "make",
          error: `Make respondió ${response.status}: ${text.slice(0, 300)}`,
        };
      }

      const object =
        payload && typeof payload === "object"
          ? (payload as Record<string, unknown>)
          : null;

      return {
        ok: true,
        provider: "make",
        messageId: String(
          object?.message_id ??
            object?.messageId ??
            object?.id ??
            `make-${Date.now()}`
        ),
      };
    } catch (error) {
      return {
        ok: false,
        provider: "make",
        error:
          error instanceof Error
            ? error.message
            : "Error desconocido enviando a Make",
      };
    }
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    return {
      ok: false,
      provider: "none",
      error:
        "No hay transporte de WhatsApp configurado: falta MAKE_DAILY_SUMMARY_WEBHOOK_URL o las credenciales Twilio.",
    };
  }

  const to = params.to.startsWith("whatsapp:")
    ? params.to
    : `whatsapp:+${params.to.replace(/\D/g, "")}`;
  const fromNormalized = from.startsWith("whatsapp:")
    ? from
    : `whatsapp:${from}`;

  try {
    const client = twilio(accountSid, authToken);
    const message = await client.messages.create({
      from: fromNormalized,
      to,
      body: params.body,
    });

    return {
      ok: true,
      provider: "twilio",
      messageId: message.sid,
    };
  } catch (error) {
    return {
      ok: false,
      provider: "twilio",
      error:
        error instanceof Error
          ? error.message
          : "Error desconocido al enviar WhatsApp",
    };
  }
}
