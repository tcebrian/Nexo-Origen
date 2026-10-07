import "server-only";

import type { UserScope } from "@/lib/auth/types";
import {
  listReportableRestaurants,
  loadMonthlyReport,
  resolveMonthlyTarget,
} from "@/lib/reports/monthly/data";
import { generateMonthlyPng } from "@/lib/reports/monthly/image/capture";
import { generateMonthlyPdf } from "@/lib/reports/monthly/pdf";
import { NETWORK_REPORT_GROUPS, isNetworkReportGroupId } from "@/lib/reports/network-summary/brand-groups";
import { captureNetworkSummaryPng } from "@/lib/reports/network-summary/capture-image";
import { resolveReportPeriodRange, type ReportPeriodSlug } from "@/lib/reports/period-ranges";
import {
  enabledReportDefinitions,
  listNetworkGroupOptions,
  periodOptionLabel,
  REPORT_FORMAT_LABELS,
  type ReportDefinition,
  type ReportOptions,
  type ReportPeriodKind,
} from "@/lib/conversations/report-catalog";
import {
  monthlyReportAdapter,
  networkReportAdapter,
  type MonthlyReportSource,
  type NetworkPeriodKind,
  type NetworkReportSource,
} from "@/lib/conversations/report-adapters";
import type { ReportAdapterRegistry } from "@/lib/conversations/report-send";

/**
 * Cableado real de los informes de Conversations: registra un adaptador por tipo
 * de informe y reutiliza directamente los generadores existentes, sin llamadas
 * HTTP internas (salvo el informe de red, cuyo generador actual captura su
 * plantilla de página). El scope lo aplican los propios resolvedores.
 *
 * Para habilitar un informe nuevo: añadir su adaptador aquí y poner
 * `enabled: true` en `report-catalog.ts`.
 */

/** Unidades de periodo que el generador común (`resolveReportPeriodRange`) sabe calcular. */
const PERIOD_SLUGS: Partial<Record<ReportPeriodKind, ReportPeriodSlug>> = {
  weekly: "semanal",
  monthly: "mensual",
  quarterly: "trimestral",
};

export function monthlyReportSource(scope: UserScope): MonthlyReportSource {
  return {
    async resolveTarget(restaurantId, offset) {
      const target = await resolveMonthlyTarget(restaurantId, offset, scope);
      return target ? { restaurantId: target.restaurantId, name: target.name, startKey: target.startKey } : null;
    },
    async generatePdf(restaurantId, offset) {
      const report = await loadMonthlyReport(restaurantId, offset, scope);
      if (!report) throw new Error("Informe no disponible");
      return generateMonthlyPdf(report);
    },
    async generateImages(restaurantId, offset) {
      const report = await loadMonthlyReport(restaurantId, offset, scope);
      if (!report) throw new Error("Informe no disponible");
      // Misma imagen 1920×1080 que `GET /api/informes/mensual/[id]/imagen`.
      return [await generateMonthlyPng(report)];
    },
  };
}

/**
 * Informes de red: el generador existente captura la plantilla
 * `/templates/network-summary/...` del propio despliegue, por lo que necesita su
 * origen (el de la petición ya autenticada del super_admin).
 */
export function networkReportSource(origin: string): NetworkReportSource {
  return {
    async resolveTarget(kind: NetworkPeriodKind, groupId, offset) {
      const slug = PERIOD_SLUGS[kind];
      if (!slug || !isNetworkReportGroupId(groupId)) return null;
      const range = resolveReportPeriodRange(slug, offset);
      return {
        groupId,
        groupLabel: NETWORK_REPORT_GROUPS[groupId].label,
        startKey: range.startKey,
        endKey: range.endKey,
        periodLabel: range.label,
      };
    },
    async generateImage(kind: NetworkPeriodKind, groupId, offset) {
      const slug = PERIOD_SLUGS[kind];
      if (!slug || !isNetworkReportGroupId(groupId)) throw new Error("Informe de red no disponible");
      return captureNetworkSummaryPng(slug, groupId, origin, offset);
    },
  };
}

/** Registro de adaptadores: un adaptador explícito por cada tipo de informe habilitado. */
export function reportAdapters(context: { scope: UserScope; origin: string }): ReportAdapterRegistry {
  const network = networkReportSource(context.origin);
  return {
    monthly: monthlyReportAdapter(monthlyReportSource(context.scope)),
    weekly: networkReportAdapter("weekly", network),
    quarterly: networkReportAdapter("quarterly", network),
  };
}

function periodOptions(definition: ReportDefinition): { offset: number; label: string }[] {
  const slug = PERIOD_SLUGS[definition.periodKind];
  if (!slug) return [];
  return Array.from({ length: Math.min(definition.periodOptionCount, definition.maxOffset + 1) }, (_, offset) => ({
    offset,
    label: periodOptionLabel(definition.periodKind, resolveReportPeriodRange(slug, offset)),
  }));
}

/** Opciones del selector: tipos habilitados con sus formatos y periodos, más restaurantes (con scope) y redes. */
export async function listReportOptions(
  scope: UserScope,
  adapters: ReportAdapterRegistry
): Promise<ReportOptions> {
  // Solo se ofrece lo que tiene catálogo habilitado Y adaptador registrado.
  const definitions = enabledReportDefinitions().filter((definition) => adapters[definition.id]);
  return {
    types: definitions.map((definition) => ({
      id: definition.id,
      label: definition.label,
      subject: definition.subject,
      formats: definition.formats.map((id) => ({ id, label: REPORT_FORMAT_LABELS[id] })),
      periods: periodOptions(definition),
    })),
    restaurants: await listReportableRestaurants(scope),
    groups: listNetworkGroupOptions(),
  };
}
