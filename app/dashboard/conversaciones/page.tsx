import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/session";
import { canReadConversations } from "@/lib/conversations/access";
import { ConversationsView } from "./conversations-view";

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  const session = await getAuthSession();

  if (!session || !canReadConversations(session.perfil.rol)) {
    redirect("/dashboard");
  }

  return <ConversationsView />;
}
