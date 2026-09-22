import "server-only";

import { buildAgentDailySummaryPreview } from "@/lib/agents/daily-summary";
import { sendWhatsAppText } from "@/lib/notifications/whatsapp";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SUPABASE_TABLES } from "@/lib/supabase/tables";

type DueAgentRow = {
  id: string;
  telefono: string;
  nombre: string;
  modo: string;
  resumen_hora: string;
  timezone: string;
};

type DeliveryRow = {
  id: number;
  status: "pending" | "sending" | "sent" | "error";
  mensaje: string;
  attempts: number;
};

export type DailySummaryRunResult = {
  checked: number;
  due: number;
  sent: number;
  failed: number;
  skipped: number;
};

function requireAdminClient() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase admin client is not configured.");
  return client;
}

function localClock(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    dateKey: `${read("year")}-${read("month")}-${read("day")}`,
    hour: Number(read("hour")),
    minute: Number(read("minute")),
  };
}

function parseClockMinutes(value: string): number {
  const match = String(value).match(/^(\d{2}):(\d{2})/);
  if (!match) return 9 * 60;
  return Number(match[1]) * 60 + Number(match[2]);
}

function isDueNow(agent: DueAgentRow, now: Date): { due: boolean; localDate: string } {
  const clock = localClock(now, agent.timezone || "Europe/Madrid");
  const currentMinutes = clock.hour * 60 + clock.minute;
  const scheduledMinutes = parseClockMinutes(agent.resumen_hora);
  const delay = currentMinutes - scheduledMinutes;

  // Vercel Cron on lower tiers can be delayed. Accept up to 75 minutes late.
  return {
    due: delay >= 0 && delay <= 75,
    localDate: clock.dateKey,
  };
}

async function getOrCreateDelivery(
  agent: DueAgentRow,
  localDate: string
): Promise<DeliveryRow | null> {
  const client = requireAdminClient();

  const { data: existing, error: existingError } = await client
    .from(SUPABASE_TABLES.nexo_bot_resumenes_envios)
    .select("id,status,mensaje,attempts")
    .eq("agente_id", agent.id)
    .eq("local_date", localDate)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    return existing as DeliveryRow;
  }

  const summary = await buildAgentDailySummaryPreview(agent.id);

  const { data: created, error: createError } = await client
    .from(SUPABASE_TABLES.nexo_bot_resumenes_envios)
    .insert({
      agente_id: agent.id,
      local_date: localDate,
      timezone: agent.timezone || "Europe/Madrid",
      mensaje: summary.message,
      status: "pending",
      provider: "pending",
    })
    .select("id,status,mensaje,attempts")
    .single();

  if (createError) {
    // A concurrent run may have won the unique(agent,date) race.
    if (createError.code === "23505") {
      const { data: raced, error: racedError } = await client
        .from(SUPABASE_TABLES.nexo_bot_resumenes_envios)
        .select("id,status,mensaje,attempts")
        .eq("agente_id", agent.id)
        .eq("local_date", localDate)
        .maybeSingle();

      if (racedError) throw racedError;
      return raced as DeliveryRow | null;
    }
    throw createError;
  }

  return created as DeliveryRow;
}

export function splitWhatsAppMessage(message: string, maxChars = 3600): string[] {
  const normalized = message.trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const sections = normalized.split(/\n(?=━━━━━━━━━━━━━━)/g);
  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const section of sections) {
    const candidate = current ? `${current}\n${section}` : section;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    pushCurrent();

    if (section.length <= maxChars) {
      current = section;
      continue;
    }

    const lines = section.split("\n");
    for (const line of lines) {
      const lineCandidate = current ? `${current}\n${line}` : line;
      if (lineCandidate.length <= maxChars) {
        current = lineCandidate;
      } else {
        pushCurrent();
        current = line;
      }
    }
  }

  pushCurrent();
  return chunks;
}

async function sendMessageParts(
  agent: DueAgentRow,
  message: string,
  localDate: string
): Promise<
  | { ok: true; provider: "make" | "twilio"; messageIds: string[]; parts: number }
  | { ok: false; provider: "make" | "twilio" | "none"; error: string }
