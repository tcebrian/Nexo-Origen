import "server-only";

import type { MonthlyReportData } from "./data";
import { launchReportBrowser } from "./browser";
import { buildMonthlyHtml } from "./html";

export async function generateMonthlyPdf(data: MonthlyReportData): Promise<Buffer> {
  const { page, close } = await launchReportBrowser({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1 });
  try {
    await page.setContent(await buildMonthlyHtml(data), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: "print" });
    return Buffer.from(await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" } }));
  } finally {
    await close().catch(() => {});
  }
}
