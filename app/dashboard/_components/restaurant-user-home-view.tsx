"use client";

import Link from "next/link";
import { useId, useMemo } from "react";
import {
  formatDateRangeLabel,
  formatSelectedDateShort,
  getSelectedRange,
  useDateRange,
} from "./date-range-context";
import { LineChart } from "./charts";
import { useAuth } from "./auth-context";
import { useDashboardControls } from "./dashboard-controls";
import { BrandMark } from "./brand-mark";
import { CommentExcerpt } from "./comment-excerpt";
import { PageErrorState } from "./page-error-state";
import { RestaurantWeeklyTrendCard } from "./restaurant-weekly-trend-card";
import { glass } from "./styles";
import { skeletonBlock } from "./ui/nexo-styles";
import { useRestaurantDetail } from "../restaurantes/_hooks/use-restaurant-detail";
import { healthStyles } from "../restaurantes/[slug]/_components/detail-health-styles";
import { computePreventProtectionPercent } from "@/lib/prevent/calculate";

const TENANT_ID = "grupo-hambar";

function IconCalendar() {
  return (
    <svg className="h-4 w-4 shrink-0 text-violet-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

function PreventGauge({
  value,
  label,
  inactive,
}: {
  value: number;
  label: string;
  inactive?: boolean;
}) {
  const gradientId = useId();
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative mx-auto h-[132px] w-[132px]">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9" />
        {!inactive && clamped > 0 ? (
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        ) : null}
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#A78BFA" />
            <stop offset="1" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
        {inactive || clamped <= 0 ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500">Sin escudo</p>
            <p className="mt-1 text-[11px] leading-snug text-gray-600">Sin margen de protección</p>
          </>
        ) : (
          <>
            <p className="font-mono text-[30px] font-semibold leading-none tabular-nums text-white">{clamped}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">/ 100</p>
            <p className="mt-1.5 text-[11px] font-medium text-violet-200">{label}</p>
          </>
        )}
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 28" className="h-7 w-20" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke="#A78BFA"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
}

function SentimentIcon({ sentiment }: { sentiment: "positive" | "negative" | "neutral" }) {
  const tone =
    sentiment === "positive"
      ? "text-emerald-400"
      : sentiment === "negative"
        ? "text-red-400"
        : "text-amber-300";
  return <span className={`text-lg ${tone}`}>{sentiment === "positive" ? "☺" : sentiment === "negative" ? "☹" : "😐"}</span>;
}

export function RestaurantUserHomeView() {
  const { displayName, primaryRestaurant } = useAuth();
  const { range: activeRange } = useDateRange();
  const range = useMemo(() => getSelectedRange(activeRange), [activeRange]);
  const periodLabel = formatDateRangeLabel(activeRange);
  const { openPanel } = useDashboardControls();

  const slug = primaryRestaurant?.slug ?? "";

  const { detail, loading, error, refetch } = useRestaurantDetail(slug, {
    tenantId: TENANT_ID,
    start: range.start,
    end: range.end,
  });

  if (!primaryRestaurant) {
    return (
      <PageErrorState
        title="Sin restaurante asignado"
        message="Tu perfil no tiene un local vinculado. Contacta con tu administrador para obtener acceso."
      />
    );
  }

  if (loading && !detail) {
    return (
      <div className="space-y-5 pt-2">
        <div className={`h-20 ${skeletonBlock}`} />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`h-28 ${skeletonBlock}`} />
          ))}
        </div>
        <div className="grid gap-5 xl:grid-cols-12">
          <div className={`h-72 xl:col-span-8 ${skeletonBlock}`} />
          <div className={`h-72 xl:col-span-4 ${skeletonBlock}`} />
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <PageErrorState
        title="No se pudo cargar tu restaurante"
        message={error ?? "Datos no disponibles"}
        onRetry={refetch}
      />
    );
  }

  const health = healthStyles[detail.healthStatus];
  const stats = detail.periodStats;
  const alertEvents = detail.recentActivity.filter((event) => event.type === "alert" || event.type === "warning");

  const hasShield = detail.currentMedia >= detail.targetMedia && detail.negativeBuffer > 0;
  const shieldPercent = hasShield
    ? computePreventProtectionPercent(detail.currentMedia, detail.totalReviews, detail.targetMedia)
    : 0;
  const preventLabel =
    shieldPercent >= 70 ? "Protegido" : shieldPercent >= 40 ? "Riesgo medio" : "Atención";
  const progressToTarget = Math.min(100, Math.round((detail.currentMedia / detail.targetMedia) * 100));

  return (
    <div className="pb-8">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-white lg:text-[32px]">
            Buenos días, {displayName.split(" ")[0]} <span className="text-[26px]">👋</span>
          </h1>
          <p className="mt-2 text-[14px] text-gray-400">
            Resumen de tu restaurante · {formatSelectedDateShort(range.end)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5">
            <BrandMark brand={detail.brand} size="xs" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-gray-100">{detail.name}</p>
              <p className="truncate text-[11px] text-gray-500">{detail.location}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={openPanel}
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-[12px] text-gray-300 transition hover:border-violet-400/20 hover:text-white"
          >
            <IconCalendar />
            {periodLabel}
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className={`p-5 ${glass}`}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">Media actual</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="font-mono text-[34px] font-semibold leading-none tabular-nums text-white">
              {detail.currentMedia.toFixed(2)}
            </p>
            <span className="text-[12px] text-gray-500">Objetivo {detail.targetMedia.toFixed(1)}</span>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-violet-500" style={{ width: `${progressToTarget}%` }} />
          </div>
        </div>

        <div className={`p-5 ${glass}`}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">Estado</p>
          <div className="mt-3 flex items-center gap-2.5">
            <span className={`h-2.5 w-2.5 rounded-full ${health.dot}`} />
            <p className={`text-[22px] font-semibold ${health.text}`}>{detail.statusLabel}</p>
          </div>
        </div>

        <div className={`p-5 ${glass}`}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">Reseñas del periodo</p>
          <div className="mt-3 flex items-end justify-between">
            <p className="font-mono text-[34px] font-semibold leading-none tabular-nums text-white">
              {stats.periodReviews}
            </p>
            <Sparkline values={detail.sparkline} />
          </div>
          <p className="mt-3 text-[12px] text-gray-500">
            {stats.mediaChange === "0.00" ? "Sin cambio" : `${stats.mediaChange} vs. periodo anterior`}
          </p>
        </div>

        <div className={`p-5 ${glass}`}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">Alertas activas</p>
          <p className="mt-3 font-mono text-[34px] font-semibold leading-none tabular-nums text-red-300">
            {detail.activeAlerts}
          </p>
          <p className="mt-3 text-[12px] text-gray-500">Requieren seguimiento</p>
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          <section className={`overflow-hidden border-violet-400/15 bg-gradient-to-br from-violet-500/[0.1] via-transparent to-transparent p-6 ${glass}`}>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
              <div className="flex shrink-0 flex-col items-center justify-center lg:w-[200px]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300/80">Nexo Prevent</p>
                <p className="mt-1 text-center text-[14px] font-medium text-white">Tu escudo reputacional</p>
                <div className="mt-4">
                  <PreventGauge
                    value={shieldPercent}
                    label={preventLabel}
                    inactive={!hasShield}
                  />
                </div>
              </div>

              <div className="grid flex-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500">Para alcanzar el objetivo</p>
                  <p className="mt-3 text-[28px] font-semibold tabular-nums text-white">
                    +{detail.recommendedPositiveReviews}
                  </p>
                  <p className="mt-1 text-[13px] text-gray-400">reseñas positivas necesarias</p>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500">Margen de seguridad</p>
                  <p className="mt-3 text-[28px] font-semibold tabular-nums text-white">{detail.negativeBuffer}</p>
                  <p className="mt-1 text-[13px] text-gray-400">reseñas negativas absorbibles</p>
                </div>
              </div>
            </div>

            <p className="mt-5 rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3 text-[14px] leading-relaxed text-gray-300">
              {detail.preventRecommendation}
            </p>
          </section>

          <RestaurantWeeklyTrendCard slug={slug} targetMedia={detail.targetMedia} />

          <section className="grid gap-5 lg:grid-cols-2">
            <div className={`p-5 ${glass}`}>
              <h3 className="text-[16px] font-medium text-white">Tendencia de tu media</h3>
              <p className="mt-1 text-[12px] text-gray-500">Evolución en el periodo seleccionado</p>
              <div className="relative mt-5 h-[240px]">
                {detail.chartValues.length > 0 ? (
                  <LineChart values={detail.chartValues} labels={detail.chartLabels} goalLine={detail.targetMedia} height={240} />
                ) : (
                  <div className="flex h-full items-center justify-center rounded-xl border border-white/[0.06] bg-black/20 text-sm text-gray-500">
                    Sin datos de evolución en este periodo
                  </div>
                )}
              </div>
            </div>

            <div className={`p-5 ${glass}`}>
              <h3 className="text-[16px] font-medium text-white">Principales motivos</h3>
              <p className="mt-1 text-[12px] text-gray-500">En reseñas negativas del periodo</p>
              <div className="mt-5 space-y-4">
                {detail.detectedIssues.length > 0 ? (
                  detail.detectedIssues.map((issue, index) => {
                    const colors = ["bg-red-400", "bg-orange-400", "bg-amber-400", "bg-violet-400", "bg-sky-400"];
                    return (
                      <div key={issue.id}>
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px]">
                          <span className="truncate text-gray-300">{issue.label}</span>
                          <span className="shrink-0 tabular-nums text-gray-500">{issue.intensity}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className={`h-full rounded-full ${colors[index % colors.length]}`}
                            style={{ width: `${issue.intensity}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="py-10 text-center text-[13px] text-gray-500">Sin motivos detectados en el periodo</p>
                )}
              </div>
            </div>
          </section>

          <section className={`flex flex-col gap-4 border-violet-400/20 bg-violet-500/[0.08] p-5 sm:flex-row sm:items-center sm:justify-between ${glass}`}>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-300/80">
                Acción recomendada para esta semana
              </p>
              <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-gray-200">{detail.primaryAction}</p>
            </div>
            <Link
              href={detail.alertsHref}
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-violet-600 px-5 py-3 text-[13px] font-medium text-white transition hover:bg-violet-500"
            >
              Ver acciones sugeridas
            </Link>
          </section>
        </div>

        <aside className="space-y-5 xl:col-span-4">
          <div className={`p-5 ${glass}`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[16px] font-medium text-white">Alertas activas</h3>
              <Link href={detail.alertsHref} className="text-[12px] text-violet-300 hover:text-violet-200">
                Ver todas
              </Link>
            </div>
            <div className="space-y-4">
              {alertEvents.length > 0 ? (
                alertEvents.slice(0, 4).map((event) => (
                  <div key={event.id} className="border-b border-white/[0.06] pb-4 last:border-0 last:pb-0">
                    <p className="text-[13px] font-medium text-gray-100">
                      {event.type === "alert" ? "Alerta crítica" : "Seguimiento"}
                    </p>
                    <CommentExcerpt
                      text={event.description}
                      reviewHref={event.reviewId ? `/dashboard/resenas/${event.reviewId}` : undefined}
                      maxLength={96}
                      className="mt-2 text-[12px] leading-relaxed text-gray-400"
                      quote={false}
                      readMoreLabel=" Leer más →"
                    />
                    <p className="mt-1.5 text-[11px] text-gray-500">
                      {event.occurredAt.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-[13px] text-gray-500">Sin alertas activas en el periodo</p>
              )}
            </div>
          </div>

          <div className={`p-5 ${glass}`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[16px] font-medium text-white">Últimas reseñas</h3>
              <Link href={detail.reviewsHref} className="text-[12px] text-violet-300 hover:text-violet-200">
                Ver todas
              </Link>
            </div>
            <div className="space-y-4">
              {detail.recentReviews.length > 0 ? (
                detail.recentReviews.slice(0, 4).map((review) => (
                  <div key={review.id} className="border-b border-white/[0.06] pb-4 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-gray-100">{review.author}</p>
                        <p className="mt-0.5 text-[11px] text-gray-500">
                          {review.date.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} · {review.rating}★
                        </p>
                      </div>
                      <SentimentIcon sentiment={review.sentiment} />
                    </div>
                    <CommentExcerpt
                      text={review.text}
                      reviewHref={`/dashboard/resenas/${review.id}`}
                      maxLength={88}
                      className="mt-2 text-[12px] leading-relaxed text-gray-400"
                      quote
                      readMoreLabel=" Leer más →"
                    />
                  </div>
                ))
              ) : (
                <p className="text-[13px] text-gray-500">Sin reseñas recientes</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
