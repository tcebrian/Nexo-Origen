/**
 * Catálogo central de TIPOS DE INFORME que Conversations puede enviar por WhatsApp.
 * Es la única fuente de verdad: la validación del servidor, las opciones del
 * selector y la UI salen de aquí; la UI no tiene ninguna lista propia.
 *
 * Para añadir un informe nuevo (p. ej. semestral o anual):
 *   1. escribir su adaptador (`report-adapters.ts`) y registrarlo en
 *      `report-delivery.server.ts`;
 *   2. poner `enabled: true` y sus `formats` en su entrada de este catálogo.
 * El selector, la API y los límites de periodo lo recogen solos.
 *
 * Sin dependencia de Next, Supabase ni Chromium: solo datos y validación.
 */

import {
  NETWORK_REPORT_GROUPS,
  NETWORK_REPORT_GROUP_IDS,
  isNetworkReportGroupId,
  type NetworkReportGroupId,
} from "@/lib/reports/network-summary/brand-groups";
import { isValidRequestId } from "@/lib/conversations/send-text";

export const REPORT_FORMATS = ["pdf", "image"] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

export const REPORT_FORMAT_LABELS: Record<ReportFormat, string> = { pdf: "PDF", image: "Imagen" };

/** Unidad del periodo del informe. Semestral y anual están previstos, aún sin generador. */
export const REPORT_PERIOD_KINDS = ["weekly", "monthly", "quarterly", "semiannual", "annual"] as const;
export type ReportPeriodKind = (typeof REPORT_PERIOD_KINDS)[number];

/** De qué trata el informe: un restaurante concreto o una red/grupo de marcas. */
export type ReportSubject = "restaurant" | "network_group";

export type ReportTypeId = ReportPeriodKind;

export type ReportDefinition = {
  id: ReportTypeId;
  label: string;
  /** Solo los habilitados se ofrecen y se aceptan; el resto están previstos. */
  enabled: boolean;
  subject: ReportSubject;
  periodKind: ReportPeriodKind;
  /** Formatos que REALMENTE tienen generador. */
  formats: readonly ReportFormat[];
  /** Periodo máximo aceptado (0 = último periodo completo, N = N periodos atrás). */
  maxOffset: number;
  /** Cuántos periodos recientes ofrece el selector. */
  periodOptionCount: number;
};

export const REPORT_CATALOG: readonly ReportDefinition[] = [
  {
    id: "weekly",
    label: "Informe semanal de red",
    enabled: true,
    subject: "network_group",
    periodKind: "weekly",
    formats: ["image"],
    maxOffset: 51,
    periodOptionCount: 12,
  },
  {
    id: "monthly",
    label: "Informe mensual por restaurante",
    enabled: true,
    subject: "restaurant",
    periodKind: "monthly",
    formats: ["pdf", "image"],
    maxOffset: 35,
    periodOptionCount: 12,
  },
  {
    id: "quarterly",
    label: "Informe trimestral de red",
    enabled: true,
    subject: "network_group",
    periodKind: "quarterly",
    formats: ["image"],
    maxOffset: 11,
    periodOptionCount: 8,
  },
  // Previstos por arquitectura; sin generador todavía (no se ofrecen ni se aceptan).
  {
    id: "semiannual",
    label: "Informe semestral",
    enabled: false,
    subject: "restaurant",
    periodKind: "semiannual",
    formats: [],
    maxOffset: 0,
    periodOptionCount: 0,
  },
  {
    id: "annual",
    label: "Informe anual",
    enabled: false,
    subject: "restaurant",
    periodKind: "annual",
    formats: [],
    maxOffset: 0,
    periodOptionCount: 0,
  },
];

export function enabledReportDefinitions(catalog: readonly ReportDefinition[] = REPORT_CATALOG): ReportDefinition[] {
  return catalog.filter((definition) => definition.enabled && definition.formats.length > 0);
}

/** Definición habilitada con ese id; `null` si es desconocido o está deshabilitado. */
export function findEnabledDefinition(
  id: unknown,
  catalog: readonly ReportDefinition[] = REPORT_CATALOG
): ReportDefinition | null {
  return enabledReportDefinitions(catalog).find((definition) => definition.id === id) ?? null;
}

