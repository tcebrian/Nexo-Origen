import "server-only";

import { randomUUID } from "node:crypto";
import { readdir, rm } from "node:fs/promises";

import { optimizeNetworkSummaryPng } from "./optimize-png";
import type { NetworkReportGroupId } from "./brand-groups";
import type { ReportPeriodSlug } from "@/lib/reports/period-ranges";

const DESIGN_WIDTH = 1536;
const DESIGN_HEIGHT = 1024;
const CAPTURE_SCALE_FACTOR = 2;
const CANVAS_SELECTOR = ".nws-canvas";

/**
 * Misma receta (probada a fuego) que
 * lib/templates/negative-review-alert/capture-image.ts: playwright-core +
 * @sparticuz/chromium en serverless (Vercel), Chromium normal en local. Se
 * duplica en vez de compartir código para no arriesgar el pipeline de
 * negative-review-alert, ya estabilizado tras mucho debugging en producción.
 */
async function waitForRender(page: import("playwright-core").Page): Promise<void> {
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

export async function captureNetworkSummaryPng(
  periodo: ReportPeriodSlug,
  grupo: NetworkReportGroupId,
  assetBaseUrl: string,
  offset: number = 0
): Promise<Buffer> {
  const templateUrl = `${assetBaseUrl.replace(/\/$/, "")}/templates/network-summary/${periodo}/${grupo}?offset=${offset}`;

  let chromium: typeof import("playwright-core").chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch (err) {
    throw new Error(
      `No se pudo cargar playwright-core: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const userDataDir = isServerless ? `/tmp/pw-${randomUUID()}` : null;

  let page: import("playwright-core").Page;
  let closeBrowser: () => Promise<void>;
  if (isServerless) {
    const entries = await readdir("/tmp").catch(() => [] as string[]);
    await Promise.all(
      entries
        .filter((name) => name.startsWith("pw-"))
        .map((name) => rm(`/tmp/${name}`, { recursive: true, force: true }).catch(() => {}))
    );

    const { default: sparticuzChromium } = await import("@sparticuz/chromium");
    sparticuzChromium.setGraphicsMode = false;
    const context = await chromium.launchPersistentContext(userDataDir as string, {
      executablePath: await sparticuzChromium.executablePath(),
      args: [...sparticuzChromium.args, "--disable-dev-shm-usage"],
      viewport: { width: DESIGN_WIDTH, height: DESIGN_HEIGHT },
      deviceScaleFactor: CAPTURE_SCALE_FACTOR,
    });
    page = context.pages()[0] ?? (await context.newPage());
    closeBrowser = () => context.close();
  } else {
    const browser = await chromium.launch({
      headless: true,
      args: ["--font-render-hinting=full", "--force-color-profile=srgb"],
    });
    page = await browser.newPage({
      viewport: { width: DESIGN_WIDTH, height: DESIGN_HEIGHT },
      deviceScaleFactor: CAPTURE_SCALE_FACTOR,
    });
    closeBrowser = () => browser.close();
  }

  try {
    await page.goto(templateUrl, { waitUntil: "networkidle" });
    await waitForRender(page);
    const canvasHandle = await page.$(CANVAS_SELECTOR);
    const screenshot = canvasHandle
      ? await canvasHandle.screenshot({ type: "png" })
      : await page.screenshot({
          type: "png",
          clip: { x: 0, y: 0, width: DESIGN_WIDTH, height: DESIGN_HEIGHT },
        });
    return optimizeNetworkSummaryPng(Buffer.from(screenshot));
  } catch (err) {
    if (isServerless) {
      const mem = process.memoryUsage();
      const diag = `rss=${Math.round(mem.rss / 1e6)}MB heapUsed=${Math.round(mem.heapUsed / 1e6)}MB heapTotal=${Math.round(mem.heapTotal / 1e6)}MB external=${Math.round(mem.external / 1e6)}MB`;
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`${msg}\n[diag] ${diag}`);
    }
    throw err;
  } finally {
    await Promise.race([
      closeBrowser().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
    if (userDataDir) {
      rm(userDataDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
