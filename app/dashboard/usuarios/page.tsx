import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/session";
import { isSuperAdmin, normalizeRole } from "@/lib/auth/permissions";
import { UsersView } from "./users-view";

export const dynamic = "force-dynamic";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ user?: string }> }) {
  const session = await getAuthSession();

  if (!session || !isSuperAdmin(normalizeRole(session.perfil.rol))) {
    redirect("/dashboard");
  }

  const { user } = await searchParams;
  return <UsersView initialUserId={typeof user === "string" ? user : null} />;
}
