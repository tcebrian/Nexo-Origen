import {
  monthParts,
  type ReportFormat,
  type ReportPeriodKind,
  type ReportSubjectRef,
} from "@/lib/conversations/report-catalog";
import type { SendFile } from "@/lib/conversations/send-text";

/**
 * Adaptadores de informe: Conversations no conoce cómo se construye cada
 * informe. Cada adaptador recibe `{ format, subject, offset }` y devuelve un PLAN
 * normalizado: los archivos que hay que enviar, en orden, con su nombre, MIME,
 * pie, vista previa y metadatos. Los bytes se piden con `produce()` SOLO cuando
 * el mensaje se va a enviar, para que un reintento ya enviado o pendiente no
 * vuelva a generar nada (ver `send-text.ts`).
 *
 * Sin dependencia de Next, Supabase, Chromium ni Meta: las fuentes reales se
 * inyectan desde `report-delivery.server.ts`.
 */

export type ReportPlan = { files: SendFile[] };

export type ReportAdapterInput = {
  format: ReportFormat;
  subject: ReportSubjectRef;
  offset: number;
};

export interface ReportAdapter {
  /** Valida sujeto y periodo (con scope) sin generar nada. `null` si no existe o no está permitido. */
  plan(input: ReportAdapterInput): Promise<ReportPlan | null>;
}

/** Tope interno de un PDF generado por Nexo (Meta admite hasta 100 MB). */
export const MAX_REPORT_PDF_BYTES = 25 * 1024 * 1024;
/** Límite de WhatsApp para una imagen. */
export const MAX_REPORT_IMAGE_BYTES = 5 * 1024 * 1024;

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

export function hasPngSignature(bytes: Uint8Array): boolean {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return bytes.length >= signature.length && signature.every((value, i) => bytes[i] === value);
}

function checkedPdf(bytes: Uint8Array): Uint8Array {
  if (!hasPdfSignature(bytes) || bytes.length > MAX_REPORT_PDF_BYTES) throw new Error("PDF generado no válido");
  return bytes;
}

function checkedPng(bytes: Uint8Array | undefined): Uint8Array {
  if (!bytes || !hasPngSignature(bytes) || bytes.length > MAX_REPORT_IMAGE_BYTES) {
    throw new Error("Imagen generada no válida");
  }
  return bytes;
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60)
    .replace(/_+$/, "");
}

const flat = (value: string) => value.replace(/\s+/g, " ").trim();
const clip = (text: string) => Array.from(text).slice(0, 140).join("");

// Mensual por restaurante ----------------------------------------------------------

/** Nº de imágenes que produce hoy el informe mensual (una de 1920×1080). */
export const MONTHLY_IMAGE_COUNT = 1;

export type MonthlyReportTarget = {
  restaurantId: number;
  name: string;
  startKey: string;
};

export type MonthlyReportSource = {
  /** Comprueba restaurante (con scope) y periodo sin generar nada. `null` si no existe o no está permitido. */
  resolveTarget(restaurantId: number, offset: number): Promise<MonthlyReportTarget | null>;
  /** Genera el PDF en servidor. */
  generatePdf(restaurantId: number, offset: number): Promise<Uint8Array>;
  /** Genera las imágenes del informe en servidor, en orden (hoy una). */
  generateImages(restaurantId: number, offset: number): Promise<Uint8Array[]>;
};

/** "Informe_Mensual_BK_Zizur_Septiembre_2026.pdf": solo ASCII seguro. */
export function buildMonthlyReportFilename(target: MonthlyReportTarget): string {
  const { month, year } = monthParts(target.startKey);
  return `Informe_Mensual_${slug(target.name) || "Restaurante"}_${month}_${year}.pdf`;
}

/** "Informe_Mensual_BK_Zizur_Septiembre_2026.png" (con "_2", "_3"… si hay varias imágenes). */
export function buildMonthlyImageFilename(target: MonthlyReportTarget, pageIndex: number, total: number): string {
  const base = buildMonthlyReportFilename(target).replace(/\.pdf$/, "");
  return `${base}${total > 1 ? `_${pageIndex + 1}` : ""}.png`;
}

/** Pie de foto de la imagen: "Informe mensual · BK Zizur · Septiembre 2026". */
export function buildMonthlyImageCaption(target: MonthlyReportTarget): string {
  const { month, year } = monthParts(target.startKey);
  return `Informe mensual · ${flat(target.name)} · ${month} ${year}`;
}

/** Vista previa de la imagen en la lista de conversaciones: "🖼️ Informe mensual · BK Zizur". */
export function buildMonthlyImagePreview(target: MonthlyReportTarget): string {
  return clip(`🖼️ Informe mensual · ${flat(target.name)}`);
}

/** Vista previa del PDF: "📊 Informe mensual · BK Zizur". */
export function buildMonthlyReportPreview(target: MonthlyReportTarget): string {
  return clip(`📊 Informe mensual · ${flat(target.name)}`);
}

