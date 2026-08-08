"use client";

import Link from "next/link";
import { PREVENT_STATUS_META } from "@/lib/prevent/status";
import type { PreventRecord, PreventStatus } from "@/lib/prevent/types";
import { BrandMark } from "../../_components/brand-mark";
import { RestaurantBrandLine } from "../../_components/restaurant-brand-line";
import { btnGhost, shell } from "../../restaurantes/_components/ui/restaurantes-styles";

type PreventRestaurantTableProps = {
  records: PreventRecord[];
  activeTab: PreventStatus | "todos";
};

function StarIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-[var(--nexo-watch)]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l2.9 6.9L22 9.8l-5.2 4.5 1.6 6.9L12 17.8 5.6 21.2l1.6-6.9L2 9.8l7.1-.9L12 2z" />
    </svg>
  );
}

function PreventEmptyState() {
  return (
    <p className="px-5 py-14 text-center text-[14px] text-[var(--nexo-text-secondary)]">
      No hay restaurantes en esta categoría para el periodo y filtros actuales.
    </p>
  );
}

function PreventMobileRow({ record }: { record: PreventRecord }) {
  const meta = PREVENT_STATUS_META[record.status];
  const isOutside = record.status === "fuera_objetivo";

  return (
    <Link
      href={`/dashboard/restaurantes/${record.restaurantSlug}`}
      className={`block border-l-2 px-4 py-3.5 transition hover:bg-white/[0.03] ${meta.cardEdge}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandMark brand={record.brand} size="sm" />
          <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-[var(--nexo-text)]">
            {record.restaurant}
          </p>
        </div>
        <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium ${meta.pill}`}>
          {meta.label}
        </span>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[15px] tabular-nums text-[var(--nexo-text)]">
            {record.currentMedia.toFixed(2)}
          </span>
          <StarIcon />
          <span className="text-[10.5px] text-[var(--nexo-text-tertiary)]">
            Objetivo {record.targetMedia.toFixed(1)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="h-1.5 w-12 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400"
              style={{ width: `${record.protectionPercent}%` }}
            />
          </div>
          <span className="font-mono text-[12px] tabular-nums text-violet-200">
            {record.protectionPercent}%
          </span>
        </div>
      </div>

      <p className="mt-2 text-[12px]">
        {isOutside ? (
          <span className={`font-medium ${meta.metricAccent}`}>
            +{record.positivesNeeded} reseñas positivas
          </span>
        ) : record.negativesTolerance > 0 ? (
          <span className="font-medium text-[var(--nexo-success)]">
            Soporta {record.negativesTolerance} negativa{record.negativesTolerance === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="text-[var(--nexo-critical)]">Sin margen (0% protección)</span>
        )}
      </p>
    </Link>
  );
}

export function PreventRestaurantTable({ records, activeTab }: PreventRestaurantTableProps) {
  const visible =
    activeTab === "todos" ? records : records.filter((record) => record.status === activeTab);

  return (
    <>
      <div className={`overflow-hidden lg:hidden ${shell}`}>
        {visible.length === 0 ? (
          <PreventEmptyState />
        ) : (
          <div className="divide-y divide-[var(--nexo-border)]">
            {visible.map((record) => (
              <PreventMobileRow key={record.id} record={record} />
            ))}
          </div>
        )}
      </div>

      <div className={`hidden overflow-hidden lg:block ${shell}`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--nexo-border)] bg-[var(--nexo-inset)]/70">
              {["Restaurante", "Media actual", "Protección", "Acción necesaria", ""].map((col) => (
                <th
                  key={col || "cta"}
                  className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--nexo-text-tertiary)]"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-14 text-center text-[14px] text-[var(--nexo-text-secondary)]">
                  No hay restaurantes en esta categoría para el periodo y filtros actuales.
                </td>
              </tr>
            ) : (
              visible.map((record) => {
                const meta = PREVENT_STATUS_META[record.status];
                const isOutside = record.status === "fuera_objetivo";

                return (
                  <tr
                    key={record.id}
                    className="border-b border-[var(--nexo-border)]/70 transition hover:bg-white/[0.02]"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <RestaurantBrandLine
                          brand={record.brand}
                          name={record.restaurant}
                          logoSize="sm"
                          nameClassName="text-[14px] font-medium text-[var(--nexo-text)]"
                        />
                        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${meta.pill}`}>
                          {meta.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[16px] tabular-nums text-[var(--nexo-text)]">
                          {record.currentMedia.toFixed(2)}
                        </span>
                        <StarIcon />
                        <span className="text-[11px] text-[var(--nexo-text-tertiary)]">
                          Objetivo {record.targetMedia.toFixed(1)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[15px] tabular-nums text-violet-200">
                          {record.protectionPercent}%
                        </span>
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400"
                            style={{ width: `${record.protectionPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {isOutside ? (
                        <span className={`font-mono text-[14px] font-medium tabular-nums ${meta.metricAccent}`}>
                          +{record.positivesNeeded} reseñas positivas
                        </span>
                      ) : record.negativesTolerance > 0 ? (
                        <span className="font-mono text-[14px] font-medium tabular-nums text-[var(--nexo-success)]">
                          Soporta {record.negativesTolerance} negativa{record.negativesTolerance === 1 ? "" : "s"}
                        </span>
                      ) : (
                        <span className="text-[13px] text-[var(--nexo-critical)]">Sin margen (0% protección)</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/dashboard/restaurantes/${record.restaurantSlug}`}
                        className={`${btnGhost} inline-flex text-[12px]`}
                      >
                        Ver estrategia
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      </div>
    </>
  );
}
