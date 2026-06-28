import Link from "next/link";
import type { TalentoRestaurantRow } from "@/lib/talento/types";
import { RestaurantBrandLine } from "../../_components/restaurant-brand-line";
import { EmployeeIllustrationAvatar } from "./employee-illustration-avatar";
import { TalentoSectionHeader } from "./talento-section-header";
import {
  tableHeadCell,
  tableRow,
  talentoPanel,
  talentoPanelInner,
  talentoPanelPad,
} from "./ui/talento-styles";

type TalentoByRestaurantProps = {
  rows: TalentoRestaurantRow[];
};

export function TalentoByRestaurant({ rows }: TalentoByRestaurantProps) {
  return (
    <section className={`${talentoPanel} ${talentoPanelPad}`}>
      <div className={talentoPanelInner} />
      <TalentoSectionHeader
        kicker="Por local"
        title="Talento por restaurante"
        description="Distribución de menciones y referente de cada sede."
      />

      {rows.length === 0 ? (
        <p className="text-[13px] text-gray-500">Sin datos por restaurante.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/[0.05]">
          <table className="w-full min-w-[540px] text-left text-[12px]">
            <thead className="bg-white/[0.02]">
              <tr className="border-b border-white/[0.05]">
                <th className={`${tableHeadCell} pl-4`}>Restaurante</th>
                <th className={tableHeadCell}>Empleados</th>
                <th className={`${tableHeadCell} text-emerald-400/80`}>Positivas</th>
                <th className={`${tableHeadCell} text-red-400/80`}>Negativas</th>
                <th className={`${tableHeadCell} pr-4`}>Más mencionado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.restaurantSlug} className={tableRow}>
                  <td className="py-3.5 pl-4 pr-4">
                    <Link
                      href={`/dashboard/restaurantes/${row.restaurantSlug}`}
                      className="transition hover:opacity-90"
                    >
                      <RestaurantBrandLine
                        brand={row.brand}
                        name={row.restaurant}
                        logoSize="xs"
                        nameClassName="text-[13px] font-medium text-gray-200"
                      />
                    </Link>
                  </td>
                  <td className="py-3.5 pr-4 font-mono tabular-nums text-gray-300">
                    {row.employeesMentioned}
                  </td>
                  <td className="py-3.5 pr-4 font-mono tabular-nums text-emerald-400">
                    {row.positiveMentions}
                  </td>
                  <td className="py-3.5 pr-4 font-mono tabular-nums text-red-400">
                    {row.negativeMentions}
                  </td>
                  <td className="py-3.5 pr-4">
                    {row.topEmployee ? (
                      <div className="flex items-center gap-2.5">
                        <EmployeeIllustrationAvatar seed={row.topEmployee.id} size="sm" />
                        <span className="font-medium text-gray-200">{row.topEmployee.name}</span>
                      </div>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
