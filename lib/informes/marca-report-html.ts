import type { InformeMarcaDatos } from "@/lib/informes/types";
import {
  buildInformeCoverHtml,
  buildStandaloneCoverHtml,
  buildLeftColHtml,
  buildCoverCompositeHtml,
  getInformeCoverStyles,
} from "@/lib/informes/informe-cover-html";
import { buildInformeSummaryHtml, getInformeSummaryStyles } from "@/lib/informes/informe-summary-html";
import { escapeInformeHtml } from "@/lib/informes/report-html-base";

function makeCoverPayload(datos: InformeMarcaDatos) {
  return {
    media: datos.media,
    resenas: datos.resenas,
    negativas: datos.negativas,
    restaurantes: datos.restaurantes,
    estado: datos.estado,
    estadoLabel: datos.estadoLabel,
    marca: datos.marca,
    ...datos.cover,
  };
}

const GOOGLE_FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />`;

/**
 * Standalone full-cover HTML for Pass 1 of the PDF pipeline.
 * With the new single-panel design the cover is a flat layout — no split panels,
 * no overlapping stacking contexts, no Chromium text-layer compositing bug.
 */
export function buildLeftColOnlyHtml(datos: InformeMarcaDatos): string {
  return buildStandaloneCoverHtml(makeCoverPayload(datos));
}

/**
 * Wraps the pre-rasterised cover PNG in a minimal HTML document.
 * Used by the PDF generator in Pass 2.
 */
export function buildCoverCompositeHtmlForPdf(
  coverB64: string,
  datos: InformeMarcaDatos
): string {
  return buildCoverCompositeHtml(coverB64, makeCoverPayload(datos));
}

/**
 * Standalone full-cover HTML — can be used directly for the preview route.
 */
export function buildCoverOnlyHtml(datos: InformeMarcaDatos): string {
  return buildStandaloneCoverHtml(makeCoverPayload(datos));
}

/**
 * Summary-only HTML (no cover). The cover will be inserted as an image
 * by the PDF generator after screenshotting the cover HTML.
 */
export function buildSummaryOnlyHtml(datos: InformeMarcaDatos): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Informe ${escapeInformeHtml(datos.marca)} — Nexo Origen</title>
  ${GOOGLE_FONTS}
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4; margin: 0; }
    body {
      font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    ${getInformeSummaryStyles()}
  </style>
</head>
<body>
  ${buildInformeSummaryHtml(datos)}
</body>
</html>`;
}

/**
 * Legacy single-pass HTML (cover + summary in one document).
 */
export function buildMarcaReportHtml(datos: InformeMarcaDatos): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Informe ${escapeInformeHtml(datos.marca)} — Nexo Origen</title>
  ${GOOGLE_FONTS}
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4; margin: 0; }
    body {
      font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    ${getInformeCoverStyles()}
    ${getInformeSummaryStyles()}
  </style>
</head>
<body>
  ${buildInformeCoverHtml(makeCoverPayload(datos))}
  ${buildInformeSummaryHtml(datos)}
</body>
</html>`;
}
