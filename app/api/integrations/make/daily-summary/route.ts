import { processDueDailySummaries } from "@/lib/agents/daily-summary-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const makeSecret = process.env.MAKE_DAILY_SUMMARY_WEBHOOK_SECRET;
  const makeHeader = request.headers.get("x-nexo-secret");

  return Boolean(
    (cronSecret && auth === `Bearer ${cronSecret}`) ||
      (makeSecret && makeHeader === makeSecret)
  );
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  try {
    const result = await processDueDailySummaries();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("[make/daily-summary]", error);
    return Response.json(
      { ok: false, error: "No se pudieron procesar los informes diarios." },
      { status: 500 }
    );
  }
}
