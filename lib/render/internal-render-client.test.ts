import { describe, expect, it, vi } from "vitest";
import { RenderError, renderViaInternal } from "@/lib/render/internal-render-client";
import {
  RENDER_PATH,
  RENDER_SIGNATURE_HEADER,
  RENDER_TIMESTAMP_HEADER,
  VERCEL_BYPASS_HEADER,
  verifyRenderSignature,
} from "@/lib/render/protocol";
import { SECRET, sampleMonthlyReport } from "@/lib/render/fixtures.test-helper";

vi.mock("server-only", () => ({}));

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const NOW = 1_790_000_000_000;
const env = { NEXO_INTERNAL_RENDER_TOKEN: SECRET, VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "app.nexo.example" } as never;

const ok = (contentType = "image/png", body: Uint8Array = PNG) =>
  vi.fn(async () => new Response(new Uint8Array(body), { status: 200, headers: { "Content-Type": contentType } }));
const request = { op: "network_summary_image", periodo: "semanal", grupo: "bk", offset: 0 } as const;

describe("renderViaInternal", () => {
  it("llama al renderer del origen fijado por el servidor, con la petición firmada", async () => {
    const fetchImpl = ok();
    const out = await renderViaInternal(request, { fetchImpl: fetchImpl as never, env, now: () => NOW });

    expect(out).toEqual(PNG);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://app.nexo.example${RENDER_PATH}`);
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;
    expect(headers[RENDER_TIMESTAMP_HEADER]).toBe(String(NOW));
    expect(
      verifyRenderSignature({
        rawBody: init.body as Uint8Array,
        timestamp: headers[RENDER_TIMESTAMP_HEADER],
        signature: headers[RENDER_SIGNATURE_HEADER],
        secret: SECRET,
        nowMs: NOW,
      })
    ).toEqual({ ok: true });
  });

  it("el token nunca viaja: ni en cabeceras ni en el cuerpo", async () => {
    const fetchImpl = ok();
    await renderViaInternal(request, { fetchImpl: fetchImpl as never, env, now: () => NOW });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.stringify(init.headers)).not.toContain(SECRET);
    expect(new TextDecoder().decode(init.body as Uint8Array)).not.toContain(SECRET);
  });

  it("envía el cuerpo tal cual (sin URL ni host) y PDF para monthly_pdf", async () => {
    const fetchImpl = ok("application/pdf", Buffer.from("%PDF"));
    const out = await renderViaInternal({ op: "monthly_pdf", report: sampleMonthlyReport() }, { fetchImpl: fetchImpl as never, env, now: () => NOW });
    expect(out.toString()).toBe("%PDF");
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const sent = JSON.parse(new TextDecoder().decode(init.body as Uint8Array));
    expect(Object.keys(sent).sort()).toEqual(["op", "report"]);
  });

  it("en preview añade la cabecera de bypass solo si está configurada", async () => {
    const withBypass = ok();
    await renderViaInternal(request, { fetchImpl: withBypass as never, env: { ...env, VERCEL_AUTOMATION_BYPASS_SECRET: "bypass-secret" } as never, now: () => NOW });
    expect(((withBypass.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>)[VERCEL_BYPASS_HEADER]).toBe("bypass-secret");

    const without = ok();
    await renderViaInternal(request, { fetchImpl: without as never, env, now: () => NOW });
    expect(((without.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>)[VERCEL_BYPASS_HEADER]).toBeUndefined();
  });

  it("sin credencial configurada falla antes de llamar a nadie", async () => {
    const fetchImpl = ok();
    await expect(renderViaInternal(request, { fetchImpl: fetchImpl as never, env: {} as never })).rejects.toThrow(/NEXO_INTERNAL_RENDER_TOKEN/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("un error del renderer conserva su mensaje (las rutas responden como antes)", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ error: "Falta NEXO_INTERNAL_RENDER_TOKEN (mínimo 16 caracteres) para renderizar la plantilla" }, { status: 500 }));
    const error = await renderViaInternal(request, { fetchImpl: fetchImpl as never, env, now: () => NOW }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RenderError);
    expect((error as RenderError).status).toBe(500);
    expect((error as Error).message).toContain("NEXO_INTERNAL_RENDER_TOKEN");
  });

  it("401 / 400 del renderer → RenderError con su estado y mensaje genérico", async () => {
    for (const status of [400, 401, 413, 503]) {
      const fetchImpl = vi.fn(async () => Response.json({ error: "No autorizado" }, { status }));
      const error = (await renderViaInternal(request, { fetchImpl: fetchImpl as never, env }).catch((e: unknown) => e)) as RenderError;
      expect(error.status).toBe(status);
    }
  });

  it("respuesta con otro tipo de contenido, vacía o fallo de red → error", async () => {
    await expect(renderViaInternal(request, { fetchImpl: ok("text/html") as never, env })).rejects.toThrow(/no válida/);
    await expect(renderViaInternal(request, { fetchImpl: ok("image/png", new Uint8Array()) as never, env })).rejects.toThrow(/vacío/);
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const error = (await renderViaInternal(request, { fetchImpl: down as never, env }).catch((e: unknown) => e)) as RenderError;
    expect(error.status).toBe(502);
  });

  it("timeout → 504", async () => {
    const hang = vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("abort"), { name: "AbortError" })))));
    const error = (await renderViaInternal(request, { fetchImpl: hang as never, env, timeoutMs: 10 }).catch((e: unknown) => e)) as RenderError;
    expect(error.status).toBe(504);
  });
});
