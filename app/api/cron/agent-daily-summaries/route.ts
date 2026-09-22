import { processDueDailySummaries } from "@/lib/agents/daily-summary-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (secret) {
    return authorization === `Bearer ${secret}`;
  }

  // Vercel Cron identifies its invocation with this user-agent.
  // Delivery is additionally protected by one-send-per-agent/day idempotency.
  return (request.headers.get("user-agent") ?? "").toLowerCase().includes("vercel-cron");
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  try {
    const result = await processDueDailySummaries();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/agent-daily-summaries]", error);
    return Response.json(
      { ok: false, error: "No se pudieron procesar los resúmenes." },
      { status: 500 }
    );
  }
}
