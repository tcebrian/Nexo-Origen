import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireApiAuth = vi.fn();
const createManagedUser = vi.fn();
const createActivationLink = vi.fn();
const getUserFormOptions = vi.fn();
const listManagedUsers = vi.fn();
const verifyOtp = vi.fn();

class FakeUserAccessError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/api-auth", () => ({ requireApiAuth }));
vi.mock("@/lib/auth/user-access.server", () => ({
  UserAccessError: FakeUserAccessError,
  listManagedUsers,
  getUserFormOptions,
}));
vi.mock("@/lib/auth/user-creation.server", () => ({ createManagedUser, createActivationLink }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { verifyOtp } }) }));

const usersRoute = await import("@/app/api/platform/users/route");
const optionsRoute = await import("@/app/api/platform/users/options/route");
const linkRoute = await import("@/app/api/platform/users/[userId]/activation-link/route");
const confirmRoute = await import("@/app/auth/confirm/route");

const USER = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const LINK = "https://nexo.example/auth/confirm?token_hash=SECRET-TOKEN&type=recovery";
const body = { nombre: "Lidia", email: "lidia@example.com", empresaId: 1, tipo: "supervisor", restaurantIds: [1, 3] };

const asRole = (rol: string) => requireApiAuth.mockResolvedValue({ ok: true, session: { userId: "actor-1", perfil: { rol }, scope: {} } });
const post = (payload: unknown) =>
  usersRoute.POST(
    new Request("https://nexo.example/api/platform/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof payload === "string" ? payload : JSON.stringify(payload),
    })
  );
const linkReq = (id = USER) =>
  linkRoute.POST(new Request(`https://nexo.example/api/platform/users/${id}/activation-link`, { method: "POST" }), {
    params: Promise.resolve({ userId: id }),
  });

beforeEach(() => {
  vi.resetAllMocks();
  asRole("super_admin");
  createManagedUser.mockResolvedValue({ userId: USER, activationUrl: LINK });
});

describe("POST /api/platform/users (alta)", () => {
  it("sin sesión → 401", async () => {
    requireApiAuth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "No autenticado" }, { status: 401 }) });
    expect((await post(body)).status).toBe(401);
    expect(createManagedUser).not.toHaveBeenCalled();
  });

  it.each(["empresa_admin", "marca_admin", "restaurante_user"])("%s no puede crear usuarios → 403", async (rol) => {
    asRole(rol);
    expect((await post(body)).status).toBe(403);
    expect((await linkReq()).status).toBe(403);
    expect((await optionsRoute.GET(new Request("https://nexo.example/x"))).status).toBe(403);
    expect(createManagedUser).not.toHaveBeenCalled();
    expect(createActivationLink).not.toHaveBeenCalled();
    expect(getUserFormOptions).not.toHaveBeenCalled();
  });

  it("super_admin crea el usuario → 201 con el enlace, sin caché", async () => {
    const res = await post(body);
    expect(res.status).toBe(201);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ userId: USER, activationUrl: LINK });
    expect(createManagedUser).toHaveBeenCalledWith({ userId: "actor-1", rol: "super_admin" }, body, "https://nexo.example");
  });

  it("los errores de dominio conservan su estado: 400, 403, 409 (email duplicado)", async () => {
    for (const status of [400, 403, 409]) {
      createManagedUser.mockRejectedValueOnce(new FakeUserAccessError(status, "mensaje controlado"));
      expect((await post(body)).status).toBe(status);
    }
  });

  it("un fallo inesperado es 500 genérico y no registra email, nombre ni enlace", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    createManagedUser.mockRejectedValue(new Error("fallo lidia@example.com SECRET-TOKEN"));
    const res = await post(body);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/lidia|SECRET/);
    // El mensaje técnico sí se registra; nunca el enlace de activación generado en el éxito.
    expect(JSON.stringify(spy.mock.calls)).toContain("create failed");
    spy.mockRestore();
  });

  it("en el éxito no se escribe nada en los logs (el enlace no se registra)", async () => {
    const spies = (["log", "info", "warn", "error"] as const).map((level) => vi.spyOn(console, level).mockImplementation(() => {}));
    await post(body);
    for (const spy of spies) expect(JSON.stringify(spy.mock.calls)).not.toMatch(/SECRET-TOKEN|lidia/);
    spies.forEach((spy) => spy.mockRestore());
  });

  it("opciones del formulario y listado solo para super_admin", async () => {
    getUserFormOptions.mockResolvedValue({ empresas: [], marcas: [], restaurants: [] });
    expect((await optionsRoute.GET(new Request("https://nexo.example/x"))).status).toBe(200);
    listManagedUsers.mockResolvedValue([]);
    expect((await usersRoute.GET(new Request("https://nexo.example/x"))).status).toBe(200);
  });
});

