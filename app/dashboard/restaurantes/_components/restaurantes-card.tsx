import Link from "next/link";
import { MiniSparkline } from "../../_components/charts";
import { getTargetProgress } from "@/lib/restaurants/reputation-math";
import {
  ACTION_PRIORITY_LABEL,
  getReputationOutlook,
  type ActionPriority,
} from "@/lib/restaurants/reputation-outlook";
import type { RestaurantOperational } from "@/lib/restaurants/types";
import { BrandMark } from "../../_components/brand-mark";
import {
  btnGhost,
  cardBase,
  cardCritical,
  cardOnTarget,
  cardWatch,
  metricCell,
  statusPill,
} from "./ui/restaurantes-styles";

type RestaurantesCardProps = {
  restaurant: RestaurantOperational;
};

const STATUS_MICROCOPY: Partial<Record<RestaurantOperational["status"], string>> = {
  watch: "Cerca del objetivo",
  critical: "Necesita atención",
};

const TREND_LABEL: Record<RestaurantOperational["trend"], string> = {
  up: "Mejorando",
  down: "Empeorando",
  flat: "Estable",
};

const TREND_TONE: Record<RestaurantOperational["trend"], string> = {
  up: "text-[var(--nexo-success)]",
  down: "text-[var(--nexo-critical)]",
  flat: "text-[var(--nexo-text-tertiary)]",
};

const TREND_COLOR_VAR: Record<RestaurantOperational["trend"], string> = {
  up: "var(--nexo-success)",
  down: "var(--nexo-critical)",
  flat: "var(--nexo-text-tertiary)",
};

