"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MIN_PASSWORD_CHARS, validateNewPassword } from "@/lib/auth/user-creation";

const field =
  "w-full rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-white outline-none transition placeholder:text-gray-400/60 focus:border-purple-300/80 focus:ring-2 focus:ring-purple-500/25";

export function SetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    const check = validateNewPassword(password, confirmation);
    if (!check.ok) {
      setError(check.error);
      return;
    }

    setSaving(true);
    setError(null);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    if (updateError) {
      setError("No se pudo guardar la contraseña. Pide un enlace nuevo.");
      setSaving(false);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label className="block text-sm text-gray-300">
        Nueva contraseña
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={`Mínimo ${MIN_PASSWORD_CHARS} caracteres`}
          className={`${field} mt-1.5`}
        />
      </label>
      <label className="block text-sm text-gray-300">
        Repite la contraseña
        <input
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className={`${field} mt-1.5`}
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl border border-white/[0.14] bg-white/[0.08] py-3 text-[15px] font-medium text-white transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Guardando…" : "Guardar contraseña y entrar"}
      </button>
    </form>
  );
}