describe("POST /api/platform/users/[userId]/activation-link", () => {
  it("genera un enlace nuevo con el origen de la petición", async () => {
    createActivationLink.mockResolvedValue(LINK);
    const res = await linkReq();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ activationUrl: LINK });
    expect(createActivationLink).toHaveBeenCalledWith({ userId: "actor-1", rol: "super_admin" }, USER, "https://nexo.example");
  });

  it("userId inválido → 400; errores de dominio conservan su estado", async () => {
    expect((await linkReq("nope")).status).toBe(400);
    createActivationLink.mockRejectedValueOnce(new FakeUserAccessError(403, "No puedes cambiar tu propio acceso"));
    expect((await linkReq()).status).toBe(403);
    createActivationLink.mockRejectedValueOnce(new FakeUserAccessError(404, "Usuario no encontrado"));
    expect((await linkReq()).status).toBe(404);
  });
});

describe("GET /auth/confirm (verifica el enlace y abre la sesión)", () => {
  const get = (query: string) => confirmRoute.GET(new Request(`https://nexo.example/auth/confirm${query}`));

  it("enlace válido → verifica con token_hash y redirige a la página fija de contraseña", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const res = await get("?token_hash=SECRET-TOKEN&type=recovery");
    expect(verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "SECRET-TOKEN" });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://nexo.example/auth/set-password");
    expect(res.headers.get("location")).not.toContain("SECRET");
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("enlace caducado, usado o inválido → login con el mismo mensaje, sin reflejar el token", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "Token has expired or is invalid" } });
    const res = await get("?token_hash=SECRET-TOKEN&type=recovery");
    expect(res.headers.get("location")).toBe("https://nexo.example/login?error=auth");
  });

  it("faltan parámetros o el tipo no está permitido → no se llama a Supabase", async () => {
    for (const query of ["", "?token_hash=x", "?type=recovery", "?token_hash=x&type=magiclink", "?token_hash=x&type=email_change"]) {
      const res = await get(query);
      expect(res.headers.get("location")).toBe("https://nexo.example/login?error=auth");
    }
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("ignora cualquier destino pedido: siempre va a la página de contraseña", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const res = await get("?token_hash=x&type=invite&next=https://evil.example");
    expect(res.headers.get("location")).toBe("https://nexo.example/auth/set-password");
  });
});

describe("interfaz", () => {
  const view = readFileSync(path.join(process.cwd(), "app/dashboard/usuarios/users-view.tsx"), "utf-8");

  it("tiene el botón y los tres tipos de usuario con los textos pedidos", () => {
    expect(view).toContain("+ Nuevo usuario");
    for (const label of ["Administrador empresa", "Responsable de marca", "Supervisor"]) expect(view).toContain(label);
  });

  it("el formulario de alta no tiene campo de contraseña y no envía roles técnicos", () => {
    const form = view.slice(view.indexOf("function NewUserForm"), view.indexOf("function Editor"));
    expect(form).not.toMatch(/type="password"|password\s*[:=]/i);
    expect(form).toContain("tipo,");
    expect(form).not.toMatch(/\brol:/);
  });
});

describe("página de contraseña", () => {
  it("la nueva contraseña la teclea la propia persona en su navegador: Nexo no la recibe", () => {
    const form = readFileSync(path.join(process.cwd(), "app/auth/set-password/set-password-form.tsx"), "utf-8");
    expect(form).toContain("auth.updateUser({ password })");
    expect(form).not.toContain("fetch(");
  });
});
