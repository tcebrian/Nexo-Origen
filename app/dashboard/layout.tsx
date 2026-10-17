import { redirect } from "next/navigation";
import { AuthProvider } from "./_components/auth-context";
import { DateRangeProvider } from "./_components/date-range-context";
import { DashboardShell } from "./_components/dashboard-shell";
import { getAuthSession } from "@/lib/auth/session";
import { CHANGE_PASSWORD_PATH, isPasswordChangePending } from "@/lib/auth/password-gate";
import { COMPANY_SELECTION_PATH } from "@/lib/company/access";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  // Segunda barrera (la primera es el middleware): contraseña inicial sin cambiar.
  if (await isPasswordChangePending(session.perfil)) {
    redirect(CHANGE_PASSWORD_PATH);
  }

  // Siempre se trabaja dentro de UNA empresa: sin empresa activa válida (2 o más y ninguna elegida, o ninguna
  // permitida) se pasa por la pantalla de selección. Con una sola empresa se entra directamente.
  if (!session.activeCompany) {
    redirect(COMPANY_SELECTION_PATH);
  }

  return (
    <AuthProvider session={session}>      <DateRangeProvider>
        <DashboardShell>{children}</DashboardShell>
      </DateRangeProvider>
    </AuthProvider>
  );
}
