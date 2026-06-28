import type { ReportExpress } from "@/lib/reports/types";
import { card, sectionPad, shell, textKicker, textTitle } from "./ui/informes-styles";

type InformesExpressProps = {
  express: ReportExpress;
};

const ITEMS = [
  { icon: "🏆", label: "Mejor restaurante", key: "bestRestaurant" as const },
  { icon: "📈", label: "Mayor mejora", key: "bestImprovement" as const },
  { icon: "📉", label: "Mayor riesgo", key: "highestRisk" as const },
];

export function InformesExpress({ express }: InformesExpressProps) {
  return (
    <div className={shell}>
      <div className={sectionPad}>
        <p className={textKicker}>Informe express</p>
        <h2 className={`mt-1.5 ${textTitle}`}>La semana en 5 segundos</h2>
        <p className="mt-1 text-sm text-gray-500">Sin abrir el PDF. Solo lo esencial.</p>
      </div>

      <div className="grid gap-3 border-t border-white/[0.06] p-4 sm:grid-cols-2 lg:grid-cols-4 lg:p-6">
        {ITEMS.map((item) => (
          <div key={item.key} className={`${card} px-4 py-4`}>
            <p className="text-lg" aria-hidden>
              {item.icon}
            </p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">
              {item.label}
            </p>
            <p className="mt-1.5 text-sm font-medium text-gray-100">{express[item.key]}</p>
          </div>
        ))}

        <div className={`${card} border-violet-400/20 bg-violet-500/[0.06] px-4 py-4`}>
          <p className="text-lg" aria-hidden>
            🛡️
          </p>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">
            Estado Prevent
          </p>
          <p className="mt-1.5 text-sm font-medium text-violet-200">
            {express.preventProtection}% protegido
          </p>
        </div>
      </div>
    </div>
  );
}
