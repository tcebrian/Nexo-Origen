/**
 * Plantillas de WhatsApp que Nexo puede enviar y acciones que sus botones disparan.
 * Sin dependencias de servidor: lo usan el envío, el webhook y los tests.
 *
 * Lista CERRADA: el navegador nunca elige el nombre de una plantilla. Cualquier nombre que no
 * esté aquí se rechaza antes de llamar a Meta.
 *
 * Cada botón de respuesta rápida se envía con un `payload` propio y estable
 * (`nexo:activate_service`…). Meta lo devuelve tal cual cuando la persona pulsa, así Nexo no
 * depende del texto visible del botón (que se puede traducir o editar en Meta).
 */

export const WHATSAPP_ACTIONS = ["ACTIVATE_SERVICE", "VIEW_DAILY_REPORT", "VIEW_PENDING_ALERTS"] as const;
export type WhatsAppActionName = (typeof WHATSAPP_ACTIONS)[number];
export type WhatsAppAction = WhatsAppActionName | "UNKNOWN";

/** Payload de cada botón (identificador estable) y su texto visible en Meta (solo respaldo). */
export const ACTION_BUTTONS: Record<WhatsAppActionName, { payload: string; title: string }> = {
  ACTIVATE_SERVICE: { payload: "nexo:activate_service", title: "Activar servicio" },
  VIEW_DAILY_REPORT: { payload: "nexo:view_daily_report", title: "Ver informe" },
  VIEW_PENDING_ALERTS: { payload: "nexo:view_pending_alerts", title: "Ver alerta" },
};

export const WHATSAPP_TEMPLATE_NAMES = ["bienvenido_nexo", "informe_diario", "alerta_negativa"] as const;
export type WhatsAppTemplateName = (typeof WHATSAPP_TEMPLATE_NAMES)[number];

/** Idioma EXACTO con el que la plantilla está registrada en Meta (puede ser distinto del del texto). */
export type WhatsAppTemplateLanguage = "es" | "en";

export type WhatsAppTemplateDefinition = {
  name: WhatsAppTemplateName;
  language: WhatsAppTemplateLanguage;
  /**
   * Nº de variables del cuerpo, igual al aprobado en Meta (que rechaza otro número):
   * bienvenido_nexo {{1}} nombre · informe_diario {{1}} nombre, {{2}} fecha ·
   * alerta_negativa {{1}} nombre, {{2}} nº de alertas.
   */
  bodyParamCount: number;
  /** Botones de respuesta rápida, en orden, con la acción que disparan. */
  buttons: WhatsAppActionName[];
  /**
   * `false`: al enviar NO se manda el componente `button`. El botón ya está definido en la plantilla
   * aprobada de Meta y se muestra igual; mandarlo (con payload) hacía que Meta devolviera 132001.
   * Las respuestas se reconocen por el texto exacto del botón (`ACTION_BUTTONS[...].title`).
   * Por defecto (`undefined`) se enviaría el payload propio de cada botón.
   */
  sendButtonPayloads?: boolean;
  /** Texto que ve el equipo en la conversación (no incluye datos del contacto). */
  display: string;
};

export const WHATSAPP_TEMPLATES: Record<WhatsAppTemplateName, WhatsAppTemplateDefinition> = {
  bienvenido_nexo: {
    name: "bienvenido_nexo",
    language: "es",
    bodyParamCount: 1,
    buttons: ["ACTIVATE_SERVICE"],
    sendButtonPayloads: false,
    display: "📩 Plantilla enviada: activación de Nexo",
  },
  informe_diario: {
    name: "informe_diario",
    language: "es",
    bodyParamCount: 2,
    buttons: ["VIEW_DAILY_REPORT"],
    sendButtonPayloads: false,
    display: "📩 Plantilla enviada: informe diario de Nexo",
  },
  // OJO: en Meta está registrada en inglés ("en") aunque su texto sea español, y su botón es "Ver alerta".
  alerta_negativa: {
    name: "alerta_negativa",
    language: "en",
    bodyParamCount: 2,
    buttons: ["VIEW_PENDING_ALERTS"],
    sendButtonPayloads: false,
    display: "📩 Plantilla enviada: alerta negativa de Nexo",
  },
};

export function isWhatsAppTemplateName(value: unknown): value is WhatsAppTemplateName {
  return typeof value === "string" && (WHATSAPP_TEMPLATE_NAMES as readonly string[]).includes(value);
}

/** Meta no admite saltos de línea, tabuladores ni más de 4 espacios seguidos en una variable. */
export function sanitizeTemplateParam(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim().slice(0, 60);
}

export type TemplateRequest = {
  name: WhatsAppTemplateName;
  language: WhatsAppTemplateLanguage;
  bodyParams: string[];
  /** Payload de cada botón de respuesta rápida, por posición. */
  buttonPayloads: string[];
};

/**
 * Construye la petición de una plantilla permitida. Nombre desconocido o número de
 * variables incorrecto → error: nunca se llama a Meta con algo que no esté en la lista.
 */
export function buildTemplateRequest(name: unknown, bodyParams: readonly string[] = []): TemplateRequest {
  if (!isWhatsAppTemplateName(name)) throw new Error("Plantilla de WhatsApp no permitida");
  const definition = WHATSAPP_TEMPLATES[name];

  const params = bodyParams.map(sanitizeTemplateParam);
  if (params.length !== definition.bodyParamCount || params.some((param) => param === "")) {
    throw new Error("Variables de plantilla no válidas");
  }

  return {
    name,
    language: definition.language,
    bodyParams: params,
    buttonPayloads: definition.sendButtonPayloads === false ? [] : definition.buttons.map((action) => ACTION_BUTTONS[action].payload),
  };
}
