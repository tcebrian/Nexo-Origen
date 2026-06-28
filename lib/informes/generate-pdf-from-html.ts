import puppeteer from "puppeteer";
import { getInformeSummaryStyles } from "@/lib/informes/informe-summary-html";

const PUPPETEER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--font-render-hinting=none",
  "--disable-lcd-text",
];

// A4 at 96 dpi (CSS reference pixels)
const A4_W = 794;
const A4_H = 1123;

type GeneratePdfOptions = {
  /**
   * Standalone HTML for the cover page (full A4, 794×1123 px).
   * Puppeteer screenshots this into a PNG bitmap which is then embedded
   * as the first page of the PDF — bypasses all text-layer compositing issues.
   */
  leftColHtml: string;
  /**
   * Kept for API compatibility with callers that pass a composite builder.
   * Not used in the current implementation — the cover screenshot is taken
   * directly from leftColHtml at A4 dimensions.
   */
  buildCoverComposite?: (leftColB64: string) => string;
  /** Standalone HTML for the summary pages (no cover). */
  summaryHtml: string;
};

async function waitForFontsAndPaint(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof puppeteer.launch>>["newPage"]>>
) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    const imgs = Array.from(document.images);
    await Promise.all(
      imgs.map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              })
      )
    );
  });
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
  );
}

/**
 * Two-pass PDF generation:
 *
 * Pass 1 — Cover screenshot (794×1123 px)
 *   Puppeteer renders the cover HTML into a full-A4 PNG bitmap.
 *   Because the output is a rasterised image, it cannot exhibit Chromium's
 *   text-layer compositing bug regardless of layout complexity.
 *
 * Pass 2 — Final PDF
 *   Combined HTML: <cover PNG as first page> + <summary HTML pages>.
 */
export async function generatePdfFromHtml({
  leftColHtml,
  summaryHtml,
}: GeneratePdfOptions): Promise<Buffer> {

  // ── Pass 1: screenshot the cover at full A4 dimensions ────────────────────
  let coverB64: string;
  const browser1 = await puppeteer.launch({ headless: true, args: PUPPETEER_ARGS });
  try {
    const page = await browser1.newPage();
    await page.setViewport({ width: A4_W, height: A4_H, deviceScaleFactor: 3 });
    await page.emulateMediaType("screen");
    await page.setContent(leftColHtml, { waitUntil: "load" });
    await waitForFontsAndPaint(page);

    coverB64 = (await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: A4_W, height: A4_H },
      encoding: "base64",
    })) as string;
  } finally {
    await browser1.close();
  }

  // ── Pass 2: build the final PDF ────────────────────────────────────────────
  const summaryBodyContent = summaryHtml.replace(
    /^[\s\S]*?<body[^>]*>|<\/body>[\s\S]*$/gi,
    ""
  );

  const combinedHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4; margin: 0; }
    body {
      font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .pdf-cover-page {
      width: 210mm;
      height: 297mm;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
      display: block;
    }
    .pdf-cover-page img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: fill;
    }
    ${getInformeSummaryStyles()}
  </style>
</head>
<body>
  <div class="pdf-cover-page">
    <img src="data:image/png;base64,${coverB64}" alt="" />
  </div>
  ${summaryBodyContent}
</body>
</html>`;

  const browser2 = await puppeteer.launch({ headless: true, args: PUPPETEER_ARGS });
  try {
    const page = await browser2.newPage();
    await page.setViewport({ width: A4_W, height: A4_H, deviceScaleFactor: 1 });
    await page.emulateMediaType("print");
    await page.setContent(combinedHtml, { waitUntil: "load" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    return Buffer.from(pdf);
  } finally {
    await browser2.close();
  }
}
