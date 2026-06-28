import { NextResponse } from "next/server";
import { fetchInformeMarcaDatos } from "@/lib/informes/fetch-informe-marca-datos";
import { buildLeftColOnlyHtml, buildCoverOnlyHtml } from "@/lib/informes/marca-report-html";
import puppeteer from "puppeteer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUPPETEER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--font-render-hinting=none",
  "--disable-lcd-text",
];

type PuppeteerPage = Awaited<ReturnType<Awaited<ReturnType<typeof puppeteer.launch>>["newPage"]>>;

async function waitForFontsAndPaint(page: PuppeteerPage) {
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
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}

/**
 * Debug route — renders the cover at A4 size for visual inspection.
 *
 * ?format=html      → raw cover HTML (browser renders it, no Puppeteer)
 * ?format=png       → Puppeteer screenshot of the cover at A4 (794×1123, 2×)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get("brand") ?? "Burger King";
    const format = searchParams.get("format") ?? "png";

    const datos = await fetchInformeMarcaDatos(brand);

    if (format === "html") {
      const html = buildCoverOnlyHtml(datos);
      return new NextResponse(html, {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    // Default: PNG screenshot of the cover at A4 dimensions via Puppeteer
    const coverHtml = buildLeftColOnlyHtml(datos); // full cover HTML (see marca-report-html.ts)
    const browser = await puppeteer.launch({ headless: true, args: PUPPETEER_ARGS });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 3 });
      await page.emulateMediaType("screen");
      await page.setContent(coverHtml, { waitUntil: "load" });
      await waitForFontsAndPaint(page);

      const pngB64 = (await page.screenshot({
        type: "png",
        clip: { x: 0, y: 0, width: 794, height: 1123 },
        encoding: "base64",
      })) as string;

      return new NextResponse(Buffer.from(pngB64, "base64"), {
        headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
      });
    } finally {
      await browser.close().catch(() => {});
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
