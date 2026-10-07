import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireApiAuth = vi.fn();
const listConversations = vi.fn();
const getConversationMessages = vi.fn();

vi.mock("@/lib/auth/api-auth", () => ({ requireApiAuth }));
// El route también importa el envío (POST); aquí solo se prueba la lectura (GET).
vi.mock("@/lib/conversations/outbound.server", () => ({ outboundRepository: {} }));
vi.mock("@/lib/whatsapp/cloud-api.server", () => ({
  sendTextMessage: vi.fn(),
  sendImageMessage: vi.fn(),
  isWhatsAppSenderConfigured: () => true,
}));
vi.mock("@/lib/conversations/read.server", () => ({ listConversations, getConversationMessages }));

const { GET: listRoute } = await import("@/app/api/conversations/route");
const { GET: messagesRoute } = await import("@/app/api/conversations/[conversationId]/messages/route");

const ID = "3f2b8c1e-5a4d-4e6f-9a1b-0c2d3e4f5a6b";
const request = new Request("http://localhost/api/conversations");
const ctx = (id: string) => ({ params: Promise.resolve({ conversationId: id }) });

function asRole(rol: string) {
  requireApiAuth.mockResolvedValue({ ok: true, session: { perfil: { rol } } });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/conversations", () => {
  it("devuelve 403 a un rol que no es super_admin y no lee datos", async () => {
    asRole("empresa_admin");
    const res = await listRoute(request);
    expect(res.status).toBe(403);
    expect(listConversations).not.toHaveBeenCalled();
  });

  it("propaga el rechazo de autenticación", async () => {
    requireApiAuth.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
    });
    expect((await listRoute(request)).status).toBe(401);
  });

  it("super_admin recibe la lista tal cual la devuelve la capa de lectura", async () => {
    asRole("super_admin");
    listConversations.mockResolvedValue([{ id: ID, displayName: "Ana" }]);
    const res = await listRoute(request);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ conversations: [{ id: ID, displayName: "Ana" }] });
  });
});

describe("GET /api/conversations/[id]/messages", () => {
  it("devuelve 403 a un rol que no es super_admin", async () => {
    asRole("marca_admin");
    const res = await messagesRoute(request, ctx(ID));
    expect(res.status).toBe(403);
    expect(getConversationMessages).not.toHaveBeenCalled();
  });

  it("rechaza ids que no son UUID", async () => {
    asRole("super_admin");
    expect((await messagesRoute(request, ctx("nope"))).status).toBe(400);
    expect(getConversationMessages).not.toHaveBeenCalled();
  });

  it("404 si la conversación no existe", async () => {
    asRole("super_admin");
    getConversationMessages.mockResolvedValue(null);
    expect((await messagesRoute(request, ctx(ID))).status).toBe(404);
  });

  it("super_admin recibe los mensajes y la respuesta no contiene raw_payload", async () => {
    asRole("super_admin");
    getConversationMessages.mockResolvedValue([{ id: "m1", contentType: "text", text: "hola" }]);
    const res = await messagesRoute(request, ctx(ID));
    expect(res.status).toBe(200);
    expect(JSON.stringify(await res.json())).not.toContain("raw_payload");
  });

  it("un fallo interno devuelve 500 genérico sin detalles", async () => {
    asRole("super_admin");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    getConversationMessages.mockRejectedValue(new Error("conversations.x failed (42P01)"));
    const res = await messagesRoute(request, ctx(ID));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("42P01");
    spy.mockRestore();
  });
});
