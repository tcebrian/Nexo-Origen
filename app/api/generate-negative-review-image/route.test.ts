import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_NEGATIVE_REVIEW_ALERT } from "@/lib/templates/negative-review-alert/sample-data";
import type { AuthSession, UserRole } from "@/lib/auth/types";

/**
 * SEC-006 — `POST /api/generate-negative-review-image`: sesión → límite por usuario → tamaño → payload → renderer.
 * Se ejecuta la ruta REAL; solo se simulan la sesión, el renderer y la base de datos del contador.
 */

const getAuthSession = vi.fn();
const renderViaInternal = vi.fn();
const rpcCalls: { bucket: string }[] = [];
const counts = new Map<string, number>();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getAuthSession }));
vi.mock("@/lib/render/internal-render-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/render/internal-render-client")>("@/lib/render/internal-render-client");
  return { ...actual, renderViaInternal };
});
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    rpc: async (_fn: string, args: { p_bucket: string; p_limit: number }) => {
      rpcCalls.push({ bucket: args.p_bucket });
      const hits = (counts.get(args.p_bucket) ?? 0) + 1;
      counts.set(args.p_bucket, hits);
      return { data: [{ allowed: hits <= args.p_limit, current_hits: hits, retry_after_seconds: 30 }], error: null };
    },
  }),
}));

const route = await import("./route");
const { RenderError } = await import("@/lib/render/internal-render-client");

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

