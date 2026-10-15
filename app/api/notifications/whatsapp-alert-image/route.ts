import { renderViaInternal } from "@/lib/render/internal-render-client";
import { secretsMatch, verifyMediaToken } from "@/lib/auth/signed-media-token";
import { buildAlertDataForResena } from "@/lib/notifications/build-alert-for-resena";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Genera el PNG de una alerta a partir de un resena_id, para que Twilio lo
 * descargue como adjunto de WhatsApp (necesita una URL pública que él mismo
 * pueda pedir, no puede recibir los bytes directamente).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resenaIdRaw = searchParams.get("resena_id");
  const sig = searchParams.get("sig");
  // Compatibilidad: `token` con el secreto en bruto (URLs ya emitidas antes de la firma). Se retirará
  // cuando se confirme que ningún sistema externo lo usa.
  const legacyToken = searchParams.get("token");

  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  const resenaId = resenaIdRaw && /^\d+$/.test(resenaIdRaw) ? Number(resenaIdRaw) : NaN;
  const authorized =
    !!secret &&
    ((Number.isSafeInteger(resenaId) && verifyMediaToken({ token: sig, secret, scope: "whatsapp-alert-image", resourceId: resenaId })) ||
      secretsMatch(legacyToken, secret));
  if (!authorized) {
    return new Response("No autorizado", { status: 401 });
  }

  if (!Number.isSafeInteger(resenaId)) {
    return new Response("resena_id inválido", { status: 400 });
  }

  try {
    const data = await buildAlertDataForResena(resenaId);
    if (!data) return new Response("Reseña no encontrada", { status: 404 });

    const png = await renderViaInternal({ op: "whatsapp_alert_image", data });

    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/notifications/whatsapp-alert-image]", error);
    return new Response("No se pudo generar la imagen", { status: 500 });
  }
}
