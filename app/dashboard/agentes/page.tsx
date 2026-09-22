import { redirect } from "next/navigation";
import { AgentControlView } from "./agent-control-view";
import { getAuthSession } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { getAgentControlSnapshot } from "@/lib/agents/control";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const session = await getAuthSession();

  if (!session || !isSuperAdmin(session.perfil.rol)) {
    redirect("/dashboard");
  }

  const snapshot = await getAgentControlSnapshot();

  return <AgentControlView initialSnapshot={snapshot} />;
}
