import "server-only";

import { optimizeNetworkSummaryPng } from "@/lib/reports/network-summary/optimize-png";
import type { MonthlyReportData } from "../data";
import { launchReportBrowser } from "../browser";
import { buildMonthlyImageHtml, MONTHLY_IMAGE_HEIGHT, MONTHLY_IMAGE_WIDTH } from "./html";
import { buildMonthlyImageModel } from "./model";

/**
 * Se renderiza a 2× (3840×2160) y se reduce con Lanczos a 1920×1080 para que
 * texto y gráficos queden muy nítidos.
 */
const CAPTURE_SCALE_FACTOR = 2;

export async function generateMonthlyPng(data: MonthlyReportData): Promise<Buffer> {
  const html = await buildMonthlyImageHtml(buildMonthlyImageModel(data));
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
