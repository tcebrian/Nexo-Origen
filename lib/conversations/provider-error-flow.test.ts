import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, type FakeDb } from "@/lib/conversations/fake-supabase.test-helper";
import { CONVERSATION_ID, REQUEST_ID, createFakeOutboundRepo } from "@/lib/conversations/outbound-fake.test-helper";
import { sendConversationOperation } from "@/lib/conversations/send-text";
import type { ProviderError } from "@/lib/whatsapp/provider-error";

let db: FakeDb;
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => db.client }));
vi.mock("@/lib/supabase/conversations.server", () => ({
  ConversationsDbError: class extends Error {
    constructor(operation: string) {
      super(operation);
    }
  },
  touchConversationLastMessage: vi.fn(),
}));

const { outboundRepository } = await import("@/lib/conversations/outbound.server");

const META: ProviderError = {
  httpStatus: 404,
  code: 132001,
  subcode: 2494073,
  type: "OAuthException",
  fbtraceId: "AbCdEf123",
  message: "(#132001) Template name does not exist in the translation",
  details: "template name (bienvenido_nexo) does not exist in es",
};

describe("el rechazo de Meta llega hasta el resultado del envío", () => {
  function run(error: ProviderError | undefined) {
    const fake = createFakeOutboundRepo();
    const outcome = sendConversationOperation(
      {
        conversationId: CONVERSATION_ID,
        requestId: REQUEST_ID,
        text: "",
        template: { display: "plantilla", send: async () => ({ status: "rejected", reason: "other", ...(error ? { error } : {}) }) },
      },
      {
        repository: fake.repo,
        sendText: vi.fn(),
        uploadMedia: vi.fn(),
        sendDocument: vi.fn(),
        sendImage: vi.fn(),
        isConfigured: () => true,
        logger: { error: () => {} },
      }
    );
    return { fake, outcome };
  }

  it("el resultado trae el error de Meta y el repositorio lo recibe al marcar el fallo", async () => {
    const { fake, outcome } = run(META);
    expect(await outcome).toMatchObject({ status: "rejected", reason: "other", providerError: META });
    expect(fake.rows[0]!.status).toBe("failed");
    expect(fake.failures).toEqual([{ messageId: fake.rows[0]!.id, providerError: META }]);
  });

  it("sin error de Meta no se inventa nada", async () => {
    const { fake, outcome } = run(undefined);
    const result = await outcome;
    expect(result).toMatchObject({ status: "rejected" });
    expect(result).not.toHaveProperty("providerError");
    expect(fake.failures).toEqual([]);
  });
});

describe("persistencia en conv_mensajes (solo código, subcódigo y tipo)", () => {
  beforeEach(() => {
    db = createFakeDb({
      conv_mensajes: [{ id: "m-1", status: "pending", text: "plantilla", external_id: null }],
    });
  });

  it("markFailed guarda las tres columnas como texto y nada más del error", async () => {
    await outboundRepository.markFailed("m-1", META);
    const row = db.tables.conv_mensajes![0]!;
    expect(row).toMatchObject({ status: "failed", provider_error_code: "132001", provider_error_subcode: "2494073", provider_error_type: "OAuthException" });
    const json = JSON.stringify(row);
    for (const leaked of ["Template name", "bienvenido_nexo", "AbCdEf123", "404"]) expect(json).not.toContain(leaked);
    expect(row.raw_payload).toBeUndefined();
  });

  it("sin subcódigo ni tipo guarda NULL; sin error no toca las columnas", async () => {
    await outboundRepository.markFailed("m-1", { httpStatus: 400 });
    expect(db.tables.conv_mensajes![0]).toMatchObject({ status: "failed", provider_error_code: null, provider_error_subcode: null, provider_error_type: null });

    db.tables.conv_mensajes = [{ id: "m-2", status: "pending" }];
    await outboundRepository.markFailed("m-2");
    expect(db.tables.conv_mensajes[0]).toEqual({ id: "m-2", status: "failed", updated_at: expect.any(String) });
  });

  it("si el mismo mensaje se reintenta y sale bien, el motivo anterior se limpia", async () => {
    await outboundRepository.markFailed("m-1", META);
    db.tables.conv_mensajes![0]!.status = "pending";
    await outboundRepository.markSent({ messageId: "m-1", wamid: "wamid.OK", sentAt: new Date() });
    expect(db.tables.conv_mensajes![0]).toMatchObject({
      status: "sent",
      external_id: "wamid.OK",
      provider_error_code: null,
      provider_error_subcode: null,
      provider_error_type: null,
    });
  });
});

describe("la migración y la interfaz", () => {
  const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf-8");

  it("la migración es aditiva e idempotente y solo añade las tres columnas", () => {
    const sql = read("supabase/conversations_provider_error.sql");
    expect(sql).toMatch(/add column if not exists provider_error_code\s+text/);
    expect(sql).toMatch(/add column if not exists provider_error_subcode\s+text/);
    expect(sql).toMatch(/add column if not exists provider_error_type\s+text/);
    expect(sql).not.toMatch(/drop |delete |update /i);
  });

  it("la ficha muestra el mensaje con el código y el detalle saneado debajo", () => {
    const view = read("app/dashboard/conversaciones/conversations-view.tsx");
    expect(view).toContain("data?.detail");
    expect(view).toContain("message.detail");
    // El mensaje con "(Meta 132001)" lo construye el servidor y la ficha lo pinta tal cual.
    expect(view).toContain("data?.error");
  });
});
