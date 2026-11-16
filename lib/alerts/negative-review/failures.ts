/**
 * "Fallos de envío" de las alertas de reseñas negativas por WhatsApp.
 *
 * Cada fila de `conv_alertas_negativas` guarda qué pasó al intentar avisar a UN contacto de UNA reseña
 * (`status`, `error_code`, `error_reason`, ver `orchestrator.ts`). Aquí se decide, sin consultar nada:
 *   · qué filas son un fallo (hubo un motivo registrado o quedó `failed`);
 *   · el motivo en lenguaje claro, a partir de los códigos técnicos;
 *   · en qué estado está AHORA (se entregó después, sigue pendiente, falló del todo…).
 * Funciones puras: sin Next, Supabase ni Meta.
 */

import { IMAGE_FAILED_PREFIX, MANUAL_RESEND_FAILED_PREFIX } from "./orchestrator";

export type AlertFailureRow = {
  id: string;
  resenaId: number;
  restaurantName: string;
  stars: number | null;
  contactName: string;
  origin: "real" | "prueba";
  status: string;
  via: string | null;
  errorCode: string | null;
  errorReason: string | null;
  createdAt: string;
  deliveredAt: string | null;
};

export type FailureState = "resolved" | "notified" | "pending" | "failed" | "in_progress";

export type DescribedFailure = {
  /** Motivo principal, en una frase. */
  reason: string;
  /** Matiz o siguiente paso (reintento, aviso enviado…), si lo hay. */
  note: string | null;
  state: FailureState;
  stateLabel: string;
  /** Sigue sin llegar al contacto: requiere atención. */
  unresolved: boolean;
  /** Código técnico tal cual, para soporte. */
  technical: string;
};

/** Prefijo con el que `process.server.ts` guarda la causa real de una imagen no generada. */
export const IMAGE_CAUSE_PREFIX = "image:";

/** Longitud máxima con la que el orquestador guarda `error_code`. */
export const ERROR_CODE_MAX = 40;

/**
 * Código compacto (≤ 40) con la causa real de una imagen no generada, p. ej.
 * `image:analysis_pending:resumen,impacto+2` o `image:RenderError:504`. Nunca corta un campo por la mitad:
 * los que no caben se cuentan en `+N`.
 */
export function imageFailureCode(kind: string, fields: readonly string[] = []): string {
  const base = `${IMAGE_CAUSE_PREFIX}${kind}`.slice(0, ERROR_CODE_MAX);
  if (fields.length === 0) return base;
  let code = `${base}:`;
  let used = 0;
  for (const [index, field] of fields.entries()) {
    const rest = fields.length - index - 1;
    const piece = `${used > 0 ? "," : ""}${field}`;
    const suffix = rest > 0 ? `+${rest}` : "";
    if ((code + piece + suffix).length > ERROR_CODE_MAX) break;
    code += piece;
    used += 1;
  }
  const omitted = fields.length - used;
  if (used === 0) return `${base}+${omitted}`.slice(0, ERROR_CODE_MAX);
  return omitted > 0 ? `${code}+${omitted}` : code;
}

/** Una fila es un fallo si quedó con un motivo registrado o en `failed`. */
export function isAlertFailure(row: Pick<AlertFailureRow, "status" | "errorCode" | "errorReason">): boolean {
  return row.status === "failed" || Boolean(row.errorCode) || Boolean(row.errorReason);
}

