import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { isProtectedApiPath } from "@/lib/auth/route-guard";

const requireApiAuth = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/api-auth", () => ({ requireApiAuth }));

const route = await import("@/app/api/internal/cron-secret-check/route");

const SECRET = "cron-secret-0123456789abcdef-NOT-REAL";
const asRole = (rol: string) => requireApiAuth.mockResolvedValue({ ok: true, session: { userId: "u-1", perfil: { rol }, scope: {} } });
const get = () => route.GET(new Request("https://nexo.example/api/internal/cron-secret-check"));

beforeEach(() => {
  vi.resetAllMocks();
  process.env.CRON_SECRET = SECRET;
  asRole("super_admin");
});

describe("GET /api/internal/cron-secret-check", () => {
  it("solo super_admin; la ruta pasa por el filtro de sesión", async () => {
    expect(isProtectedApiPath("/api/internal/cron-secret-check")).toBe(true);
    requireApiAuth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "No autenticado" }, { status: 401 }) });
    expect((await get()).status).toBe(401);
    for (const rol of ["empresa_admin", "marca_admin", "restaurante_user"]) {
      asRole(rol);
      expect((await get()).status).toBe(403);
    }
  });

  it("devuelve únicamente configured, length y sha256_prefix (8 caracteres), nunca el secreto", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["configured", "length", "sha256_prefix"]);
    expect(body).toEqual({
      configured: true,
      length: SECRET.length,
      sha256_prefix: createHash("sha256").update(SECRET).digest("hex").slice(0, 8),
    });
    expect(JSON.stringify(body)).not.toContain(SECRET);
    expect(body.sha256_prefix).toHaveLength(8);
  });

  it("sin CRON_SECRET: configured=false y longitud 0", async () => {
    delete process.env.CRON_SECRET;
    expect(await (await get()).json()).toEqual({ configured: false, length: 0, sha256_prefix: null });
    process.env.CRON_SECRET = "";
    expect((await (await get()).json()).configured).toBe(false);
  });

  it("la longitud cuenta los caracteres tal cual (un salto de línea final se vería)", async () => {
    process.env.CRON_SECRET = `${SECRET}\n`;
    expect((await (await get()).json()).length).toBe(SECRET.length + 1);
  });
});
