import { getAuthSession } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";
import {
  createAgentControl,
  getAgentControlSnapshot,
} from "@/lib/agents/control";
import type { AgentCreateInput } from "@/lib/agents/types";

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session || !isSuperAdmin(session.perfil.rol)) {
    return Response.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as AgentCreateInput;
    await createAgentControl(body);
    return Response.json(await getAgentControlSnapshot());
  } catch (error) {
    console.error("[api/agents/create]", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo crear el agente.",
      },
      { status: 400 }
    );
  }
}
