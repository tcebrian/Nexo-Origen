import { createHash, timingSafeEqual } from "node:crypto";
import { sendAgentDailySummaryTest } from "@/lib/agents/daily-summary-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOMAS_AGENT_ID = "b0f73a2b-2303-4ef1-ba2c-bc1993ae76ab";
const TOKEN_HASH = "7b1ad12b549eab4ec4db10c70c710cf1b7a76c891c3511d4ec2e11901bdc2045";

function validToken(candidate: string | null): boolean {
  if (!candidate) return false;
  const actual = createHash("sha256").update(candidate).digest("hex");
  const left = Buffer.from(actual, "hex");
  const right = Buffer.from(TOKEN_HASH, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!validToken(token)) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  try {
    const result = await sendAgentDailySummaryTest(TOMAS_AGENT_ID);
    if (!result.ok) return Response.json(result, { status: 502 });
    return Response.json({
      ok: true,
      provider: result.provider,
      parts: result.parts,
      length: result.length
    });
  } catch (error) {
    console.error("[test-hambar-daily-summary]", error);
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "No se pudo enviar la prueba."
      },
      { status: 500 }
    );
  }
}
