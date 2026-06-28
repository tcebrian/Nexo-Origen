"use client";

import { useMemo, useState } from "react";
import { RestaurantBrandLine } from "@/app/dashboard/_components/restaurant-brand-line";
import { brands, type BrandId } from "@/app/dashboard/restaurantes/data";
import { formatImpactSummary, impactToneClass } from "@/lib/reviews/impact-display";
import type { NegativeReviewReportRow } from "@/lib/reports/negative-reviews/types";
import { useNegativeReviews } from "../_hooks/use-negative-reviews";
import { InformesNegativeReviewsImageModal } from "./informes-negative-reviews-image-modal";
import { btnGhost, btnPrimary, card, shell, textKicker } from "./ui/informes-styles";

type InformesNegativeReviewsProps = {
  start: Date;
  end: Date;
  periodLabel: string;
};

function getReportRowKey(row: NegativeReviewReportRow): string {
  const comment = row.comment.trim().toLowerCase().replace(/\s+/g, " ");
  const author = row.author.trim().toLowerCase();
  const date = row.dateIso.slice(0, 10);
  return `${row.restaurantSlug}|${date}|${author}|${row.stars}|${comment}`;
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} estrellas`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <svg
          key={index}
          className={`h-3.5 w-3.5 ${index < value ? "text-amber-400" : "text-white/10"}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

function MediaImpactCell({ row }: { row: NegativeReviewReportRow }) {
  const impact = formatImpactSummary(
    {
      mediaBefore: row.mediaBefore,
      mediaAfter: row.mediaAfter,
      impact: row.impact,
    },
    2
  );

  if (!impact.hasData) {
    return <span className="text-[var(--nexo-text-tertiary)]">Sin datos de media</span>;
  }

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2 font-mono text-[12px] tabular-nums">
      <span className="text-[var(--nexo-text)]">{impact.range}</span>
      <span className={impactToneClass(impact.tone)}>{impact.delta}</span>
    </span>
  );
}

export function InformesNegativeReviews({ start, end, periodLabel }: InformesNegativeReviewsProps) {
  const [selectedBrand, setSelectedBrand] = useState<"todas" | BrandId>("todas");
  const { rows, loading, error, refetch } = useNegativeReviews({ start, end, brand: selectedBrand });
  const [selectedRow, setSelectedRow] = useState<NegativeReviewReportRow | null>(null);

  const brandLabel =
    selectedBrand === "todas"
      ? "todas las marcas"
      : (brands.find((b) => b.id === selectedBrand)?.name ?? selectedBrand);

  const summary = useMemo(() => {
    if (loading) return "Cargando reseñas…";
    if (rows.length === 0) return `Sin reseñas negativas de ${brandLabel} en el periodo.`;
    return `${rows.length} reseña${rows.length === 1 ? "" : "s"} negativa${rows.length === 1 ? "" : "s"} · ${brandLabel}`;
  }, [brandLabel, loading, rows.length]);

  return (
    <>
      <section id="informes-resenas-negativas" className={shell}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className={textKicker}>Listado del periodo</p>
            <p className="mt-1 text-[13px] text-[var(--nexo-text-secondary)]">{summary}</p>
            <p className="mt-1 text-[11px] text-[var(--nexo-text-tertiary)]">{periodLabel}</p>
          </div>
          <button type="button" onClick={() => void refetch()} className={btnGhost} disabled={loading}>
            Actualizar
          </button>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-28 animate-pulse rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)]"
                />
              ))}
            </div>
          ) : error ? (
            <div className={`${card} p-6 text-[13px] text-red-300`}>{error}</div>
          ) : rows.length === 0 ? (
            <div className={`${card} p-10 text-center`}>
              <p className="text-[15px] font-medium text-[var(--nexo-text)]">
                No hay reseñas negativas en este periodo
              </p>
              <p className="mt-2 text-[13px] text-[var(--nexo-text-secondary)]">
                Amplía el rango de fechas con el selector superior o espera nuevas reseñas en Supabase.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                  <article
                    key={getReportRowKey(row)}
                    className={`${card} grid gap-4 p-4 transition hover:border-[var(--nexo-border-strong)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto] lg:items-center`}
                  >
                    <div className="min-w-0">
                      <RestaurantBrandLine
                        brand={row.brand}
                        name={row.restaurant}
                        subtitle={row.address}
                        logoSize="sm"
                        layout="stack"
                        nameClassName="truncate text-[14px] font-semibold text-[var(--nexo-text)]"
                        subtitleClassName="mt-0.5 truncate text-[11px] text-[var(--nexo-text-tertiary)]"
                      />
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-[var(--nexo-text-secondary)]">
                        <span>{row.author}</span>
                        <span>·</span>
                        <span>{row.dateLabel}</span>
                        <Stars value={row.stars} />
                      </div>
                    </div>

                    <div className="min-w-0 space-y-2 text-[12px] text-[var(--nexo-text-secondary)]">
                      <p className="line-clamp-3 leading-relaxed text-[var(--nexo-text)]">{row.comment}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <span>
                          <span className="text-[var(--nexo-text-tertiary)]">Motivo: </span>
                          {row.motive}
                        </span>
                        <span>
                          <span className="text-[var(--nexo-text-tertiary)]">Media: </span>
                          <MediaImpactCell row={row} />
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 lg:justify-end">
                      <button
                        type="button"
                        className={btnPrimary}
                        onClick={() => setSelectedRow(row)}
                      >
                        Generar imagen
                      </button>
                    </div>
                  </article>
                ))}
            </div>
          )}
        </div>
      </section>

      <InformesNegativeReviewsImageModal row={selectedRow} onClose={() => setSelectedRow(null)} />
    </>
  );
}
