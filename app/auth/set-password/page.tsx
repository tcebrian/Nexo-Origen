import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetPasswordForm } from "./set-password-form";

export const dynamic = "force-dynamic";

/** Elegir la contraseña tras abrir un enlace de alta o restablecimiento (requiere la sesión que abre `/auth/confirm`). */
export default async function SetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?error=auth");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05030A] px-4 font-sans text-white antialiased">
      <div className="w-full max-w-md rounded-3xl border border-white/[0.1] bg-white/[0.04] p-7 backdrop-blur-xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300">Nexo Origen</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Elige tu contraseña</h1>
        <p className="mt-2 text-sm text-gray-400">Úsala después para entrar en Nexo con tu email.</p>
        <SetPasswordForm />
      </div>
    </main>
  );
}
