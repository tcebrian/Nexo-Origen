"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  formatDateRangeLabel,
  formatSelectedDateShort,
  getDaysInRange,
  getSelectedRange,
  useDateRange,
} from "./_components/date-range-context";
import { DonutChart, HorizontalBarChart, LineChart } from "./_components/charts";
import { KpiStrip, type KpiStripItem } from "./_components/kpi-strip";
import { PageHeader } from "./_components/page-header";
import { AnimatedNumber } from "./_components/motion/animated-number";
import { PageErrorState } from "./_components/page-error-state";
import { glass } from "./_components/styles";
import { skeletonBlock } from "./_components/ui/nexo-styles";
import { CommentExcerpt } from "./_components/comment-excerpt";
import { MediaImpactDisplay } from "./_components/media-impact-display";
import { StaggerItem, StaggerList } from "./_components/motion/stagger";
import { MotionLink } from "./_components/motion/motion-link";
import { RestaurantBrandLine } from "./_components/restaurant-brand-line";
import { useDashboardData } from "./_hooks/use-dashboard-data";
import { formatAlertTime } from "@/lib/dashboard/format-alert-time";
import { getReviewHref } from "@/lib/text/excerpt";

const marcaHex: Record<string, string> = {
  "Burger King": "#7C3AED",
  Popeyes: "#F97316",
  "Santa Gloria": "#10B981",
  "Tim Hortons": "#3B82F6",
  Vault: "#F8E914",
  Otros: "#6B7280",
};
import { useAuth } from "./_components/auth-context";
import { RestaurantUserHomeView } from "./_components/restaurant-user-home-view";

function HomeKpiIcon({ type }: { type: "star" | "chat" | "warning" | "store" }) {
  const className = "h-4 w-4";

  if (type === "star") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l2.09 6.26L20.5 9.27l-5 3.64L16.82 20 12 16.77 7.18 20l1.32-7.09-5-3.64 6.41-.99L12 2z" />
      </svg>
    );
  }

  if (type === "chat") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
      </svg>
    );
  }

  if (type === "warning") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

export function DashboardHomeView() {
  const { primaryRestaurant } = useAuth();

  // Perfiles con un único restaurante (restaurante_user, o un cliente con un solo
  // local) usan la vista compacta de restaurante en vez del panel de red.
  if (primaryRestaurant) {
    return <RestaurantUserHomeView />;
  }

  return <NetworkDashboardHomeView />;
}