/** Códigos de error de la API de WhatsApp Cloud más habituales. */
const META_CODES: Record<string, string> = {
  "131047": "Habían pasado más de 24 h desde el último mensaje del contacto",
  "131026": "WhatsApp no pudo entregar el mensaje a ese número (sin WhatsApp o número no válido)",
  "131049": "Meta no entregó el mensaje para proteger la experiencia del usuario",
  "131048": "Meta limitó los envíos por posible spam",
  "131056": "Demasiados mensajes seguidos al mismo número",
  "130429": "Se superó el límite de envíos de Meta",
  "131000": "Error genérico de Meta",
  "131005": "Permiso denegado por Meta",
  "131008": "Faltaba un parámetro obligatorio en el envío",
  "131009": "Un parámetro del envío no era válido",
  "131021": "El número de destino es el mismo que el de envío",
  "131031": "La cuenta de WhatsApp Business está bloqueada",
  "131051": "Tipo de mensaje no admitido",
  "131052": "WhatsApp no pudo descargar el archivo",
  "131053": "WhatsApp no pudo procesar el archivo subido",
  "132000": "La plantilla no tenía los parámetros correctos",
  "132001": "La plantilla no existe o no está aprobada en ese idioma",
  "132005": "El texto de la plantilla es demasiado largo",
  "132007": "La plantilla incumple la política de Meta",
  "132015": "La plantilla está pausada por baja calidad",
  "132016": "La plantilla está desactivada",
  "133010": "El número de WhatsApp Business no está registrado",
  "368": "La cuenta está bloqueada temporalmente por Meta",
  "190": "El token de acceso de Meta ha caducado o no es válido",
  "100": "Meta rechazó un parámetro del envío",
  "10": "La app de Meta no tiene permiso para enviar",
  "4": "Límite de llamadas a la API de Meta",
};

/** Estados internos del envío (`send-text.ts`) que pueden quedar como código. */
const SEND_STATUS_CODES: Record<string, string> = {
  generation_failed: "No se pudo generar la imagen de la alerta (la causa exacta no quedó registrada)",
  upload_failed: "No se pudo subir la imagen a WhatsApp",
  rejected: "WhatsApp rechazó el mensaje",
  unconfirmed: "No se pudo confirmar si el mensaje llegó",
  channel_inactive: "El canal de WhatsApp no estaba activo",
  misconfigured: "El envío por WhatsApp no estaba configurado en el servidor",
  not_found: "No se encontró la conversación del contacto",
  in_progress: "Había otro envío igual en curso",
  sent_not_saved: "Se envió pero no se pudo guardar el registro",
  request_conflict: "Petición de envío duplicada o no válida",
  review_not_found: "La reseña ya no existe en la base de datos",
};

const READINESS_CODES: Record<string, string> = {
  analysis_pending: "La imagen no se generó: el análisis de IA de la reseña aún no estaba listo",
  incomplete_data: "La imagen no se generó: faltan datos de la reseña o del restaurante",
  invalid_image: "La imagen generada no era válida",
};

/** Traducción de los nombres de campo que puede listar la validación previa a la imagen. */
const FIELD_LABELS: Record<string, string> = {
  // Análisis de IA (analisis_ia)
  resumen: "resumen",
  impacto: "impacto",
  recomendacion: "recomendación",
  sentimiento: "sentimiento",
  // Datos de la imagen
  review_author: "autor",
  review_comment: "comentario",
  restaurant_name: "nombre del restaurante",
  brand_name: "marca",
  brand: "marca",
  risk_level: "nivel de riesgo",
  ai_summary: "resumen IA",
  main_motive: "motivo principal",
  detected_impact: "impacto",
  recommendation: "recomendación",
  sentiment: "sentimiento",
  previous_rating: "media anterior",
  current_rating: "media actual",
  rating_impact: "impacto en la media",
  review_stars: "estrellas",
  png: "formato PNG",
  dimensions: "tamaño",
};

function imageCause(detail: string): string {
  const colon = detail.indexOf(":");
  const head = colon === -1 ? detail : detail.slice(0, colon);
  const rest = colon === -1 ? "" : detail.slice(colon + 1);
  // "analysis_pending+4" (ningún campo cupo) o "…:resumen,impacto+2".
  const [kind = "", headOmitted] = head.split("+");
  if (READINESS_CODES[kind]) {
    const [list = "", restOmitted] = rest.split("+");
    const fields = list
      .split(",")
      .map((field) => field.trim())
      .filter(Boolean)
      .map((field) => FIELD_LABELS[field] ?? field);
    const omitted = Number(headOmitted ?? restOmitted ?? 0) || 0;
    const list_ = [fields.join(", "), omitted > 0 ? `${omitted} más` : ""].filter(Boolean).join(" y ");
    return list_ ? `${READINESS_CODES[kind]} (${list_})` : READINESS_CODES[kind]!;
  }
  if (kind === "RenderError") {
    const status = Number(rest);
    if (status === 504) return "El generador de imágenes tardó demasiado (tiempo agotado)";
    if (status === 429) return "El generador de imágenes estaba saturado";
    return Number.isFinite(status) && status > 0
      ? `El generador de imágenes falló (error ${status})`
      : "El generador de imágenes falló";
  }
  return `No se pudo generar la imagen de la alerta (${detail || "error desconocido"})`;
}

