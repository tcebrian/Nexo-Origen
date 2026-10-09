import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { isProtectedApiPath } from "@/lib/auth/route-guard";

const requireApiAuth = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/api-auth", () => ({ requireApiAuth }));

const { TEMPLATE_CHECK_WABA_ID, checkTemplate } = await import("@/lib/whatsapp/template-check.server");
const route = await import("@/app/api/internal/whatsapp/template-check/route");

const TOKEN = "EAAB-super-secret-token-0123456789abcdef";
const asRole = (rol: string) => requireApiAuth.mockResolvedValue({ ok: true, session: { userId: "u-1", perfil: { rol }, scope: {} } });
const get = (query = "?name=bienvenido_nexo") => route.GET(new Request(`https://nexo.example/api/internal/whatsapp/template-check${query}`));

const row = (over: Record<string, unknown> = {}) => ({ name: "bienvenido_nexo", language: "es_ES", status: "APPROVED", category: "MARKETING", id: "999111", ...over });
const meta = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = TOKEN;
  asRole("super_admin");
  fetchMock = meta(200, { data: [row()] });
  vi.stubGlobal("fetch", fetchMock);
});

describe("GET /api/internal/whatsapp/template-check — acceso", () => {
  it("sin sesión → 401 y no consulta a Meta", async () => {
    requireApiAuth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "No autenticado" }, { status: 401 }) });
    expect((await get()).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["empresa_admin", "marca_admin", "restaurante_user"])("%s → 403 y no consulta a Meta", async (rol) => {
    asRole(rol);
    expect((await get()).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("la ruta pasa por el filtro de sesión de la aplicación (no es pública)", () => {
    expect(isProtectedApiPath("/api/internal/whatsapp/template-check")).toBe(true);
  });
});

describe("GET /api/internal/whatsapp/template-check — solo lectura y valores fijos", () => {
  it("nombre arbitrario, ausente o con parámetros extra (WABA incluido) → 400 sin llamar a Meta", async () => {
    for (const query of ["", "?name=hello_world", "?name=bienvenida_nexo", "?name=bienvenido_nexo%20", "?name=bienvenido_nexo&waba=123", "?name=bienvenido_nexo&waba_id=9", "?name[]=bienvenido_nexo"]) {
      expect((await get(query)).status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("consulta GET al WABA fijado en el servidor, pidiendo solo los campos necesarios", async () => {
    await get();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://graph.facebook.com");
    expect(parsed.pathname).toBe(`/v26.0/${TEMPLATE_CHECK_WABA_ID}/message_templates`);
    expect(TEMPLATE_CHECK_WABA_ID).toBe("1743350907791174");
    expect(parsed.searchParams.get("name")).toBe("bienvenido_nexo");
    expect(parsed.searchParams.get("fields")).toBe("name,language,status,category,id");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("el token solo va en la cabecera hacia Meta: nunca en la URL ni en la respuesta", async () => {
    const res = await get();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain(TOKEN);
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    expect(JSON.stringify(await res.json())).not.toContain(TOKEN);
  });
});

describe("GET /api/internal/whatsapp/template-check — respuesta", () => {
  it("una traducción → objeto plano con el idioma REAL de Meta", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ name: "bienvenido_nexo", language: "es_ES", status: "APPROVED", category: "MARKETING", id: "999111" });
  });

  it("devuelve el idioma tal cual, sea es, es_ES u otro", async () => {
    for (const language of ["es", "es_ES", "es_MX"]) {
      vi.stubGlobal("fetch", meta(200, { data: [row({ language })] }));
      expect((await (await get()).json()).language).toBe(language);
    }
  });

  it("varias traducciones → lista completa; plantillas de nombre parecido se descartan", async () => {
    vi.stubGlobal("fetch", meta(200, { data: [row(), row({ language: "es", id: "2" }), row({ name: "bienvenido_nexo_v2", id: "3" })] }));
    const body = await (await get()).json();
    expect(body.name).toBe("bienvenido_nexo");
    expect(body.translations.map((t: { language: string }) => t.language)).toEqual(["es_ES", "es"]);
  });

  it("la plantilla no existe → 404", async () => {
    vi.stubGlobal("fetch", meta(200, { data: [] }));
    const res = await get();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ name: "bienvenido_nexo", found: false, templates: [] });
  });

  it("campos con forma inesperada → null, no se fía de ellos", async () => {
    vi.stubGlobal("fetch", meta(200, { data: [{ name: "bienvenido_nexo", language: { x: 1 }, status: 5, category: "x".repeat(500) }] }));
    expect(await (await get()).json()).toEqual({ name: "bienvenido_nexo", language: null, status: null, category: null, id: null });
  });
});

describe("GET /api/internal/whatsapp/template-check — errores", () => {
  it("Meta rechaza la consulta → 502 con el código, sin token y con el log sin secretos", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", meta(400, { error: { message: `Invalid token ${TOKEN}`, type: "OAuthException", code: 190 } }));
    const res = await get();
    expect(res.status).toBe(502);
    const json = JSON.stringify(await res.json());
    expect(json).toContain("190");
    expect(json).not.toContain(TOKEN);
    const logs = JSON.stringify(spy.mock.calls);
    expect(logs).toContain("metaCode=190");
    expect(logs).not.toContain(TOKEN);
    spy.mockRestore();
  });

  it("sin token configurado → 500 genérico y no consulta a Meta", async () => {
    delete process.env.WHATSAPP_CLOUD_ACCESS_TOKEN;
    const res = await get();
    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fallo de red → 502 genérico", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError(`fetch failed ${TOKEN}`); }));
    const res = await get();
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain(TOKEN);
  });

  it("checkTemplate: timeout → unreachable", async () => {
    const hang = vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new Error("abort")))));
    expect(await checkTemplate("bienvenido_nexo", { accessToken: TOKEN, fetchImpl: hang as never, timeoutMs: 10 })).toEqual({ ok: false, reason: "unreachable" });
  });
});
