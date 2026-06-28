"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PANEL_SLIDE } from "../../_components/motion/motion-config";
import { usePrefersReducedMotion } from "../../_components/motion/use-prefers-reduced-motion";
import {
  formatDetectedDate,
  formatImpactRange,
  STATUS_META,
} from "@/lib/alerts/status";
import { formatImpactSummary } from "@/lib/reviews/impact-display";
import type { RestaurantAlert } from "@/lib/alerts/types";
import { getReviewHrefFromAlertId } from "@/lib/text/excerpt";
import { RestaurantBrandLine } from "../../_components/restaurant-brand-line";
import {
  btnOutline,
  btnPrimary,
  insightBlock,
  metricPill,
  panelChrome,
  priorityBadge,
  sectionPad,
  surfaceDetail,
  textBody,
  textKicker,
} from "./ui/alertas-styles";

type AlertasDetailPanelProps = {
  alert: RestaurantAlert | null;
  onResolve: (id: string) => void;
  onClose?: () => void;
};

function MetaBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={insightBlock}>
      <p className={textKicker}>{label}</p>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 py-24 text-center">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.02]">
        <svg className="h-5 w-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      <p className="text-[14px] font-medium text-gray-400">Selecciona una incidencia</p>
      <p className="mt-2 max-w-[260px] text-[13px] leading-relaxed text-gray-600">
        Elige una alerta de la lista para ver el expediente completo.
      </p>
    </div>
  );
}

export function AlertasDetailPanel({ alert, onResolve, onClose }: AlertasDetailPanelProps) {
  const [assigned, setAssigned] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    setAssigned(false);
  }, [alert?.id]);

  if (!alert) {
    return (
      <div className={`flex h-full flex-col ${surfaceDetail}`}>
        <EmptyState />
      </div>
    );
  }

  const meta = STATUS_META[alert.status];
  const canResolve = alert.status === "critico" || alert.status === "seguimiento";
  const reviewHref = getReviewHrefFromAlertId(alert.id);
  const impact = formatImpactSummary({
    mediaBefore: alert.mediaBefore,
    mediaAfter: alert.mediaAfter,
  });

  const panelBody = (
    <div className={`flex h-full flex-col ${surfaceDetail}`}>
      <div className={`${panelChrome} ${sectionPad} py-4`}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-gray-600">
            Expediente de incidencia
          </p>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-md border border-white/[0.08] px-2.5 py-1 text-[11px] text-gray-500 lg:hidden"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={`border-b border-white/[0.05] ${sectionPad} py-7`}>
          <RestaurantBrandLine
            brand={alert.brand}
            name={alert.restaurant}
            logoSize="md"
            nameClassName="text-[19px] font-medium tracking-[-0.01em] text-white"
          />
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            {meta.priority !== "—" && (
              <span className={`${priorityBadge} ${meta.priorityBadge}`}>{meta.priority}</span>
            )}
            <span className={`${metricPill} ${meta.pill}`}>{meta.label}</span>
            <span className="text-[12px] text-gray-600">{formatDetectedDate(alert.detectedAt)}</span>
          </div>
        </div>

        <div className={`space-y-3 ${sectionPad} py-7`}>
          <MetaBlock label="Qué ha ocurrido">
            <p className={textBody}>{alert.whatHappened}</p>
          </MetaBlock>

          <div className="grid gap-3 sm:grid-cols-2">
            <MetaBlock label="Reseña que dispara la alerta">
              <p className="font-mono text-[22px] font-light tabular-nums tracking-tight text-white">
                {alert.affectedReviews}
              </p>
              <p className="mt-1 text-[12px] text-gray-600">
                Una reseña negativa en el periodo seleccionado
              </p>
            </MetaBlock>
            <MetaBlock label="Impacto en la media del local">
              <p className="text-[14px] leading-relaxed text-gray-200">{impact.deltaLong}</p>
              <p className="mt-2 font-mono text-[13px] text-gray-400">
                {formatImpactRange(alert)}
              </p>
              <p className="mt-1 text-[12px] text-gray-600">
                Media acumulada del local antes y después de publicarse esta reseña
              </p>
            </MetaBlock>
          </div>

          {alert.motives.length > 0 && (
            <MetaBlock label="Motivos detectados">
              <ul className="space-y-2.5">
                {alert.motives.map((motive) => (
                  <li key={motive.name} className="flex items-center justify-between text-[13px]">
                    <span className="text-gray-400">{motive.name}</span>
                    <span className="font-mono text-gray-600">{motive.percentage}%</span>
                  </li>
                ))}
              </ul>
            </MetaBlock>
          )}

          <div className={insightBlock}>
            <p className={textKicker}>Recomendación operativa</p>
            <p className="mt-3 text-[14px] leading-relaxed text-gray-400">{alert.recommendation}</p>
          </div>
        </div>

        <div className={`border-t border-white/[0.05] ${sectionPad} py-7`}>
          <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.14em] text-gray-600">
            Acciones
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/restaurantes/${alert.restaurantSlug}`} className={btnOutline}>
              Ver restaurante
            </Link>
            {reviewHref ? (
              <Link href={reviewHref} className={btnPrimary}>
                Ver comentario completo
              </Link>
            ) : (
              <Link
                href={`/dashboard/resenas?local=${alert.restaurantSlug}`}
                className={btnOutline}
              >
                Ver reseñas asociadas
              </Link>
            )}
            <button
              type="button"
              onClick={() => setAssigned(true)}
              disabled={assigned}
              className={`${btnOutline} disabled:opacity-40`}
            >
              {assigned ? "Responsable asignado" : "Asignar responsable"}
            </button>
            {canResolve && (
              <button type="button" onClick={() => onResolve(alert.id)} className={btnPrimary}>
                Marcar como resuelta
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={alert.id}
        className={`flex h-full flex-col ${surfaceDetail}`}
        initial={reducedMotion ? false : PANEL_SLIDE.initial}
        animate={reducedMotion ? undefined : PANEL_SLIDE.animate}
        exit={reducedMotion ? undefined : PANEL_SLIDE.exit}
        transition={PANEL_SLIDE.transition}
      >
        {panelBody}
      </motion.div>
    </AnimatePresence>
  );
}
