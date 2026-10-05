import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { IngestInboundResult } from "@/lib/conversations/ingest-inbound";
import type { InboundMessage } from "@/lib/conversations/types";
import {
  handleWebhookEvent,
  handleWebhookVerification,
  type WebhookLogger,
} from "./webhook-handler";

// Todos los datos son inventados.
const VERIFY_TOKEN = "test-verify-token-not-real";
const APP_SECRET = "test-app-secret-not-real";
const CHANNEL = "100000000000001";

const silent: WebhookLogger = { info: () => {}, error: () => {} };

// GET -----------------------------------------------------------------------------

describe("handleWebhookVerification (GET)", () => {
  const ok = { mode: "subscribe", token: VERIFY_TOKEN, challenge: "1158201444" };
  const config = { verifyToken: VERIFY_TOKEN };

  it("1. token correcto → 200 con el challenge", () => {
    const result = handleWebhookVerification(ok, config, silent);
    expect(result).toMatchObject({ status: 200, body: "1158201444", contentType: "text/plain" });
  });

  it("2. token incorrecto → 403", () => {
    expect(handleWebhookVerification({ ...ok, token: "otro" }, config, silent).status).toBe(403);
  });

  it("3. mode incorrecto → 403", () => {
    expect(handleWebhookVerification({ ...ok, mode: "unsubscribe" }, config, silent).status).toBe(403);
    expect(handleWebhookVerification({ ...ok, mode: null }, config, silent).status).toBe(403);
  });

  it("4. falta challenge o token → 403", () => {
    expect(handleWebhookVerification({ ...ok, challenge: null }, config, silent).status).toBe(403);
    expect(handleWebhookVerification({ ...ok, challenge: "" }, config, silent).status).toBe(403);
    expect(handleWebhookVerification({ ...ok, token: null }, config, silent).status).toBe(403);
    expect(handleWebhookVerification({ ...ok, token: "" }, config, silent).status).toBe(403);
  });

  it("un rechazo no revela el token ni qué dato falló", () => {
    const wrongToken = handleWebhookVerification({ ...ok, token: "otro" }, config, silent);
    const wrongMode = handleWebhookVerification({ ...ok, mode: "x" }, config, silent);
    expect(wrongToken.body).toBe(wrongMode.body);
    expect(wrongToken.body).not.toContain(VERIFY_TOKEN);
  });

  it("18. falta WHATSAPP_CLOUD_VERIFY_TOKEN → fallo seguro (500), aunque el token recibido esté vacío", () => {
    for (const verifyToken of [undefined, ""]) {
      const result = handleWebhookVerification({ ...ok, token: "" }, { verifyToken }, silent);
      expect(result.status).toBe(500);
      expect(result.body).not.toContain("1158201444");
    }
    expect(handleWebhookVerification(ok, { verifyToken: undefined }, silent).status).toBe(500);
  });
});

// POST ----------------------------------------------------------------------------

function sign(raw: string, secret = APP_SECRET): string {
  return `sha256=${createHmac("sha256", secret).update(Buffer.from(raw, "utf8")).digest("hex")}`;
}

function textMessage(id: string, body = "Hola") {
  return { from: "34600000001", id, timestamp: "1760000000", type: "text", text: { body } };
}

function webhookBody(value: Record<string, unknown>): string {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "200000000000001",
        changes: [
          {
            field: "messages",
            value: { messaging_product: "whatsapp", metadata: { phone_number_id: CHANNEL }, ...value },
          },
        ],
      },
    ],
  });
}

const stored = (): IngestInboundResult => ({
  status: "stored",
  empresaId: 7,
  channelId: "canal-1",
  contactId: "contacto-1",
  conversationId: "conv-1",
  contactCreated: false,
  conversationCreated: false,
  lastMessageUpdated: true,
});

function run(
  raw: string,
  options: {
    signature?: string | null;
    appSecret?: string | undefined;
    ingest?: (m: InboundMessage) => Promise<IngestInboundResult>;
  } = {}
) {
  const ingested: string[] = [];
  const ingest =
    options.ingest ??
    (async () => {
      return stored();
    });
  const errors: string[] = [];
  const promise = handleWebhookEvent(
    {
      rawBody: new TextEncoder().encode(raw),
      signature: options.signature === undefined ? sign(raw) : options.signature,
    },
    {
      appSecret: "appSecret" in options ? options.appSecret : APP_SECRET,
      ingest: async (message) => {
        ingested.push(message.externalMessageId);
        return ingest(message);
      },
      logger: { info: () => {}, error: (m) => errors.push(m) },
    }
  );
  return { promise, ingested, errors };
}

