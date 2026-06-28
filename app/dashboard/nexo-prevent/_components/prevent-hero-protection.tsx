"use client";

import { motion } from "framer-motion";
import type { PreventNetworkSummary } from "@/lib/prevent/types";
import { PREVENT_STATUS_META } from "@/lib/prevent/status";
import { AnimatedNumber } from "@/app/dashboard/_components/motion/animated-number";
import { usePrefersReducedMotion } from "@/app/dashboard/_components/motion/use-prefers-reduced-motion";
import { summaryCard } from "./ui/prevent-styles";

type PreventHeroProtectionProps = {
  summary: PreventNetworkSummary;
  periodLabel: string;
  loading?: boolean;
};

function ShieldIcon() {
  return (
    <svg className="h-16 w-16 text-violet-300" viewBox="0 0 64 64" fill="none" aria-hidden>
      <defs>
        <linearGradient id="preventShield" x1="12" y1="8" x2="52" y2="56">
          <stop stopColor="#A78BFA" />
          <stop offset="1" stopColor="#6D28D9" />
        </linearGradient>
      </defs>
      <path
        d="M32 6L10 14v16c0 14.5 9.4 28 22 28s22-13.5 22-28V14L32 6z"
        fill="url(#preventShield)"
        fillOpacity="0.9"
      />
      <path
        d="M32 6L10 14v16c0 14.5 9.4 28 22 28s22-13.5 22-28V14L32 6z"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function StatusMiniCard({
  label,
  value,
  hint,
  valueClass,
  cardClass,
  loading,
  motionClass,
}: {
  label: string;
  value: number;
  hint: string;
  valueClass: string;
  cardClass: string;
  loading?: boolean;
  motionClass?: string;
}) {
  return (
    <div className={`${summaryCard} ${cardClass} ${motionClass ?? ""} min-h-[120px]`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-600">{label}</p>
      {loading ? (
        <div className="nexo-skeleton mt-4 h-9 w-12" />
      ) : (
        <AnimatedNumber
          value={value}
          decimals={0}
          className={`mt-3 block font-mono text-[36px] font-light tabular-nums leading-none ${valueClass}`}
        />
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-gray-600">{hint}</p>
    </div>
  );
}

export function PreventHeroProtection({ summary, periodLabel, loading }: PreventHeroProtectionProps) {
  const protection = summary.networkProtectionPercent;
  const reducedMotion = usePrefersReducedMotion();

  return (
    <section className="mb-8 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="relative overflow-hidden rounded-[28px] border border-violet-400/20 bg-gradient-to-br from-violet-600/20 via-[var(--nexo-card)] to-[var(--nexo-card)] px-6 py-6 shadow-[0_24px_80px_rgba(109,40,217,0.18)] lg:px-8 lg:py-7">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-violet-500/20 blur-2xl" />
            <ShieldIcon />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200/80">
              Protección global · {periodLabel}
            </p>
            {loading ? (
              <div className="nexo-skeleton mt-4 h-14 w-28" />
            ) : (
              <p className="mt-2 font-mono text-[56px] font-light tabular-nums leading-none text-white lg:text-[64px]">
                <AnimatedNumber value={protection} decimals={0} />
                <span className="text-[28px] text-violet-200/80">%</span>
              </p>
            )}
            <p className="mt-3 max-w-md text-[14px] leading-relaxed text-[var(--nexo-text-secondary)]">
              Nivel de protección de toda tu red en el periodo seleccionado. Calculado por margen ante negativas y
              distancia al objetivo 4.4.
            </p>
            <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 via-violet-400 to-fuchsia-400"
                initial={{ width: reducedMotion ? `${Math.max(4, protection)}%` : "0%" }}
                animate={{ width: `${Math.max(4, protection)}%` }}
                transition={{ duration: reducedMotion ? 0 : 0.9, ease: [0, 0, 0.2, 1] }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
        <StatusMiniCard
          label="Protegidos"
          value={summary.protectedCount}
          hint="Margen amplio sobre 4.4"
          valueClass={PREVENT_STATUS_META.protegido.summaryValue}
          cardClass={PREVENT_STATUS_META.protegido.summaryCard}
          motionClass="nexo-prevent-protected"
          loading={loading}
        />
        <StatusMiniCard
          label="En vigilancia"
          value={summary.watchCount}
          hint="En objetivo, poco margen"
          valueClass={PREVENT_STATUS_META.vigilancia.summaryValue}
          cardClass={PREVENT_STATUS_META.vigilancia.summaryCard}
          motionClass="nexo-prevent-watch"
          loading={loading}
        />
        <StatusMiniCard
          label="Necesitan actuación"
          value={summary.outsideGoalCount}
          hint="Fuera del objetivo 4.4"
          valueClass={PREVENT_STATUS_META.fuera_objetivo.summaryValue}
          cardClass={PREVENT_STATUS_META.fuera_objetivo.summaryCard}
          motionClass="nexo-prevent-critical"
          loading={loading}
        />
      </div>
    </section>
  );
}
