import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { buildRecoveryRedirect, isValidRecoveryEmail } from "@/lib/auth/password-recovery";

const requireApiAuth = vi.fn();
const createManagedUser = vi.fn();
const setManagedUserPassword = vi.fn();
const changeOwnPassword = vi.fn();
const getUser = vi.fn();
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
vi.mock("@/lib/auth/user-creation.server", () => ({ createManagedUser, setManagedUserPassword, changeOwnPassword }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { verifyOtp, getUser } }) }));

const usersRoute = await import("@/app/api/platform/users/route");
const optionsRoute = await import("@/app/api/platform/users/options/route");
const passwordRoute = await import("@/app/api/platform/users/[userId]/password/route");
const ownPasswordRoute = await import("@/app/api/auth/change-password/route");
const confirmRoute = await import("@/app/auth/confirm/route");

const USER = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const PASSWORD = "inicial-12345";
const body = { nombre: "Lidia", email: "lidia@example.com", password: PASSWORD, empresaId: 1, tipo: "restaurantes", restaurantIds: [1, 3] };

const asRole = (rol: string) => requireApiAuth.mockResolvedValue({ ok: true, session: { userId: "actor-1", perfil: { rol }, scope: {} } });
const post = (payload: unknown) =>
  usersRoute.POST(
    new Request("https://nexo.example/api/platform/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof payload === "string" ? payload : JSON.stringify(payload),
    })
  );
const passwordReq = (id = USER, payload: unknown = { password: "otra-clave-123" }) =>
  passwordRoute.POST(
    new Request(`https://nexo.example/api/platform/users/${id}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
    { params: Promise.resolve({ userId: id }) }
  );
const ownReq = (payload: unknown = { password: "mi-clave-nueva-1" }) =>
  ownPasswordRoute.POST(
    new Request("https://nexo.example/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );

beforeEach(() => {
  vi.resetAllMocks();
  asRole("super_admin");
  createManagedUser.mockResolvedValue({ userId: USER });
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
    expect((await passwordReq()).status).toBe(403);
    expect((await optionsRoute.GET(new Request("https://nexo.example/x"))).status).toBe(403);
    expect(createManagedUser).not.toHaveBeenCalled();
    expect(setManagedUserPassword).not.toHaveBeenCalled();
    expect(getUserFormOptions).not.toHaveBeenCalled();
  });

  it("super_admin crea el usuario → 201 solo con el id, sin caché ni contraseña", async () => {
    const res = await post(body);
    expect(res.status).toBe(201);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ userId: USER });
    expect(createManagedUser).toHaveBeenCalledWith({ userId: "actor-1", rol: "super_admin" }, body);
  });

  it("los errores de dominio conservan su estado: 400, 403, 409 (email duplicado)", async () => {
    for (const status of [400, 403, 409]) {
      createManagedUser.mockRejectedValueOnce(new FakeUserAccessError(status, "mensaje controlado"));
      expect((await post(body)).status).toBe(status);
    }
  });

  it("un fallo inesperado es 500 genérico y no registra email, nombre ni enlace", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    createManagedUser.mockRejectedValue(new Error("fallo tecnico"));
    const res = await post(body);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/lidia|inicial-12345/);
    // Solo el mensaje técnico se registra; nunca email, nombre ni contraseña.
    expect(JSON.stringify(spy.mock.calls)).toContain("create failed");
    spy.mockRestore();
  });

  it("en el éxito no se escribe nada en los logs (ni la contraseña)", async () => {
    const spies = (["log", "info", "warn", "error"] as const).map((level) => vi.spyOn(console, level).mockImplementation(() => {}));
    await post(body);
    for (const spy of spies) expect(JSON.stringify(spy.mock.calls)).not.toMatch(/inicial-12345|lidia/);
    spies.forEach((spy) => spy.mockRestore());
  });

  it("opciones del formulario y listado solo para super_admin", async () => {
    getUserFormOptions.mockResolvedValue({ empresas: [], marcas: [], restaurants: [] });
    expect((await optionsRoute.GET(new Request("https://nexo.example/x"))).status).toBe(200);
    listManagedUsers.mockResolvedValue([]);
    expect((await usersRoute.GET(new Request("https://nexo.example/x"))).status).toBe(200);
  });
});

describe("POST /api/platform/users/[userId]/password", () => {
  it("fija la contraseña y responde solo ok, sin caché ni contraseña", async () => {
    const res = await passwordReq(USER, { password: "otra-clave-123", mustChangePassword: true });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true });
    expect(setManagedUserPassword).toHaveBeenCalledWith({ userId: "actor-1", rol: "super_admin" }, USER, {
      password: "otra-clave-123",
      mustChangePassword: true,
    });
  });

  it("userId inválido → 400; errores de dominio conservan su estado; un fallo inesperado no filtra nada", async () => {
    expect((await passwordReq("nope")).status).toBe(400);
    setManagedUserPassword.mockRejectedValueOnce(new FakeUserAccessError(403, "No puedes cambiar tu propio acceso"));
    expect((await passwordReq()).status).toBe(403);
    setManagedUserPassword.mockRejectedValueOnce(new FakeUserAccessError(404, "Usuario no encontrado"));
    expect((await passwordReq()).status).toBe(404);

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    setManagedUserPassword.mockRejectedValueOnce(new Error("boom"));
    const res = await passwordReq();
    expect(res.status).toBe(500);
    expect(JSON.stringify(spy.mock.calls)).not.toContain("otra-clave-123");
    spy.mockRestore();
  });
});

describe("POST /api/auth/change-password (cambio propio)", () => {
  it("sin sesión → 401 y no cambia nada", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await ownReq()).status).toBe(401);
    expect(changeOwnPassword).not.toHaveBeenCalled();
  });

  it("con sesión cambia SU contraseña (el id sale de la sesión, no del cuerpo)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "me-1" } } });
    const res = await ownReq({ password: "mi-clave-nueva-1", userId: "otro" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true });
    expect(changeOwnPassword).toHaveBeenCalledWith("me-1", "mi-clave-nueva-1");
  });

  it("contraseña no válida → 400; fallo inesperado → 500 genérico sin la contraseña en logs", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "me-1" } } });
    changeOwnPassword.mockRejectedValueOnce(new FakeUserAccessError(400, "La contraseña debe tener al menos 10 caracteres."));
    expect((await ownReq({ password: "x" })).status).toBe(400);

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    changeOwnPassword.mockRejectedValueOnce(new Error("boom"));
    const res = await ownReq();
    expect(res.status).toBe(500);
    expect(JSON.stringify(spy.mock.calls)).not.toContain("mi-clave-nueva-1");
    spy.mockRestore();
  });
});

describe("GET /auth/confirm (verifica el enlace y abre la sesión)", () => {
  const get = (query: string) => confirmRoute.GET(new Request(`https://nexo.example/auth/confirm${query}`));

  it("enlace válido → verifica con token_hash y redirige a la pantalla fija de cambio de contraseña", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const res = await get("?token_hash=SECRET-TOKEN&type=recovery");
    expect(verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "SECRET-TOKEN" });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://nexo.example/auth/change-password");
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
    expect(res.headers.get("location")).toBe("https://nexo.example/auth/change-password");
  });
});

