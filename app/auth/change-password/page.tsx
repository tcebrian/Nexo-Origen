import { redirect } from "next/navigation";
import { fetchPerfilFresh } from "@/lib/auth/perfiles";
import { createClient } from "@/lib/supabase/server";
import { ChangePasswordForm } from "./change-password-form";

export const dynamic = "force-dynamic";

/**
 * Elegir una contraseña nueva. Una sola pantalla para los tres casos:
 *  - cambio OBLIGATORIO del primer acceso (el middleware envía aquí mientras `must_change_password`);
 *  - cambio voluntario desde la cuenta;
 *  - elección tras abrir el enlace de "¿Olvidaste tu contraseña?".
 * Vive fuera de /dashboard y /api, así que el middleware no la redirige (sin bucles).
 */
export default async function ChangePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?error=auth");

  const perfil = await fetchPerfilFresh(user.id);
  const forced = perfil?.mustChangePassword === true;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05030A] px-4 font-sans text-white antialiased">
      <div className="w-full max-w-md rounded-3xl border border-white/[0.1] bg-white/[0.04] p-7 backdrop-blur-xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300">Nexo Origen</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{forced ? "Elige tu contraseña" : "Cambiar contraseña"}</h1>
        <p className="mt-2 text-sm text-gray-400">
          {forced
            ? "Es tu primer acceso: antes de continuar, elige una contraseña nueva que solo conozcas tú."
            : "Elige una contraseña nueva. Úsala después para entrar en Nexo con tu email."}
        </p>
        <ChangePasswordForm canCancel={!forced} />
      </div>
    </main>
  );
}
