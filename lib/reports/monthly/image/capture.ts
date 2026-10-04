import "server-only";

import { optimizeNetworkSummaryPng } from "@/lib/reports/network-summary/optimize-png";
import type { MonthlyReportData } from "../data";
import { launchReportBrowser } from "../browser";
import { buildMonthlyImageHtml } from "./html";
import { buildMonthlyImageModel, type MonthlyImageModel } from "./model";
import { buildPopeyesImageHtml } from "./popeyes-html";
import { buildRibsImageHtml } from "./ribs-html";
import { buildSantaGloriaImageHtml } from "./santa-gloria-html";
import { buildSibuyaImageHtml } from "./sibuya-html";
import { buildTimHortonsImageHtml } from "./tim-hortons-html";
import { buildVolapieImageHtml } from "./volapie-html";
import { MONTHLY_IMAGE_HEIGHT, MONTHLY_IMAGE_WIDTH } from "./shared";

/**
 * Se renderiza a 2× (3840×2160) y se reduce con Lanczos a 1920×1080 para que
 * texto y gráficos queden muy nítidos.
 */
const CAPTURE_SCALE_FACTOR = 2;

/** Cada marca con plantilla dedicada usa la suya; el resto, la plantilla base con su tema. */
export function buildMonthlyImageDocument(model: MonthlyImageModel): Promise<string> {
  if (model.theme.id === "sg") return buildSantaGloriaImageHtml(model);
  if (model.theme.id === "pp") return buildPopeyesImageHtml(model);
  if (model.theme.id === "th") return buildTimHortonsImageHtml(model);
  if (model.theme.id === "rb") return buildRibsImageHtml(model);
  if (model.theme.id === "sb") return buildSibuyaImageHtml(model);
  if (model.theme.id === "tv") return buildVolapieImageHtml(model);
  return buildMonthlyImageHtml(model);
}

export async function generateMonthlyPng(data: MonthlyReportData): Promise<Buffer> {
  const html = await buildMonthlyImageDocument(buildMonthlyImageModel(data));
  const { page, close } = await launchReportBrowser({
    viewport: { width: MONTHLY_IMAGE_WIDTH, height: MONTHLY_IMAGE_HEIGHT },
    deviceScaleFactor: CAPTURE_SCALE_FACTOR,
  });
  try {
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const screenshot = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: MONTHLY_IMAGE_WIDTH, height: MONTHLY_IMAGE_HEIGHT },
    });
    return optimizeNetworkSummaryPng(Buffer.from(screenshot));
  } finally {
    await Promise.race([close().catch(() => {}), new Promise((resolve) => setTimeout(resolve, 5000))]);
  }
}
