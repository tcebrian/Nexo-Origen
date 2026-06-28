import type { ReactNode } from "react";
import type { TalentoSummary, TalentoSummaryTrends } from "@/lib/talento/types";
import { EmployeeIllustrationAvatar } from "./employee-illustration-avatar";
import {
  talentoKpiAccent,
  talentoKpiCard,
  trendDown,
  trendUp,
} from "./ui/talento-styles";

type TalentoSummaryProps = {
  summary: TalentoSummary;
  trends: TalentoSummaryTrends;
  loading?: boolean;
};

function TrendPill({ delta, invert = false }: { delta: number; invert?: boolean }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-[10px] text-gray-500">
        Sin cambio vs. periodo anterior
      </span>
    );
  }

  const positive = invert ? delta < 0 : delta > 0;
  const sign = delta > 0 ? "+" : "";
  const tone = positive ? trendUp : trendDown;
  const arrow = delta > 0 ? "↑" : "↓";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-[10px] font-medium tabular-nums ${tone}`}
    >
      <span aria-hidden>{arrow}</span>
      {sign}
      {delta} vs. periodo anterior
    </span>
  );
}

function KpiIcon({ children, tint }: { children: ReactNode; tint?: string }) {
  return (
    <div
      className={`flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] ${tint ?? "text-violet-300"}`}
    >
      {children}
    </div>
  );
}

function Card({
  label,
  value,
  trend,
  loading,
  accent,
  icon,
  invertTrend,
  iconTint,
}: {
  label: string;
  value: string | number;
  trend?: number;
  loading?: boolean;
  accent?: string;
  icon: ReactNode;
  invertTrend?: boolean;
  iconTint?: string;
}) {
  return (
    <div className={talentoKpiCard}>
      <div className={talentoKpiAccent} />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-600">
          {label}
        </p>
        <KpiIcon tint={iconTint}>{icon}</KpiIcon>
      </div>
      {loading ? (
        <div className="mt-5 h-10 w-20 animate-pulse rounded-lg bg-white/[0.04]" />
      ) : (
        <p
          className={`mt-5 font-mono text-[30px] font-light tabular-nums leading-none tracking-tight sm:text-[34px] ${accent ?? "text-white"}`}
        >
          {value}
        </p>
      )}
      {trend != null && !loading && (
        <div className="mt-4">
          <TrendPill delta={trend} invert={invertTrend} />
        </div>
      )}
    </div>
  );
}

export function TalentoSummaryBar({ summary, trends, loading }: TalentoSummaryProps) {
  return (
    <section className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card
        label="Empleados mencionados"
        value={summary.employeesMentioned}
        trend={trends.employeesMentionedDelta}
        loading={loading}
        icon={
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
          </svg>
        }
      />
      <Card
        label="Menciones positivas"
        value={summary.positiveMentions}
        trend={trends.positiveMentionsDelta}
        loading={loading}
        accent="text-emerald-400"
        iconTint="text-emerald-400"
        icon={
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" strokeLinecap="round" />
            <circle cx="9" cy="9" r="0.5" fill="currentColor" />
            <circle cx="15" cy="9" r="0.5" fill="currentColor" />
          </svg>
        }
      />
      <Card
        label="Menciones negativas"
        value={summary.negativeMentions}
        trend={trends.negativeMentionsDelta}
        loading={loading}
        accent="text-orange-400"
        iconTint="text-orange-400"
        invertTrend
        icon={
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="9" />
            <path d="M16 16s-1.5-2-4-2-4 2-4 2" strokeLinecap="round" />
            <circle cx="9" cy="9" r="0.5" fill="currentColor" />
            <circle cx="15" cy="9" r="0.5" fill="currentColor" />
          </svg>
        }
      />
      <div className={talentoKpiCard}>
        <div className={talentoKpiAccent} />
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-600">
            Empleado más mencionado
          </p>
          <KpiIcon>
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6L5.7 21l2.3-7-6-4.6h7.6z" />
            </svg>
          </KpiIcon>
        </div>
        {loading ? (
          <div className="mt-5 h-12 w-32 animate-pulse rounded-lg bg-white/[0.04]" />
        ) : summary.topMentionedEmployee ? (
          <div className="mt-5 flex items-center gap-3.5">
            <EmployeeIllustrationAvatar
              seed={summary.topMentionedEmployee.id}
              size="md"
              highlight
            />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-violet-200">
                {summary.topMentionedEmployee.name}
              </p>
              <p className="mt-1 font-mono text-[12px] tabular-nums text-gray-500">
                {summary.topMentionedEmployee.mentions} menciones
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-5 text-[15px] text-gray-500">—</p>
        )}
      </div>
    </section>
  );
}
