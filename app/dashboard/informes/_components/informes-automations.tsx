"use client";

import type { ReportAutomation } from "@/lib/reports/types";
import { card, sectionPad, shell, textKicker, textTitle } from "./ui/informes-styles";

type InformesAutomationsProps = {
  automations: ReportAutomation[];
  onToggle: (id: string, active: boolean) => void;
};

function ToggleSwitch({
  active,
  onChange,
  label,
}: {
  active: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      onClick={() => onChange(!active)}
      className={`relative h-7 w-12 shrink-0 rounded-full border transition ${
        active
          ? "border-violet-400/40 bg-violet-600"
          : "border-white/[0.1] bg-white/[0.06]"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
          active ? "left-[22px]" : "left-1"
        }`}
      />
    </button>
  );
}

export function InformesAutomations({ automations, onToggle }: InformesAutomationsProps) {
  return (
    <div className={shell}>
      <div className={sectionPad}>
        <p className={textKicker}>Automatizaciones</p>
        <h2 className={`mt-1.5 ${textTitle}`}>Informes automáticos</h2>
        <p className="mt-1 text-sm text-gray-500">Programa envíos recurrentes a tu equipo.</p>
      </div>

      <div className="space-y-3 border-t border-white/[0.06] p-4 lg:p-6">
        {automations.map((automation) => (
          <div
            key={automation.id}
            className={`${card} flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span aria-hidden>📧</span>
                <p className="truncate text-sm font-medium text-gray-100">{automation.title}</p>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Envío: <span className="text-gray-400">{automation.schedule}</span>
              </p>
              <p className="mt-1 truncate text-xs text-gray-600">
                Destinatarios: {automation.recipients}
              </p>
              <p className="mt-2 text-xs">
                <span
                  className={
                    automation.active ? "text-emerald-400" : "text-gray-500"
                  }
                >
                  {automation.active ? "Activo" : "Inactivo"}
                </span>
              </p>
            </div>

            <ToggleSwitch
              active={automation.active}
              onChange={(next) => onToggle(automation.id, next)}
              label={`Activar ${automation.title}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
