import Link from "next/link";
import { getTargetProgress } from "@/lib/restaurants/reputation-math";
import type { RestaurantOperational } from "@/lib/restaurants/types";
import { RestaurantBrandLine } from "../../_components/restaurant-brand-line";
import {
  btnGhost,
  cardBase,
  cardCritical,
  cardNeutral,
  cardWatch,
  metricCell,
  statusPill,
} from "./ui/restaurantes-styles";

type RestaurantesCardProps = {
  restaurant: RestaurantOperational;
};

function MediaBlock({ media, target }: { media: number; target: number }) {
  const onTarget = media >= target;
  const progress = getTargetProgress(media, target);

  return (
    <div className={metricCell}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--nexo-text-tertiary)]">
        Media
      </p>
      <p className="mt-1 font-mono text-[28px] font-light tabular-nums text-[var(--nexo-text)]">
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

function NegativeBufferPanel({ buffer }: { buffer: number }) {
  return (
    <div className="rounded-xl border border-[var(--nexo-success-border)] bg-[var(--nexo-success-muted)] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--nexo-success)]">
        Margen de seguridad
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--nexo-text-secondary)]">
        Aguanta{" "}
        <span className="font-mono text-[15px] font-medium text-[var(--nexo-success)]">{buffer}</span>{" "}
        reseñas
        negativas sin bajar del objetivo.
      </p>
    </div>
  );
}

function TargetPathPanel({
  needed,
  currentMedia,
  target,
}: {
  needed: number;
  currentMedia: number;
  target: number;
}) {
  const progress = getTargetProgress(currentMedia, target);

  return (
    <div className="rounded-xl border border-[var(--nexo-accent-border)] bg-[var(--nexo-accent-muted)] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--nexo-accent)]">
        Camino al objetivo
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--nexo-text-secondary)]">
        Necesita{" "}
        <span className="font-mono text-[15px] font-medium text-[var(--nexo-accent)]">{needed}</span>{" "}
        reseñas
        positivas para entrar en objetivo.
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
        : cardNeutral;

  const isOnTarget = restaurant.status === "on_target";
  const hasBuffer = isOnTarget && restaurant.negativeBuffer > 0;
  const needsReviews = restaurant.recommendedPositiveReviews > 0;

  return (
    <article className={`${cardBase} ${cardTone} flex flex-col p-6`}>
      <div className="relative border-b border-[var(--nexo-border)] pb-4">
        <div className="absolute right-0 top-0 flex flex-col items-end gap-1.5">
          <span
            className={`rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${statusPill[restaurant.status]}`}
          >
            {restaurant.statusLabel}
          </span>
          {restaurant.activeAlerts > 0 && (
            <span className="rounded-md border border-[var(--nexo-critical-border)] bg-[var(--nexo-critical-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--nexo-critical)]">
              {restaurant.activeAlerts} alerta{restaurant.activeAlerts === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <RestaurantBrandLine
          brand={restaurant.brand}
          name={restaurant.name}
          subtitle={restaurant.location}
          logoSize="lg"
          layout="stack"
          className="px-2"
          nameClassName="truncate text-[17px] font-medium tracking-tight text-[var(--nexo-text)]"
          subtitleClassName="mt-1 truncate text-[12px] text-[var(--nexo-text-tertiary)]"
        />
      </div>

      <div className="mt-5 grid grid-cols-[1fr_1.2fr] gap-4">
        <MediaBlock media={restaurant.currentMedia} target={restaurant.targetMedia} />
        <div className="space-y-3">
          <SentimentBar
            positive={restaurant.positiveReviews}
            negative={restaurant.negativeReviews}
          />
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-emerald-400/10 bg-emerald-500/[0.06] px-2 py-2 text-center">
              <p className="text-[9px] font-medium uppercase tracking-[0.06em] text-emerald-400/70">
                Positivas
              </p>
              <p className="mt-0.5 font-mono text-[15px] tabular-nums text-emerald-200">
                {restaurant.positiveReviews}
              </p>
            </div>
            <div className="rounded-lg border border-red-400/10 bg-red-500/[0.06] px-2 py-2 text-center">
              <p className="text-[9px] font-medium uppercase tracking-[0.06em] text-red-400/70">
                Negativas
              </p>
              <p className="mt-0.5 font-mono text-[15px] tabular-nums text-red-200">
                {restaurant.negativeReviews}
              </p>
            </div>
            <div className="rounded-lg border border-violet-400/10 bg-violet-500/[0.06] px-2 py-2 text-center">
              <p className="text-[9px] font-medium uppercase tracking-[0.06em] text-violet-400/70">
                Para meta
              </p>
              <p className="mt-0.5 font-mono text-[15px] tabular-nums text-[var(--nexo-accent)]">
                {needsReviews ? `+${restaurant.recommendedPositiveReviews}` : "✓"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5">
        {hasBuffer ? (
          <NegativeBufferPanel buffer={restaurant.negativeBuffer} />
        ) : needsReviews ? (
          <TargetPathPanel
            needed={restaurant.recommendedPositiveReviews}
            currentMedia={restaurant.currentMedia}
            target={restaurant.targetMedia}
          />
        ) : (
          <div className="rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)] px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--nexo-text-tertiary)]">
              Acción recomendada
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--nexo-text-secondary)]">
              {restaurant.recommendedAction}
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 border-t border-[var(--nexo-border)] pt-4">
        <Link href={`/dashboard/restaurantes/${restaurant.slug}`} className={`${btnGhost} w-full`}>
          Ver detalle
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </article>
  );
}
