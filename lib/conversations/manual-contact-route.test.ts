import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireApiAuth = vi.fn();
const createManualContact = vi.fn();
const getUserFormOptions = vi.fn();

class FakeContactError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/api-auth", () => ({ requireApiAuth }));
vi.mock("@/lib/auth/user-access.server", () => ({ getUserFormOptions }));
vi.mock("@/lib/conversations/manual-contact.server", () => ({ createManualContact }));
vi.mock("@/lib/conversations/contact-link.server", () => ({ ContactError: FakeContactError }));

const route = await import("@/app/api/conversations/contacts/route");

const valid = {
  nombre: "Víctor",
  countryCallingCode: "+34",
  nationalNumber: "688 718 820",
  tipo: "supervisor",
  empresaId: 1,
  todosRestaurantes: false,
  restaurantIds: [1, 2, 4],
};

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
  createManualContact.mockResolvedValue({ status: "created", contactId: "c-1", conversationId: "conv-1" });
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
    expect(getUserFormOptions).not.toHaveBeenCalled();
  });

  it("super_admin crea el contacto con el teléfono E.164 y los permisos elegidos aquí → 201", async () => {
    const res = await post(valid);
    expect(res.status).toBe(201);
    expect(createManualContact).toHaveBeenCalledWith({
      nombre: "Víctor",
      telefonoE164: "+34688718820",
      access: { tipo: "supervisor", empresaId: 1, todosRestaurantes: false, restaurantIds: [1, 2, 4] },
    });
    expect(await res.json()).toEqual({ existing: false, conversationId: "conv-1" });
  });

  it("un teléfono que ya existe devuelve el contacto existente (200) con el aviso `existing`", async () => {
    createManualContact.mockResolvedValue({ status: "existing", contactId: "c-1", conversationId: "conv-1" });
    const res = await post(valid);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ existing: true, conversationId: "conv-1" });
  });

  it("selección inválida (restaurante de otra empresa…) → el error de dominio conserva su estado", async () => {
    createManualContact.mockRejectedValueOnce(new FakeContactError(400, "Hay restaurantes que no son de la empresa elegida"));
    const res = await post(valid);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("no son de la empresa");
  });

  it("teléfono o cuerpo inválidos → 400 sin tocar nada", async () => {
    expect((await post({ ...valid, nationalNumber: "abc" })).status).toBe(400);
    expect((await post({ ...valid, countryCallingCode: "" })).status).toBe(400);
    expect((await post("{no json")).status).toBe(400);
    expect(createManualContact).not.toHaveBeenCalled();
  });

  it("la cuenta web no interviene: usuarioId, rol y scope enviados se ignoran", async () => {
    await post({ ...valid, usuarioId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d", rol: "super_admin", scope: { rol: "super_admin" } });
    const arg = createManualContact.mock.calls[0]![0];
    expect(JSON.stringify(arg)).not.toMatch(/usuarioId|usuario_id|super_admin|9b1deb4d/);
  });

  it("la respuesta no expone teléfono, raw_payload ni identificadores internos", async () => {
    const raw = JSON.stringify(await (await post(valid)).json());
    for (const hidden of ["34688718820", "raw_payload", "c-1", "usuario_id"]) expect(raw).not.toContain(hidden);
  });

  it("un fallo interno devuelve 500 genérico sin datos personales", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    createManualContact.mockRejectedValue(new Error("duplicate +34688718820 Víctor"));
    const res = await post(valid);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("34688");
    spy.mockRestore();
  });

  it("las opciones del formulario (tipos, empresas y restaurantes) solo las ve el super_admin", async () => {
    getUserFormOptions.mockResolvedValue({ empresas: [{ id: 1, nombre: "Grupo" }], marcas: [], restaurants: [] });
    const res = await route.GET(new Request("http://localhost/api/conversations/contacts"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.types.map((t: { label: string }) => t.label)).toEqual([
      "Dirección",
      "Operaciones",
      "Supervisor",
      "Responsable de marca",
      "Responsable de restaurante",
      "Otro",
    ]);
    expect(json.options.empresas).toEqual([{ id: 1, nombre: "Grupo" }]);
  });
});

describe("la interfaz del contacto", () => {
  const view = readFileSync(path.join(process.cwd(), "app/dashboard/conversaciones/conversations-view.tsx"), "utf-8");
  const form = view.slice(view.indexOf("function NewContactForm"), view.indexOf("export function ConversationsView"));

  it("pide nombre, teléfono, tipo, empresa y restaurantes, con 'todos los restaurantes de la empresa'", () => {
    for (const text of ["Nombre", "Teléfono", "Tipo de contacto", "Empresa", "Todos los restaurantes de la empresa", "restaurantes seleccionados"]) {
      expect(view, text).toContain(text);
    }
    expect(form).toContain("ContactAccessFields");
  });

  it("no exige cuenta web: el alta no tiene selector de usuario ni envía usuarioId", () => {
    expect(form).not.toMatch(/usuarioId|linkable-users|Usuario Nexo/);
    expect(form).toContain("No hace falta cuenta web");
  });

  it("el tipo es descriptivo y no condiciona los permisos", () => {
    expect(view).toContain("Solo descriptivo: no decide qué restaurantes ve.");
  });

  it("una cuenta de restaurante no se etiqueta como 'Supervisor'", () => {
    expect(view).toContain('restaurante_user: "Cuenta de restaurante"');
    expect(view).not.toMatch(/restaurante_user:\s*"Supervisor/);
  });
});
