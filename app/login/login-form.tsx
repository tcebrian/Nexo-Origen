"use client";

import { perfilVerifyErrorMessage, verifyPerfilForUser } from "@/lib/auth/verify-perfil-client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hasSession, setHasSession] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    if (searchParams.get("error") === "perfil_rls") {
      return perfilVerifyErrorMessage("forbidden");
    }
    if (searchParams.get("error") === "perfil") {
      return perfilVerifyErrorMessage("missing");
    }
    if (searchParams.get("error") === "forbidden") {
      return "No tienes permiso para acceder a esa sección.";
    }
    if (searchParams.get("error") === "config") {
      return "El servicio no está disponible ahora mismo. Inténtalo más tarde.";
    }
    if (searchParams.get("logout") === "1") {
      return null;
    }
    return null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function prepareLogin() {
      try {
        const supabase = createClient();

        if (searchParams.get("logout") === "1") {
          await supabase.auth.signOut();
          await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
          setHasSession(false);
          return;
        }

        const { data } = await supabase.auth.getUser();
        setHasSession(Boolean(data.user));
      } catch (err) {
        console.error("[LoginForm] No se pudo inicializar Supabase", err);
        setError("El servicio de autenticación no está disponible. Inténtalo más tarde.");
      }
    }

    void prepareLogin();
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const nextPath = searchParams.get("next");
    const destination = nextPath?.startsWith("/dashboard") ? nextPath : "/dashboard";

    try {
      const trimmedEmail = email.trim();
      if (!trimmedEmail || !password) {
        setError("Email y contraseña son obligatorios.");
        return;
      }

      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (authError || !data.session || !data.user) {
        setError("Email o contraseña incorrectos.");
        return;
      }

      const perfilCheck = await verifyPerfilForUser(supabase, data.user.id);
      if (!perfilCheck.ok) {
        await supabase.auth.signOut();
        setError(perfilVerifyErrorMessage(perfilCheck.reason));
        return;
      }

      window.location.assign(destination);
    } catch {
      setError("No se pudo iniciar sesión. Comprueba tu conexión e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="mt-5 space-y-3.5 sm:mt-9 sm:space-y-5" onSubmit={handleSubmit}>
      {hasSession ? (
        <div className="rounded-xl border border-purple-300/25 bg-purple-500/10 px-4 py-3 text-center text-sm text-purple-50">
          <p>Ya tienes una sesión activa.</p>
          <Link
            href="/dashboard"
            className="mt-2 inline-block font-medium text-white underline underline-offset-2"
          >
            Ir al panel
          </Link>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-center text-sm text-red-100">
          {error}
        </p>
      ) : null}

      <div>
        <label className="mb-2 block text-sm text-gray-200/90">Email</label>

        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="ejemplo@empresa.com"
          className="w-full rounded-xl border border-white/15 bg-black/25 px-5 py-3 text-white outline-none backdrop-blur-xl transition placeholder:text-gray-400/60 focus:border-purple-300/80 focus:ring-2 focus:ring-purple-500/25 sm:py-4"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm text-gray-200/90">Contraseña</label>

        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          className="w-full rounded-xl border border-white/15 bg-black/25 px-5 py-3 text-white outline-none backdrop-blur-xl transition placeholder:text-gray-400/60 focus:border-purple-300/80 focus:ring-2 focus:ring-purple-500/25 sm:py-4"
        />

        <div className="mt-3 text-right">
          <button type="button" className="text-sm text-purple-200/85 transition hover:text-white">
            ¿Olvidaste tu contraseña?
          </button>
        </div>
      </div>

      <div className="block pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.14] bg-white/[0.08] py-3 text-[15px] font-medium text-white transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-60 sm:py-4"
        >
          {loading ? "Iniciando sesión..." : "Iniciar sesión"}
        </button>
      </div>
    </form>
  );
}