> {
  const parts = splitWhatsAppMessage(message);
  if (parts.length === 0) {
    return { ok: false, provider: "none", error: "El informe diario está vacío." };
  }

  const ids: string[] = [];
  let provider: "make" | "twilio" = "make";

  for (let index = 0; index < parts.length; index += 1) {
    const result = await sendWhatsAppText({
      to: agent.telefono,
      body: parts[index],
      metadata: {
        agent_id: agent.id,
        agent_name: agent.nombre,
        local_date: localDate,
        report_part: index + 1,
        report_parts_total: parts.length,
      },
    });

    if (!result.ok) {
      return {
        ok: false,
        provider: result.provider,
        error: `Parte ${index + 1}/${parts.length}: ${result.error}`,
      };
    }

    provider = result.provider;
    ids.push(result.messageId);
  }

  return { ok: true, provider, messageIds: ids, parts: parts.length };
}

async function deliver(agent: DueAgentRow, delivery: DeliveryRow) {
  const client = requireAdminClient();

  if (delivery.status === "sent" || delivery.status === "sending") {
    return { sent: false, skipped: true };
  }

  const nextAttempts = Number(delivery.attempts ?? 0) + 1;

  const { data: claimed, error: claimError } = await client
    .from(SUPABASE_TABLES.nexo_bot_resumenes_envios)
    .update({
      status: "sending",
      attempts: nextAttempts,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", delivery.id)
    .in("status", ["pending", "error"])
    .select("id")
    .maybeSingle();

  if (claimError) throw claimError;
  if (!claimed) return { sent: false, skipped: true };

  const localDate = localClock(new Date(), agent.timezone || "Europe/Madrid").dateKey;
  const result = await sendMessageParts(agent, delivery.mensaje, localDate);

  if (result.ok) {
    await client
      .from(SUPABASE_TABLES.nexo_bot_resumenes_envios)
      .update({
        status: "sent",
        provider: result.provider,
        provider_message_id: result.messageIds.join(","),
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", delivery.id);

    return { sent: true, skipped: false };
  }

  await client
    .from(SUPABASE_TABLES.nexo_bot_resumenes_envios)
    .update({
      status: "error",
      provider: result.provider,
      last_error: result.error.slice(0, 1000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", delivery.id);

  return { sent: false, skipped: false };
}

export async function processDueDailySummaries(
  now = new Date()
): Promise<DailySummaryRunResult> {
  const client = requireAdminClient();

  const { data, error } = await client
    .from(SUPABASE_TABLES.nexo_bot_accesos)
    .select("id,telefono,nombre,modo,resumen_hora,timezone")
    .eq("activo", true)
    .eq("resumen_diario", true)
    .neq("modo", "pausado");

  if (error) throw error;

  const agents = (data ?? []) as DueAgentRow[];
  const result: DailySummaryRunResult = {
    checked: agents.length,
    due: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  for (const agent of agents) {
    const schedule = isDueNow(agent, now);
    if (!schedule.due) {
      result.skipped += 1;
      continue;
    }

    result.due += 1;

    try {
      const delivery = await getOrCreateDelivery(agent, schedule.localDate);
      if (!delivery) {
        result.failed += 1;
        continue;
      }

      const outcome = await deliver(agent, delivery);
      if (outcome.sent) result.sent += 1;
      else if (outcome.skipped) result.skipped += 1;
      else result.failed += 1;
    } catch (error) {
      console.error("[agent-daily-summary-delivery]", agent.id, error);
      result.failed += 1;
    }
  }

  return result;
}


export async function sendAgentDailySummaryTest(agentId: string) {
  const client = requireAdminClient();
  const { data, error } = await client
    .from(SUPABASE_TABLES.nexo_bot_accesos)
    .select("id,telefono,nombre,modo,resumen_hora,timezone")
    .eq("id", agentId)
    .eq("activo", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Agente no encontrado o inactivo.");

  const agent = data as DueAgentRow;
  const summary = await buildAgentDailySummaryPreview(agent.id);
  const localDate = localClock(new Date(), agent.timezone || "Europe/Madrid").dateKey;
  const result = await sendMessageParts(agent, summary.message, localDate);

  return {
    ...result,
    preview: summary.message,
    length: summary.message.length,
  };
}
