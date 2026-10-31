import "server-only";

import { productionSendDeps } from "@/lib/conversations/send-deps.server";
import { resolveContactRestaurantIds, resolveContactsRestaurantIds } from "@/lib/conversations/contact-scope.server";
import { sendConversationOperation } from "@/lib/conversations/send-text";
import { WHATSAPP_TEMPLATES, buildTemplateRequest } from "@/lib/conversations/whatsapp-templates";
import { deriveStableRequestId } from "@/lib/conversations/request-ids";
import { qualifyRestaurantName } from "@/lib/restaurants/qualified-name";
import { classifyReviewReason } from "@/lib/reviews/classify-reason";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { findOrCreateConversation } from "@/lib/supabase/conversations.server";
import { categoriaMotivoLabel } from "@/lib/supabase/resena-motivos";
import { fetchResenaMotivosForReviewIds } from "@/lib/supabase/resena-motivos.server";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";
import { sendTemplateMessage } from "@/lib/whatsapp/cloud-api.server";
import { DAILY_REPORT_TEMPLATE, runDailyReport, type DailyReportJobDeps, type DailyReportRunResult, type WindowData } from "./job";
import { comparisonWindowEnd, type DailySlot } from "./calendar";
import { runManualDailyReport, type ManualDailyReportOutcome } from "./manual-test";
import { TARGET_AVERAGE, type DailyReportSnapshot, type NewNegative, type RestaurantInfo, type WindowMetrics } from "./snapshot";
import { viewDailyReport, type DailyReportViewDeps, type DailyReportViewResult, type InformeEnvio } from "./view";

/**
 * Cableado de producción del informe diario (solo servidor, service role): persistencia en
 * `conv_informe_envios`, métricas por ventana horaria (`nexo_reputation_window_metrics`), permisos de
 * `conv_contacto_*` y envío por el sistema de Conversations. La lógica vive en `job.ts` y `view.ts`.
 */

const ENVIOS = "conv_informe_envios";
const CONSTRAINT_UNIQUE = "conv_informe_envios_contacto_slot_template_key";

function admin() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase admin client is not configured.");
  return client;
}

type DbError = { code?: string; message?: string; details?: string };
function fail(operation: string, error: DbError): never {
  // Solo la operación y el SQLSTATE: nunca valores de filas.
  throw new Error(`daily-report ${operation} failed (${error.code ?? "unknown"})`);
}

const NON_CAUSAL = new Set(["sin motivo", "valoracion incoherente", "no operativo", "sin comentario", "otros", "otro"]);
const normalizeLabel = (label: string) => label.trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const normalizeWall = (value: unknown): string => String(value ?? "").replace(" ", "T").slice(0, 19);
const toMetrics = (row: Record<string, unknown>): WindowMetrics => ({
  reviews: Number(row.total_resenas),
  ratingSum: Number(row.rating_sum),
  positive: Number(row.positivas),
  neutral: Number(row.neutras),
  negative: Number(row.negativas),
});

/** Comienzo de un texto en una sola línea y con límite; nunca se guarda el comentario completo. */
function excerptOf(text: string | null | undefined, max = 110): string | null {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return null;
  const chars = Array.from(clean);
  return chars.length <= max ? clean : `${chars.slice(0, max - 1).join("").trimEnd()}…`;
}

