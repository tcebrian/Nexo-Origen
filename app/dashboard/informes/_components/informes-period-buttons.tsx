"use client";

import Link from "next/link";
import { card, shell, textKicker, textTitle } from "./ui/informes-styles";

const PERIODS = [
  {
    slug: "semanal",
    label: "Informes semanales",
    description: "Rendimiento de la última semana, marca por marca.",
  },
  {
    slug: "mensual",
    label: "Informes mensuales",
    description: "Rendimiento del último mes, marca por marca.",
  },
  {
    slug: "trimestral",
    label: "Informes trimestrales",
    description: "Rendimiento del último trimestre, marca por marca.",
  },
] as const;

function CalendarIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 3v4M16 3v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

export function InformesPeriodButtons() {
  return (
    <section className={shell}>
      <div className="p-5 pt-6 lg:p-8 lg:pt-8">
        <p className={textKicker}>Informes automáticos</p>
        <h2 className={`mt-1.5 ${textTitle}`}>Elige el periodo</h2>
        <p className="mt-1 text-sm text-gray-500">
          Cada informe incluye el PDF individual por restaurante y una imagen PNG comparando toda la red de la marca.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {PERIODS.map((period) => (
            <Link
              key={period.slug}
              href={`/dashboard/informes/${period.slug}`}
              className={`${card} group relative flex flex-col gap-3 overflow-hidden rounded-2xl border-violet-400/15 bg-gradient-to-br from-violet-500/[0.08] via-white/[0.02] to-purple-950/20 px-5 py-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-300/35 hover:bg-violet-500/[0.12] hover:shadow-[0_0_36px_rgba(124,58,237,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]`}
            >
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-400/25 bg-violet-500/15 text-violet-200 shadow-[0_0_20px_rgba(124,58,237,0.18)] transition duration-300 group-hover:border-violet-300/40 group-hover:bg-violet-500/25 group-hover:text-white group-hover:shadow-[0_0_28px_rgba(124,58,237,0.35)]">
                <CalendarIcon className="h-5 w-5" />
              </span>
              <span className="relative">
                <span className="block text-[15px] font-medium text-gray-100 transition-colors duration-300 group-hover:text-white">
                  {period.label}
                </span>
                <span className="mt-1 block text-[13px] leading-relaxed text-gray-500">{period.description}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
