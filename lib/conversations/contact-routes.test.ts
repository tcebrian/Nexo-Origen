import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireApiAuth = vi.fn();
const getConversationContactAccess = vi.fn();
const setConversationContactUser = vi.fn();
const listLinkableUsers = vi.fn();
const listManagedUsers = vi.fn();
const getManagedUserDetail = vi.fn();
const setManagedUserAccess = vi.fn();

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
vi.mock("@/lib/conversations/contact-link.server", () => ({
  getConversationContactAccess,
  setConversationContactUser,
  listLinkableUsers,
}));
vi.mock("@/lib/auth/user-access.server", () => ({
  UserAccessError: FakeUserAccessError,
  listManagedUsers,
  getManagedUserDetail,
  setManagedUserAccess,
}));

const contactRoute = await import("@/app/api/conversations/[conversationId]/contact/route");
const linkableRoute = await import("@/app/api/conversations/[conversationId]/linkable-users/route");
const usersRoute = await import("@/app/api/platform/users/route");
const userRoute = await import("@/app/api/platform/users/[userId]/route");

const CONV = "3f2b8c1e-5a4d-4e6f-9a1b-0c2d3e4f5a6b";
const USER = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const convCtx = (id = CONV) => ({ params: Promise.resolve({ conversationId: id }) });
const userCtx = (id = USER) => ({ params: Promise.resolve({ userId: id }) });

const asRole = (rol: string, userId = "actor-1") =>
  requireApiAuth.mockResolvedValue({ ok: true, session: { userId, perfil: { rol }, scope: {} } });
const req = (body?: unknown) =>
  new Request("http://localhost/api/x", {
    method: body === undefined ? "GET" : "PUT",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

beforeEach(() => {
  vi.resetAllMocks();
  asRole("super_admin");
});

describe("rutas de contacto de Conversations (solo super_admin)", () => {
  it("sin sesión → 401", async () => {
    requireApiAuth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "No autenticado" }, { status: 401 }) });
    expect((await contactRoute.GET(req(), convCtx())).status).toBe(401);
  });

  it.each(["empresa_admin", "marca_admin", "restaurante_user"])("%s → 403 en lectura, vínculo y usuarios", async (rol) => {
    asRole(rol);
    expect((await contactRoute.GET(req(), convCtx())).status).toBe(403);
    expect((await contactRoute.PUT(req({ usuarioId: USER }), convCtx())).status).toBe(403);
    expect((await linkableRoute.GET(req(), convCtx())).status).toBe(403);
    expect(getConversationContactAccess).not.toHaveBeenCalled();
    expect(setConversationContactUser).not.toHaveBeenCalled();
    expect(listLinkableUsers).not.toHaveBeenCalled();
  });

  it("conversationId inválido → 400; conversación inexistente → 404", async () => {
    expect((await contactRoute.GET(req(), convCtx("nope"))).status).toBe(400);
    getConversationContactAccess.mockResolvedValue(null);
    expect((await contactRoute.GET(req(), convCtx())).status).toBe(404);
  });

  it("vincular con un usuario inválido → 400; desvincular (null) es válido", async () => {
    expect((await contactRoute.PUT(req({ usuarioId: "x" }), convCtx())).status).toBe(400);
    expect((await contactRoute.PUT(req({}), convCtx())).status).toBe(400);
    setConversationContactUser.mockResolvedValue("ok");
    getConversationContactAccess.mockResolvedValue({ linkedUser: null, access: { count: 0, restaurants: [] } });
    expect((await contactRoute.PUT(req({ usuarioId: null }), convCtx())).status).toBe(200);
    expect(setConversationContactUser).toHaveBeenCalledWith(CONV, null);
  });

  it("resultados del vínculo: ya vinculado → 409, usuario o conversación inexistente → 404", async () => {
    setConversationContactUser.mockResolvedValueOnce("already_linked");
    expect((await contactRoute.PUT(req({ usuarioId: USER }), convCtx())).status).toBe(409);
    setConversationContactUser.mockResolvedValueOnce("user_not_found");
    expect((await contactRoute.PUT(req({ usuarioId: USER }), convCtx())).status).toBe(404);
    setConversationContactUser.mockResolvedValueOnce("conversation_not_found");
    expect((await contactRoute.PUT(req({ usuarioId: USER }), convCtx())).status).toBe(404);
  });

  it("el cuerpo no puede fijar restaurantes: Conversations solo vincula (el resto se ignora)", async () => {
    setConversationContactUser.mockResolvedValue("ok");
    getConversationContactAccess.mockResolvedValue({ linkedUser: null, access: { count: 0, restaurants: [] } });
    await contactRoute.PUT(req({ usuarioId: USER, restaurantIds: [1, 2, 3], rol: "super_admin" }), convCtx());
    expect(setConversationContactUser).toHaveBeenCalledWith(CONV, USER);
    expect(setManagedUserAccess).not.toHaveBeenCalled();
  });

  it("un fallo interno devuelve 500 genérico sin detalles", async () => {
    getConversationContactAccess.mockRejectedValue(new Error("34600111222 secreto"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await contactRoute.GET(req(), convCtx());
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("34600");
    spy.mockRestore();
  });
});

