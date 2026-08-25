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
  const token = searchParams.get("token");

  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!secret || token !== secret) {
    return new Response("No autorizado", { status: 401 });
  }

  const resenaId = resenaIdRaw ? Number(resenaIdRaw) : NaN;
  if (!Number.isFinite(resenaId)) {
    return new Response("resena_id inválido", { status: 400 });
  }

  try {
    const data = await buildAlertDataForResena(resenaId);
    if (!data) return new Response("Reseña no encontrada", { status: 404 });

    const origin = new URL(request.url).origin;
    const { captureNegativeReviewAlertPng } = await import(
      "@/lib/templates/negative-review-alert/capture-image"
    );
    const png = await captureNegativeReviewAlertPng(data, { assetBaseUrl: origin });

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
