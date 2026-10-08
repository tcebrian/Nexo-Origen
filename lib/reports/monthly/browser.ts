import "server-only";

import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import type { Page } from "playwright-core";
import { installNetworkGuard } from "@/lib/render/network-guard";

/** Abre el navegador: Chromium empaquetado en serverless (Vercel), el de Playwright en local. */
export async function launchReportBrowser(options: {
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
}): Promise<{ page: Page; close: () => Promise<void> }> {
  const { chromium } = await import("playwright-core");
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

  if (!isServerless) {
    const browser = await chromium.launch({
      headless: true,
      args: ["--font-render-hinting=none", "--force-color-profile=srgb"],
    });
    const page = await browser.newPage(options);
    // El HTML de los informes lo lleva todo incrustado (data:): Chromium no necesita red.
    await installNetworkGuard(page, null);
    return { page, close: () => browser.close() };
  }

  const { default: packagedChromium } = await import("@sparticuz/chromium");
  packagedChromium.setGraphicsMode = false;
  const directory = `/tmp/nexo-monthly-${randomUUID()}`;
  const context = await chromium.launchPersistentContext(directory, {
    executablePath: await packagedChromium.executablePath(),
    args: [...packagedChromium.args, "--disable-dev-shm-usage"],
    ...options,
  });
  const page = context.pages()[0] ?? (await context.newPage());
  await installNetworkGuard(page, null);
  return {
    page,
    close: async () => {
      await context.close().catch(() => {});
      await rm(directory, { recursive: true, force: true }).catch(() => {});
    },
  };
}