describe("rutas de gestión de usuarios (solo super_admin)", () => {
  const selection = { rol: "restaurante_user", empresaId: 1, restaurantIds: [1, 4], marcaIds: [] };

  it.each(["empresa_admin", "marca_admin", "restaurante_user"])("%s → 403 en listado, detalle y guardado", async (rol) => {
    asRole(rol);
    expect((await usersRoute.GET(req())).status).toBe(403);
    expect((await userRoute.GET(req(), userCtx())).status).toBe(403);
    expect((await userRoute.PUT(req(selection), userCtx())).status).toBe(403);
    expect(listManagedUsers).not.toHaveBeenCalled();
    expect(setManagedUserAccess).not.toHaveBeenCalled();
  });

  it("super_admin lista usuarios y ve el detalle", async () => {
    listManagedUsers.mockResolvedValue([{ id: USER, restaurantCount: 3 }]);
    expect(await (await usersRoute.GET(req())).json()).toEqual({ users: [{ id: USER, restaurantCount: 3 }] });

    getManagedUserDetail.mockResolvedValue({ user: { id: USER } });
    expect((await userRoute.GET(req(), userCtx())).status).toBe(200);
    getManagedUserDetail.mockResolvedValue(null);
    expect((await userRoute.GET(req(), userCtx())).status).toBe(404);
    expect((await userRoute.GET(req(), userCtx("nope"))).status).toBe(400);
  });

  it("guardar pasa el actor de la sesión y la selección, y devuelve el detalle actualizado", async () => {
    setManagedUserAccess.mockResolvedValue({});
    getManagedUserDetail.mockResolvedValue({ effective: { count: 2 } });
    const res = await userRoute.PUT(req(selection), userCtx());
    expect(res.status).toBe(200);
    expect(setManagedUserAccess).toHaveBeenCalledWith({ userId: "actor-1", rol: "super_admin" }, USER, selection);
    expect(await res.json()).toEqual({ effective: { count: 2 } });
  });

  it("los errores de dominio conservan su estado (400, 403, 404) y los demás son 500 genéricos", async () => {
    for (const status of [400, 403, 404]) {
      setManagedUserAccess.mockRejectedValueOnce(new FakeUserAccessError(status, "mensaje controlado"));
      expect((await userRoute.PUT(req(selection), userCtx())).status).toBe(status);
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    setManagedUserAccess.mockRejectedValueOnce(new Error("detalle interno"));
    const res = await userRoute.PUT(req(selection), userCtx());
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("detalle interno");
    spy.mockRestore();
  });

  it("userId inválido → 400 y no se guarda nada", async () => {
    expect((await userRoute.PUT(req(selection), userCtx("nope"))).status).toBe(400);
    expect(setManagedUserAccess).not.toHaveBeenCalled();
  });
});
