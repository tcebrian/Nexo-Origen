import { normalizeAlertPayload } from "@/lib/templates/negative-review-alert/parse-payload";
import { SAMPLE_NEGATIVE_REVIEW_ALERT } from "@/lib/templates/negative-review-alert/sample-data";
import type { NegativeReviewAlertData } from "@/lib/templates/negative-review-alert/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildFilename(data: NegativeReviewAlertData): string {
  const slug = data.restaurant_name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const date = data.review_date.replace(/\s+/g, "-").toLowerCase();
  return `nexo-alerta-${slug || "restaurante"}-${date}.png`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<NegativeReviewAlertData>;
    const data = normalizeAlertPayload(body, SAMPLE_NEGATIVE_REVIEW_ALERT);
    const origin = new URL(request.url).origin;

    const { captureNegativeReviewAlertPng } = await import(
      "@/lib/templates/negative-review-alert/capture-image"
    );
    const png = await captureNegativeReviewAlertPng(data, {
      assetBaseUrl: origin,
    });

    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="${buildFilename(data)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/generate-negative-review-image]", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo generar la imagen de alerta.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json({
    ok: true,
    message: "Usa POST con el payload de la alerta. Sin body, se usa el ejemplo BK Utebo.",
    sample: SAMPLE_NEGATIVE_REVIEW_ALERT,
    templateUrl: "/templates/negative-review-alert",
    previewUrl: "/preview/negative-review-alert",
    formats: {
      "4:3": "1600x1200",
      "9:16": "1080x1920",
    },
  });
}
