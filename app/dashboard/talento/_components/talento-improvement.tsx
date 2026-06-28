import type { EmployeeRecord } from "@/lib/talento/types";
import { RestaurantBrandLine } from "../../_components/restaurant-brand-line";
import { EmployeeIllustrationAvatar } from "./employee-illustration-avatar";
import { TalentoSectionHeader } from "./talento-section-header";
import {
  listRowCard,
  negativePill,
  talentoPanel,
  talentoPanelInner,
  talentoPanelPad,
} from "./ui/talento-styles";

type TalentoImprovementProps = {
  employees: EmployeeRecord[];
};

export function TalentoImprovement({ employees }: TalentoImprovementProps) {
  return (
    <section className={`${talentoPanel} ${talentoPanelPad} flex h-full flex-col`}>
      <div className={talentoPanelInner} />
      <TalentoSectionHeader
        kicker="Desarrollo"
        title="Oportunidades de mejora"
        description="Feedback negativo recurrente que requiere acompañamiento."
      />

      {employees.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.06] bg-white/[0.01] px-6 py-12 text-center">
          <p className="text-[14px] font-medium text-gray-300">Sin incidencias destacadas</p>
          <p className="mt-2 text-[12px] text-gray-600">
            No hay empleados con menciones negativas en este periodo.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {employees.map((employee) => (
            <li key={employee.id} className={`${listRowCard} flex-col !items-stretch !gap-0 sm:flex-row`}>
              <div className="flex items-start gap-3.5">
                <div className="relative">
                  <div className="absolute -left-px top-2 bottom-2 w-0.5 rounded-full bg-red-400/50" />
                  <EmployeeIllustrationAvatar seed={employee.id} size="md" className="ml-2" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[14px] font-semibold tracking-[-0.01em] text-white">
                    {employee.name}
                  </p>
                  <RestaurantBrandLine
                    brand={employee.brand}
                    name={employee.restaurant}
                    logoSize="xs"
                    nameClassName="mt-1 text-[11px] text-gray-600"
                  />
                  <span className={`${negativePill} mt-2.5`}>
                    {employee.negativeMentions} menciones negativas
                  </span>
                </div>
              </div>

              {employee.negativeMotives.length > 0 && (
                <div className="mt-3 border-t border-white/[0.04] pt-3 sm:mt-0 sm:border-0 sm:pt-0 sm:pl-[60px]">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-gray-600">
                    Motivos principales
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {employee.negativeMotives.slice(0, 3).map((motive) => (
                      <li
                        key={motive.name}
                        className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[11px] text-gray-400"
                      >
                        {motive.name}
                        <span className="ml-1.5 font-mono text-[10px] text-gray-600">
                          ×{motive.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
