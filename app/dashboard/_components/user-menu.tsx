"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "./auth-context";
import { useLogout } from "./use-logout";

/**
 * Bloque de usuario fijo al pie del menú lateral (y de la hoja "Más" en móvil).
 * Muestra inicial, nombre y rol; al pulsarlo abre hacia arriba un menú con
 * "Cambiar contraseña" y "Cerrar sesión". Se cierra con clic fuera, Escape o al navegar.
 */
export function UserMenu() {
  const { displayName, roleLabel, initials } = useAuth();
  const { logout, loading } = useLogout();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Cuenta"
          className="absolute inset-x-0 bottom-full z-50 mb-2 overflow-hidden rounded-xl border border-white/[0.1] bg-[#0d0a14]/98 p-1 shadow-2xl backdrop-blur-xl"
        >
          <Link
            href="/auth/change-password"
            role="menuitem"
            className="flex w-full items-center rounded-lg px-3 py-2.5 text-sm text-gray-300 transition hover:bg-white/[0.06] hover:text-white"
          >
            Cambiar contraseña
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => void logout()}
            disabled={loading}
            className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm text-gray-300 transition hover:bg-red-500/10 hover:text-red-200 disabled:opacity-60"
          >
            {loading ? "Cerrando sesión…" : "Cerrar sesión"}
          </button>
        </div>
      ) : null}

      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.05] ${open ? "bg-white/[0.05]" : ""}`}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-purple-300/40 bg-purple-500/10 text-xs font-semibold text-purple-100">
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{displayName}</span>
          <span className="block truncate text-xs text-gray-500">{roleLabel}</span>
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? "" : "rotate-180"}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m6 15 6-6 6 6" />
        </svg>
      </button>
    </div>
  );
}
