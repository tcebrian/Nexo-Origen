import type { EmployeeRecord } from "@/lib/talento/types";
import { RestaurantBrandLine } from "../../_components/restaurant-brand-line";
import { EmployeeIllustrationAvatar } from "./employee-illustration-avatar";
import { TalentoSectionHeader } from "./talento-section-header";
import {
  employeeFeaturedCard,
  employeeFeaturedCardTop,
  mentionPill,
  quoteBlock,
  talentoPanel,
  talentoPanelInner,
  talentoPanelPad,
} from "./ui/talento-styles";

type TalentoFeaturedEmployeesProps = {
  employees: EmployeeRecord[];
};

function StarRow({ percent }: { percent: number }) {
  const filled = Math.min(5, Math.max(1, Math.round(percent / 20)));
  return (
    <div className="mt-4 flex justify-center gap-0.5" aria-label={`${filled} de 5 estrellas`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <svg
          key={index}
          className={`h-3.5 w-3.5 ${index < filled ? "text-amber-400" : "text-white/[0.08]"}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function PositiveRing({ percent, id }: { percent: number; id: string }) {
  const clamped = Math.min(100, Math.max(0, percent));
  const gradId = `pos-${id.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <div className="relative mt-4 flex h-14 w-14 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#6EE7B7" />
          </linearGradient>
        </defs>
        <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <circle
          cx="28"
          cy="28"
          r="24"
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * 150.8} 150.8`}
        />
      </svg>
      <span className="font-mono text-[15px] font-semibold tabular-nums text-emerald-400">
        {percent}%
      </span>
    </div>
  );
}

export function TalentoFeaturedEmployees({ employees }: TalentoFeaturedEmployeesProps) {
  return (
    <section className={`${talentoPanel} ${talentoPanelPad} flex h-full flex-col`}>
      <div className={talentoPanelInner} />
      <TalentoSectionHeader
        kicker="Reconocimiento"
        title="Empleados destacados"
        description="Mayor ratio de menciones positivas en el periodo."
      />

      {employees.length === 0 ? (
        <p className="text-[13px] text-gray-500">Sin empleados destacados en el periodo.</p>
      ) : (
        <div className="grid flex-1 gap-3 sm:grid-cols-3">
          {employees.map((employee, index) => (
            <article
              key={employee.id}
              className={`${employeeFeaturedCard} ${index === 0 ? employeeFeaturedCardTop : ""}`}
            >
              <EmployeeIllustrationAvatar
                seed={employee.id}
                size="xl"
                rank={index + 1}
                highlight={index === 0}
              />
              <h3 className="mt-5 text-[15px] font-semibold tracking-[-0.01em] text-white">
                {employee.name}
              </h3>
              <div className="mt-2 flex justify-center opacity-80">
                <RestaurantBrandLine
                  brand={employee.brand}
                  name={employee.restaurant}
                  logoSize="xs"
                  nameClassName="text-[11px] text-gray-500"
                />
              </div>
              <span className={`${mentionPill} mt-3`}>{employee.totalMentions} menciones</span>

              <PositiveRing percent={employee.positivePercent} id={employee.id} />
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-gray-600">
                positivas
              </p>

              {employee.featuredComment ? (
                <blockquote className={quoteBlock}>
                  <p className="line-clamp-3 text-[12px] leading-relaxed text-gray-400">
                    &ldquo;{employee.featuredComment}&rdquo;
                  </p>
                </blockquote>
              ) : null}

              <StarRow percent={employee.positivePercent} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
