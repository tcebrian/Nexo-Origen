import { describe, expect, it, vi } from "vitest";
import { buildTemplateRequest } from "@/lib/conversations/whatsapp-templates";
import { describeTemplateRejection, parseProviderError, sanitizeProviderText } from "@/lib/whatsapp/provider-error";

vi.mock("server-only", () => ({}));
const { sendTemplateMessage, sendTextMessage } = await import("@/lib/whatsapp/cloud-api.server");

const TOKEN = "EAAB-super-secret-token-0123456789abcdef";
const PHONE = "+34600111222";
const template = buildTemplateRequest("bienvenida_nexo", ["Ana"]);
const send = (fetchImpl: unknown) =>
  sendTemplateMessage({ phoneNumberId: "1365004563368241", to: PHONE, template }, { accessToken: TOKEN, fetchImpl: fetchImpl as never });
const reply = (status: number, body: unknown) => vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));

describe("rechazo de Meta: error 132001", () => {
  const body = {
    error: {
      message: "(#132001) Template name does not exist in the translation",
      type: "OAuthException",
      code: 132001,
      error_data: { messaging_product: "whatsapp", details: "template name (bienvenida_nexo) does not exist in es" },
      fbtrace_id: "AbCdEf123_gh-IJ",
    },
  };

  it("devuelve código, tipo, traza, mensaje y detalle", async () => {
    const result = await send(reply(404, body));
    expect(result).toEqual({
      status: "rejected",
      reason: "other",
      error: {
        httpStatus: 404,
        code: 132001,
        type: "OAuthException",
        fbtraceId: "AbCdEf123_gh-IJ",
        message: "(#132001) Template name does not exist in the translation",
        details: "template name (bienvenida_nexo) does not exist in es",
      },
    });
  });

  it("la interfaz recibe el código y el detalle", async () => {
    const result = await send(reply(404, body));
    expect(result.status === "rejected" && describeTemplateRejection(result.error)).toEqual({
      message: "WhatsApp rechazó la plantilla (Meta 132001)",
      detail: "template name (bienvenida_nexo) does not exist in es",
    });
  });
});

describe("rechazo con subcódigo", () => {
  it("captura error_subcode y lo muestra junto al código", async () => {
    const result = await send(reply(400, { error: { message: "Invalid parameter", type: "OAuthException", code: 100, error_subcode: 2494073, fbtrace_id: "Trace123" } }));
    expect(result).toMatchObject({ status: "rejected", reason: "invalid_recipient", error: { code: 100, subcode: 2494073, httpStatus: 400 } });
    expect(result.status === "rejected" && describeTemplateRejection(result.error).message).toBe("WhatsApp rechazó la plantilla (Meta 100/2494073)");
  });
});

describe("rechazo sin JSON válido o con forma inesperada", () => {
  it("cuerpo que no es JSON → solo el código HTTP", async () => {
    const result = await send(reply(400, "<html>Bad Request</html>"));
    expect(result).toEqual({ status: "rejected", reason: "other", error: { httpStatus: 400 } });
    expect(result.status === "rejected" && describeTemplateRejection(result.error)).toEqual({ message: "WhatsApp rechazó la plantilla (HTTP 400)" });
  });

  it("JSON sin `error`, con tipos raros o campos hostiles → ignorados", async () => {
    expect(parseProviderError(400, null)).toEqual({ httpStatus: 400 });
    expect(parseProviderError(400, { error: "texto" })).toEqual({ httpStatus: 400 });
    expect(parseProviderError(400, { error: { code: "132001", error_subcode: 1.5, type: "<script>", fbtrace_id: "../x" } })).toEqual({ httpStatus: 400 });
  });

  it("sin información, el mensaje de la interfaz sigue siendo claro", () => {
    expect(describeTemplateRejection(undefined)).toEqual({ message: "WhatsApp rechazó la plantilla" });
  });
});

describe("nunca se expone token, teléfono ni secretos", () => {
  const hostile = {
    error: {
      message: `Recipient ${PHONE} (34600111222) rejected, Authorization: Bearer ${TOKEN}, contact soporte@empresa.com`,
      type: "OAuthException",
      code: 131030,
      error_data: { details: `Número 600 111 222 no permitido; token ${TOKEN}; clave ${"a".repeat(40)}` },
      fbtrace_id: "Trace_1234",
    },
  };

  it("el resultado del cliente no contiene el token ni ninguna forma del teléfono", async () => {
    const json = JSON.stringify(await send(reply(400, hostile)));
    for (const secret of [TOKEN, "EAAB-super", PHONE, "34600111222", "600111222", "600 111 222", "soporte@empresa.com", "a".repeat(40)]) {
      expect(json).not.toContain(secret);
    }
    expect(json).toContain("[número]");
    expect(json).toContain("[token]");
  });

  it("tampoco en los envíos de texto", async () => {
    const result = await sendTextMessage({ phoneNumberId: "1365004563368241", to: PHONE, text: "Hola" }, { accessToken: TOKEN, fetchImpl: reply(400, hostile) as never });
    const json = JSON.stringify(result);
    expect(json).not.toContain(TOKEN);
    expect(json).not.toContain("600111222");
    expect(json).not.toContain(PHONE);
  });

  it("los mensajes se acortan y se limpian de caracteres de control", () => {
    expect(sanitizeProviderText("a".repeat(500))!.length).toBeLessThanOrEqual(300);
    expect(sanitizeProviderText("línea 1\n\tlínea 2")).toBe("línea 1 línea 2");
    expect(sanitizeProviderText("   ")).toBeUndefined();
    expect(sanitizeProviderText(42)).toBeUndefined();
    expect(sanitizeProviderText("código 132001 en 2 s")).toBe("código 132001 en 2 s");
  });
});
