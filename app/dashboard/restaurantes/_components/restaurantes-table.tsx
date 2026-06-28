import Link from "next/link";
import {
  ACTION_PRIORITY_CLASS,
  ACTION_PRIORITY_LABEL,
  formatNegativesTolerance,
  formatPositivesNeeded,
  getReputationOutlook,
} from "@/lib/restaurants/reputation-outlook";
import type { RestaurantOperational } from "@/lib/restaurants/types";
import { RestaurantBrandLine } from "../../_components/restaurant-brand-line";
import { btnGhost, shell, statusPill } from "./ui/restaurantes-styles";

type RestaurantesTableProps = {
  restaurants: RestaurantOperational[];
};

function StarIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-[var(--nexo-watch)]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l2.9 6.9L22 9.8l-5.2 4.5 1.6 6.9L12 17.8 5.6 21.2l1.6-6.9L2 9.8l7.1-.9L12 2z" />
    </svg>
  );
}

export function RestaurantesTable({ restaurants }: RestaurantesTableProps) {
  return (
    <div className={`overflow-hidden ${shell}`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--nexo-border)] bg-[var(--nexo-inset)]/60">
              {[
                "Restaurante",
                "Marca",
                "Estado",
                "Media actual",
                "Necesita positivas",
                "Soporta negativas",
                "Acción recomendada",
                "",
              ].map((col) => (
                <th
                  key={col || "action"}
                  className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--nexo-text-tertiary)]"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {restaurants.map((restaurant) => {
              const outlook = getReputationOutlook(
                restaurant.currentMedia,
                restaurant.totalReviews,
                restaurant.status,
                restaurant.targetMedia
              );

              return (
                <tr
                  key={restaurant.id}
                  className="border-b border-[var(--nexo-border)]/70 transition hover:bg-white/[0.02]"
                >
                  <td className="px-5 py-4">
                    <RestaurantBrandLine
                      brand={restaurant.brand}
                      name={restaurant.name}
                      subtitle={restaurant.location}
                      logoSize="sm"
                      layout="stack"
                      nameClassName="truncate text-[13px] font-medium text-[var(--nexo-text)]"
                      subtitleClassName="mt-0.5 truncate text-[11px] text-[var(--nexo-text-tertiary)]"
                    />
                  </td>

                  <td className="px-5 py-4 text-[13px] text-[var(--nexo-text-secondary)]">
                    {restaurant.brandLabel}
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${statusPill[restaurant.status]}`}
                    >
                      {restaurant.statusLabel}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[15px] tabular-nums text-[var(--nexo-text)]">
                      {restaurant.currentMedia.toFixed(2)}
                      <StarIcon />
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={`font-mono text-[14px] tabular-nums ${
                        outlook.positivesNeeded > 0
                          ? "font-medium text-[var(--nexo-accent)]"
                          : "text-[var(--nexo-text-tertiary)]"
                      }`}
                    >
                      {formatPositivesNeeded(outlook.positivesNeeded)}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={`font-mono text-[14px] tabular-nums ${
                        outlook.negativesTolerance > 0
                          ? "font-medium text-[var(--nexo-success)]"
                          : "text-[var(--nexo-text-tertiary)]"
                      }`}
                    >
                      {formatNegativesTolerance(outlook.negativesTolerance)}
                    </span>
                  </td>

                  <td className="max-w-[220px] px-5 py-4">
                    <p className="text-[13px] leading-snug text-[var(--nexo-text-secondary)]">
                      {restaurant.recommendedAction}
                    </p>
                    <p
                      className={`mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${ACTION_PRIORITY_CLASS[outlook.actionPriority]}`}
                    >
                      {ACTION_PRIORITY_LABEL[outlook.actionPriority]}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <Link
                      href={`/dashboard/restaurantes/${restaurant.slug}`}
                      className={`${btnGhost} whitespace-nowrap`}
                    >
                      Ver detalle
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