export function supportsFormat(definition: ReportDefinition, format: unknown): format is ReportFormat {
  return (definition.formats as readonly unknown[]).includes(format);
}

// Etiquetas de periodo ------------------------------------------------------------

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

export type PeriodRangeLike = { startKey: string; endKey: string; label: string };

/** Texto del selector de periodo: "Septiembre 2026", "T3 2026 (…)" o el rango de la semana. */
export function periodOptionLabel(kind: ReportPeriodKind, range: PeriodRangeLike): string {
  switch (kind) {
    case "monthly": {
      const { month, year } = monthParts(range.startKey);
      return `${month} ${year}`;
    }
    case "quarterly": {
      const first = monthParts(range.startKey);
      const last = monthParts(range.endKey);
      const quarter = Math.floor((Number(range.startKey.slice(5, 7)) - 1) / 3) + 1;
      return `T${quarter} ${first.year} (${first.month} – ${last.month})`;
    }
    default:
      return range.label;
  }
}

// Opciones para la interfaz ---------------------------------------------------------

export type ReportOptionType = {
  id: ReportTypeId;
  label: string;
  subject: ReportSubject;
  formats: { id: ReportFormat; label: string }[];
  periods: { offset: number; label: string }[];
};

export type ReportOptions = {
  types: ReportOptionType[];
  /** Para los informes por restaurante (ya filtrados por scope). */
  restaurants: { id: number; name: string; brand: string; city: string }[];
  /** Para los informes de red. */
  groups: { id: NetworkReportGroupId; label: string }[];
};

export function listNetworkGroupOptions(): ReportOptions["groups"] {
  return NETWORK_REPORT_GROUP_IDS.map((id) => ({ id, label: NETWORK_REPORT_GROUPS[id].label }));
}

// Validación del cuerpo --------------------------------------------------------------

export type ReportSubjectRef =
  | { kind: "restaurant"; restaurantId: number }
  | { kind: "network_group"; groupId: NetworkReportGroupId };

export type ParsedReportRequest =
  | {
      ok: true;
      requestId: string;
      reportType: ReportTypeId;
      format: ReportFormat;
      subject: ReportSubjectRef;
      /** 0 = último periodo completo; N = N periodos atrás (en la unidad del tipo). */
      offset: number;
    }
  | { ok: false; error: string };

/**
 * Valida el cuerpo contra el catálogo: tipo habilitado, formato soportado por ese
 * tipo, sujeto del tipo adecuado y periodo dentro de su rango. Solo se leen
 * `requestId`, `reportType`, `format` (por defecto "pdf" si el tipo lo soporta, si
 * no el primero), `restaurantId` | `groupId` y `period` (alias antiguo: `offset`);
 * cualquier otro campo se ignora.
 */
export function parseSendReportBody(
  body: unknown,
  catalog: readonly ReportDefinition[] = REPORT_CATALOG
): ParsedReportRequest {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  if (!isValidRequestId(record.requestId)) return { ok: false, error: "requestId no válido" };

  const definition = findEnabledDefinition(record.reportType, catalog);
  if (!definition) return { ok: false, error: "Tipo de informe no válido" };

  const format = record.format ?? (supportsFormat(definition, "pdf") ? "pdf" : definition.formats[0]);
  if (!supportsFormat(definition, format)) return { ok: false, error: "Formato no disponible para este informe" };

  const period = record.period ?? record.offset ?? 0;
  if (typeof period !== "number" || !Number.isInteger(period) || period < 0 || period > definition.maxOffset) {
    return { ok: false, error: "Periodo no válido" };
  }

  let subject: ReportSubjectRef;
  if (definition.subject === "restaurant") {
    const restaurantId = record.restaurantId;
    if (typeof restaurantId !== "number" || !Number.isSafeInteger(restaurantId) || restaurantId <= 0) {
      return { ok: false, error: "Restaurante no válido" };
    }
    subject = { kind: "restaurant", restaurantId };
  } else {
    const groupId = record.groupId;
    if (typeof groupId !== "string" || !isNetworkReportGroupId(groupId)) {
      return { ok: false, error: "Red o marca no válida" };
    }
    subject = { kind: "network_group", groupId };
  }

  return { ok: true, requestId: record.requestId, reportType: definition.id, format, subject, offset: period };
}