function codeReason(code: string): string {
  if (code.startsWith(IMAGE_CAUSE_PREFIX)) return imageCause(code.slice(IMAGE_CAUSE_PREFIX.length));
  if (META_CODES[code]) return `${META_CODES[code]} (código ${code})`;
  if (SEND_STATUS_CODES[code]) return SEND_STATUS_CODES[code]!;
  if (/^\d+$/.test(code)) return `WhatsApp devolvió el error ${code}`;
  return `Error al enviar (${code})`;
}

function stateOf(status: string): { state: FailureState; label: string } {
  switch (status) {
    case "delivered":
      return { state: "resolved", label: "Entregada después" };
    case "notified":
      return { state: "notified", label: "Avisada con plantilla" };
    case "pending":
      return { state: "pending", label: "Sin entregar" };
    case "failed":
      return { state: "failed", label: "Fallida" };
    default:
      return { state: "in_progress", label: "En curso" };
  }
}

/** Motivo, matiz y estado actual de una alerta con fallo. */
export function describeAlertFailure(row: Pick<AlertFailureRow, "status" | "errorCode" | "errorReason">): DescribedFailure {
  const code = row.errorCode?.trim() || "";
  const reasonTag = row.errorReason?.trim() || "";
  const { state, label } = stateOf(row.status);

  let reason: string;
  let note: string | null = null;

  if (code === "exception") {
    const name =
      reasonTag.startsWith("image_failed_final;") || reasonTag.startsWith(MANUAL_RESEND_FAILED_PREFIX)
        ? reasonTag.split(";")[1]
        : reasonTag;
    reason = `Error inesperado del servidor${name ? ` (${name})` : ""}`;
  } else if (reasonTag === "waiting_template") {
    reason = "La ventana de 24 h está cerrada y el contacto ya tiene un aviso «Ver alerta» sin atender";
    note = "Llegará en cuanto pulse «Ver alerta» en ese aviso.";
  } else if (reasonTag === "direct_rejected") {
    reason = code === "131047" ? "La ventana de 24 h ya estaba cerrada al enviar la imagen" : codeReason(code || "rejected");
    note = "Se avisó con la plantilla «Ver alerta» en su lugar.";
  } else if (reasonTag === "template") {
    reason = `No se pudo enviar la plantilla de aviso: ${codeReason(code || "rejected")}`;
  } else if (reasonTag === "uncertain") {
    reason = `No se pudo confirmar el envío: ${codeReason(code || "unconfirmed")}`;
    note = "Puede que la imagen llegara y el texto no. Revisa la conversación antes de reenviar.";
  } else if (reasonTag === "window_closed_at_retry") {
    reason = code ? codeReason(code) : "La imagen no se pudo enviar";
    note = "La ventana de 24 h se cerró antes del reintento: se avisó con la plantilla si no había otra pendiente.";
  } else {
    reason = code ? codeReason(code) : row.status === "failed" ? "El envío falló" : "La alerta no se pudo entregar";
  }

  if (reasonTag.startsWith(IMAGE_FAILED_PREFIX)) {
    note = "Queda en cola: solo llega si el contacto pulsa «Ver alerta» o se reintenta.";
  } else if (reasonTag.startsWith("image_failed_final;notice_sent")) {
    note = "Falló también al reintentar: se envió al contacto un aviso de texto con el enlace de la reseña.";
  } else if (reasonTag.startsWith("image_failed_final;notice_failed")) {
    note = "Falló también al reintentar y tampoco se pudo enviar el aviso de texto.";
  } else if (reasonTag.startsWith(MANUAL_RESEND_FAILED_PREFIX)) {
    note = "El reenvío manual tampoco funcionó.";
  }

  if (state === "resolved") note = "Se acabó entregando más tarde.";

  return {
    reason,
    note,
    state,
    stateLabel: label,
    unresolved: state === "pending" || state === "failed",
    technical: [code, reasonTag].filter(Boolean).join(" · ") || row.status,
  };
}
