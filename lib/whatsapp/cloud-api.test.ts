import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  sendTextMessage,
  isWhatsAppSenderConfigured,
  uploadMedia,
  sendDocumentMessage,
} = await import("@/lib/whatsapp/cloud-api.server");

const input = { phoneNumberId: "1365004563368241", to: "+34600111222", text: "Hola" };
const TOKEN = "EAAB-super-secret-token";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("sendTextMessage", () => {
  it("sin token → misconfigured y no llama a Meta", async () => {
    const fetchImpl = vi.fn();
    const result = await sendTextMessage(input, { accessToken: "", fetchImpl: fetchImpl as never });
    expect(result).toEqual({ status: "misconfigured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("llama al endpoint del phone_number_id con el cuerpo de texto y devuelve el wamid", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { messages: [{ id: "wamid.XYZ" }] }));
    const result = await sendTextMessage(input, { accessToken: TOKEN, fetchImpl: fetchImpl as never });

    expect(result).toEqual({ status: "sent", wamid: "wamid.XYZ" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v26.0/1365004563368241/messages");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    expect(JSON.parse(init.body as string)).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "34600111222",
      type: "text",
      text: { preview_url: false, body: "Hola" },
    });
  });

  it("2xx sin wamid legible → unconfirmed", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { nope: true }));
    expect(await sendTextMessage(input, { accessToken: TOKEN, fetchImpl: fetchImpl as never })).toEqual({
      status: "unconfirmed",
    });
  });

  it("4xx → rejected con motivo seguro; fuera de ventana de 24 h se distingue", async () => {
    const closed = vi.fn(async () => jsonResponse(400, { error: { code: 131047, message: "secreto" } }));
    const other = vi.fn(async () => jsonResponse(400, { error: { code: 1, message: "secreto" } }));
    expect(await sendTextMessage(input, { accessToken: TOKEN, fetchImpl: closed as never })).toEqual({
      status: "rejected",
      reason: "window_closed",
    });
    expect(await sendTextMessage(input, { accessToken: TOKEN, fetchImpl: other as never })).toEqual({
      status: "rejected",
      reason: "other",
    });
  });

  it("5xx, fallo de red y timeout → unconfirmed", async () => {
    const serverError = vi.fn(async () => jsonResponse(503, {}));
    const network = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const hang = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        })
    );

    expect(await sendTextMessage(input, { accessToken: TOKEN, fetchImpl: serverError as never })).toEqual({
      status: "unconfirmed",
    });
    expect(await sendTextMessage(input, { accessToken: TOKEN, fetchImpl: network as never })).toEqual({
      status: "unconfirmed",
    });
    expect(
      await sendTextMessage(input, { accessToken: TOKEN, fetchImpl: hang as never, timeoutMs: 10 })
    ).toEqual({ status: "unconfirmed" });
  });

  it("el resultado nunca contiene el token, el teléfono ni el texto", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(400, { error: { code: 190, message: TOKEN } }));
    const result = await sendTextMessage(input, { accessToken: TOKEN, fetchImpl: fetchImpl as never });
    const json = JSON.stringify(result);
    expect(json).not.toContain(TOKEN);
    expect(json).not.toContain("600111222");
  });

  it("valida los argumentos que resuelve el servidor", async () => {
    const deps = { accessToken: TOKEN, fetchImpl: vi.fn() as never };
    await expect(sendTextMessage({ ...input, to: "600111222" }, deps)).rejects.toThrow();
    await expect(sendTextMessage({ ...input, phoneNumberId: "abc" }, deps)).rejects.toThrow();
    await expect(sendTextMessage({ ...input, text: "  " }, deps)).rejects.toThrow();
  });
});

describe("isWhatsAppSenderConfigured", () => {
  it("exige un token no vacío", () => {
    expect(isWhatsAppSenderConfigured("")).toBe(false);
    expect(isWhatsAppSenderConfigured("  ")).toBe(false);
    expect(isWhatsAppSenderConfigured(TOKEN)).toBe(true);
  });
});

describe("uploadMedia", () => {
  const upload = {
    phoneNumberId: "1365004563368241",
    bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1]),
    mimeType: "application/pdf",
    filename: "Informe.pdf",
  };

  it("sube en multipart a /{phone_number_id}/media y devuelve el media_id", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { id: "MEDIA-123" }));
    const result = await uploadMedia(upload, { accessToken: TOKEN, fetchImpl: fetchImpl as never });

    expect(result).toEqual({ status: "uploaded", mediaId: "MEDIA-123" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v26.0/1365004563368241/media");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(headers["Content-Type"]).toBeUndefined(); // lo añade fetch con el boundary
    const form = init.body as FormData;
    expect(form.get("messaging_product")).toBe("whatsapp");
    expect(form.get("type")).toBe("application/pdf");
    expect((form.get("file") as File).name).toBe("Informe.pdf");
  });

  it("sin token → misconfigured; errores, red o respuesta sin id → failed (sin filtrar nada)", async () => {
    expect(await uploadMedia(upload, { accessToken: "" })).toEqual({ status: "misconfigured" });

    const rejected = vi.fn(async () => jsonResponse(400, { error: { message: TOKEN } }));
    const network = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const noId = vi.fn(async () => jsonResponse(200, {}));
    for (const fetchImpl of [rejected, network, noId]) {
      const result = await uploadMedia(upload, { accessToken: TOKEN, fetchImpl: fetchImpl as never });
      expect(result).toEqual({ status: "failed" });
    }
  });
});

describe("sendDocumentMessage", () => {
  const base = {
    phoneNumberId: "1365004563368241",
    to: "+34600111222",
    mediaId: "MEDIA-123",
    filename: "Informe.pdf",
  };

  it("type=document con media_id y filename; sin pie no envía caption", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { messages: [{ id: "wamid.DOC" }] }));
    const result = await sendDocumentMessage(base, { accessToken: TOKEN, fetchImpl: fetchImpl as never });

    expect(result).toEqual({ status: "sent", wamid: "wamid.DOC" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v26.0/1365004563368241/messages");
    expect(JSON.parse(init.body as string)).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "34600111222",
      type: "document",
      document: { id: "MEDIA-123", filename: "Informe.pdf" },
    });
  });

  it("incluye el pie cuando existe", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { messages: [{ id: "wamid.DOC" }] }));
    await sendDocumentMessage({ ...base, caption: " Hola " }, { accessToken: TOKEN, fetchImpl: fetchImpl as never });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).document.caption).toBe("Hola");
  });

  it("4xx → rejected, 5xx → unconfirmed; rechaza media_id con caracteres raros", async () => {
    const r4 = vi.fn(async () => jsonResponse(400, { error: { code: 131047 } }));
    const r5 = vi.fn(async () => jsonResponse(500, {}));
    expect(await sendDocumentMessage(base, { accessToken: TOKEN, fetchImpl: r4 as never })).toEqual({
      status: "rejected",
      reason: "window_closed",
    });
    expect(await sendDocumentMessage(base, { accessToken: TOKEN, fetchImpl: r5 as never })).toEqual({
      status: "unconfirmed",
    });
    await expect(
      sendDocumentMessage({ ...base, mediaId: "../x" }, { accessToken: TOKEN, fetchImpl: r4 as never })
    ).rejects.toThrow();
  });
});
