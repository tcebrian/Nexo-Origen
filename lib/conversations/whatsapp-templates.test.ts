import { describe, expect, it, vi } from "vitest";
import { parseWhatsAppWebhook } from "@/lib/conversations/channels/whatsapp-cloud/parse-webhook";
import { resolveWhatsAppAction } from "@/lib/conversations/whatsapp-actions";
import {
  ACTION_BUTTONS,
  WHATSAPP_TEMPLATES,
  WHATSAPP_TEMPLATE_NAMES,
  buildTemplateRequest,
  isWhatsAppTemplateName,
  sanitizeTemplateParam,
} from "@/lib/conversations/whatsapp-templates";

vi.mock("server-only", () => ({}));
const { sendTemplateMessage } = await import("@/lib/whatsapp/cloud-api.server");

describe("lista cerrada de plantillas", () => {
  it("solo las tres plantillas de Nexo", () => {
    expect([...WHATSAPP_TEMPLATE_NAMES]).toEqual(["bienvenido_nexo", "informe_diario_nexo", "alertas_pendientes_nexo"]);
  });

  it("un nombre arbitrario se rechaza antes de llamar a Meta", () => {
    for (const name of ["hello_world", "bienvenida_nexo", "bienvenido_nexo ", "BIENVENIDO_NEXO", "", null, undefined, 3, "../x"]) {
      expect(isWhatsAppTemplateName(name)).toBe(false);
      expect(() => buildTemplateRequest(name, ["Ana"])).toThrow(/no permitida/);
    }
  });

  it("bienvenido_nexo: {{1}} = nombre y botón con payload estable", () => {
    expect(buildTemplateRequest("bienvenido_nexo", ["  Víctor\n Soria "])).toEqual({
      name: "bienvenido_nexo",
      language: "es",
      bodyParams: ["Víctor Soria"],
      buttonPayloads: [ACTION_BUTTONS.ACTIVATE_SERVICE.payload],
    });
  });

  it("número de variables incorrecto o vacío → error", () => {
    expect(() => buildTemplateRequest("bienvenido_nexo", [])).toThrow();
    expect(() => buildTemplateRequest("bienvenido_nexo", ["a", "b"])).toThrow();
    expect(() => buildTemplateRequest("bienvenido_nexo", ["  "])).toThrow();
    expect(sanitizeTemplateParam("a\t\tb      c")).toBe("a b c");
  });

  it("informe_diario y alertas llevan su propio botón", () => {
    expect(buildTemplateRequest("informe_diario_nexo", ["Ana", "08/10/2026"])).toMatchObject({
      bodyParams: ["Ana", "08/10/2026"],
      buttonPayloads: [ACTION_BUTTONS.VIEW_DAILY_REPORT.payload],
    });
    expect(buildTemplateRequest("alertas_pendientes_nexo", ["Ana", "3"])).toMatchObject({
      bodyParams: ["Ana", "3"],
      buttonPayloads: [ACTION_BUTTONS.VIEW_PENDING_ALERTS.payload],
    });
  });

  it("variables como en Meta: bienvenida 1, informe diario 2, alertas 2", () => {
    expect(WHATSAPP_TEMPLATES.bienvenido_nexo.bodyParamCount).toBe(1);
    expect(WHATSAPP_TEMPLATES.informe_diario_nexo.bodyParamCount).toBe(2);
    expect(WHATSAPP_TEMPLATES.alertas_pendientes_nexo.bodyParamCount).toBe(2);
    expect(() => buildTemplateRequest("informe_diario_nexo", ["Ana"])).toThrow();
    expect(() => buildTemplateRequest("alertas_pendientes_nexo", [])).toThrow();
  });
});

describe("sendTemplateMessage (Cloud API)", () => {
  const TOKEN = "EAAB-secret";
  const run = async (template = buildTemplateRequest("bienvenido_nexo", ["Ana"])) => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ messages: [{ id: "wamid.T" }] }), { status: 200 }));
    const result = await sendTemplateMessage(
      { phoneNumberId: "1365004563368241", to: "+34600111222", template },
      { accessToken: TOKEN, fetchImpl: fetchImpl as never }
    );
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    return { result, init, body: JSON.parse(init.body as string) };
  };

  it("envía type=template con idioma es, variable de cuerpo y botón quick_reply con payload", async () => {
    const { result, body } = await run();
    expect(result).toEqual({ status: "sent", wamid: "wamid.T" });
    expect(body).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "34600111222",
      type: "template",
      template: {
        name: "bienvenido_nexo",
        language: { code: "es" },
        components: [
          { type: "body", parameters: [{ type: "text", text: "Ana" }] },
          { type: "button", sub_type: "quick_reply", index: "0", parameters: [{ type: "payload", payload: "nexo:activate_service" }] },
        ],
      },
    });
  });

  it("el token solo viaja en la cabecera, nunca en el cuerpo", async () => {
    const { init } = await run();
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    expect(init.body as string).not.toContain(TOKEN);
  });

  it("una plantilla fuera de la lista no llega a Meta ni siquiera construyéndola a mano", async () => {
    const fetchImpl = vi.fn();
    await expect(
      sendTemplateMessage(
        { phoneNumberId: "1365004563368241", to: "+34600111222", template: { name: "otra", language: "es", bodyParams: [], buttonPayloads: [] } as never },
        { accessToken: TOKEN, fetchImpl: fetchImpl as never }
      )
    ).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rechazo 4xx → rejected con el error de Meta saneado (código y mensaje, sin token ni teléfono)", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: { code: 132001, message: "Template does not exist" } }), { status: 400 }));
    const result = await sendTemplateMessage(
      { phoneNumberId: "1365004563368241", to: "+34600111222", template: buildTemplateRequest("bienvenido_nexo", ["Ana"]) },
      { accessToken: TOKEN, fetchImpl: fetchImpl as never }
    );
    expect(result).toEqual({
      status: "rejected",
      reason: "other",
      error: { httpStatus: 400, code: 132001, message: "Template does not exist" },
    });
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });
});

