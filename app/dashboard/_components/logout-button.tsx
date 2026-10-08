"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Link
        href="/auth/change-password"
        className="mt-3 block w-full rounded-xl px-4 py-2 text-center text-xs text-gray-400 transition hover:bg-white/[0.04] hover:text-white"
      >
        Cambiar contraseña
      </Link>
      <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="mt-1 w-full rounded-xl border border-white/10 px-4 py-2 text-xs text-gray-400 transition hover:border-red-400/30 hover:text-red-200 disabled:opacity-60"
    >
      {loading ? "Cerrando sesión…" : "Cerrar sesión"}
    </button>
    </>
  );
}
