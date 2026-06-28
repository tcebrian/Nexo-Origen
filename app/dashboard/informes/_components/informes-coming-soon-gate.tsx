"use client";

import type { ReactNode } from "react";

type InformesComingSoonGateProps = {
  children: ReactNode;
};

export function InformesComingSoonGate({ children }: InformesComingSoonGateProps) {
  return (
    <div className="relative min-h-[calc(100vh-10rem)]">
      <div className="pointer-events-none select-none" aria-hidden>
        <div className="overflow-hidden rounded-2xl border border-white/[0.05]">
          <div className="w-1/4 origin-top-left scale-[4] opacity-55 [image-rendering:pixelated]">
            <div className="w-[400%] origin-top-left scale-[0.25]">{children}</div>
          </div>
        </div>
        <div className="absolute inset-0 rounded-2xl bg-[#05030A]/55 backdrop-blur-[1px]" />
      </div>

      <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
        <div className="relative w-full max-w-md text-center">
          <div className="pointer-events-none absolute -inset-8 rounded-full bg-violet-600/20 blur-3xl" />

          <div className="relative overflow-hidden rounded-2xl border border-violet-400/30 bg-[#0a0812]/95 px-8 py-10 shadow-[0_24px_80px_rgba(0,0,0,0.55),0_0_60px_rgba(124,58,237,0.15)] backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.14),transparent_60%)]" />

            <div className="relative">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/25 bg-violet-500/10 text-2xl">
                📊
              </div>

              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300/80">
                Centro de informes
              </p>

              <h2 className="mt-3 text-3xl font-medium tracking-tight text-white">Próximamente</h2>

              <p className="mx-auto mt-4 max-w-xs text-sm leading-relaxed text-gray-400">
                Los informes ejecutivos en PDF con diseño por marca estarán disponibles muy pronto.
              </p>

              <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[11px] text-gray-500">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
                En desarrollo
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
