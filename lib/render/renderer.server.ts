import "server-only";

import { generateMonthlyPng } from "@/lib/reports/monthly/image/capture";
import { generateMonthlyPdf } from "@/lib/reports/monthly/pdf";
import { captureNetworkSummaryPng } from "@/lib/reports/network-summary/capture-image";
import { RENDER_CONTENT_TYPES, resolveInternalOrigin, type RenderRequest } from "@/lib/render/protocol";
import { captureNegativeReviewAlertPng } from "@/lib/templates/negative-review-alert/capture-image";

/**
 * Ejecuta una operación de render ya validada. SOLO lo importa `/api/internal/render`: es el único
 * punto del proyecto que carga Chromium (playwright-core + @sparticuz/chromium), sharp y las plantillas.
 *
 * El origen al que se navega lo decide el servidor, nunca la petición, y Chromium solo puede salir a
 * ese origen (más `data:`). Cada operación llama al mismo generador que usaban antes las rutas públicas,
 * así que el resultado (tamaño, PDF A4, calidad del PNG) es el mismo.
 */
export async function executeRender(request: RenderRequest): Promise<{ contentType: string; body: Buffer }> {
  const contentType = RENDER_CONTENT_TYPES[request.op];

  switch (request.op) {
    case "monthly_pdf":
      return { contentType, body: await generateMonthlyPdf(request.report) };

    case "monthly_image":
      return { contentType, body: await generateMonthlyPng(request.report) };

    case "negative_review_image":
    case "whatsapp_alert_image": {
      const origin = resolveInternalOrigin();
      return {
        contentType,
        body: await captureNegativeReviewAlertPng(request.data, { assetBaseUrl: origin, allowedOrigin: origin }),
      };
    }

    case "network_summary_image": {
      const origin = resolveInternalOrigin();
      return {
        contentType,
        body: await captureNetworkSummaryPng(request.periodo, request.grupo, origin, request.offset, { allowedOrigin: origin }),
      };
    }
  }
}
