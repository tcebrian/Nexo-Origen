import "server-only";

import { resolveDesignCanvasSize } from "@/lib/templates/negative-review-alert/dimensions";
import { optimizeAlertPng } from "@/lib/templates/negative-review-alert/optimize-png";
import type { NegativeReviewAlertData } from "@/lib/templates/negative-review-alert/types";
export type CaptureImageOptions = {
  assetBaseUrl: string;
  deviceScaleFactor?: number;
};

const CAPTURE_SCALE_FACTOR = 3;

// Cada marca con plantilla propia usa su propio nombre de clase en el
// elemento raíz (ver el className del <div ref={ref}> en cada
// brands/*.tsx) — hay que listarlos todos aquí o Playwright espera
// indefinidamente al buscar un selector que no existe en esa plantilla.
const CANVAS_SELECTOR = ".nra-canvas, .bka-canvas, .ppa-canvas, .sga-canvas, .rba-canvas, .tha-canvas";

async function waitForRender(page: import("playwright").Page): Promise<void> {
  await page.waitForSelector(CANVAS_SELECTOR);
  await page.evaluate(async () => {
    await document.fonts.ready;
    const images = Array.from(document.images);
    await Promise.all(
      images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        });
      })
    );
  });
  await page.waitForTimeout(120);
}

export async function captureNegativeReviewAlertPng(
  data: NegativeReviewAlertData,
  options: CaptureImageOptions
): Promise<Buffer> {
  const { buildAlertTemplateUrl } = await import(
    "@/lib/templates/negative-review-alert/parse-payload"
  );
  const templateUrl = buildAlertTemplateUrl(data, options.assetBaseUrl);
  return captureNegativeReviewAlertViaUrl(data, templateUrl, options);
}

export async function captureNegativeReviewAlertViaUrl(
  data: NegativeReviewAlertData,
  templateUrl: string,
  options: Omit<CaptureImageOptions, "assetBaseUrl"> = {}
): Promise<Buffer> {
  const design = resolveDesignCanvasSize(data.aspect_ratio);
  const deviceScaleFactor = options.deviceScaleFactor ?? CAPTURE_SCALE_FACTOR;

  let chromium: typeof import("playwright").chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error(
      "Playwright no está instalado. Ejecuta: npm install playwright && npx playwright install chromium"
    );
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--font-render-hinting=full", "--force-color-profile=srgb"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: design.width, height: design.height },
      deviceScaleFactor,
    });
    await page.goto(templateUrl, { waitUntil: "networkidle" });
    await waitForRender(page);
    const canvasHandle = await page.$(CANVAS_SELECTOR);
    const screenshot = canvasHandle
      ? await canvasHandle.screenshot({ type: "png" })
      : await page.screenshot({
          type: "png",
          clip: { x: 0, y: 0, width: design.width, height: design.height },
        });
    return optimizeAlertPng(Buffer.from(screenshot), data.aspect_ratio);
  } finally {
    await browser.close();
  }
}
