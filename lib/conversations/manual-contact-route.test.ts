import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireApiAuth = vi.fn();
const createManualContact = vi.fn();
const listLinkableUsers = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/api-auth", () => ({ requireApiAuth }));
vi.mock("@/lib/conversations/manual-contact.server", () => ({ createManualContact }));
vi.mock("@/lib/conversations/contact-link.server", () => ({ listLinkableUsers }));

const route = await import("@/app/api/conversations/contacts/route");

const USER = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const valid = { nombre: "Víctor", countryCallingCode: "+34", nationalNumber: "688 718 820", usuarioId: USER };

const asRole = (rol: string) => requireApiAuth.mockResolvedValue({ ok: true, session: { userId: "a", perfil: { rol }, scope: {} } });
const post = (body: unknown) =>
  route.POST(
    new Request("http://localhost/api/conversations/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );

beforeEach(() => {
  vi.resetAllMocks();
  asRole("super_admin");
  createManualContact.mockResolvedValue({ status: "created", contactId: "c-1", conversationId: "conv-1", linked: true });
});

describe("POST /api/conversations/contacts", () => {
  it("sin sesión → 401", async () => {
    requireApiAuth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "No autenticado" }, { status: 401 }) });
    expect((await post(valid)).status).toBe(401);
    expect(createManualContact).not.toHaveBeenCalled();
  });

  it.each(["empresa_admin", "marca_admin", "restaurante_user"])("%s (usuario normal) no puede crear contactos → 403", async (rol) => {
    asRole(rol);
    expect((await post(valid)).status).toBe(403);
    expect((await route.GET(new Request("http://localhost/api/conversations/contacts"))).status).toBe(403);
    expect(createManualContact).not.toHaveBeenCalled();
    expect(listLinkableUsers).not.toHaveBeenCalled();
  });

  it("super_admin crea el contacto con el teléfono normalizado a E.164 → 201", async () => {
    const res = await post(valid);
    expect(res.status).toBe(201);
    expect(createManualContact).toHaveBeenCalledWith({ nombre: "Víctor", telefonoE164: "+34688718820", usuarioId: USER });
    expect(await res.json()).toEqual({ existing: false, conversationId: "conv-1", linked: true });
  });

  it("un teléfono que ya existe devuelve el contacto existente (200) con el aviso `existing`", async () => {
    createManualContact.mockResolvedValue({ status: "existing", contactId: "c-1", conversationId: "conv-1", linked: false });
    const res = await post(valid);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ existing: true, conversationId: "conv-1", linked: false });
  });

  it("conflictos → 409: usuario ya vinculado a otro número, o número vinculado a otro usuario", async () => {
    createManualContact.mockResolvedValueOnce({ status: "user_already_linked" });
    expect((await post(valid)).status).toBe(409);
    createManualContact.mockResolvedValueOnce({ status: "phone_linked_to_other_user" });
    expect((await post(valid)).status).toBe(409);
  });

  it("usuario inexistente → 404; teléfono o cuerpo inválidos → 400 sin tocar nada", async () => {
    createManualContact.mockResolvedValueOnce({ status: "user_not_found" });
    expect((await post(valid)).status).toBe(404);

    createManualContact.mockClear();
    expect((await post({ ...valid, nationalNumber: "abc" })).status).toBe(400);
    expect((await post({ ...valid, countryCallingCode: "" })).status).toBe(400);
    expect((await post({ ...valid, usuarioId: "x" })).status).toBe(400);
    expect((await post("{no json")).status).toBe(400);
    expect(createManualContact).not.toHaveBeenCalled();
  });

  it("no se pueden asignar restaurantes ni permisos desde este formulario: se ignoran", async () => {
    await post({ ...valid, restaurantIds: [1, 2, 3], marcaIds: [10], rol: "super_admin", empresaId: 1, scope: {} });
    expect(createManualContact).toHaveBeenCalledWith({ nombre: "Víctor", telefonoE164: "+34688718820", usuarioId: USER });
  });

  it("la respuesta no expone teléfono, raw_payload ni identificadores internos", async () => {
    const raw = JSON.stringify(await (await post(valid)).json());
    for (const hidden of ["34688718820", "raw_payload", "c-1", "usuario_id", USER]) {
      expect(raw).not.toContain(hidden);
    }
  });

  it("un fallo interno devuelve 500 genérico sin datos personales", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    createManualContact.mockRejectedValue(new Error("duplicate +34688718820 Víctor"));
    const res = await post(valid);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("34688");
    expect(JSON.stringify(spy.mock.calls)).toContain("manual contact failed");
    spy.mockRestore();
  });

  it("el listado de usuarios para el formulario solo lo ve el super_admin", async () => {
    listLinkableUsers.mockResolvedValue([{ id: USER, nombre: "Víctor", rol: "restaurante_user", empresaNombre: "Grupo", linkedElsewhere: false }]);
    const res = await route.GET(new Request("http://localhost/api/conversations/contacts"));
    expect(res.status).toBe(200);
    expect(listLinkableUsers).toHaveBeenCalledWith(null);
  });
});

describe("el formulario no duplica permisos", () => {
  it("la capa de alta no lee ni escribe asignaciones de restaurantes, marcas ni roles", () => {
    for (const file of ["lib/conversations/manual-contact.server.ts", "lib/conversations/manual-contact.ts", "app/api/conversations/contacts/route.ts"]) {
      const source = readFileSync(path.join(process.cwd(), file), "utf-8");
      for (const forbidden of ["usuario_restaurantes", "usuario_marcas", "nexo_set_user_access", "restaurantIds", "fetchUserScope"]) {
        // Se permite mencionarlos solo en comentarios de la propia advertencia.
        const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
        expect(code, `${file} → ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("la interfaz del alta no tiene selector de restaurantes", () => {
    const view = readFileSync(path.join(process.cwd(), "app/dashboard/conversaciones/conversations-view.tsx"), "utf-8");
    const form = view.slice(view.indexOf("function NewContactForm"), view.indexOf("export function ConversationsView"));
    expect(form).toContain("Usuario Nexo vinculado");
    // Solo teléfono, nombre y persona de Nexo: ningún control ni campo de restaurantes o marcas.
    expect(form).not.toMatch(/restaurantIds|restauranteIds|marcaIds|type="checkbox"|<optgroup/);
  });
});