async function loadWindowData(restaurantIds: number[], slot: DailySlot): Promise<WindowData> {
  const client = admin();
  const window = { p_start: slot.periodStart, p_end: slot.periodEnd, p_restaurant_ids: restaurantIds };
  // Ventana de comparación: mismo inicio, fin a las 09:00 del día anterior (misma semana).
  const previousEnd = comparisonWindowEnd(slot);
  const previousWindow = { p_start: slot.periodStart, p_end: previousEnd, p_restaurant_ids: restaurantIds };

  const [restaurants, brands, companies, metricRows, previousRows, reviewRows] = await Promise.all([
    client.from(SUPABASE_TABLES.restaurantes).select("id,nombre,marca_id,empresa_id,activo").in("id", restaurantIds),
    client.from(SUPABASE_TABLES.marcas).select("id,nombre,objetivo_media"),
    client.from(SUPABASE_TABLES.empresas).select("id,nombre"),
    client.rpc("nexo_reputation_window_metrics", window),
    client.rpc("nexo_reputation_window_metrics", previousWindow),
    client.rpc("nexo_window_reviews", window),
  ]);
  if (restaurants.error) fail("restaurants", restaurants.error);
  if (brands.error) fail("brands", brands.error);
  if (companies.error) fail("companies", companies.error);
  if (metricRows.error) fail("metrics", metricRows.error);
  if (previousRows.error) fail("previous_metrics", previousRows.error);
  if (reviewRows.error) fail("reviews", reviewRows.error);

  const brandRows = new Map(
    ((brands.data ?? []) as { id: number; nombre: string; objetivo_media: number | string | null }[]).map((row) => [Number(row.id), row])
  );
  const companyName = new Map(((companies.data ?? []) as { id: number; nombre: string }[]).map((row) => [Number(row.id), String(row.nombre)]));

  const info = new Map<number, RestaurantInfo>();
  for (const row of (restaurants.data ?? []) as { id: number; nombre: string; marca_id: number | null; empresa_id: number | null; activo: boolean | null }[]) {
    // Un restaurante dado de baja (`activo = false`) no aparece en el informe, aunque el contacto aún tenga acceso.
    if (row.activo === false) continue;
    const brandRow = row.marca_id === null ? undefined : brandRows.get(Number(row.marca_id));
    const brand = brandRow ? String(brandRow.nombre) : "";
    const name = qualifyRestaurantName(brand, row.nombre);
    const target = Number(brandRow?.objetivo_media);
    info.set(Number(row.id), {
      id: Number(row.id),
      name,
      brand,
      company: row.empresa_id === null ? null : (companyName.get(Number(row.empresa_id)) ?? null),
      // Objetivo de la marca (`marcas.objetivo_media`); sin dato, 4,4.
      target: Number.isFinite(target) && target > 0 ? target : TARGET_AVERAGE,
    });
  }

  const metrics = new Map<number, WindowMetrics>();
  for (const row of (metricRows.data ?? []) as Record<string, unknown>[]) metrics.set(Number(row.restaurante_id), toMetrics(row));
  const previousMetrics = new Map<number, WindowMetrics>();
  for (const row of (previousRows.data ?? []) as Record<string, unknown>[]) previousMetrics.set(Number(row.restaurante_id), toMetrics(row));

  // Motivo principal por restaurante: mismas fuentes que el informe mensual (categoría guardada → clasificador).
  type ReviewRow = { restaurante_id: number; review_id: string | null; estrellas: number; comentario: string | null; activity_wall: string };
  const negatives = ((reviewRows.data ?? []) as ReviewRow[]).filter((row) => Number(row.estrellas) <= 2);
  const reviewIds = negatives.map((row) => String(row.review_id ?? "")).filter(Boolean);
  const motives = await fetchResenaMotivosForReviewIds(reviewIds);
  const categoryById = new Map(motives.rows.map((row) => [row.review_id, row.categoria]));
  const labelOf = (row: ReviewRow): string | null => {
    const category = categoryById.get(String(row.review_id ?? ""));
    const label = category ? categoriaMotivoLabel(category) : classifyReviewReason({ comentario: row.comentario });
    return !label || NON_CAUSAL.has(normalizeLabel(label)) ? null : label;
  };

  const counts = new Map<number, Map<string, number>>();
  for (const row of negatives) {
    const label = labelOf(row);
    if (!label) continue;
    const byLabel = counts.get(Number(row.restaurante_id)) ?? new Map<string, number>();
    byLabel.set(label, (byLabel.get(label) ?? 0) + 1);
    counts.set(Number(row.restaurante_id), byLabel);
  }
  const reasons = new Map<number, string | null>();
  for (const [restaurantId, byLabel] of counts) {
    reasons.set(restaurantId, [...byLabel].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))[0]![0]);
  }

  // Negativas NUEVAS desde el corte anterior (actividad >= fin de la ventana de comparación). Se reutiliza el
  // resumen del análisis ya guardado; nunca se llama a IA.
  const fresh = negatives.filter((row) => normalizeWall(row.activity_wall) >= previousEnd);
  const summaries = new Map<string, string>();
  const freshIds = fresh.map((row) => String(row.review_id ?? "")).filter(Boolean);
  if (freshIds.length > 0) {
    const { data: analyses, error: analysisError } = await client.from("analisis_ia").select("review_id,resumen").in("review_id", freshIds);
    if (analysisError) fail("analysis", analysisError);
    for (const row of (analyses ?? []) as { review_id: string; resumen: string | null }[]) {
      if (row.resumen?.trim()) summaries.set(String(row.review_id), row.resumen);
    }
  }
  const newNegatives = new Map<number, NewNegative[]>();
  for (const row of fresh) {
    const list = newNegatives.get(Number(row.restaurante_id)) ?? [];
    list.push({
      stars: Number(row.estrellas),
      at: normalizeWall(row.activity_wall),
      reason: labelOf(row),
      excerpt: excerptOf(summaries.get(String(row.review_id ?? "")) ?? row.comentario),
    });
    newNegatives.set(Number(row.restaurante_id), list);
  }

  return { restaurants: info, metrics, reasons, previousMetrics, newNegatives };
}

