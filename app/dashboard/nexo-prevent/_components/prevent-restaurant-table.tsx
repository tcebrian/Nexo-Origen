"use client";

import Link from "next/link";
import { PREVENT_STATUS_META } from "@/lib/prevent/status";
import type { PreventRecord, PreventStatus } from "@/lib/prevent/types";
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

export function PreventRestaurantTable({ records, activeTab }: PreventRestaurantTableProps) {
  const visible =
    activeTab === "todos" ? records : records.filter((record) => record.status === activeTab);

  return (
    <div className={`overflow-hidden ${shell}`}>
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
  );
}
