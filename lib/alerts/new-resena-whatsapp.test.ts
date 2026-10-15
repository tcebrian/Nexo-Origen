import { beforeEach, describe, expect, it, vi } from "vitest";

const sendWhatsAppImageAlert = vi.fn();
let dedupe: { data: unknown; error: { code: string } | null };
const insert = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/notifications/whatsapp", () => ({ sendWhatsAppImageAlert }));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => (table === "restaurantes" ? { data: { empresa_id: 1 }, error: null } : dedupe),
        }),
      }),
      insert,
    }),
  }),
}));

const route = await import("@/app/api/webhooks/new-resena-whatsapp/route");
const body = { type: "INSERT", table: "resenas", record: { id: 9, restaurante_id: 3, estrellas: 1, review_id: "x" } };
const post = (secret: string | null) =>
  new Request("https://nexo.example/api/webhooks/new-resena-whatsapp", {
    method: "POST",
    headers: secret ? { "x-webhook-secret": secret } : {},
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.resetAllMocks();
  process.env.WHATSAPP_WEBHOOK_SECRET = "secreto-whatsapp";
  dedupe = { data: null, error: null };
  sendWhatsAppImageAlert.mockResolvedValue({ ok: true, sid: "SM1" });
});

describe("POST /api/webhooks/new-resena-whatsapp", () => {
  it("sin secreto, secreto incorrecto o sin configurar → 401 y no se envía nada", async () => {
    expect((await route.POST(post(null))).status).toBe(401);
    expect((await route.POST(post("otro"))).status).toBe(401);
    process.env.WHATSAPP_WEBHOOK_SECRET = "";
    expect((await route.POST(post(""))).status).toBe(401);
    expect(sendWhatsAppImageAlert).not.toHaveBeenCalled();
  });

  it("la URL de la imagen no contiene el secreto y va firmada", async () => {
    const res = await route.POST(post("secreto-whatsapp"));
    expect(res.status).toBe(200);
    const { mediaUrl } = sendWhatsAppImageAlert.mock.calls[0]![0];
    expect(mediaUrl).not.toContain("secreto-whatsapp");
    expect(mediaUrl).toMatch(/[?&]sig=\d+\.[0-9a-f]{64}$/);
    expect(mediaUrl).not.toContain("token=");
  });

  it("reseña ya enviada → no duplica", async () => {
    dedupe = { data: { resena_id: 9 }, error: null };
    const res = await route.POST(post("secreto-whatsapp"));
    expect(await res.json()).toMatchObject({ skipped: "ya-enviado" });
    expect(sendWhatsAppImageAlert).not.toHaveBeenCalled();
  });

  it("si la deduplicación falla (tabla inexistente) → 503 y no se envía", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    dedupe = { data: null, error: { code: "42P01" } };
    expect((await route.POST(post("secreto-whatsapp"))).status).toBe(503);
    expect(sendWhatsAppImageAlert).not.toHaveBeenCalled();
  });
});
