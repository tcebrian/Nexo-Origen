import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TOKEN = "nexo-render-token-0123456789abcdef";
const ORIGIN = "https://nexo.example";
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

type RouteHandler = (route: {
  request: () => { headers: () => Record<string, string> };
  continue: (options: { headers: Record<string, string> }) => Promise<void>;
}) => unknown;
type RoutePredicate = (url: URL) => boolean;

const launch = vi.fn();
const goto = vi.fn();
const route = vi.fn();
const close = vi.fn();

function makePage() {
  return {
    route,
    goto,
    waitForSelector: vi.fn(async () => undefined),
    $eval: vi.fn(async () => ""),
    evaluate: vi.fn(async () => undefined),
    waitForTimeout: vi.fn(async () => undefined),
    $: vi.fn(async () => ({ screenshot: vi.fn(async () => PNG) })),
  };
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getAuthSession: vi.fn() }));
vi.mock("playwright-core", () => ({ chromium: { launch } }));
vi.mock("@/lib/reports/network-summary/optimize-png", () => ({ optimizeNetworkSummaryPng: async (b: Buffer) => b }));

const { captureNetworkSummaryPng } = await import("@/lib/reports/network-summary/capture-image");

beforeEach(() => {
  vi.resetAllMocks();
  process.env.NEXO_INTERNAL_RENDER_TOKEN = TOKEN;
  delete process.env.VERCEL;
  delete process.env.AWS_LAMBDA_FUNCTION_NAME;
  const page = makePage();
  launch.mockResolvedValue({ newPage: async () => page, close });
  route.mockResolvedValue(undefined);
  goto.mockResolvedValue(undefined);
  close.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.NEXO_INTERNAL_RENDER_TOKEN;
});

describe("captureNetworkSummaryPng", () => {
  it("sigue devolviendo la imagen de la plantilla (semanal y trimestral)", async () => {
    expect(await captureNetworkSummaryPng("semanal", "bk", ORIGIN, 1)).toEqual(PNG);
    expect(goto).toHaveBeenLastCalledWith(`${ORIGIN}/templates/network-summary/semanal/bk?offset=1`, {
      waitUntil: "networkidle",
    });
    expect(await captureNetworkSummaryPng("trimestral", "sg-es", `${ORIGIN}/`, 0)).toEqual(PNG);
    expect(goto).toHaveBeenLastCalledWith(`${ORIGIN}/templates/network-summary/trimestral/sg-es?offset=0`, {
      waitUntil: "networkidle",
    });
  });

  it("envía la cabecera interna al navegar a la plantilla y conserva el resto de cabeceras", async () => {
    await captureNetworkSummaryPng("semanal", "bk", ORIGIN, 0);

    expect(route).toHaveBeenCalledTimes(1);
    const [, handler] = route.mock.calls[0] as [RoutePredicate, RouteHandler];

    const proceed = vi.fn(async () => undefined);
    await handler({
      request: () => ({ headers: () => ({ "user-agent": "Chromium", accept: "text/html" }) }),
      continue: proceed,
    });
    expect(proceed).toHaveBeenCalledWith({
      headers: { "user-agent": "Chromium", accept: "text/html", "x-nexo-internal-render-token": TOKEN },
    });
  });

  it("la cabecera solo se añade a la navegación a la plantilla de nuestro origen (no a imágenes ni a terceros)", async () => {
    await captureNetworkSummaryPng("semanal", "bk", ORIGIN, 0);
    const [matches] = route.mock.calls[0] as [RoutePredicate];

    expect(matches(new URL(`${ORIGIN}/templates/network-summary/semanal/bk?offset=0`))).toBe(true);
    expect(matches(new URL(`${ORIGIN}/brands/burger-king.png`))).toBe(false);
    expect(matches(new URL(`${ORIGIN}/templates/network-summary/semanal/pp`))).toBe(false);
    expect(matches(new URL(`https://fonts.googleapis.com/templates/network-summary/semanal/bk`))).toBe(false);
  });

  it("el token no va en la URL de navegación", async () => {
    await captureNetworkSummaryPng("semanal", "bk", ORIGIN, 0);
    expect(JSON.stringify(goto.mock.calls)).not.toContain(TOKEN);
  });

  it("sin credencial configurada falla antes de lanzar Chromium y sin revelar nada", async () => {
    delete process.env.NEXO_INTERNAL_RENDER_TOKEN;
    const error = await captureNetworkSummaryPng("semanal", "bk", ORIGIN, 0).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("NEXO_INTERNAL_RENDER_TOKEN");
    expect(launch).not.toHaveBeenCalled();
  });

  it("un fallo de navegación no filtra la credencial en el error", async () => {
    goto.mockRejectedValue(new Error("net::ERR_FAILED"));
    const error = await captureNetworkSummaryPng("semanal", "bk", ORIGIN, 0).catch((e: Error) => e);
    expect((error as Error).message).not.toContain(TOKEN);
    expect(close).toHaveBeenCalled();
  });
});