function session(userId: string, rol: UserRole = "restaurante_user"): AuthSession {
  return {
    userId,
    email: "u@example.com",
    perfil: { id: userId, userId, rol, nombre: null, email: null, empresaId: "1", mustChangePassword: false },
    scope: { rol, empresaId: "1", empresaNombre: null, marcaIds: [], restauranteIds: [], brandIds: [] },
    assignedRestaurants: [],
    companies: [],
    activeCompany: null,
  } as unknown as AuthSession;
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  route.POST(
    new Request("https://nexo.example/api/generate-negative-review-image", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );

beforeEach(() => {
  vi.resetAllMocks();
  rpcCalls.length = 0;
  counts.clear();
  getAuthSession.mockResolvedValue(session("user-A"));
  renderViaInternal.mockResolvedValue(PNG);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("autenticación", () => {
  it("sin sesión → 401 y no cuenta límite ni renderiza", async () => {
    getAuthSession.mockResolvedValue(null);
    expect((await post(SAMPLE_NEGATIVE_REVIEW_ALERT)).status).toBe(401);
    expect(renderViaInternal).not.toHaveBeenCalled();
    expect(rpcCalls).toHaveLength(0);
  });

  it("la autorización va antes de leer el cuerpo (cuerpo basura sin sesión → 401, no 400)", async () => {
    getAuthSession.mockResolvedValue(null);
    expect((await post("{no es json")).status).toBe(401);
    expect(renderViaInternal).not.toHaveBeenCalled();
  });

  it.each(["restaurante_user", "marca_admin", "empresa_admin", "super_admin"] as UserRole[])(
    "%s autorizado → genera la imagen (el modal de reseñas es de todos los roles)",
    async (rol) => {
      getAuthSession.mockResolvedValue(session("u", rol));
      const res = await post(SAMPLE_NEGATIVE_REVIEW_ALERT);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      expect(res.headers.get("content-disposition")).toMatch(/^inline; filename="nexo-alerta-[\x20-\x7E]+\.png"$/);
      expect(renderViaInternal).toHaveBeenCalledTimes(1);
      expect(renderViaInternal.mock.calls[0]![0]).toMatchObject({ op: "negative_review_image" });
    }
  );
});

describe("validación del cuerpo", () => {
  it.each([
    ["JSON inválido", "{no es json"],
    ["cuerpo vacío", ""],
  ])("%s → 400 y no renderiza", async (_name, body) => {
    expect((await post(body)).status).toBe(400);
    expect(renderViaInternal).not.toHaveBeenCalled();
  });

  it("payload incompleto → 400 (no se completa con el ejemplo)", async () => {
    const res = await post({ restaurant_name: "BK" });
    expect(res.status).toBe(400);
    expect(renderViaInternal).not.toHaveBeenCalled();
    const { restaurant_name: _omit, ...withoutName } = SAMPLE_NEGATIVE_REVIEW_ALERT;
    expect((await post(withoutName)).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect((await post([])).status).toBe(400);
    expect(renderViaInternal).not.toHaveBeenCalled();
  });

  it.each([0, 6, -3])("estrellas fuera de rango (%s) → 400", async (stars) => {
    expect((await post({ ...SAMPLE_NEGATIVE_REVIEW_ALERT, review_stars: stars })).status).toBe(400);
    expect(renderViaInternal).not.toHaveBeenCalled();
  });

  it("textos excesivamente grandes → 400", async () => {
    expect((await post({ ...SAMPLE_NEGATIVE_REVIEW_ALERT, review_comment: "x".repeat(5001) })).status).toBe(400);
    expect((await post({ ...SAMPLE_NEGATIVE_REVIEW_ALERT, review_author: "x".repeat(201) })).status).toBe(400);
    expect(renderViaInternal).not.toHaveBeenCalled();
  });

  it("URL de imagen externa → 400", async () => {
    expect((await post({ ...SAMPLE_NEGATIVE_REVIEW_ALERT, brand_logo_url: "http://169.254.169.254/latest" })).status).toBe(400);
    expect(renderViaInternal).not.toHaveBeenCalled();
  });

  it("la respuesta de validación no repite el valor enviado", async () => {
    const res = await post({ ...SAMPLE_NEGATIVE_REVIEW_ALERT, review_comment: "SECRETO-".repeat(1000) });
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).not.toContain("SECRETO-");
  });

  it("cuerpo excesivo → 413 sin renderizar (por Content-Length y por bytes reales)", async () => {
    expect((await post("{}", { "content-length": "1000000" })).status).toBe(413);
    const huge = JSON.stringify({ ...SAMPLE_NEGATIVE_REVIEW_ALERT, review_comment: "x".repeat(70 * 1024) });
    expect((await post(huge, { "content-length": "10" })).status).toBe(413);
    expect(renderViaInternal).not.toHaveBeenCalled();
  });

  it("al renderer solo llega el payload validado (sin campos extra ni risk_level del cliente)", async () => {
    await post({ ...SAMPLE_NEGATIVE_REVIEW_ALERT, review_stars: 1, risk_level: "BAJO", evil: "x" });
    const sent = renderViaInternal.mock.calls[0]![0].data;
    expect(sent).not.toHaveProperty("evil");
    expect(sent.risk_level).toBe("ALTO");
  });
});

describe("límite de frecuencia", () => {
  it("al superar 10 por minuto → 429 con Retry-After y sin renderizar", async () => {
    for (let i = 0; i < 10; i++) expect((await post(SAMPLE_NEGATIVE_REVIEW_ALERT)).status).toBe(200);
    expect(renderViaInternal).toHaveBeenCalledTimes(10);

    const res = await post(SAMPLE_NEGATIVE_REVIEW_ALERT);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(renderViaInternal).toHaveBeenCalledTimes(10);
  });

  it("el límite se aplica antes de leer el cuerpo (una ráfaga de basura también se corta)", async () => {
    for (let i = 0; i < 10; i++) await post("{no");
    expect((await post("{no")).status).toBe(429);
  });

  it("el usuario A no consume el cupo del usuario B", async () => {
    for (let i = 0; i < 11; i++) await post(SAMPLE_NEGATIVE_REVIEW_ALERT);
    expect((await post(SAMPLE_NEGATIVE_REVIEW_ALERT)).status).toBe(429);

    getAuthSession.mockResolvedValue(session("user-B"));
    expect((await post(SAMPLE_NEGATIVE_REVIEW_ALERT)).status).toBe(200);
  });

  it("la clave sale del usuario autenticado, no de nada que envíe el cliente", async () => {
    await post({ ...SAMPLE_NEGATIVE_REVIEW_ALERT, userId: "user-B" }, { "x-user-id": "user-B", "x-forwarded-for": "9.9.9.9" });
    expect(rpcCalls).toEqual([{ bucket: "negative-review-image:user-A" }]);
  });
});

describe("errores", () => {
  it("un fallo del renderer devuelve un mensaje genérico, sin error.message", async () => {
    renderViaInternal.mockRejectedValue(
      new RenderError("browserType.launch: Executable doesn't exist at /var/task/node_modules/@sparticuz/chromium/bin/chromium", 500)
    );
    const res = await post(SAMPLE_NEGATIVE_REVIEW_ALERT);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: "No se pudo generar la imagen de alerta." });
    for (const leak of ["chromium", "/var/task", "Executable", "browserType", "node_modules"]) expect(text).not.toContain(leak);
  });

  it("registra solo el tipo y el estado, nunca el mensaje ni la reseña", async () => {
    renderViaInternal.mockRejectedValue(new RenderError("fallo con /var/task/secreto y Laura Martínez", 502));
    await post(SAMPLE_NEGATIVE_REVIEW_ALERT);
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).toContain("RenderError");
    expect(logged).toContain("502");
    expect(logged).not.toContain("/var/task");
    expect(logged).not.toContain("Laura");
  });

  it("un error no controlado también es genérico", async () => {
    renderViaInternal.mockRejectedValue("boom");
    const res = await post(SAMPLE_NEGATIVE_REVIEW_ALERT);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "No se pudo generar la imagen de alerta." });
  });
});

describe("GET", () => {
  it("ya no existe (no se expone la información de ejemplo)", () => {
    expect((route as Record<string, unknown>).GET).toBeUndefined();
  });
});