function TrendArrow({ trend }: { trend: RestaurantOperational["trend"] }) {
  if (trend === "flat") {
    return (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 12h14" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg
      className={`h-3.5 w-3.5 ${trend === "down" ? "rotate-180" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MediaBlock({ media, target }: { media: number; target: number }) {
  const onTarget = media >= target;
  const progress = getTargetProgress(media, target);

  return (
    <div className={metricCell}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--nexo-text-tertiary)]">
        Media
      </p>
      <p className="mt-1 font-mono text-[26px] font-light tabular-nums text-[var(--nexo-text)]">
        {media.toFixed(1)}
      </p>
      <p className="mt-0.5 text-[11px] text-[var(--nexo-text-tertiary)]">Objetivo {target.toFixed(1)}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--nexo-inset)]">
        <div
          className={`h-full rounded-full ${onTarget ? "bg-[var(--nexo-success)]" : progress > 60 ? "bg-[var(--nexo-watch)]" : "bg-[var(--nexo-critical)]"}`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    </div>
  );
}

function EvolutionBlock({
  trend,
  sparkline,
}: {
  trend: RestaurantOperational["trend"];
  sparkline: number[];
}) {
  return (
    <div className={metricCell}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--nexo-text-tertiary)]">
        Evolución
      </p>
      <div className={`mt-1.5 flex items-center gap-1.5 ${TREND_TONE[trend]}`}>
        <TrendArrow trend={trend} />
        <span className="text-[12px] font-medium">{TREND_LABEL[trend]}</span>
      </div>
      <div className="mt-2.5">
        <MiniSparkline
          values={sparkline}
          color={TREND_COLOR_VAR[trend]}
          width={104}
          height={30}
          filled={false}
        />
      </div>
    </div>
  );
}

function SentimentBar({ positive, negative }: { positive: number; negative: number }) {
  const total = positive + negative || 1;
  const positivePct = Math.round((positive / total) * 100);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.08em]">
        <span className="text-[var(--nexo-success)]">Positivas {positive}</span>
        <span className="text-[var(--nexo-critical)]">Negativas {negative}</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-[var(--nexo-inset)]">
        <div
          className="rounded-l-full bg-[var(--nexo-success)] opacity-80"
          style={{ width: `${positivePct}%` }}
        />
        <div
          className="rounded-r-full bg-[var(--nexo-critical)] opacity-75"
          style={{ width: `${100 - positivePct}%` }}
        />
      </div>
      <p className="mt-1.5 text-right text-[10px] text-[var(--nexo-text-tertiary)]">
        {positivePct}% satisfacción
      </p>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: ActionPriority }) {
  if (priority !== "alta") return null;
  return (
    <span className="inline-flex shrink-0 items-center rounded-md border border-[var(--nexo-critical-border)] bg-[var(--nexo-critical-muted)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--nexo-critical)]">
      {ACTION_PRIORITY_LABEL[priority]}
    </span>
  );
}

function NegativeBufferPanel({ buffer }: { buffer: number }) {
  return (
    <div className="rounded-xl border border-[var(--nexo-success-border)] bg-[var(--nexo-success-muted)] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--nexo-success)]">
        Margen de seguridad
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--nexo-text-secondary)]">
        Aguanta{" "}
        <span className="font-mono text-[15px] font-medium text-[var(--nexo-success)]">{buffer}</span>{" "}
        reseñas negativas sin bajar del objetivo.
      </p>
    </div>
  );
}

function TargetPathPanel({
  needed,
  currentMedia,
  target,
  priority,
}: {
  needed: number;
  currentMedia: number;
  target: number;
  priority: ActionPriority;
}) {
  const progress = getTargetProgress(currentMedia, target);

  return (
    <div className="rounded-xl border border-[var(--nexo-accent-border)] bg-[var(--nexo-accent-muted)] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--nexo-accent)]">
          Camino al objetivo
        </p>
        <PriorityBadge priority={priority} />
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--nexo-text-secondary)]">
        Necesita{" "}
        <span className="font-mono text-[15px] font-medium text-[var(--nexo-accent)]">{needed}</span>{" "}
        reseñas positivas para entrar en objetivo.
      </p>
      <div className="mt-3">
        <div className="mb-1.5 flex justify-between text-[10px] text-[var(--nexo-text-tertiary)]">
          <span>Progreso hacia {target.toFixed(1)}</span>
          <span className="font-mono text-[var(--nexo-text-secondary)]">{progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--nexo-inset)]">
          <div
            className="h-full rounded-full bg-[var(--nexo-accent)] opacity-80"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function RestaurantesCard({ restaurant }: RestaurantesCardProps) {
  const cardTone =
    restaurant.status === "critical"
      ? cardCritical
      : restaurant.status === "watch"
        ? cardWatch
        : cardOnTarget;

  const outlook = getReputationOutlook(
    restaurant.currentMedia,
    restaurant.totalReviews,
    restaurant.status,
    restaurant.targetMedia
  );

  const isOnTarget = restaurant.status === "on_target";
  const hasBuffer = isOnTarget && restaurant.negativeBuffer > 0;
  const needsReviews = restaurant.recommendedPositiveReviews > 0;
  const microcopy = STATUS_MICROCOPY[restaurant.status];

  return (
    <Link
      href={`/dashboard/restaurantes/${restaurant.slug}`}
      aria-label={`Ver detalle de ${restaurant.name}`}
      className={`${cardBase} ${cardTone} block p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nexo-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--nexo-bg)] motion-safe:active:scale-[0.99]`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-[var(--nexo-border)] pb-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <BrandMark brand={restaurant.brand} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium tracking-tight text-[var(--nexo-text)]">
              {restaurant.name}
            </p>
            <p className="mt-0.5 truncate text-[12px] text-[var(--nexo-text-tertiary)]">
              {restaurant.location}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className={`inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${statusPill[restaurant.status]}`}
          >
            {restaurant.statusLabel}
          </span>
          {microcopy ? (
            <span className="text-[10px] text-[var(--nexo-text-tertiary)]">{microcopy}</span>
          ) : null}
          {restaurant.activeAlerts > 0 && (
            <span className="rounded-md border border-[var(--nexo-critical-border)] bg-[var(--nexo-critical-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--nexo-critical)]">
              {restaurant.activeAlerts} alerta{restaurant.activeAlerts === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MediaBlock media={restaurant.currentMedia} target={restaurant.targetMedia} />
        <EvolutionBlock trend={restaurant.trend} sparkline={restaurant.sparkline} />
      </div>

      <div className="mt-4">
        <SentimentBar positive={restaurant.positiveReviews} negative={restaurant.negativeReviews} />
      </div>

      <div className="mt-4">
        {hasBuffer ? (
          <NegativeBufferPanel buffer={restaurant.negativeBuffer} />
        ) : needsReviews ? (
          <TargetPathPanel
            needed={restaurant.recommendedPositiveReviews}
            currentMedia={restaurant.currentMedia}
            target={restaurant.targetMedia}
            priority={outlook.actionPriority}
          />
        ) : (
          <div className="rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)] px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--nexo-text-tertiary)]">
              Acción recomendada
            </p>
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-[var(--nexo-text-secondary)]">
              {restaurant.recommendedAction}
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 border-t border-[var(--nexo-border)] pt-4">
        <span aria-hidden className={`${btnGhost} pointer-events-none w-full`}>
          Ver detalle
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
