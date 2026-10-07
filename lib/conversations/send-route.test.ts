import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import {
  CONVERSATION_ID,
  REQUEST_ID,
  createFakeOutboundRepo,
} from "@/lib/conversations/outbound-fake.test-helper";

const TOKEN = "EAAB-super-secret-token";
const requireApiAuth = vi.fn();
const sendTextMessage = vi.fn();
const uploadMedia = vi.fn();
const sendDocumentMessage = vi.fn();
let fake = createFakeOutboundRepo();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/api-auth", () => ({ requireApiAuth }));
vi.mock("@/lib/conversations/read.server", () => ({
  listConversations: vi.fn(),
  getConversationMessages: vi.fn(),
}));
vi.mock("@/lib/conversations/outbound.server", () => ({
  get outboundRepository() {
    return fake.repo;
  },
}));
vi.mock("@/lib/whatsapp/cloud-api.server", () => ({
  sendTextMessage,
  uploadMedia,
  sendDocumentMessage,
  sendImageMessage: vi.fn(),
  isWhatsAppSenderConfigured: () => true,
}));

const { POST } = await import("@/app/api/conversations/[conversationId]/messages/route");

const ctx = (id: string) => ({ params: Promise.resolve({ conversationId: id }) });
function post(body: unknown, id = CONVERSATION_ID) {
  return POST(
    new Request(`http://localhost/api/conversations/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    ctx(id)
  );
}

const asRole = (rol: string) => requireApiAuth.mockResolvedValue({ ok: true, session: { perfil: { rol } } });

let wamidCounter = 0;
beforeEach(() => {
  vi.resetAllMocks();
  fake = createFakeOutboundRepo();
  wamidCounter = 0;
  asRole("super_admin");
  sendTextMessage.mockImplementation(async () => ({ status: "sent", wamid: `wamid.T${++wamidCounter}` }));
  uploadMedia.mockResolvedValue({ status: "uploaded", mediaId: "MEDIA-1" });
  sendDocumentMessage.mockResolvedValue({ status: "sent", wamid: "wamid.DOC" });
});

describe("POST texto", () => {
  it("sin sesión → 401", async () => {
    requireApiAuth.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
    });
    expect((await post({ text: "hola", requestId: REQUEST_ID })).status).toBe(401);
    expect(sendTextMessage).not.toHaveBeenCalled();
  });

  it.each(["empresa_admin", "marca_admin", "restaurante_user"])("%s → 403 sin enviar", async (rol) => {
    asRole(rol);
    expect((await post({ text: "hola", requestId: REQUEST_ID })).status).toBe(403);
    expect(sendTextMessage).not.toHaveBeenCalled();
    expect(fake.rows).toHaveLength(0);
  });

  it("conversationId inválido → 400", async () => {
    expect((await post({ text: "hola", requestId: REQUEST_ID }, "nope")).status).toBe(400);
  });

  it("texto vacío, requestId inválido, JSON roto o > 20.000 → 400", async () => {
    expect((await post({ text: "   ", requestId: REQUEST_ID })).status).toBe(400);
    expect((await post({ text: "hola", requestId: "x" })).status).toBe(400);
    expect((await post("{no json")).status).toBe(400);
    expect((await post({ text: "a".repeat(20_001), requestId: REQUEST_ID })).status).toBe(400);
    expect(sendTextMessage).not.toHaveBeenCalled();
  });

  it("conversación inexistente → 404", async () => {
    fake = createFakeOutboundRepo({ context: null });
    expect((await post({ text: "hola", requestId: REQUEST_ID })).status).toBe(404);
  });

  it("éxito: DTO sin token, raw_payload ni ids externos; el destino lo decide el servidor", async () => {
    const res = await post({ text: "hola", requestId: REQUEST_ID, to: "+34999999999", sender_type: "ai" });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.messages).toHaveLength(1);
    expect(json.messages[0]).toMatchObject({ direction: "outbound", contentType: "text", text: "hola", status: "sent" });
    const raw = JSON.stringify(json);
    for (const forbidden of [TOKEN, "raw_payload", "wamid.T1", "external_id", "client_request_id", "+34600111222"]) {
      expect(raw).not.toContain(forbidden);
    }
    expect(sendTextMessage.mock.calls[0]![0].to).toBe("+34600111222");
    expect(fake.rows[0]!.sender_type).toBe("human");
  });

  it("texto largo: se envía en varios mensajes y la respuesta los devuelve todos", async () => {
    const long = "palabra ".repeat(1200).trim(); // ≈ 9.6k caracteres
    const json = await (await post({ text: long, requestId: REQUEST_ID })).json();
    expect(json.messages.length).toBeGreaterThanOrEqual(3);
    expect(sendTextMessage).toHaveBeenCalledTimes(json.messages.length);
  });

  it("doble POST con el mismo requestId: un solo envío a Meta", async () => {
    await post({ text: "hola", requestId: REQUEST_ID });
    expect((await post({ text: "hola", requestId: REQUEST_ID })).status).toBe(200);
    expect(sendTextMessage).toHaveBeenCalledTimes(1);
    expect(fake.rows).toHaveLength(1);
  });

  it("fallo de Meta → error seguro, mensaje failed y sin detalles", async () => {
    sendTextMessage.mockResolvedValue({ status: "rejected", reason: "other" });
    const res = await post({ text: "hola", requestId: REQUEST_ID });
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain(TOKEN);
    expect(fake.rows).toHaveLength(1);
    expect(fake.rows[0]!.status).toBe("failed");
  });

  it("fallo intermedio: la respuesta incluye los trozos ya enviados y el reintento no los repite", async () => {
    const long = "palabra ".repeat(1200).trim();
    let n = 0;
    sendTextMessage.mockImplementation(async () =>
      ++n === 2 ? { status: "unconfirmed" } : { status: "sent", wamid: `wamid.${n}` }
    );
    const first = await post({ text: long, requestId: REQUEST_ID });
    expect(first.status).toBe(502);
    expect((await first.json()).messages).toHaveLength(1);

    const retry = await post({ text: long, requestId: REQUEST_ID });
    expect(retry.status).toBe(409);
    expect(sendTextMessage).toHaveBeenCalledTimes(2);
  });

  it("fuera de la ventana de 24 h se explica", async () => {
    sendTextMessage.mockResolvedValue({ status: "rejected", reason: "window_closed" });
    expect((await (await post({ text: "hola", requestId: REQUEST_ID })).json()).code).toBe("window_closed");
  });
});
