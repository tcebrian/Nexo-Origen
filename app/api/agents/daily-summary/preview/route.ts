import { getAuthSession } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { buildAgentDailySummaryPreview } from "@/lib/agents/daily-summary";
import { rateLimitAuthenticatedUser } from "@/lib/security/rate-limit.server";

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session || !isSuperAdmin(session.perfil.rol)) {
    return Response.json({ error: "No autorizado." }, { status: 403 });
  }

  const limited = await rateLimitAuthenticatedUser("agents-summary-preview", session.userId);
  if (limited) return limited;

  try {
    const body = (await request.json()) as { agentId?: string };
    if (!body.agentId) {
      throw new Error("Agente no válido.");
    }

    return Response.json(await buildAgentDailySummaryPreview(body.agentId));
  } catch (error) {
    console.error("[api/agents/daily-summary/preview]", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo generar el resumen.",
      },
      { status: 400 }
    );
  }
}
