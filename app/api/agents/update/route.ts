import { getAuthSession } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";
import {
  getAgentControlSnapshot,
  updateAgentControl,
  type AgentControlUpdateInput,
} from "@/lib/agents/control";

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session || !isSuperAdmin(session.perfil.rol)) {
    return Response.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as AgentControlUpdateInput;
    await updateAgentControl(body);
    const snapshot = await getAgentControlSnapshot();
    return Response.json(snapshot);
  } catch (error) {
    console.error("[api/agents/update]", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el agente.",
      },
      { status: 400 }
    );
  }
}
