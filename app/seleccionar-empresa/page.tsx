import Link from "next/link";
import { redirect } from "next/navigation";
import { NexoOrigenWordmark } from "@/app/_components/nexo-brand";
import { DashboardAmbient } from "@/app/dashboard/_components/dashboard-ambient";
import { CHANGE_PASSWORD_PATH, isPasswordChangePending } from "@/lib/auth/password-gate";
import { getAuthSessionWithCompanies } from "@/lib/auth/session";
import { loadCompanyCards } from "@/lib/company/cards.server";
import { CompanyPicker } from "./company-picker";

export const dynamic = "force-dynamic";

/**
 * Selección de empresa (después del login). Fuera de /dashboard para no cargar el menú lateral.
 *  - 1 empresa → entra directamente al dashboard.
 *  - 2 o más → una tarjeta por empresa permitida, con su media global real (motor canónico).
 *  - ninguna → aviso (deny by default).
 * Las empresas salen de la base de datos y de los permisos reales del usuario; nada está escrito en el código.
 */
export default async function SelectCompanyPage() {
  const loaded = await getAuthSessionWithCompanies();
  if (!loaded) redirect("/login");
  const { session, company } = loaded;

  if (await isPasswordChangePending(session.perfil)) redirect(CHANGE_PASSWORD_PATH);
  if (session.companies.length === 1) redirect("/dashboard");

  const cards = session.companies.length > 1 ? await loadCompanyCards(company) : [];

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#05030A] px-4 py-10 font-sans text-white antialiased">
      <DashboardAmbient />
      <div className="relative z-10 w-full max-w-4xl">
        <NexoOrigenWordmark size="md" align="center" variant="dashboard" className="mx-auto mb-10 px-2" />
        {session.companies.length === 0 ? (
          <div className="mx-auto max-w-md rounded-3xl border border-white/[0.1] bg-white/[0.04] p-8 text-center backdrop-blur-xl">
            <h1 className="text-xl font-semibold tracking-tight">Sin empresas asignadas</h1>
            <p className="mt-2 text-sm text-gray-400">Tu cuenta todavía no tiene ninguna empresa asignada. Contacta con tu administrador.</p>
            <Link href="/logout" className="mt-6 inline-block text-xs text-violet-300 transition hover:text-violet-200">
              Cerrar sesión
            </Link>
          </div>
        ) : (
          <>
            <h1 className="mb-10 text-center text-3xl font-light tracking-tight sm:text-4xl">Selecciona tu empresa</h1>
            <CompanyPicker cards={cards} activeId={session.activeCompany?.id ?? null} />
          </>
        )}
      </div>
    </main>
  );
}