function NetworkDashboardHomeView() {
  const { displayName, empresaNombre } = useAuth();
  const { range: activeRange } = useDateRange();
  const range = useMemo(() => getSelectedRange(activeRange), [activeRange]);
  const days = useMemo(
    () => getDaysInRange({ start: range.start, end: range.end, source: "calendar" }),
    [range]
  );

  const { data, loading, refreshing, error, refetch } = useDashboardData(range.start, range.end);

  const showFullSkeleton = loading && data.totalRestaurantes === 0 && !error;

  if (showFullSkeleton) {
    return (
      <div className="space-y-5 pt-2">
        <div className={`h-24 ${skeletonBlock}`} />
        <div className={`h-28 ${skeletonBlock}`} />
        <div className={`h-80 ${skeletonBlock}`} />
      </div>
    );
  }

  if (error) {
    return (
      <PageErrorState
        title="No se pudo cargar el inicio"
        message={error}
        onRetry={refetch}
      />
    );
  }

  const donutSegments = data.distribucionMarca.map((item) => ({
    value: item.porcentaje,
    color: marcaHex[item.marca] ?? "#6B7280",
    label: item.marca,
  }));

  const kpiItems: KpiStripItem[] = [
    {
      key: "media",
      label: "Media global",
      value: <AnimatedNumber value={data.mediaGlobal} decimals={2} />,
      hint: "Media ponderada de la red",
      tone: data.mediaGlobal >= 4.4 ? "success" : data.mediaGlobal > 0 ? "critical" : "neutral",
      topRight: <HomeKpiIcon type="star" />,
    },
    {
      key: "resenas",
      label: "Reseñas este mes",
      value: <AnimatedNumber value={data.totalResenas} decimals={0} />,
      hint: "Total acumulado en la red",
      tone: "neutral",
      topRight: <HomeKpiIcon type="chat" />,
    },
    {
      key: "negativas",
      label: "Reseñas negativas",
      value: <AnimatedNumber value={data.totalNegativas} decimals={0} />,
      hint: "Suma de reseñas negativas",
      tone: data.totalNegativas === 0 ? "success" : "critical",
      topRight: <HomeKpiIcon type="warning" />,
    },
    {
      key: "restaurantes",
      label: "Restaurantes",
      value: <AnimatedNumber value={data.totalRestaurantes} decimals={0} />,
      hint: `${data.totalRestaurantes} locales en ${empresaNombre}`,
      tone: "neutral",
      topRight: <HomeKpiIcon type="store" />,
    },
  ];

  return (
    <>
      {refreshing && (
        <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
          Actualizando datos…
        </div>
      )}
      <PageHeader
        title={`Buenos días, ${displayName} 👋`}
        subtitle={`Resumen de ${empresaNombre} · ${formatDateRangeLabel(activeRange)}`}
        action={
          <div className="flex items-center gap-2 rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-inset)] px-3.5 py-2 text-[12px] text-[var(--nexo-text-secondary)]">
            <span className="h-2 w-2 rounded-full bg-[var(--nexo-success)]" />
            <span>
              {days} días · hasta {formatSelectedDateShort(range.end)}
            </span>
          </div>
        }
      />

      <KpiStrip items={kpiItems} />

      <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className={`p-5 xl:col-span-8 ${glass}`}>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Evolución de la media global</h3>
              <div className="mt-3 flex items-center gap-5 text-xs text-gray-400">
                <span className="flex items-center gap-2">
                  <span className="h-0.5 w-5 bg-purple-400" />
                  Media real
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-0.5 w-5 border-t border-dashed border-emerald-400" />
                  Objetivo 4.40
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-right">
              <p className="text-[10px] uppercase tracking-[0.08em] text-violet-300/70">Periodo</p>
              <p className="text-xs text-violet-100">{days} días</p>
            </div>
          </div>

          <div className="relative h-[280px]">
            {data.chartPending ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-white/[0.06] bg-black/20 text-sm text-gray-500">
                Evolución histórica pendiente de activar
              </div>
            ) : (
              <LineChart
                values={data.chartValues}
                labels={data.chartLabels}
                goalLine={4.4}
                height={280}
              />
            )}
            {!data.chartPending && (
              <div className="pointer-events-none absolute right-4 top-4 rounded-xl border border-white/[0.08] bg-black/60 px-4 py-3 backdrop-blur-xl">
                <p className="text-base font-medium tabular-nums">{data.mediaGlobal.toFixed(2)}</p>
                <p className="text-xs text-gray-500">{formatSelectedDateShort(range.end)}</p>
              </div>
            )}
          </div>
        </div>

        <div className={`p-5 xl:col-span-4 ${glass}`}>
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-medium">Últimas alertas</h3>
            <Link href="/dashboard/alertas" className="text-xs text-purple-300 transition hover:text-purple-200">
              Ver todas
            </Link>
          </div>

          <div className="space-y-4">
            {data.alertas.length > 0 ? (
              <StaggerList className="space-y-4">
                {data.alertas.map((alerta) => (
                  <StaggerItem key={alerta.reviewId ?? `${alerta.restaurante}-${alerta.ultima_resena}`}>
                    <div className="border-b border-white/[0.08] pb-4 last:border-0">
                  <div className="flex gap-4">
                    <div className={`mt-1 h-2.5 w-2.5 rounded-full ${alerta.color}`} />
                    <div className="flex-1">
                      <div className="flex justify-between gap-4">
                        <div>
                          <Link
                            href={`/dashboard/restaurantes/${alerta.slug}`}
                            className="transition hover:opacity-90"
                          >
                            <RestaurantBrandLine
                              brand={alerta.brand}
                              name={alerta.restaurante}
                              logoSize="xs"
                              nameClassName="truncate text-sm font-medium text-gray-100 transition group-hover:text-violet-200"
                            />
                          </Link>
                          <p className="text-xs text-gray-500">
                            {formatAlertTime(alerta.ultima_resena)}
                            {alerta.estrellas > 0 ? ` · ${alerta.estrellas}★` : ""}
                            {alerta.motivoPrincipal ? ` · ${alerta.motivoPrincipal}` : ""}
                          </p>
                        </div>
                        <MediaImpactDisplay
                          align="right"
                          compact
                          snapshot={{
                            mediaBefore: alerta.mediaBefore,
                            mediaAfter: alerta.mediaAfter,
                            impact: alerta.impacto,
                          }}
                        />
                      </div>
                      <CommentExcerpt
                        text={alerta.texto ?? "Sin comentario"}
                        reviewHref={alerta.reviewId ? getReviewHref(alerta.reviewId) : undefined}
                        maxLength={140}
                        className="mt-2 text-xs leading-relaxed text-gray-400"
                      />
                    </div>
                  </div>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerList>
            ) : (
              <p className="text-xs text-gray-500">Sin datos</p>
            )}
          </div>

          <MotionLink
            href="/dashboard/alertas"
            className="mt-4 inline-block text-xs text-purple-300 transition hover:text-purple-200"
            showArrow
          >
            Ver todas las alertas
          </MotionLink>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-12">
        <Panel
          className="xl:col-span-4"
          title="Restaurantes en riesgo"
          actionHref="/dashboard/restaurantes"
          actionLabel="Ver todos"
        >
          <div className="mt-4 space-y-2.5">
            {data.restaurantesRiesgo.length > 0 ? (
              data.restaurantesRiesgo.map((restaurant) => (
                <Link
                  key={restaurant.restaurante}
                  href={`/dashboard/restaurantes/${restaurant.slug}`}
                  className="grid grid-cols-[1fr_50px_86px] items-center gap-3 rounded-xl bg-black/20 px-3 py-2.5 transition hover:bg-white/[0.04]"
                >
                  <RestaurantBrandLine
                    brand={restaurant.brand}
                    name={restaurant.restaurante}
                    logoSize="xs"
                    nameClassName="truncate text-xs text-gray-200"
                  />
                  <span className="text-xs text-gray-300">{restaurant.media_total.toFixed(1)}</span>
                  <span
                    className={`rounded-lg px-2 py-1 text-center text-[11px] ${restaurant.bg} ${restaurant.color}`}
                  >
                    {restaurant.estado}
                  </span>
                </Link>
              ))
            ) : (
              <p className="text-xs text-gray-500">Sin datos</p>
            )}
          </div>
        </Panel>

        <Panel className="xl:col-span-3" title="Ranking de restaurantes">
          <div className="mt-4 space-y-3.5">
            {data.ranking.length > 0 ? (
              data.ranking.map((item) => (
                <Link
                  key={item.position}
                  href={`/dashboard/restaurantes/${item.slug}`}
                  className="flex items-center justify-between rounded-lg px-1 py-1 transition hover:bg-white/[0.03]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] text-gray-300">
                      {item.position}
                    </span>
                    <RestaurantBrandLine
                      brand={item.brand}
                      name={item.restaurante}
                      logoSize="xs"
                      nameClassName="truncate text-xs text-gray-200"
                    />
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium">{item.media_total.toFixed(1)}</p>
                    <p className="text-[11px] text-gray-500">{item.marca}</p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-xs text-gray-500">Sin datos</p>
            )}
          </div>
          <Link
            href="/dashboard/ranking"
            className="mt-5 inline-block text-xs text-purple-300 transition hover:text-purple-200"
          >
            Ver ranking completo →
          </Link>
        </Panel>

        <Panel className="xl:col-span-3" title="Distribución por marca">
          <div className="mt-5 flex items-center gap-5">
            {donutSegments.length > 0 ? (
              <>
                <DonutChart segments={donutSegments} size={132} centerSub="Marcas" />
                <div className="flex-1 space-y-2.5">
                  {data.distribucionMarca.map((item) => (
                    <div key={item.marca} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-gray-400">
                        <span className={`h-2 w-2 rounded-full ${item.color}`} />
                        {item.marca}
                      </span>
                      <span>{item.porcentaje}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-500">Sin datos</p>
            )}
          </div>
          <Link
            href="/dashboard/nexo-prevent"
            className="mt-5 inline-block text-xs text-purple-300 transition hover:text-purple-200"
          >
            Abrir Nexo Prevent →
          </Link>
        </Panel>

        <Panel className="xl:col-span-2" title="Resumen IA">
          <div className="mt-4 rounded-2xl bg-black/25 p-4 text-xs leading-relaxed text-gray-300">
            {data.resumenIA}
          </div>

          <Link
            href="/dashboard/informes"
            className="mt-4 block w-full rounded-xl border border-purple-400/25 bg-purple-500/10 py-2.5 text-center text-xs text-purple-100 transition hover:bg-purple-500/20"
          >
            Ver informe completo ▣
          </Link>
        </Panel>
      </section>

      {data.problemDistribution.length > 0 ? (
        <section className={`mt-5 p-5 ${glass}`}>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Motivos principales</h3>
              <p className="mt-1 text-xs text-gray-500">
                Clasificación automática desde análisis IA en reseñas negativas
              </p>
            </div>
            <Link href="/dashboard/resenas" className="text-xs text-purple-300 transition hover:text-purple-200">
              Ver reseñas
            </Link>
          </div>
          <HorizontalBarChart
            items={data.problemDistribution.slice(0, 6).map((item) => ({
              label: item.label,
              value: item.percent,
            }))}
          />
        </section>
      ) : null}
    </>
  );
}

function Panel({
  title,
  actionHref,
  actionLabel,
  children,
  className,
}: {
  title: string;
  actionHref?: string;
  actionLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`p-5 ${glass} ${className ?? ""}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">{title}</h3>
        {actionHref && actionLabel && (
          <Link href={actionHref} className="text-xs text-purple-300 transition hover:text-purple-200">
            {actionLabel}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}
