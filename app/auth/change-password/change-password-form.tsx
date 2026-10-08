"use client";

import Link from "next/link";
import { useState } from "react";
import { MIN_PASSWORD_CHARS, validateNewPassword } from "@/lib/auth/user-creation";

const field =
  "w-full rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-white outline-none transition placeholder:text-gray-400/60 focus:border-purple-300/80 focus:ring-2 focus:ring-purple-500/25";

export function ChangePasswordForm({ canCancel }: { canCancel: boolean }) {
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
    try {
      // El servidor la guarda en Supabase Auth y solo entonces levanta el cambio obligatorio.
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(data?.error ?? "No se pudo guardar la contraseña.");
        return;
      }
      // Navegación completa: el middleware vuelve a leer el perfil ya sin el cambio pendiente.
      window.location.assign("/dashboard");
    } catch {
      setError("No se pudo guardar la contraseña.");
    } finally {
      // La contraseña no se conserva en el navegador más de lo imprescindible.
      setPassword("");
      setConfirmation("");
      setSaving(false);
    }
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
        {saving ? "Guardando…" : "Guardar contraseña"}
      </button>
      {canCancel ? (
        <Link href="/dashboard" className="block text-center text-sm text-gray-400 hover:text-white">
          Cancelar
        </Link>
      ) : null}
    </form>
  );
}
