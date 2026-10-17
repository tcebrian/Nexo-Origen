import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { authorizeConversationsAccess } from "@/lib/conversations/access";
import { sendManualTestTemplate } from "@/lib/conversations/contact-activation.server";
import { isValidConversationId, mapMessageRow } from "@/lib/conversations/read-model";
import { errorReply } from "@/lib/conversations/send-reply";
import { isValidRequestId } from "@/lib/conversations/send-text";
import { isTestTemplateKind } from "@/lib/conversations/template-test";
import { runManualNegativeAlertForConversation } from "@/lib/alerts/negative-review/process.server";
import { runManualDailyReportForConversation } from "@/lib/reports/daily/process.server";
import { describeTemplateRejection } from "@/lib/whatsapp/provider-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * PRUEBA MANUAL y TEMPORAL (solo super_admin): envía `informe_diario` o `alerta_negativa` al contacto de
 * la conversación. Body: { kind: "daily_report" | "negative_alert", requestId }.
 * La plantilla, el idioma y las variables los decide el servidor: el navegador solo elige el tipo.
 * Usa el mismo envío de Conversations que producción; no cambia activación, permisos ni automatizaciones.
 */
export async function POST(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const access = authorizeConversationsAccess(auth.session);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { conversationId } = await params;
  if (!isValidConversationId(conversationId)) {
    return NextResponse.json({ error: "Identificador de conversación no válido" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { kind?: unknown; requestId?: unknown } | null;
  if (!isTestTemplateKind(body?.kind)) return NextResponse.json({ error: "Tipo de prueba no válido" }, { status: 400 });
  if (!isValidRequestId(body?.requestId)) return NextResponse.json({ error: "requestId no válido" }, { status: 400 });

  try {
    // "Probar informe diario" ejecuta el flujo REAL del job (restaurantes, slot de ahora, snapshot, fila de
    // `conv_informe_envios`, plantilla y wamid), para que "Ver informe" sobre ese aviso funcione de verdad.
    if (body.kind === "daily_report") {
      const report = await runManualDailyReportForConversation({ conversationId, requestId: body.requestId });
      if (report.status === "contact_not_found") {
        return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
      }
      if (report.status === "no_restaurants") {
        return NextResponse.json(
          { error: "Este contacto no tiene restaurantes asignados: no hay informe que enviar.", code: "no_restaurants" },
          { status: 409 }
        );
      }
      if (report.status === "failed") {
        console.error(
          `[conversations] daily_report_test_failed conversationId=${conversationId} code=${report.code} reason=${report.reason}`
        );
        return NextResponse.json({ error: "No se pudo enviar el informe de prueba", code: report.reason, detail: `Código ${report.code}` }, { status: 502 });
      }
      return NextResponse.json(
        {
          template: "informe_diario",
          report: {
            envioId: report.envioId,
            kind: report.slot.kind,
            slotDate: report.slot.slotDate,
            periodStart: report.slot.periodStart,
            periodEnd: report.slot.periodEnd,
            restaurants: report.restaurants,
          },
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // "Probar alerta negativa" también ejecuta el flujo REAL (permisos, ventana de 24 h, imagen, texto con
    // enlace, plantilla y "Ver alerta") sobre la reseña negativa más reciente a la que el contacto tiene acceso.
    if (body.kind === "negative_alert" || body.kind === "negative_alert_template") {
      const run = await runManualNegativeAlertForConversation({
        conversationId,
        forceTemplate: body.kind === "negative_alert_template",
      });
      if (run.status === "contact_not_found") return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
      if (run.status === "alerts_disabled") {
        return NextResponse.json(
          { error: "Las alertas negativas están desactivadas para este contacto", code: "alerts_disabled" },
          { status: 409 }
        );
      }
      if (run.status === "no_restaurants") {
        return NextResponse.json({ error: "Este contacto no tiene restaurantes asignados: no hay alertas que enviar.", code: "no_restaurants" }, { status: 409 });
      }
      if (run.status === "no_negative_review") {
        return NextResponse.json({ error: "No hay reseñas negativas en los restaurantes de este contacto.", code: "no_negative_review" }, { status: 409 });
      }
      if (run.result.status === "skipped") {
        return NextResponse.json({ error: "La reseña no es válida para alerta", code: run.result.reason }, { status: 409 });
      }
      const outcome = run.result.outcomes[0]?.outcome ?? "failed";
      if (outcome === "failed" || outcome === "pending_template_failed") {
        console.error(`[conversations] negative_alert_test_failed conversationId=${conversationId} outcome=${outcome}`);
        return NextResponse.json({ error: "No se pudo enviar la alerta de prueba", code: outcome }, { status: 502 });
      }
      return NextResponse.json(
        { template: "alerta_negativa", alert: { outcome, resenaId: run.resenaId } },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const outcome = await sendManualTestTemplate({ conversationId, kind: body.kind, requestId: body.requestId });

    if (outcome.status === "sent") {
      return NextResponse.json(
        { template: outcome.template, messages: outcome.messages.map(mapMessageRow) },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    if (outcome.status === "contact_not_found") {
      return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
    }

    if (outcome.status === "rejected") {
      const meta = outcome.providerError;
      console.error(
        `[conversations] template_test_rejected conversationId=${conversationId} template=${outcome.template}` +
          ` metaCode=${meta?.code ?? "-"} metaSubcode=${meta?.subcode ?? "-"} metaType=${meta?.type ?? "-"}` +
          ` http=${meta?.httpStatus ?? "-"} fbtrace=${meta?.fbtraceId ?? "-"}`
      );
      const { message, detail } = describeTemplateRejection(meta);
      return NextResponse.json({ error: message, code: "rejected", ...(detail ? { detail } : {}) }, { status: 502 });
    }

    const reply = errorReply(outcome);
    return NextResponse.json({ error: reply.error, code: reply.code }, { status: reply.status });
  } catch (error) {
    console.error("[conversations] template test failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudo enviar la plantilla de prueba" }, { status: 500 });
  }
}