async function singleConnectedChannelId(): Promise<string> {
  const { data, error } = await admin()
    .from(SUPABASE_TABLES.conv_canales)
    .select("id")
    .eq("provider", "whatsapp_cloud")
    .eq("status", "connected");
  if (error) fail("channel", error);
  const rows = (data ?? []) as { id: string }[];
  if (rows.length !== 1) throw new Error("daily-report: no hay exactamente un canal de WhatsApp conectado");
  return rows[0]!.id;
}

export function dailyReportJobDeps(): DailyReportJobDeps {
  return {
    async listActivatedContacts() {
      const { data, error } = await admin()
        .from(SUPABASE_TABLES.conv_contactos)
        .select("id,nombre,nombre_perfil")
        .not("whatsapp_activated_at", "is", null);
      if (error) fail("contacts", error);
      return ((data ?? []) as { id: string; nombre: string | null; nombre_perfil: string | null }[]).map((row) => ({
        id: row.id,
        name: row.nombre?.trim() || row.nombre_perfil?.trim() || null,
      }));
    },

    resolveRestaurantIds: (contactIds) => resolveContactsRestaurantIds(contactIds),

    async listContactsWithEnvio(slotDate) {
      // Solo cuentan los envíos del job: una prueba manual no marca el slot como hecho.
      const { data, error } = await admin()
        .from(ENVIOS)
        .select("contacto_id")
        .eq("slot_date", slotDate)
        .eq("template", DAILY_REPORT_TEMPLATE)
        .eq("origen", "job");
      if (error) fail("existing", error);
      return new Set(((data ?? []) as { contacto_id: string }[]).map((row) => row.contacto_id));
    },

    loadWindowData,

    async reserve({ contactId, slot, template, origin }) {
      const { data, error } = await admin()
        .from(ENVIOS)
        .insert({
          contacto_id: contactId,
          origen: origin ?? "job",
          template,
          slot_date: slot.slotDate,
          kind: slot.kind,
          period_start: slot.periodStart,
          period_end: slot.periodEnd,
          status: "reserved",
        })
        .select("id")
        .single();
      if (!error) return { id: (data as { id: string }).id };
      // La restricción única decide: otra ejecución ya reservó este (contacto, slot, plantilla).
      if (error.code === "23505" && (error.message ?? "").includes(CONSTRAINT_UNIQUE)) return null;
      if (error.code === "23505") return null;
      return fail("reserve", error);
    },

    async saveSnapshot(envioId, snapshot) {
      const { error } = await admin().from(ENVIOS).update({ snapshot }).eq("id", envioId);
      if (error) fail("snapshot", error);
    },

    async send({ contactId, contactName, slot, requestSeed }) {
      const canalId = await singleConnectedChannelId();
      const { conversation } = await findOrCreateConversation({ canalId, contactoId: contactId });
      const template = buildTemplateRequest(DAILY_REPORT_TEMPLATE, [contactName?.trim() || "equipo", slot.templateLabel]);

      const outcome = await sendConversationOperation(
        {
          conversationId: conversation.id,
          requestId: deriveStableRequestId(requestSeed),
          text: "",
          template: {
            display: WHATSAPP_TEMPLATES.informe_diario.display,
            send: (context) =>
              sendTemplateMessage({ phoneNumberId: context.canal.externalAccountId, to: context.contactPhone, template }),
          },
        },
        productionSendDeps()
      );

      if (outcome.status === "sent") {
        const message = outcome.messages[0]!;
        return { status: "sent", messageId: message.id, wamid: message.external_id, conversationId: conversation.id };
      }
      const code = outcome.providerError?.code !== undefined ? String(outcome.providerError.code) : outcome.status;
      return { status: "failed", code, reason: outcome.status, conversationId: conversation.id };
    },

    async markSent(envioId, result, at) {
      const { error } = await admin()
        .from(ENVIOS)
        .update({
          status: "sent",
          mensaje_id: result.messageId,
          template_wamid: result.wamid,
          conversacion_id: result.conversationId,
          sent_at: at.toISOString(),
        })
        .eq("id", envioId);
      if (error) fail("mark_sent", error);
    },

    async markFailed(envioId, result) {
      const { error } = await admin()
        .from(ENVIOS)
        .update({
          status: "failed",
          error_code: result.code.slice(0, 40),
          error_reason: result.reason.slice(0, 120),
          conversacion_id: result.conversationId ?? null,
        })
        .eq("id", envioId);
      if (error) fail("mark_failed", error);
    },

    log: (message) => console.error(message),
  };
}

