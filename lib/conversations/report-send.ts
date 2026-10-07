import {
  REPORT_CATALOG,
  findEnabledDefinition,
  type ParsedReportRequest,
  type ReportDefinition,
  type ReportTypeId,
} from "@/lib/conversations/report-catalog";
import type { ReportAdapter, ReportAdapterInput, ReportPlan } from "@/lib/conversations/report-adapters";
import {
  sendConversationOperation,
  type SendDeps,
  type SendOutcome,
} from "@/lib/conversations/send-text";

/**
 * Envío de informes de Nexo por WhatsApp, independiente del tipo de informe.
 * Conversations solo conoce el catálogo (`report-catalog.ts`) y un registro de
 * adaptadores (`report-adapters.ts`); no sabe cómo se construye ningún informe.
 *
 * El navegador solo manda identificadores. El PDF o la imagen se generan en
 * servidor y viajan servidor → Meta; nunca pasan por el navegador.
 */

export type ReportAdapterRegistry = Partial<Record<ReportTypeId, ReportAdapter>>;

export type ConversationReportRequest = Extract<ParsedReportRequest, { ok: true }>;

/**
 * Resuelve QUÉ archivos hay que enviar para un informe, sin generar nada todavía.
 * El tipo debe estar habilitado en el catálogo y tener adaptador registrado: nunca
 * se elige una función a partir de una cadena arbitraria. `null` si el informe no
 * existe o no está permitido.
 */
export async function generateConversationReport(
  request: Pick<ConversationReportRequest, "reportType" | "format" | "subject" | "offset">,
  adapters: ReportAdapterRegistry,
  catalog: readonly ReportDefinition[] = REPORT_CATALOG
): Promise<ReportPlan | null> {
  const definition = findEnabledDefinition(request.reportType, catalog);
  const adapter = definition ? adapters[definition.id] : undefined;
  if (!definition || !adapter) return null;
  if (!(definition.formats as readonly string[]).includes(request.format)) return null;

  const input: ReportAdapterInput = {
    format: request.format,
    subject: request.subject,
    offset: request.offset,
  };
  const plan = await adapter.plan(input);
  return plan && plan.files.length > 0 ? plan : null;
}

export type SendReportOutcome = SendOutcome | { status: "report_not_found"; sent: [] };

export async function sendConversationReport(
  input: { conversationId: string } & ConversationReportRequest,
  adapters: ReportAdapterRegistry,
  operation: SendDeps,
  catalog: readonly ReportDefinition[] = REPORT_CATALOG
): Promise<SendReportOutcome> {
  const plan = await generateConversationReport(input, adapters, catalog);
  if (!plan) return { status: "report_not_found", sent: [] };

  return sendConversationOperation(
    { conversationId: input.conversationId, requestId: input.requestId, text: "", files: plan.files },
    operation
  );
}