// Webhook: botones -------------------------------------------------------------------------

function webhook(message: Record<string, unknown>) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: "100000000000001" },
              contacts: [{ wa_id: "34600000001", profile: { name: "Ana" } }],
              messages: [{ from: "34600000001", id: "wamid.IN1", timestamp: "1760000000", ...message }],
            },
          },
        ],
      },
    ],
  };
}

describe("parser: respuestas de botones", () => {
  it("quick reply de plantilla (type=button) → texto = título + payload estable", () => {
    const [message] = parseWhatsAppWebhook(webhook({ type: "button", button: { payload: "nexo:activate_service", text: "Activar servicio" } })).messages;
    expect(message).toMatchObject({ contentType: "text", text: "Activar servicio", interactive: { id: "nexo:activate_service", title: "Activar servicio" } });
  });

  it("botón interactivo (button_reply) y de lista (list_reply)", () => {
    const [button] = parseWhatsAppWebhook(
      webhook({ type: "interactive", interactive: { type: "button_reply", button_reply: { id: "nexo:view_daily_report", title: "Ver informe" } } })
    ).messages;
    expect(button).toMatchObject({ contentType: "text", text: "Ver informe", interactive: { id: "nexo:view_daily_report" } });

    const [list] = parseWhatsAppWebhook(
      webhook({ type: "interactive", interactive: { type: "list_reply", list_reply: { id: "x", title: "Opción" } } })
    ).messages;
    expect(list).toMatchObject({ text: "Opción", interactive: { id: "x" } });
  });

  it("botón sin payload ni texto → mensaje no compatible, sin acción", () => {
    const [message] = parseWhatsAppWebhook(webhook({ type: "button", button: {} })).messages;
    expect(message).toMatchObject({ contentType: "unsupported" });
    expect(message!.interactive).toBeUndefined();
  });

  it("un texto normal no lleva interactive", () => {
    const [message] = parseWhatsAppWebhook(webhook({ type: "text", text: { body: "OK" } })).messages;
    expect(message!.interactive).toBeUndefined();
  });
});

describe("resolveWhatsAppAction", () => {
  const button = (id?: string, title?: string) => ({ contentType: "text", text: title, interactive: { id, title } });

  it("los tres payloads estables", () => {
    expect(resolveWhatsAppAction(button("nexo:activate_service", "x"), { activationPending: false })).toBe("ACTIVATE_SERVICE");
    expect(resolveWhatsAppAction(button("nexo:view_daily_report"), { activationPending: false })).toBe("VIEW_DAILY_REPORT");
    expect(resolveWhatsAppAction(button("nexo:view_pending_alerts"), { activationPending: false })).toBe("VIEW_PENDING_ALERTS");
  });

  it("el payload manda sobre el texto visible", () => {
    expect(resolveWhatsAppAction(button("nexo:view_daily_report", "Activar servicio"), { activationPending: true })).toBe("VIEW_DAILY_REPORT");
  });

  it("sin payload propio, el texto exacto del botón (Meta lo devuelve como payload)", () => {
    expect(resolveWhatsAppAction(button("Activar servicio", "Activar servicio"), { activationPending: false })).toBe("ACTIVATE_SERVICE");
    expect(resolveWhatsAppAction(button(undefined, "ver informe"), { activationPending: false })).toBe("VIEW_DAILY_REPORT");
    expect(resolveWhatsAppAction(button(undefined, "  Ver alertas "), { activationPending: false })).toBe("VIEW_PENDING_ALERTS");
  });

  it("botón desconocido o con coincidencia parcial → UNKNOWN", () => {
    for (const [id, title] of [["nexo:borrar_todo", "Borrar"], [undefined, "Ver informes"], [undefined, "Quiero ver informe"], ["otra", undefined]] as const) {
      expect(resolveWhatsAppAction(button(id, title), { activationPending: true })).toBe("UNKNOWN");
    }
  });

  it("texto OK solo activa si el contacto está pendiente", () => {
    for (const text of ["OK", "ok", "Ok", " ok "]) {
      expect(resolveWhatsAppAction({ contentType: "text", text }, { activationPending: true })).toBe("ACTIVATE_SERVICE");
      expect(resolveWhatsAppAction({ contentType: "text", text }, { activationPending: false })).toBe("UNKNOWN");
    }
  });

  it("el texto libre nunca dispara nada por coincidencia parcial", () => {
    for (const text of ["ok gracias", "vale", "Activar servicio", "ver informe", "okay", "OK!", ""]) {
      expect(resolveWhatsAppAction({ contentType: "text", text }, { activationPending: true })).toBe("UNKNOWN");
    }
    expect(resolveWhatsAppAction({ contentType: "image" }, { activationPending: true })).toBe("UNKNOWN");
  });
});
