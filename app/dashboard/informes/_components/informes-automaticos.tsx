"use client";

import { card, sectionPad, shell, textKicker, textTitle } from "./ui/informes-styles";

const BRAND_REPORTS = [
  { label: "Burger King", href: "/api/informes/marca?brand=Burger%20King" },
  { label: "Popeyes", href: "/api/informes/marca?brand=Popeyes" },
  { label: "Santa Gloria", href: "/api/informes/marca?brand=Santa%20Gloria" },
  { label: "Tim Hortons", href: "/api/informes/marca?brand=Tim%20Hortons" },
  { label: "Ribs", href: "/api/informes/marca?brand=Ribs" },
  { label: "Sibuya", href: "/api/informes/marca?brand=Sibuya" },
  { label: "Taberna Volapié", href: "/api/informes/marca?brand=Taberna%20Volapi%C3%A9" },
] as const;

function DocumentIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <path
        d="M14 3H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8l-4-5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 13h6M9 17h4" strokeLinecap="round" />
    </svg>
  );
}

export function InformesAutomaticos() {
  return (
    <section className={shell}>
      <div className={sectionPad + " pt-6 lg:pt-8"}>
        <p className={textKicker}>PDF automático</p>
        <h2 className={`mt-1.5 ${textTitle}`}>Informes automáticos</h2>
        <p className="mt-1 text-sm text-gray-500">
          Generación automática de informes PDF por marca
        </p>
      </div>

      <div className="border-t border-white/[0.06] px-5 pb-6 pt-5 lg:px-8 lg:pb-8 lg:pt-6">
        <p className="mb-5 max-w-2xl text-sm leading-relaxed text-gray-400">
          Genera automáticamente un informe PDF profesional con los datos reales de la marca
          seleccionada.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {BRAND_REPORTS.map((brand) => (
            <a
              key={brand.label}
              href={brand.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`${card} group relative flex items-center gap-4 overflow-hidden rounded-2xl border-violet-400/15 bg-gradient-to-br from-violet-500/[0.08] via-white/[0.02] to-purple-950/20 px-5 py-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-300/35 hover:bg-violet-500/[0.12] hover:shadow-[0_0_36px_rgba(124,58,237,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]`}
            >
              <span
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background:
                    "radial-gradient(120% 80% at 0% 0%, rgba(167,139,250,0.14), transparent 55%)",
                }}
              />

              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-400/25 bg-violet-500/15 text-violet-200 shadow-[0_0_20px_rgba(124,58,237,0.18)] transition duration-300 group-hover:border-violet-300/40 group-hover:bg-violet-500/25 group-hover:text-white group-hover:shadow-[0_0_28px_rgba(124,58,237,0.35)]">
                <DocumentIcon className="h-5 w-5" />
              </span>

              <span className="relative min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-gray-100 transition-colors duration-300 group-hover:text-white">
                  {brand.label}
                </span>
                <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-violet-300/70 transition-colors duration-300 group-hover:text-violet-200">
                  Generar PDF
                </span>
              </span>

              <span className="relative text-violet-300/50 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-violet-200">
                ↗
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
