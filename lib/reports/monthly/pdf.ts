import "server-only";

import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import type { MonthlyReportData } from "./data";
import { buildMonthlyHtml } from "./html";

/** Abre el navegador: Chromium empaquetado en serverless (Vercel), el de Playwright en local. */
async function launchPdfBrowser() {
  const { chromium } = await import("playwright-core");
  const viewport = { width: 794, height: 1123 };
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

  if (!isServerless) {
    const browser = await chromium.launch({
      headless: true,
      args: ["--font-render-hinting=none", "--force-color-profile=srgb"],
    });
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    return { page, close: () => browser.close() };
  }

  const { default: packagedChromium } = await import("@sparticuz/chromium");
  packagedChromium.setGraphicsMode = false;
  const directory = `/tmp/nexo-monthly-${randomUUID()}`;
  const context = await chromium.launchPersistentContext(directory, {
    executablePath: await packagedChromium.executablePath(),
    args: [...packagedChromium.args, "--disable-dev-shm-usage"],
    viewport,
    deviceScaleFactor: 1,
  });
  const page = context.pages()[0] ?? (await context.newPage());
  return {
    page,
    close: async () => {
      await context.close().catch(() => {});
      await rm(directory, { recursive: true, force: true }).catch(() => {});
    },
  };
}

export async function generateMonthlyPdf(data: MonthlyReportData): Promise<Buffer> {
  const { page, close } = await launchPdfBrowser();
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
