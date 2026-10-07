import {
  isValidRequestId,
  sendConversationOperation,
  type SendDeps,
  type SendOutcome,
} from "@/lib/conversations/send-text";

/**
 * Envío de informes de Nexo por WhatsApp. Sin dependencia de Next, Supabase,
 * Chromium ni Meta: la resolución del informe, la generación del PDF y el
 * transporte se inyectan (ver `report-delivery.server.ts` para el cableado real).
 *
 * El navegador solo manda identificadores (`reportType`, `restaurantId`,
 * `offset`). El PDF se genera en servidor y viaja servidor → Meta; nunca pasa
 * por el navegador.
 */

export const REPORT_TYPES = ["monthly"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  monthly: "Informe mensual por restaurante",
};

/** El generador mensual acepta de 0 (mes anterior) a 35 meses hacia atrás. */
export const MAX_REPORT_OFFSET = 35;

/** Tope interno de un PDF generado por Nexo (Meta admite hasta 100 MB). */
export const MAX_REPORT_PDF_BYTES = 25 * 1024 * 1024;

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** "2026-09-01" → { month: "Septiembre", year: "2026" } */
export function monthParts(startKey: string): { month: string; year: string } {
  const month = MONTHS[Number(startKey.slice(5, 7)) - 1];
  if (!month || !/^\d{4}-\d{2}/.test(startKey)) throw new Error("Periodo no válido");
  return { month, year: startKey.slice(0, 4) };
}

export type MonthlyReportTarget = {
  restaurantId: number;
  name: string;
  startKey: string;
};

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60)
    .replace(/_+$/, "");
}

/** "Informe_Mensual_BK_Zizur_Septiembre_2026.pdf": solo ASCII seguro. */
export function buildMonthlyReportFilename(target: MonthlyReportTarget): string {
  const { month, year } = monthParts(target.startKey);
  return `Informe_Mensual_${slug(target.name) || "Restaurante"}_${month}_${year}.pdf`;
}

/** Vista previa de la conversación: "📊 Informe mensual · BK Zizur". */
export function buildMonthlyReportPreview(target: MonthlyReportTarget): string {
  const text = `📊 Informe mensual · ${target.name.replace(/\s+/g, " ").trim()}`;
  return Array.from(text).slice(0, 140).join("");
}

export function hasPdfSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

// Cuerpo de la petición -------------------------------------------------------

export type ParsedReportRequest =
  | { ok: true; requestId: string; reportType: ReportType; restaurantId: number; offset: number }
  | { ok: false; error: string };

/**
 * Valida el cuerpo. Solo se leen `requestId`, `reportType`, `restaurantId` y
 * `offset`: cualquier otro campo (teléfono, canal, media, bytes, scope,
 * ReportRecord…) se ignora.
 */
export function parseSendReportBody(body: unknown): ParsedReportRequest {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  if (!isValidRequestId(record.requestId)) return { ok: false, error: "requestId no válido" };
  if (!(REPORT_TYPES as readonly unknown[]).includes(record.reportType)) {
    return { ok: false, error: "Tipo de informe no válido" };
  }
  const restaurantId = record.restaurantId;
  if (typeof restaurantId !== "number" || !Number.isSafeInteger(restaurantId) || restaurantId <= 0) {
    return { ok: false, error: "Restaurante no válido" };
  }
  const offset = record.offset ?? 0;
  if (typeof offset !== "number" || !Number.isInteger(offset) || offset < 0 || offset > MAX_REPORT_OFFSET) {
    return { ok: false, error: "Periodo no válido" };
  }

  return {
    ok: true,
    requestId: record.requestId,
    reportType: record.reportType as ReportType,
    restaurantId,
    offset,
  };
}

// Envío -------------------------------------------------------------------------

export type MonthlyReportSource = {
  /** Comprueba restaurante (con scope) y periodo sin generar nada. `null` si no existe o no está permitido. */
  resolveTarget(restaurantId: number, offset: number): Promise<MonthlyReportTarget | null>;
  /** Genera el PDF en servidor. */
  generatePdf(restaurantId: number, offset: number): Promise<Uint8Array>;
};

export type SendReportOutcome = SendOutcome | { status: "report_not_found"; sent: [] };

export async function sendMonthlyReport(
  input: { conversationId: string; requestId: string; restaurantId: number; offset: number },
  source: MonthlyReportSource,
  operation: SendDeps
): Promise<SendReportOutcome> {
  const target = await source.resolveTarget(input.restaurantId, input.offset);
  if (!target) return { status: "report_not_found", sent: [] };

  return sendConversationOperation(
    {
      conversationId: input.conversationId,
      requestId: input.requestId,
      text: "",
      document: {
        media: {
          mime_type: "application/pdf",
          filename: buildMonthlyReportFilename(target),
          source: "nexo_report",
          report_type: "monthly",
          restaurant_id: target.restaurantId,
          period: target.startKey.slice(0, 7),
        },
        preview: buildMonthlyReportPreview(target),
        // Solo se llama si el mensaje se va a enviar (no en reintentos ya enviados/pendientes).
        produce: async () => {
          const bytes = await source.generatePdf(input.restaurantId, input.offset);
          if (!hasPdfSignature(bytes) || bytes.length > MAX_REPORT_PDF_BYTES) {
            throw new Error("PDF generado no válido");
          }
          return bytes;
        },
      },
    },
    operation
  );
}
