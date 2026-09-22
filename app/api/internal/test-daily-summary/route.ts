import { sendAgentDailySummaryTest } from "@/lib/agents/daily-summary-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TEST_TOKEN = "nexo-test-7Qm4pL9x2Vf8";
const TOMAS_AGENT_ID = "b0f73a2b-2303-4ef1-ba2c-bc1993ae76ab";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("token") !== TEST_TOKEN) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  try {
    const result = await sendAgentDailySummaryTest(TOMAS_AGENT_ID);
    return Response.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    console.error("[test-daily-summary]", error);
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