describe("interfaz", () => {
  const view = readFileSync(path.join(process.cwd(), "app/dashboard/usuarios/users-view.tsx"), "utf-8");

  it("tiene el botón y los tres tipos de usuario con los textos pedidos", () => {
    expect(view).toContain("+ Nuevo usuario");
    for (const label of ["Administrador empresa", "Responsable de marca", "Cuenta de restaurantes"]) expect(view).toContain(label);
    // Una cuenta de restaurante (p. ej. "Burger King Soria") no se etiqueta como "Supervisor".
    expect(view).not.toMatch(/restaurante_user:\s*"Supervisor|label: "Supervisor"/);
  });

  it("el formulario de alta pide la contraseña inicial, el cambio obligatorio y no persiste ni registra nada", () => {
    const form = view.slice(view.indexOf("function NewUserForm"), view.indexOf("function Editor"));
    expect(form).toContain("PasswordFields");
    expect(view).toContain("Obligar a cambiar contraseña al primer acceso");
    expect(view).toContain("Usuario creado correctamente");
    expect(form).toContain("tipo,");
    expect(form).not.toMatch(/\brol:/);
    // Nada de almacenamiento del navegador ni logs con la contraseña; ni enlaces de activación.
    expect(view).not.toMatch(/localStorage|sessionStorage|document\.cookie|console\.(log|info|warn|error)/);
    expect(view).not.toMatch(/activationUrl|activation-link|ActivationLink/);
    expect(view).toContain("Establecer nueva contraseña");
  });
});

describe("pantalla de cambio de contraseña y recuperación", () => {
  const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf-8");

  it("el cambio va por el servidor (que escribe en Auth y levanta el flag), sin guardar nada en el navegador", () => {
    const form = read("app/auth/change-password/change-password-form.tsx");
    expect(form).toContain("/api/auth/change-password");
    expect(form).not.toMatch(/localStorage|sessionStorage|console\./);
  });

  it("login: ¿Olvidaste tu contraseña? usa resetPasswordForEmail y responde igual exista o no la cuenta", () => {
    const login = read("app/login/login-form.tsx");
    expect(login).toContain("resetPasswordForEmail");
    expect(login).toContain("RECOVERY_SENT_MESSAGE");
  });

  it("la recuperación vuelve a /auth/callback y desemboca en la misma pantalla de cambio", () => {
    const redirect = buildRecoveryRedirect("https://nexo.example/");
    expect(redirect).toBe("https://nexo.example/auth/callback?next=%2Fauth%2Fchange-password");
    expect(isValidRecoveryEmail("a@b.co")).toBe(true);
    expect(isValidRecoveryEmail("sin-arroba")).toBe(false);
  });

  it("el middleware lleva a la pantalla de cambio mientras sea obligatorio y la deja fuera de su ámbito", () => {
    const middleware = read("middleware.ts");
    expect(middleware).toContain("isPasswordChangePending");
    expect(middleware).toContain("CHANGE_PASSWORD_PATH");
    expect(middleware).toContain("password_change_required");
  });
});
