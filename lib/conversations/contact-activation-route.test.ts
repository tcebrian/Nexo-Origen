import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireApiAuth = vi.fn();
const sendManualActivation = vi.fn();

// SEC-013: estas pruebas no son de límites (están en lib/security/sensitive-routes-rate-limit.test.ts): el limitador no interviene.
vi.mock("@/lib/security/rate-limit.server", () => ({ rateLimitAuthenticatedUser: async () => null }));
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
    await post(CONVERSATION, { template: "hello_world", name: "informe_diario", to: "+34000000000", phoneNumberId: "1" });
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

  it("si Meta rechaza la plantilla, el super_admin ve el código y el motivo saneado", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    sendManualActivation.mockResolvedValueOnce({
      status: "rejected",
      reason: "other",
      sent: [],
      providerError: {
        httpStatus: 404,
        code: 132001,
        subcode: 2494073,
        type: "OAuthException",
        fbtraceId: "AbCdEf123",
        message: "(#132001) Template name does not exist in the translation",
        details: "template name (bienvenido_nexo) does not exist in es",
      },
    });
    const res = await post();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: "WhatsApp rechazó la plantilla (Meta 132001/2494073)",
      code: "rejected",
      detail: "template name (bienvenido_nexo) does not exist in es",
      provider: { code: 132001, subcode: 2494073, type: "OAuthException", httpStatus: 404 },
    });

    // Una línea estructurada en el servidor, sin teléfono ni token.
    expect(spy).toHaveBeenCalledTimes(1);
    const line = String(spy.mock.calls[0]![0]);
    expect(line).toContain(`conversationId=${CONVERSATION}`);
    expect(line).toContain("template=bienvenido_nexo");
    expect(line).toContain("metaCode=132001");
    expect(line).toContain("metaSubcode=2494073");
    expect(line).toContain("metaType=OAuthException");
    expect(line).not.toMatch(/\+?\d{8,}|token|Bearer/i);
    spy.mockRestore();
  });

  it("rechazo sin información de Meta: mensaje claro y la línea del servidor lo indica", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    sendManualActivation.mockResolvedValueOnce({ status: "rejected", reason: "other", sent: [] });
    const res = await post();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "WhatsApp rechazó la plantilla", code: "rejected" });
    expect(String(spy.mock.calls[0]![0])).toContain("metaCode=-");
    spy.mockRestore();
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
  const panel = readFileSync(path.join(process.cwd(), "app/dashboard/conversaciones/_components/contact-info-panel.tsx"), "utf-8");
  const view = panel;

  it("muestra los tres estados y el botón solo cuando está pendiente", () => {
    for (const text of ["Todavía no se ha enviado la activación", "Activación enviada", "Enviada el", "Servicio activo", "Activado el", "Enviar activación"]) {
      expect(view).toContain(text);
    }
    // El botón principal solo existe con el contacto pendiente; con la activación enviada hay uno secundario.
    expect(view).toContain('whatsapp.state === "pending" ?');
    const pendingButton = view.slice(view.indexOf('whatsapp.state === "pending" ?'));
    expect(pendingButton.indexOf("Enviar activación")).toBeGreaterThan(-1);
    expect(pendingButton.indexOf("Reenviar activación")).toBeGreaterThan(pendingButton.indexOf("Enviar activación"));
    expect(view).toContain("/activation");
  });

  it("crear un contacto no envía ninguna plantilla ni activación", () => {
    const form = readFileSync(path.join(process.cwd(), "app/dashboard/conversaciones/_components/new-contact-drawer.tsx"), "utf-8");
    expect(form).not.toMatch(/\/activation|plantilla|template/i);
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
