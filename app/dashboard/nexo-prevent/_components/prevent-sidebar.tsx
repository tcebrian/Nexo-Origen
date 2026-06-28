"use client";

import { useMemo, useState } from "react";
import { REPUTATION_TARGET, simulateMediaAfterReviews } from "@/lib/prevent/calculate";
import { PREVENT_STATUS_META } from "@/lib/prevent/status";
import type { PreventRecord } from "@/lib/prevent/types";
import { insightBlock, shellWorkspace, textKicker } from "./ui/prevent-styles";

type PreventSidebarProps = {
  records: PreventRecord[];
};

type SimulatorMode = "negative" | "positive";

export function PreventSidebar({ records }: PreventSidebarProps) {
  const [mode, setMode] = useState<SimulatorMode>("negative");
  const [selectedSlug, setSelectedSlug] = useState(records[0]?.restaurantSlug ?? "");

  const selected = useMemo(
    () => records.find((record) => record.restaurantSlug === selectedSlug) ?? records[0] ?? null,
    [records, selectedSlug]
  );

  if (!selected) return null;

  const star = mode === "negative" ? 1 : 5;
  const scenarios = [1, 3, 5].map((count) => ({
    count,
    media: simulateMediaAfterReviews(selected.currentMedia, selected.reviewCount, star, count),
  }));

  const fallsBelowTarget = (media: number) => media < REPUTATION_TARGET;

  return (
    <aside className="space-y-5">
      <div className={`${shellWorkspace} p-5`}>
        <p className={textKicker}>¿Qué significa cada estado?</p>
        <div className="mt-4 space-y-3">
          {(Object.keys(PREVENT_STATUS_META) as Array<keyof typeof PREVENT_STATUS_META>).map((status) => {
            const meta = PREVENT_STATUS_META[status];
            const copy = {
              protegido: "Dentro del objetivo con margen para absorber varias negativas.",
              vigilancia: "En objetivo, pero con poco colchón. Conviene impulsar captación.",
              fuera_objetivo: "Por debajo de 4.4. Necesita reseñas positivas para recuperar el objetivo.",
            }[status];
            return (
              <div key={status} className={`rounded-xl border px-3.5 py-3 ${meta.summaryCard}`}>
                <p className={`text-[12px] font-semibold ${meta.summaryValue}`}>{meta.label}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--nexo-text-secondary)]">{copy}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`${shellWorkspace} p-5`}>
        <p className={textKicker}>Simulador rápido</p>
        <p className="mt-1 text-[12px] text-[var(--nexo-text-secondary)]">
          Anticipa el impacto de nuevas reseñas en la media del local.
        </p>

        <div className="mt-4 flex rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-inset)] p-1">
          {(
            [
              { key: "negative" as const, label: "¿Y si entra una negativa?" },
              { key: "positive" as const, label: "¿Y si entran positivas?" },
            ] as const
          ).map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setMode(option.key)}
              className={`flex-1 rounded-lg px-2 py-2 text-[10px] font-medium leading-snug transition ${
                mode === option.key
                  ? "bg-violet-500/20 text-violet-100"
                  : "text-[var(--nexo-text-tertiary)] hover:text-[var(--nexo-text-secondary)]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--nexo-text-tertiary)]">
            Restaurante
          </span>
          <select
            value={selected.restaurantSlug}
            onChange={(event) => setSelectedSlug(event.target.value)}
            className="mt-2 w-full rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-3 py-2.5 text-[13px] text-[var(--nexo-text)]"
          >
            {records.map((record) => (
              <option key={record.restaurantSlug} value={record.restaurantSlug}>
                {record.restaurant}
              </option>
            ))}
          </select>
        </label>

        <div className={`${insightBlock} mt-4 space-y-2`}>
          <p className="text-[12px] text-[var(--nexo-text-secondary)]">
            Media actual:{" "}
            <span className="font-mono font-medium text-[var(--nexo-text)]">
              {selected.currentMedia.toFixed(2)}
            </span>
          </p>
          {scenarios.map((scenario) => (
            <p key={scenario.count} className="text-[12px] text-[var(--nexo-text-secondary)]">
              Con {scenario.count} {mode === "negative" ? "negativa" : "positiva"}
              {scenario.count === 1 ? "" : "s"}:{" "}
              <span
                className={`font-mono font-medium ${
                  fallsBelowTarget(scenario.media) ? "text-[var(--nexo-critical)]" : "text-[var(--nexo-success)]"
                }`}
              >
                {scenario.media.toFixed(2)}
              </span>
            </p>
          ))}
        </div>

        {mode === "negative" && fallsBelowTarget(scenarios[0].media) ? (
          <p className="mt-3 text-[12px] font-medium text-[var(--nexo-critical)]">
            Resultado: saldría del objetivo ({REPUTATION_TARGET.toFixed(1)})
          </p>
        ) : mode === "positive" && !fallsBelowTarget(scenarios[scenarios.length - 1].media) ? (
          <p className="mt-3 text-[12px] font-medium text-[var(--nexo-success)]">
            Resultado: se acercaría o superaría el objetivo {REPUTATION_TARGET.toFixed(1)}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
