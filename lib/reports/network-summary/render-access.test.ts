import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TOKEN = "nexo-render-token-0123456789abcdef";
const getAuthSession = vi.fn();
const fetchNetworkSummaryReport = vi.fn();
let requestHeaders: Record<string, string> = {};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getAuthSession }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(requestHeaders) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  },
}));
vi.mock("@/lib/reports/network-summary/fetch", () => ({ fetchNetworkSummaryReport }));
vi.mock("@/templates/network-summary/network-summary-standard-template", () => ({ NetworkSummaryStandardTemplate: () => null }));
vi.mock("@/templates/network-summary/network-summary-bk-template", () => ({ NetworkSummaryBkTemplate: () => null }));
vi.mock("@/templates/network-summary/network-summary-pp-template", () => ({ NetworkSummaryPpTemplate: () => null }));
vi.mock("@/templates/network-summary/network-summary-sg-template", () => ({ NetworkSummarySgTemplate: () => null }));
vi.mock("@/templates/network-summary/network-summary-th-template", () => ({ NetworkSummaryThTemplate: () => null }));
vi.mock("@/templates/network-summary/network-summary-hb-template", () => ({ NetworkSummaryHbTemplate: () => null }));

const { INTERNAL_RENDER_HEADER, canRenderNetworkTemplate, internalRenderToken, isValidInternalRenderToken } =
  await import("@/lib/reports/network-summary/render-access");

const session = (rol: string) => ({ perfil: { rol } });

beforeEach(() => {
  vi.resetAllMocks();
  requestHeaders = {};
  process.env.NEXO_INTERNAL_RENDER_TOKEN = TOKEN;
  getAuthSession.mockResolvedValue(null);
});

afterEach(() => {
  delete process.env.NEXO_INTERNAL_RENDER_TOKEN;
  vi.restoreAllMocks();
});

describe("credencial interna", () => {
  it("se lee del entorno del servidor; sin variable o demasiado corta queda cerrada", () => {
    expect(internalRenderToken()).toBe(TOKEN);
    process.env.NEXO_INTERNAL_RENDER_TOKEN = "corta";
    expect(internalRenderToken()).toBeNull();
    delete process.env.NEXO_INTERNAL_RENDER_TOKEN;
    expect(internalRenderToken()).toBeNull();
    expect(isValidInternalRenderToken("lo-que-sea")).toBe(false);
    expect(isValidInternalRenderToken(null)).toBe(false);
  });

  it("solo el valor exacto es válido", () => {
    expect(isValidInternalRenderToken(TOKEN)).toBe(true);
    expect(isValidInternalRenderToken(`${TOKEN}x`)).toBe(false);
    expect(isValidInternalRenderToken(TOKEN.slice(1))).toBe(false);
    expect(isValidInternalRenderToken("")).toBe(false);
    expect(INTERNAL_RENDER_HEADER).toBe("x-nexo-internal-render-token");
  });
});

describe("canRenderNetworkTemplate", () => {
  it("sin sesión ni cabecera → rechazado", async () => {
    expect(await canRenderNetworkTemplate(null)).toBe(false);
  });

  it("super_admin con sesión → permitido", async () => {
    getAuthSession.mockResolvedValue(session("super_admin"));
    expect(await canRenderNetworkTemplate(null)).toBe(true);
  });

  it.each(["empresa_admin", "marca_admin", "restaurante_user"])("sesión de %s → rechazado", async (rol) => {
    getAuthSession.mockResolvedValue(session(rol));
    expect(await canRenderNetworkTemplate(null)).toBe(false);
  });

  it("cabecera interna correcta → permitido sin consultar la sesión", async () => {
    expect(await canRenderNetworkTemplate(TOKEN)).toBe(true);
    expect(getAuthSession).not.toHaveBeenCalled();
  });

  it("cabecera incorrecta sin sesión → rechazado", async () => {
    expect(await canRenderNetworkTemplate("token-incorrecto-de-largo-suficiente")).toBe(false);
  });

  it("sin credencial configurada, ninguna cabecera sirve (falla cerrado)", async () => {
    delete process.env.NEXO_INTERNAL_RENDER_TOKEN;
    expect(await canRenderNetworkTemplate("")).toBe(false);
    expect(await canRenderNetworkTemplate("undefined")).toBe(false);
  });
});

describe("página /templates/network-summary/[periodo]/[grupo]", () => {
  const render = async () => {
    const { default: Page } = await import("@/app/templates/network-summary/[periodo]/[grupo]/page");
    return Page({
      params: Promise.resolve({ periodo: "semanal", grupo: "bk" }),
      searchParams: Promise.resolve({}),
    });
  };

  it("acceso público (sin sesión ni cabecera) → 404 y no se cargan datos", async () => {
    await expect(render()).rejects.toThrow("404");
    expect(fetchNetworkSummaryReport).not.toHaveBeenCalled();
  });

  it("cabecera incorrecta → 404 y no se cargan datos", async () => {
    requestHeaders = { [INTERNAL_RENDER_HEADER]: "token-incorrecto-de-largo-suficiente" };
    await expect(render()).rejects.toThrow("404");
    expect(fetchNetworkSummaryReport).not.toHaveBeenCalled();
  });

  it("sesión de un rol que no es super_admin → 404", async () => {
    getAuthSession.mockResolvedValue(session("empresa_admin"));
    await expect(render()).rejects.toThrow("404");
    expect(fetchNetworkSummaryReport).not.toHaveBeenCalled();
  });

  it("super_admin con sesión → carga los datos y renderiza", async () => {
    getAuthSession.mockResolvedValue(session("super_admin"));
    fetchNetworkSummaryReport.mockResolvedValue({ marker: "datos" });
    const element = await render();
    expect(element).toBeTruthy();
    expect(fetchNetworkSummaryReport).toHaveBeenCalledTimes(1);
  });

  it("cabecera interna correcta → carga los datos y renderiza", async () => {
    requestHeaders = { [INTERNAL_RENDER_HEADER]: TOKEN };
    fetchNetworkSummaryReport.mockResolvedValue({ marker: "datos" });
    const element = await render();
    expect(element).toBeTruthy();
    expect(fetchNetworkSummaryReport).toHaveBeenCalledTimes(1);
    expect(getAuthSession).not.toHaveBeenCalled();
  });

  it("el token no aparece en lo renderizado, en los errores ni en los logs", async () => {
    const spies = (["log", "info", "warn", "error"] as const).map((level) => vi.spyOn(console, level).mockImplementation(() => {}));

    requestHeaders = { [INTERNAL_RENDER_HEADER]: TOKEN };
    fetchNetworkSummaryReport.mockResolvedValue({ marker: "datos" });
    const element = await render();
    expect(JSON.stringify(element)).not.toContain(TOKEN);

    // Rechazo con cabecera incorrecta: el error no contiene ninguno de los dos valores.
    requestHeaders = { [INTERNAL_RENDER_HEADER]: "token-incorrecto-de-largo-suficiente" };
    const rejection = await render().then(
      () => "",
      (error: Error) => error.message
    );
    expect(rejection).not.toContain(TOKEN);
    expect(rejection).not.toContain("token-incorrecto");

    for (const spy of spies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(TOKEN);
    }
  });
});
