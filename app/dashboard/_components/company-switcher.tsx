"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "./auth-context";

/**
 * Selector discreto de empresa (solo si el usuario tiene acceso a 2 o más). Las empresas vienen del servidor,
 * ya filtradas por sus permisos. Cambiar de empresa pide al servidor que la valide y la guarde, y recarga el
 * dashboard completo para que ningún dato de la empresa anterior quede en pantalla.
 */
export function CompanySwitcher() {
  const { companies, activeCompany } = useAuth();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

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

  async function choose(id: number) {
    if (id === activeCompany?.id) {
      setOpen(false);
      return;
    }
    setPending(id);
    setError(null);
    try {
      const response = await fetch("/api/company/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: id }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "No se pudo cambiar de empresa");
        setPending(null);
        return;
      }
      window.location.assign("/dashboard");
    } catch {
      setError("No se pudo cambiar de empresa");
      setPending(null);
    }
  }

  if (companies.length < 2) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className="flex w-full items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-left transition hover:border-violet-400/30 hover:bg-white/[0.05]"
      >
        <span aria-hidden>🏢</span>
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-gray-200">{activeCompany?.name ?? "Elegir empresa"}</span>
        <span aria-hidden className={`text-[10px] text-gray-500 transition ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Empresas"
          className="absolute left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-xl border border-white/[0.1] bg-[#12101a]/95 p-1 shadow-2xl backdrop-blur-xl"
        >
          {companies.map((company) => {
            const selected = company.id === activeCompany?.id;
            return (
              <li key={company.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => void choose(company.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[12px] transition ${
                    selected ? "bg-violet-500/15 text-white" : "text-gray-300 hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  <span className="truncate">{company.name}</span>
                  {selected ? <span aria-hidden className="text-violet-300">✓</span> : null}
                </button>
              </li>
            );
          })}
          {error ? (
            <li role="alert" className="px-3 py-2 text-[11px] text-rose-300">
              {error}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
