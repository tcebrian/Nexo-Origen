import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchPerfilFresh = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/perfiles", () => ({ fetchPerfilFresh }));

const { CHANGE_PASSWORD_PATH, isPasswordChangePending } = await import("@/lib/auth/password-gate");

beforeEach(() => vi.resetAllMocks());

describe("isPasswordChangePending", () => {
  it("sin cambio pendiente no consulta la base de datos", async () => {
    expect(await isPasswordChangePending({ id: "u", mustChangePassword: false })).toBe(false);
    expect(fetchPerfilFresh).not.toHaveBeenCalled();
  });

  it("si la caché dice pendiente, manda la lectura fresca (evita volver a la pantalla tras cambiarla)", async () => {
    fetchPerfilFresh.mockResolvedValue({ id: "u", mustChangePassword: false });
    expect(await isPasswordChangePending({ id: "u", mustChangePassword: true })).toBe(false);
    fetchPerfilFresh.mockResolvedValue({ id: "u", mustChangePassword: true });
    expect(await isPasswordChangePending({ id: "u", mustChangePassword: true })).toBe(true);
  });

  it("si la lectura falla, se mantiene pendiente", async () => {
    fetchPerfilFresh.mockResolvedValue(null);
    expect(await isPasswordChangePending({ id: "u", mustChangePassword: true })).toBe(true);
  });

  it("la pantalla de cambio vive fuera de /dashboard y /api: no hay bucle de redirecciones", () => {
    expect(CHANGE_PASSWORD_PATH).toBe("/auth/change-password");
    expect(CHANGE_PASSWORD_PATH.startsWith("/dashboard")).toBe(false);
    expect(CHANGE_PASSWORD_PATH.startsWith("/api")).toBe(false);
  });
});