describe("handleWebhookEvent (POST) — firma y formato", () => {
  const body = webhookBody({ messages: [textMessage("wamid.A")] });

  it("5. firma válida → procesa y responde 200", async () => {
    const { promise, ingested } = run(body);
    expect(await promise).toMatchObject({ status: 200 });
    expect(ingested).toEqual(["wamid.A"]);
  });

  it("5b. la firma se valida sobre los bytes exactos (también con caracteres no ASCII)", async () => {
    const raw = webhookBody({ messages: [textMessage("wamid.U", "¿Cómo vamos? 🍔")] });
    const { promise, ingested } = run(raw);
    expect((await promise).status).toBe(200);
    expect(ingested).toEqual(["wamid.U"]);
  });

  it("6. firma inválida → 401 y no se procesa nada", async () => {
    for (const signature of [sign(body, "otro-secret"), sign(`${body} `), "sha256=abc", "basura", ""]) {
      const { promise, ingested } = run(body, { signature });
      expect((await promise).status).toBe(401);
      expect(ingested).toEqual([]);
    }
  });

  it("6b. sin cabecera de firma → 401", async () => {
    const { promise, ingested } = run(body, { signature: null });
    expect((await promise).status).toBe(401);
    expect(ingested).toEqual([]);
  });

  it("6c. con firma inválida ni siquiera se parsea el cuerpo (401, no 400)", async () => {
    const { promise } = run("esto no es json", { signature: "sha256=" + "0".repeat(64) });
    expect((await promise).status).toBe(401);
  });

  it("7. JSON inválido con firma válida → 400", async () => {
    const raw = "{ esto no es json";
    const { promise, ingested } = run(raw);
    expect((await promise).status).toBe(400);
    expect(ingested).toEqual([]);
  });

  it("17. falta WHATSAPP_CLOUD_APP_SECRET → fallo seguro (500) sin procesar", async () => {
    for (const appSecret of [undefined, ""]) {
      const { promise, ingested, errors } = run(body, { appSecret });
      const result = await promise;
      expect(result.status).toBe(500);
      expect(result.body).not.toContain(APP_SECRET);
      expect(ingested).toEqual([]);
      expect(errors.join(" ")).not.toContain(APP_SECRET);
    }
  });

  it("las respuestas de error no incluyen detalles internos", async () => {
    const { promise } = run(body, { signature: "sha256=" + "0".repeat(64) });
    expect(JSON.parse((await promise).body)).toEqual({ ok: false });
  });
});

