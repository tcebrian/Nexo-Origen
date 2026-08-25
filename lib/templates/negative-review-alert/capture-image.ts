import "server-only";

import { randomUUID } from "node:crypto";
import { readdir, rm } from "node:fs/promises";

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
const CANVAS_SELECTOR =
  ".nra-canvas, .bka-canvas, .ppa-canvas, .sga-canvas, .rba-canvas, .tha-canvas, .sba-canvas, .tva-canvas, .vaa-canvas";

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

  // playwright-core (a diferencia del paquete "playwright" completo) no
  // trae el instalador de navegadores ni el runner de tests — es más
  // ligero y evita problemas de empaquetado al desplegar en Vercel.
  let chromium: typeof import("playwright-core").chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch (err) {
    throw new Error(
      `No se pudo cargar playwright-core: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // En Vercel (y cualquier entorno serverless) no hay un Chromium
  // instalado vía `npx playwright install` — el binario que trae el
  // paquete "playwright" solo existe en la máquina de desarrollo. Ahí
  // usamos el Chromium empaquetado de @sparticuz/chromium, pensado para
  // correr dentro de una función serverless.
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  // Un directorio de perfil de Chromium propio y único por petición. En un
  // Lambda/función "caliente" (reutilizada entre peticiones), Playwright no
  // limpia solo su user-data-dir por defecto — /tmp se va llenando y, tras
  // varias invocaciones seguidas, Chromium empieza a fallar con
  // net::ERR_INSUFFICIENT_RESOURCES. Se borra en el finally de abajo.
  const userDataDir = isServerless ? `/tmp/pw-${randomUUID()}` : null;
  const browser = isServerless
    ? await (async () => {
        // Barrido defensivo: si una invocación anterior en esta misma
        // función "caliente" murió a media captura (timeout, OOM…), su
        // finally no llegó a ejecutarse y su carpeta /tmp/pw-* quedó
        // huérfana. Limpiarlas aquí evita que /tmp se vaya llenando entre
        // invocaciones hasta que Chromium falle con
        // net::ERR_INSUFFICIENT_RESOURCES.
        const entries = await readdir("/tmp").catch(() => [] as string[]);
        await Promise.all(
          entries
            .filter((name) => name.startsWith("pw-"))
            .map((name) => rm(`/tmp/${name}`, { recursive: true, force: true }).catch(() => {}))
        );

        const { default: sparticuzChromium } = await import("@sparticuz/chromium");
        // No usamos WebGL/canvas 3D en estas plantillas — desactivarlo evita
        // problemas de inicialización de swiftshader en el sandbox de Vercel.
        sparticuzChromium.setGraphicsMode = false;
        // OJO: aparte de --user-data-dir (necesario, ver arriba) y
        // --disable-dev-shm-usage (el /dev/shm de estos contenedores es
        // minúsculo; sin este flag Chromium intenta usarlo igualmente y
        // acaba fallando con net::ERR_INSUFFICIENT_RESOURCES), se pasan
        // solo los args recomendados por @sparticuz/chromium, tal cual su
        // ejemplo oficial para Playwright, sin forzar `headless` — chromium.args
        // ya trae su propio `--headless='shell'` y flags que chocan con los
        // nuestros (p.ej. --font-render-hinting). Mezclar flags propios aquí
        // hizo que Chromium se cerrase nada más arrancar ("Target page,
        // context or browser has been closed").
        return chromium.launch({
          executablePath: await sparticuzChromium.executablePath(),
          args: [
            ...sparticuzChromium.args,
            `--user-data-dir=${userDataDir}`,
            "--disable-dev-shm-usage",
          ],
        });
      })()
    : await chromium.launch({
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
  } catch (err) {
    if (isServerless) {
      const mem = process.memoryUsage();
      const diag = `rss=${Math.round(mem.rss / 1e6)}MB heapUsed=${Math.round(mem.heapUsed / 1e6)}MB heapTotal=${Math.round(mem.heapTotal / 1e6)}MB external=${Math.round(mem.external / 1e6)}MB`;
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`${msg}\n[diag] ${diag}`);
    }
    throw err;
  } finally {
    await browser.close();
    if (userDataDir) {
      await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
