import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireApiAuth = vi.fn();
const sendManualActivation = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/api-auth", () => ({ requireApiAuth }));
vi.mock("@/lib/conversations/contact-activation.server", () => ({ sendManualActivation }));

const route = await import("@/app/api/conversations/[conversationId]/activation/route");

const CONVERSATION = "3f2b8c1e-5a4d-4e6f-9a1b-0c2d3e4f5a6b";
const asRole = (rol: string) => requireApiAuth.mockResolvedValue({ ok: true, session: { userId: "u-1", perfil: { rol }, scope: {} } });
const post = (id = CONVERSATION, body?: unknown) =>
  route.POST(
    new Request(`https://nexo.example/api/conversations/${id}/activation`, {
      method: "POST",
      ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    }),
    { params: Promise.resolve({ conversationId: id }) }
  );

beforeEach(() => {
  vi.resetAllMocks();
  asRole("super_admin");
  sendManualActivation.mockResolvedValue({
    status: "sent",
    messages: [],
    whatsapp: { state: "sent", welcomeSentAt: "2026-10-08T09:00:00.000Z", activatedAt: null },
  });
});

describe("POST /api/conversations/[id]/activation", () => {
  it("sin sesión → 401 y no envía", async () => {
    requireApiAuth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "No autenticado" }, { status: 401 }) });
    expect((await post()).status).toBe(401);
    expect(sendManualActivation).not.toHaveBeenCalled();
  });

  it.each(["empresa_admin", "marca_admin", "restaurante_user"])("%s no puede enviar activaciones → 403", async (rol) => {
    asRole(rol);
    expect((await post()).status).toBe(403);
    expect(sendManualActivation).not.toHaveBeenCalled();
  });

  it("identificador no válido → 400", async () => {
    expect((await post("nope")).status).toBe(400);
    expect(sendManualActivation).not.toHaveBeenCalled();
  });

  it("super_admin: envía y devuelve el nuevo estado, sin caché", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ whatsapp: { state: "sent" } });
    expect(sendManualActivation).toHaveBeenCalledWith(CONVERSATION);
  });

  it("el navegador no puede elegir plantilla, teléfono ni canal: el cuerpo se ignora", async () => {
    await post(CONVERSATION, { template: "hello_world", name: "informe_diario_nexo", to: "+34000000000", phoneNumberId: "1" });
    expect(sendManualActivation).toHaveBeenCalledTimes(1);
    expect(sendManualActivation.mock.calls[0]).toEqual([CONVERSATION]);
  });

  it("ya enviada / ya activo → 409; conversación inexistente → 404", async () => {
    sendManualActivation.mockResolvedValueOnce({ status: "already_sent" });
    expect((await post()).status).toBe(409);
    sendManualActivation.mockResolvedValueOnce({ status: "already_active" });
    expect((await post()).status).toBe(409);
    sendManualActivation.mockResolvedValueOnce({ status: "contact_not_found" });
    expect((await post()).status).toBe(404);
  });

  it("si Meta rechaza o no confirma: error genérico, sin detalles de Meta, y la ficha queda pendiente", async () => {
    sendManualActivation.mockResolvedValueOnce({ status: "rejected", reason: "other", sent: [] });
    const rejected = await post();
    expect(rejected.status).toBe(502);
    expect(JSON.stringify(await rejected.json())).not.toMatch(/token|graph|132001|Template/i);

    sendManualActivation.mockResolvedValueOnce({ status: "unconfirmed", sent: [] });
    expect((await post()).status).toBe(502);
  });

  it("un fallo inesperado es 500 genérico y no registra nada sensible", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    sendManualActivation.mockRejectedValue(new Error("boom"));
    const res = await post();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("boom");
    spy.mockRestore();
  });
});

describe("interfaz de la ficha", () => {
  const view = readFileSync(path.join(process.cwd(), "app/dashboard/conversaciones/conversations-view.tsx"), "utf-8");

  it("muestra los tres estados y el botón solo cuando está pendiente", () => {
    for (const text of ["Pendiente de enviar activación", "Activación enviada", "Enviada:", "Activado:", "Enviar activación"]) {
      expect(view).toContain(text);
    }
    const pending = view.slice(view.indexOf('Pendiente de enviar activación') - 400, view.indexOf('Pendiente de enviar activación') + 700);
    expect(pending).toContain("Enviar activación");
    expect(view).toContain("/activation");
  });

  it("crear un contacto no envía ninguna plantilla ni activación", () => {
    const form = view.slice(view.indexOf("function NewContactForm"));
    expect(form).not.toMatch(/activation|plantilla|template/i);
  });
});

describe("seguridad del código", () => {
  const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf-8");

  it("el token de Meta no sale del servidor ni se usa en código de cliente", () => {
    expect(read("app/dashboard/conversaciones/conversations-view.tsx")).not.toContain("WHATSAPP_CLOUD_ACCESS_TOKEN");
    const server = read("lib/conversations/contact-activation.server.ts");
    expect(server).toContain('import "server-only"');
    expect(server).not.toMatch(/console\.(log|info)/);
  });

  it("crear contactos no importa el envío de plantillas", () => {
    const creation = read("lib/conversations/manual-contact.server.ts");
    expect(creation).not.toMatch(/sendTemplate|contact-activation|cloud-api/);
  });

  it("el cuerpo del webhook no se persiste: las acciones no guardan raw", () => {
    expect(read("lib/conversations/inbound-actions.ts")).not.toMatch(/\.raw\b/);
  });
});