export function monthlyReportAdapter(source: MonthlyReportSource): ReportAdapter {
  return {
    async plan({ format, subject, offset }) {
      if (subject.kind !== "restaurant") return null;
      const { restaurantId } = subject;
      const target = await source.resolveTarget(restaurantId, offset);
      if (!target) return null;

      const identity = {
        source: "nexo_report",
        report_type: "monthly",
        restaurant_id: target.restaurantId,
        period: target.startKey.slice(0, 7),
      };

      if (format === "image") {
        // Un solo render genera todas las imágenes; se pide al enviar la primera.
        let rendering: Promise<Uint8Array[]> | null = null;
        const render = () => (rendering ??= source.generateImages(restaurantId, offset));

        return {
          files: Array.from({ length: MONTHLY_IMAGE_COUNT }, (_, pageIndex): SendFile => ({
            kind: "image",
            media: {
              mime_type: "image/png",
              filename: buildMonthlyImageFilename(target, pageIndex, MONTHLY_IMAGE_COUNT),
              ...identity,
              report_format: "image",
              page_index: pageIndex,
            },
            caption: buildMonthlyImageCaption(target),
            preview: buildMonthlyImagePreview(target),
            produce: async () => {
              const images = await render();
              if (images.length !== MONTHLY_IMAGE_COUNT) throw new Error("Imagen generada no válida");
              return checkedPng(images[pageIndex]);
            },
          })),
        };
      }

      return {
        files: [
          {
            kind: "document",
            media: {
              mime_type: "application/pdf",
              filename: buildMonthlyReportFilename(target),
              ...identity,
            },
            preview: buildMonthlyReportPreview(target),
            produce: async () => checkedPdf(await source.generatePdf(restaurantId, offset)),
          },
        ],
      };
    },
  };
}

// Informes de red (semanal / trimestral) -------------------------------------------

export type NetworkPeriodKind = Extract<ReportPeriodKind, "weekly" | "quarterly">;

export type NetworkReportTarget = {
  groupId: string;
  groupLabel: string;
  startKey: string;
  endKey: string;
  /** "14 al 20 de septiembre de 2026" */
  periodLabel: string;
};

export type NetworkReportSource = {
  /** Valida grupo y periodo sin generar nada. */
  resolveTarget(kind: NetworkPeriodKind, groupId: string, offset: number): Promise<NetworkReportTarget | null>;
  /** Genera la imagen PNG de red (1920×1080) en servidor. */
  generateImage(kind: NetworkPeriodKind, groupId: string, offset: number): Promise<Uint8Array>;
};

const NETWORK_KIND_NAMES: Record<NetworkPeriodKind, { name: string; title: string }> = {
  weekly: { name: "Semanal", title: "semanal" },
  quarterly: { name: "Trimestral", title: "trimestral" },
};

/** Fragmento de nombre de archivo del periodo: semana "2026-09-14_2026-09-20", trimestre "2026_T3". */
function networkPeriodSegment(kind: NetworkPeriodKind, target: NetworkReportTarget): string {
  if (kind === "weekly") return `${target.startKey}_${target.endKey}`;
  const quarter = Math.floor((Number(target.startKey.slice(5, 7)) - 1) / 3) + 1;
  return `${target.startKey.slice(0, 4)}_T${quarter}`;
}

export function buildNetworkImageFilename(kind: NetworkPeriodKind, target: NetworkReportTarget): string {
  return `Informe_${NETWORK_KIND_NAMES[kind].name}_${slug(target.groupLabel) || "Red"}_${networkPeriodSegment(kind, target)}.png`;
}

export function buildNetworkImageCaption(kind: NetworkPeriodKind, target: NetworkReportTarget): string {
  return `Informe ${NETWORK_KIND_NAMES[kind].title} · ${flat(target.groupLabel)} · ${target.periodLabel}`;
}

export function buildNetworkImagePreview(kind: NetworkPeriodKind, target: NetworkReportTarget): string {
  return clip(`🖼️ Informe ${NETWORK_KIND_NAMES[kind].title} · ${flat(target.groupLabel)}`);
}

/** Informe de red (imagen PNG por grupo de marcas) para un periodo semanal o trimestral. */
export function networkReportAdapter(kind: NetworkPeriodKind, source: NetworkReportSource): ReportAdapter {
  return {
    async plan({ format, subject, offset }) {
      // Los informes de red solo existen como imagen: nunca se ofrece otro formato.
      if (format !== "image" || subject.kind !== "network_group") return null;
      const { groupId } = subject;
      const target = await source.resolveTarget(kind, groupId, offset);
      if (!target) return null;

      return {
        files: [
          {
            kind: "image",
            media: {
              mime_type: "image/png",
              filename: buildNetworkImageFilename(kind, target),
              source: "nexo_report",
              report_type: kind,
              report_format: "image",
              group_id: target.groupId,
              period: target.startKey,
              page_index: 0,
            },
            caption: buildNetworkImageCaption(kind, target),
            preview: buildNetworkImagePreview(kind, target),
            produce: async () => checkedPng(await source.generateImage(kind, groupId, offset)),
          },
        ],
      };
    },
  };
}
