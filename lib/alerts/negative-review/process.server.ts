import "server-only";

import { resolveContactRestaurantIds, resolveContactsRestaurantIds } from "@/lib/conversations/contact-scope.server";
import { deriveStableRequestId } from "@/lib/conversations/request-ids";
import { productionSendDeps } from "@/lib/conversations/send-deps.server";
import { sendConversationOperation, type SendFailureStatus } from "@/lib/conversations/send-text";
import { WHATSAPP_TEMPLATES, buildTemplateRequest } from "@/lib/conversations/whatsapp-templates";
import { renderViaInternal } from "@/lib/render/internal-render-client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { findOrCreateConversation } from "@/lib/supabase/conversations.server";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";
import { sendTemplateMessage } from "@/lib/whatsapp/cloud-api.server";
import { buildAlertDataForResena } from "@/lib/notifications/build-alert-for-resena";
import { alertImagePreview, buildAlertText } from "./message";
import { resolveMapsLink, type MapsLinkInput } from "./maps-link";
import {
  deliverPendingAlerts,
  processNegativeReviewAlert,
  NEGATIVE_ALERT_MAX_STARS,
  type AlertPatch,
  type AlertReview,
  type DeliverResult,
  type NegativeAlertDeps,
  type PendingAlertsDeps,
  type PendingAlertsResult,
  type ProcessAlertResult,
} from "./orchestrator";

/**
 * Cableado de producción de las alertas negativas (solo servidor, service role): permisos de
 * `conv_contacto_*`, estado en `conv_alertas_negativas`, imagen del renderer interno y envío por el
 * sistema de Conversations (idempotente). La lógica vive en `orchestrator.ts`.
 */

const ALERTAS = "conv_alertas_negativas";
/** Ventana de atención al cliente de WhatsApp. */
const WINDOW_MS = 24 * 60 * 60 * 1000;

function admin() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase admin client is not configured.");
  return client;
}

type DbError = { code?: string; message?: string };
function fail(operation: string, error: DbError): never {
  // Solo la operación y el SQLSTATE: nunca valores de filas.
  throw new Error(`negative-alert ${operation} failed (${error.code ?? "unknown"})`);
}

async function singleConnectedChannelId(): Promise<string> {
  const { data, error } = await admin()
    .from(SUPABASE_TABLES.conv_canales)
    .select("id")
    .eq("provider", "whatsapp_cloud")
    .eq("status", "connected");
  if (error) fail("channel", error);
  const rows = (data ?? []) as { id: string }[];
  if (rows.length !== 1) throw new Error("negative-alert: no hay exactamente un canal de WhatsApp conectado");
  return rows[0]!.id;
}

type ReviewDetails = { review: AlertReview; link: MapsLinkInput; empresaId: number | null };

const REJECTED_STATUSES = new Set<SendFailureStatus>(["rejected", "upload_failed", "generation_failed", "misconfigured", "channel_inactive", "not_found"]);

function toDeliverResult(status: SendFailureStatus, code: string): DeliverResult {
  return REJECTED_STATUSES.has(status) ? { status: "rejected", code } : { status: "uncertain", code };
}

