"use client";

import { useState } from "react";
import { formatCompanyAverage, type CompanyCard } from "@/lib/company/cards";

/** Una tarjeta por empresa: SOLO el nombre y la media global. Toda la tarjeta es el botón. */
export function CompanyPicker({ cards, activeId }: { cards: CompanyCard[]; activeId: number | null }) {
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(id: number) {
    if (pending !== null) return;
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
        setError(data?.error ?? "No se pudo seleccionar la empresa");
        setPending(null);
        return;
      }
      // Recarga completa: el servidor ya conoce la empresa y no queda ningún dato de otra en memoria.
      window.location.assign("/dashboard");
    } catch {
      setError("No se pudo seleccionar la empresa");
      setPending(null);
    }
  }

  return (
    <div>
      <ul className="grid gap-5 sm:grid-cols-2">
        {cards.map((card) => (
          <li key={card.id}>
            <button
              type="button"
              onClick={() => void choose(card.id)}
              disabled={pending !== null}
              aria-label={`${card.name}, media ${formatCompanyAverage(card.average)}`}
              aria-current={activeId === card.id ? "true" : undefined}
              className="group relative flex h-full min-h-[190px] w-full flex-col items-center justify-center gap-5 overflow-hidden rounded-3xl border border-white/[0.1] bg-white/[0.03] px-6 py-10 text-center shadow-[0_8px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl transition duration-300 hover:-translate-y-0.5 hover:border-violet-400/50 hover:bg-white/[0.05] hover:shadow-[0_0_44px_rgba(124,58,237,0.28)] focus-visible:border-violet-300/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 disabled:cursor-wait disabled:opacity-70"
            >
              <span className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/50 to-transparent opacity-0 transition group-hover:opacity-100" />
              <span className="text-lg font-semibold uppercase tracking-[0.18em] text-white sm:text-xl">{card.name}</span>
              <span className="text-3xl font-light tabular-nums text-violet-100">
                {formatCompanyAverage(card.average)} <span aria-hidden>⭐</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="mt-6 text-center text-sm text-rose-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