describe("handleWebhookEvent (POST) — mensajes", () => {
  it("8. webhook sin mensajes → 200", async () => {
    const { promise, ingested } = run(webhookBody({}));
    expect((await promise).status).toBe(200);
    expect(ingested).toEqual([]);
  });

  it("webhook de otro tipo de objeto → 200 sin procesar", async () => {
    const raw = JSON.stringify({ object: "page", entry: [] });
    const { promise, ingested } = run(raw);
    expect((await promise).status).toBe(200);
    expect(ingested).toEqual([]);
  });

  it("9. un mensaje stored → 200", async () => {
    const { promise } = run(webhookBody({ messages: [textMessage("wamid.A")] }));
    expect(await promise).toMatchObject({ status: 200, contentType: "application/json" });
  });

  it.each([
    ["10. duplicate", { status: "duplicate" as const }],
    ["11. channel_not_found", { status: "channel_not_found" as const }],
    ["12. channel_inactive", { status: "channel_inactive" as const, channelId: "canal-9" }],
  ])("%s es un resultado normal → 200", async (_name, outcome) => {
    const result = outcome.status === "duplicate" ? { ...stored(), ...outcome } : outcome;
    const { promise } = run(webhookBody({ messages: [textMessage("wamid.A")] }), {
      ingest: async () => result as IngestInboundResult,
    });
    expect((await promise).status).toBe(200);
  });

  it("13. varios mensajes → se procesan todos, en orden", async () => {
    const raw = webhookBody({
      messages: [textMessage("wamid.1"), textMessage("wamid.2"), textMessage("wamid.3")],
    });
    const { promise, ingested } = run(raw);
    expect((await promise).status).toBe(200);
    expect(ingested).toEqual(["wamid.1", "wamid.2", "wamid.3"]);
  });

  it("el canal de cada mensaje sale del metadata del proveedor, no de otro dato del cuerpo", async () => {
    const raw = webhookBody({ messages: [{ ...textMessage("wamid.1"), empresa_id: 99, canal_id: "x" }] });
    const seen: InboundMessage[] = [];
    const { promise } = run(raw, {
      ingest: async (m) => {
        seen.push(m);
        return stored();
      },
    });
    await promise;
    expect(seen[0].channelExternalId).toBe(CHANNEL);
    expect(JSON.stringify({ ...seen[0], raw: undefined })).not.toContain("99");
  });

  it("14. error real en el segundo mensaje → 500", async () => {
    const raw = webhookBody({ messages: [textMessage("wamid.1"), textMessage("wamid.2")] });
    const { promise } = run(raw, {
      ingest: async (m) => {
        if (m.externalMessageId === "wamid.2") throw new Error("db caída");
        return stored();
      },
    });
    expect((await promise).status).toBe(500);
  });

  it("15. tras un fallo el primero ya se procesó, no se bloquea el tercero y el reintento es seguro", async () => {
    const raw = webhookBody({
      messages: [textMessage("wamid.1"), textMessage("wamid.2"), textMessage("wamid.3")],
    });
    const savedIds = new Set<string>();
    let failSecond = true;
    const ingest = async (m: InboundMessage): Promise<IngestInboundResult> => {
      if (m.externalMessageId === "wamid.2" && failSecond) throw new Error("db caída");
      const duplicate = savedIds.has(m.externalMessageId);
      savedIds.add(m.externalMessageId);
      return duplicate ? { ...stored(), status: "duplicate" } : stored();
    };

    const first = run(raw, { ingest });
    expect((await first.promise).status).toBe(500);
    expect(first.ingested).toEqual(["wamid.1", "wamid.2", "wamid.3"]);
    expect([...savedIds]).toEqual(["wamid.1", "wamid.3"]);

    // Meta reenvía el lote entero: 1 y 3 son duplicados, 2 se guarda.
    failSecond = false;
    const retry = run(raw, { ingest });
    expect((await retry.promise).status).toBe(200);
    expect([...savedIds].sort()).toEqual(["wamid.1", "wamid.2", "wamid.3"]);
  });

  it("16. solo statuses, sin mensajes → 200 y no se procesan", async () => {
    const raw = webhookBody({
      statuses: [{ id: "wamid.OUT1", status: "delivered", timestamp: "1760000000", recipient_id: "34600000001" }],
    });
    const { promise, ingested } = run(raw);
    expect((await promise).status).toBe(200);
    expect(ingested).toEqual([]);
  });

  it("mensajes y statuses juntos: solo se ingieren los mensajes", async () => {
    const raw = webhookBody({
      messages: [textMessage("wamid.1")],
      statuses: [{ id: "wamid.OUT1", status: "read", timestamp: "1760000000", recipient_id: "34600000001" }],
    });
    const { promise, ingested } = run(raw);
    expect((await promise).status).toBe(200);
    expect(ingested).toEqual(["wamid.1"]);
  });

  describe("logs de errores", () => {
    const raw = webhookBody({ messages: [textMessage("wamid.SECRETO1", "texto privado")] });
    const SENSITIVE = ["texto privado", "34600000001", "+34600000001", "wamid.SECRETO1", "Ana Pérez", APP_SECRET];

    async function logsFor(error: unknown) {
      const logged: string[] = [];
      const result = await handleWebhookEvent(
        { rawBody: new TextEncoder().encode(raw), signature: sign(raw) },
        {
          appSecret: APP_SECRET,
          ingest: async () => {
            throw error;
          },
          logger: { info: (m) => logged.push(m), error: (m) => logged.push(m) },
        }
      );
      return { status: result.status, all: logged.join(" | ") };
    }

    /** Imita un error de PostgreSQL con valores de fila en message, details y hasta en el nombre. */
    class LeakyDbError extends Error {
      code = "23505";
      operation = "findOrCreateContact.insert";
      details = "Key (telefono_e164)=(+34600000001) already exists.";
      constructor() {
        super('duplicate key (+34600000001, wamid.SECRETO1) "Ana Pérez" texto privado');
        this.name = "ConversationsDbError";
      }
    }

    it("registran solo tipo, fase y código SQLSTATE", async () => {
      const { status, all } = await logsFor(new LeakyDbError());
      expect(status).toBe(500);
      expect(all).toContain("type=ConversationsDbError operation=findOrCreateContact.insert code=23505");
      expect(all).toContain("mensaje 1/1");
    });

    it("nunca escriben error.message, details, teléfonos, ids, texto ni secretos", async () => {
      const { all } = await logsFor(new LeakyDbError());
      for (const value of SENSITIVE) expect(all).not.toContain(value);
      expect(all).not.toContain("duplicate key");
      expect(all).not.toContain("Key (");
    });

    it("valores no fiables se sustituyen: nombre, fase y código fuera de lista blanca", async () => {
      const hostile = Object.assign(new Error("wamid.SECRETO1"), {
        name: "Error con espacios y 34600000001",
        operation: "insert 34600000001",
        code: "+34600000001",
      });
      const { all } = await logsFor(hostile);
      expect(all).toContain("type=UnknownError");
      expect(all).not.toContain("operation=");
      expect(all).not.toContain("code=");
      for (const value of SENSITIVE) expect(all).not.toContain(value);
    });

    it("errores que no son Error (texto, null) no filtran su contenido", async () => {
      for (const thrown of ["texto privado 34600000001", null, undefined, { message: "texto privado" }]) {
        const { status, all } = await logsFor(thrown);
        expect(status).toBe(500);
        expect(all).toContain("type=UnknownError");
        for (const value of SENSITIVE) expect(all).not.toContain(value);
      }
    });

    it("el resumen agregado solo lleva contadores", async () => {
      const { all } = await logsFor(new LeakyDbError());
      expect(all).toMatch(/mensajes=1 stored=0 duplicate=0 channel_not_found=0 channel_inactive=0 failed=1 statuses_ignorados=0/);
    });
  });
});