/** Dependencias de producción. Se crea una por ejecución: cachea lo que se reutiliza entre contactos. */
function createRuntime() {
  const details = new Map<number, Promise<ReviewDetails | null>>();
  const images = new Map<number, Promise<Buffer>>();

  function loadDetails(resenaId: number): Promise<ReviewDetails | null> {
    let cached = details.get(resenaId);
    if (!cached) {
      cached = (async () => {
        const client = admin();
        const { data: resena, error } = await client
          .from("resenas")
          .select("id,restaurante_id,estrellas,url,place_id,restaurante_nombre")
          .eq("id", resenaId)
          .maybeSingle();
        if (error) fail("review", error);
        const row = resena as {
          id: number;
          restaurante_id: number | null;
          estrellas: number | null;
          url: string | null;
          place_id: string | null;
          restaurante_nombre: string | null;
        } | null;
        if (!row || row.restaurante_id == null || row.estrellas == null) return null;

        const { data: restaurante, error: restauranteError } = await client
          .from(SUPABASE_TABLES.restaurantes)
          .select("id,nombre,direccion,ciudad,place_id,google_maps_url,empresa_id,marca_id")
          .eq("id", row.restaurante_id)
          .maybeSingle();
        if (restauranteError) fail("restaurant", restauranteError);
        const rest = restaurante as {
          id: number;
          nombre: string | null;
          direccion: string | null;
          ciudad: string | null;
          place_id: string | null;
          google_maps_url: string | null;
          empresa_id: number | null;
          marca_id: number | null;
        } | null;
        if (!rest) return null;

        let brand = "";
        if (rest.marca_id != null) {
          const { data: marca } = await client.from(SUPABASE_TABLES.marcas).select("nombre").eq("id", rest.marca_id).maybeSingle();
          brand = (marca as { nombre: string } | null)?.nombre?.trim() ?? "";
        }
        const baseName = rest.nombre?.trim() || row.restaurante_nombre?.trim() || "Restaurante";
        const restaurantName = brand && !baseName.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${baseName}` : baseName;

        return {
          empresaId: rest.empresa_id === null ? null : Number(rest.empresa_id),
          review: { resenaId: Number(row.id), restauranteId: Number(row.restaurante_id), stars: Number(row.estrellas), restaurantName },
          link: {
            reviewUrl: row.url,
            restaurantMapsUrl: rest.google_maps_url,
            placeId: rest.place_id || row.place_id,
            name: restaurantName,
            address: rest.direccion,
            city: rest.ciudad,
          },
        } satisfies ReviewDetails;
      })();
      details.set(resenaId, cached);
    }
    return cached;
  }

  function loadImage(resenaId: number): Promise<Buffer> {
    let cached = images.get(resenaId);
    if (!cached) {
      cached = (async () => {
        const data = await buildAlertDataForResena(resenaId);
        if (!data) throw new Error("negative-alert: sin datos para generar la imagen");
        return renderViaInternal({ op: "negative_review_image", data });
      })();
      images.set(resenaId, cached);
    }
    return cached;
  }

  async function conversationFor(contactId: string): Promise<string> {
    const canalId = await singleConnectedChannelId();
    const { conversation } = await findOrCreateConversation({ canalId, contactoId: contactId });
    return conversation.id;
  }

  async function deliverContent(input: { conversationId: string; review: AlertReview; contactId: string; requestSeed: string }): Promise<DeliverResult> {
    const info = await loadDetails(input.review.resenaId);
    const link = info ? resolveMapsLink(info.link) : null;
    const text = buildAlertText({ restaurantName: input.review.restaurantName, stars: input.review.stars, link: link?.url ?? null });
    const deps = productionSendDeps();

    // 1) La imagen de la reseña (se genera solo si de verdad se va a enviar).
    const image = await sendConversationOperation(
      {
        conversationId: input.conversationId,
        requestId: deriveStableRequestId(`${input.requestSeed}:image`),
        text: "",
        files: [
          {
            kind: "image",
            media: {
              mime_type: "image/png",
              filename: `nexo-alerta-${input.review.resenaId}.png`,
              source: "nexo_negative_alert",
              restaurant_id: input.review.restauranteId,
            },
            caption: null,
            preview: alertImagePreview(input.review.restaurantName),
            produce: async () => new Uint8Array(await loadImage(input.review.resenaId)),
          },
        ],
      },
      deps
    );
    if (image.status !== "sent") {
      const code = image.providerError?.code !== undefined ? String(image.providerError.code) : image.status;
      return toDeliverResult(image.status, code);
    }

    // 2) El texto corto con el enlace. Si falla, la imagen ya salió: no se cae a plantilla (incierto).
    const sentText = await sendConversationOperation(
      { conversationId: input.conversationId, requestId: deriveStableRequestId(`${input.requestSeed}:text`), text },
      deps
    );
    if (sentText.status !== "sent") {
      const code = sentText.providerError?.code !== undefined ? String(sentText.providerError.code) : sentText.status;
      return { status: "uncertain", code };
    }
    return { status: "sent" };
  }

  async function update(alertId: string, patch: AlertPatch): Promise<void> {
    const row: Record<string, unknown> = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.via !== undefined) row.via = patch.via;
    if (patch.conversationId !== undefined) row.conversacion_id = patch.conversationId;
    if (patch.templateWamid !== undefined) row.template_wamid = patch.templateWamid;
    if (patch.errorCode !== undefined) row.error_code = patch.errorCode;
    if (patch.errorReason !== undefined) row.error_reason = patch.errorReason;
    if (patch.notifiedAt !== undefined) row.notified_at = patch.notifiedAt?.toISOString() ?? null;
    if (patch.deliveredAt !== undefined) row.delivered_at = patch.deliveredAt?.toISOString() ?? null;
    if (Object.keys(row).length === 0) return;
    const { error } = await admin().from(ALERTAS).update(row).eq("id", alertId);
    if (error) fail("update", error);
  }

  return { loadDetails, conversationFor, deliverContent, update };
}

export function negativeAlertDeps(): NegativeAlertDeps {
  const runtime = createRuntime();

  return {
    async loadReview(resenaId) {
      return (await runtime.loadDetails(resenaId))?.review ?? null;
    },

    async findRecipients(review) {
      const client = admin();
      const details = await runtime.loadDetails(review.resenaId);
      const empresaId = details?.empresaId ?? null;

      const [byEmpresa, byRestaurant] = await Promise.all([
        empresaId === null
          ? Promise.resolve({ data: [], error: null })
          : client.from(SUPABASE_TABLES.conv_contacto_empresas).select("contacto_id").eq("empresa_id", empresaId),
        client.from(SUPABASE_TABLES.conv_contacto_restaurantes).select("contacto_id").eq("restaurante_id", review.restauranteId),
      ]);
      if (byEmpresa.error) fail("recipients_empresa", byEmpresa.error);
      if (byRestaurant.error) fail("recipients_restaurant", byRestaurant.error);

      const candidates = [
        ...new Set([...(byEmpresa.data ?? []), ...(byRestaurant.data ?? [])].map((row) => (row as { contacto_id: string }).contacto_id)),
      ];
      if (candidates.length === 0) return [];

      // DENY BY DEFAULT: solo quien HOY puede consultar ese restaurante (misma resolución que informes y bot).
      const access = await resolveContactsRestaurantIds(candidates);
      const allowed = candidates.filter((id) => access.get(id)?.includes(review.restauranteId));
      if (allowed.length === 0) return [];

      const { data, error } = await client
        .from(SUPABASE_TABLES.conv_contactos)
        .select("id,nombre,nombre_perfil,whatsapp_activated_at")
        .in("id", allowed);
      if (error) fail("contacts", error);
      return ((data ?? []) as { id: string; nombre: string | null; nombre_perfil: string | null; whatsapp_activated_at: string | null }[]).map((row) => ({
        contactId: row.id,
        name: row.nombre?.trim() || row.nombre_perfil?.trim() || null,
        activated: row.whatsapp_activated_at !== null,
      }));
    },

    async reserve({ resenaId, contactId, restauranteId, origin }) {
      const { data, error } = await admin()
        .from(ALERTAS)
        .insert({ resena_id: resenaId, contacto_id: contactId, restaurante_id: restauranteId, origen: origin, status: "reserved" })
        .select("id")
        .single();
      if (!error) return { id: (data as { id: string }).id };
      if (error.code === "23505") return null;
      return fail("reserve", error);
    },

    update: runtime.update,
    conversationFor: runtime.conversationFor,

    async isWindowOpen(conversationId, now) {
      const { data, error } = await admin()
        .from(SUPABASE_TABLES.conv_mensajes)
        .select("received_at,provider_timestamp")
        .eq("conversacion_id", conversationId)
        .eq("direction", "inbound")
        .order("received_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) fail("window", error);
      if (!data) return false;
      const row = data as { received_at: string | null; provider_timestamp: string | null };
      const last = Math.max(
        row.received_at ? Date.parse(row.received_at) : 0,
        row.provider_timestamp ? Date.parse(row.provider_timestamp) : 0
      );
      return last > 0 && now.getTime() - last < WINDOW_MS;
    },

    async countOutstanding(contactId) {
      const { count, error } = await admin()
        .from(ALERTAS)
        .select("id", { count: "exact", head: true })
        .eq("contacto_id", contactId)
        .in("status", ["pending", "notified"]);
      if (error) fail("count", error);
      return count ?? 0;
    },

    deliverContent: runtime.deliverContent,

    async sendTemplate({ conversationId, contactName, count, requestSeed }) {
      const template = buildTemplateRequest("alerta_negativa", [contactName?.trim() || "equipo", String(count)]);
      const outcome = await sendConversationOperation(
        {
          conversationId,
          requestId: deriveStableRequestId(`${requestSeed}:template`),
          text: "",
          template: {
            display: WHATSAPP_TEMPLATES.alerta_negativa.display,
            send: (context) => sendTemplateMessage({ phoneNumberId: context.canal.externalAccountId, to: context.contactPhone, template }),
          },
        },
        productionSendDeps()
      );
      if (outcome.status === "sent") return { status: "sent", wamid: outcome.messages[0]?.external_id ?? null };
      return { status: "failed", code: outcome.providerError?.code !== undefined ? String(outcome.providerError.code) : outcome.status };
    },

    log: (message) => console.error(message),
  };
}

/** Procesa una reseña nueva (la llama el webhook de inserción en `resenas`). */
export function processNegativeAlert(resenaId: number): Promise<ProcessAlertResult> {
  return processNegativeReviewAlert({ resenaId }, negativeAlertDeps());
}

/** Prueba manual del super_admin sobre UN contacto, con el flujo real (filas `origen = 'prueba'`). */
export async function runManualNegativeAlertForConversation(input: {
  conversationId: string;
  forceTemplate: boolean;
}): Promise<
  | { status: "contact_not_found" }
  | { status: "no_restaurants" }
  | { status: "no_negative_review" }
  | { status: "done"; resenaId: number; result: ProcessAlertResult }
> {
  const client = admin();
  const { data: conversation, error } = await client
    .from(SUPABASE_TABLES.conv_conversaciones)
    .select("contacto_id")
    .eq("id", input.conversationId)
    .maybeSingle();
  if (error) fail("manual_conversation", error);
  const contactId = (conversation as { contacto_id: string } | null)?.contacto_id;
  if (!contactId) return { status: "contact_not_found" };

  const restaurantIds = await resolveContactRestaurantIds(contactId);
  if (restaurantIds.length === 0) return { status: "no_restaurants" };

  // La reseña negativa más reciente de un restaurante al que ESTE contacto tiene acceso.
  const { data: reviews, error: reviewError } = await client
    .from("resenas")
    .select("id")
    .in("restaurante_id", restaurantIds)
    .lte("estrellas", NEGATIVE_ALERT_MAX_STARS)
    .gte("estrellas", 1)
    .order("fecha_resena", { ascending: false, nullsFirst: false })
    .limit(1);
  if (reviewError) fail("manual_review", reviewError);
  const resenaId = (reviews as { id: number }[] | null)?.[0]?.id;
  if (resenaId === undefined) return { status: "no_negative_review" };

  const result = await processNegativeReviewAlert(
    { resenaId: Number(resenaId), origin: "prueba", onlyContactId: contactId, forceTemplate: input.forceTemplate },
    negativeAlertDeps()
  );
  return { status: "done", resenaId: Number(resenaId), result };
}

// "Ver alerta" ---------------------------------------------------------------------------------------

export function pendingAlertsDeps(): PendingAlertsDeps {
  const runtime = createRuntime();
  return {
    resolveRestaurantIds: (contactId) => resolveContactRestaurantIds(contactId),

    async listOutstanding(contactId) {
      const { data, error } = await admin()
        .from(ALERTAS)
        .select("id,resena_id,restaurante_id")
        .eq("contacto_id", contactId)
        .in("status", ["pending", "notified"])
        .order("created_at", { ascending: true });
      if (error) fail("outstanding", error);
      return ((data ?? []) as { id: string; resena_id: number; restaurante_id: number }[]).map((row) => ({
        id: row.id,
        resenaId: Number(row.resena_id),
        restauranteId: Number(row.restaurante_id),
      }));
    },

    async claim(alertId) {
      const { data, error } = await admin()
        .from(ALERTAS)
        .update({ status: "delivering" })
        .eq("id", alertId)
        .in("status", ["pending", "notified"])
        .select("id");
      if (error) fail("claim", error);
      return (data?.length ?? 0) > 0;
    },

    async loadReview(resenaId) {
      return (await runtime.loadDetails(resenaId))?.review ?? null;
    },

    update: runtime.update,
    deliverContent: runtime.deliverContent,
  };
}

export function resolvePendingAlerts(input: { contactId: string; conversationId: string }): Promise<PendingAlertsResult> {
  return deliverPendingAlerts(input, pendingAlertsDeps());
}