/** Ejecuta el slot actual (lo llama el cron de Supabase). */
export function processDailyReport(): Promise<DailyReportRunResult> {
  return runDailyReport(dailyReportJobDeps());
}

/**
 * Prueba manual (super_admin, temporal): el flujo real del job para el contacto de UNA conversación.
 * Ver `manual-test.ts`. No exige activación: es una prueba explícita del propio super_admin.
 */
export async function runManualDailyReportForConversation(input: {
  conversationId: string;
  requestId: string;
}): Promise<ManualDailyReportOutcome | { status: "contact_not_found" }> {
  const client = admin();
  const { data: conversation, error } = await client
    .from(SUPABASE_TABLES.conv_conversaciones)
    .select("contacto_id")
    .eq("id", input.conversationId)
    .maybeSingle();
  if (error) fail("manual_conversation", error);
  const contactId = (conversation as { contacto_id: string } | null)?.contacto_id;
  if (!contactId) return { status: "contact_not_found" };

  const { data: contact, error: contactError } = await client
    .from(SUPABASE_TABLES.conv_contactos)
    .select("id,nombre,nombre_perfil")
    .eq("id", contactId)
    .maybeSingle();
  if (contactError) fail("manual_contact", contactError);
  if (!contact) return { status: "contact_not_found" };
  const row = contact as { id: string; nombre: string | null; nombre_perfil: string | null };

  return runManualDailyReport(
    { contactId: row.id, contactName: row.nombre?.trim() || row.nombre_perfil?.trim() || null, requestId: input.requestId },
    dailyReportJobDeps()
  );
}

// "Ver informe" -------------------------------------------------------------------------------------

type EnvioRow = { id: string; contacto_id: string; slot_date: string; snapshot: unknown; sent_at: string | null };
const ENVIO_COLUMNS = "id,contacto_id,slot_date,snapshot,sent_at";
const mapEnvio = (row: EnvioRow): InformeEnvio => ({
  id: row.id,
  contactoId: row.contacto_id,
  slotDate: row.slot_date,
  snapshot: row.snapshot,
  sentAt: row.sent_at,
});

export function dailyReportViewDeps(): DailyReportViewDeps {
  return {
    async findByWamid(wamid) {
      const { data, error } = await admin()
        .from(ENVIOS)
        .select(ENVIO_COLUMNS)
        .eq("template_wamid", wamid)
        .eq("status", "sent")
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) fail("find_wamid", error);
      return data ? mapEnvio(data as EnvioRow) : null;
    },

    async findLatestForContact(contactId, sinceIso) {
      const { data, error } = await admin()
        .from(ENVIOS)
        .select(ENVIO_COLUMNS)
        .eq("contacto_id", contactId)
        .eq("status", "sent")
        .gte("sent_at", sinceIso)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) fail("find_latest", error);
      return data ? mapEnvio(data as EnvioRow) : null;
    },

    async markViewed(envioId, { fallback, count }) {
      const client = admin();
      const now = new Date().toISOString();
      const { data, error } = await client.from(ENVIOS).select("view_count,first_viewed_at,view_fallback_used").eq("id", envioId).maybeSingle();
      if (error) fail("view_read", error);
      const current = (data ?? { view_count: 0, first_viewed_at: null, view_fallback_used: false }) as {
        view_count: number;
        first_viewed_at: string | null;
        view_fallback_used: boolean;
      };
      const { error: updateError } = await client
        .from(ENVIOS)
        .update({
          view_count: current.view_count + (count ? 1 : 0),
          first_viewed_at: current.first_viewed_at ?? now,
          last_viewed_at: now,
          view_fallback_used: current.view_fallback_used || fallback,
        })
        .eq("id", envioId);
      if (updateError) fail("view_update", updateError);
    },

    resolveRestaurantIds: (contactId) => resolveContactRestaurantIds(contactId),
  };
}

export function resolveDailyReportView(input: {
  contactId: string;
  replyToWamid: string | null;
  redelivery: boolean;
}): Promise<DailyReportViewResult> {
  return viewDailyReport(input, dailyReportViewDeps());
}

export type { DailyReportSnapshot };
