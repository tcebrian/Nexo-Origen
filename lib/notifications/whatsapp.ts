import twilio from "twilio";

/**
 * Envía un aviso de WhatsApp con una imagen adjunta (el PNG de la alerta)
 * vía Twilio. Necesita TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y
 * TWILIO_WHATSAPP_FROM (número de Twilio, formato "whatsapp:+14155238886").
 */
export async function sendWhatsAppImageAlert(params: {
  to: string;
  mediaUrl: string;
  caption: string;
}): Promise<{ ok: true; sid: string } | { ok: false; error: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    return { ok: false, error: "Twilio no está configurado (faltan TWILIO_ACCOUNT_SID/AUTH_TOKEN/WHATSAPP_FROM)" };
  }

  const to = params.to.startsWith("whatsapp:") ? params.to : `whatsapp:${params.to}`;
  const fromNormalized = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;

  try {
    const client = twilio(accountSid, authToken);
    const message = await client.messages.create({
      from: fromNormalized,
      to,
      body: params.caption,
      mediaUrl: [params.mediaUrl],
    });
    return { ok: true, sid: message.sid };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Error desconocido al enviar WhatsApp" };
  }
}
