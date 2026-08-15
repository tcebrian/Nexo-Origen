import type { ReactNode } from "react";

type KpiTone = "neutral" | "success" | "watch" | "critical" | "accent";

const toneValueClass: Record<KpiTone, string> = {
  neutral: "text-[var(--nexo-text)]",
  success: "text-[var(--nexo-success)]",
  watch: "text-[var(--nexo-watch)]",
  critical: "text-[var(--nexo-critical)]",
  accent: "text-[var(--nexo-accent)]",
};

export type KpiStripItem = {
  key: string;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: KpiTone;
  /** Icono o mini-gráfico opcional, esquina superior derecha de la celda. */
  topRight?: ReactNode;
  onClick?: () => void;
  active?: boolean;
  loading?: boolean;
};

type KpiStripProps = {
  items: KpiStripItem[];
  className?: string;
};

/**
 * Fila de KPIs relacionados como una sola superficie con divisores internos,
 * en vez de una tarjeta con borde y sombra por cifra (ver nexo-saas-system:
 * ese patrón es el ejemplo citado de "card soup" en RestaurantesStatusSummary
 * y equivalentes en Alertas/Reseñas/Nexo Prevent/Talento). Apilada con
 * divisor horizontal en móvil, fila con divisor vertical en escritorio.
 */
export function KpiStrip({ items, className = "" }: KpiStripProps) {
  return (
    <section
      className={`flex flex-col divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] lg:flex-row lg:divide-y-0 lg:divide-x ${className}`}
    >
      {items.map((item) => {
        const Wrapper = item.onClick ? "button" : "div";

        return (
          <Wrapper
            key={item.key}
            type={item.onClick ? "button" : undefined}
            onClick={item.onClick}
            className={`min-w-0 flex-1 px-5 py-4 text-left transition-colors ${
              item.onClick ? "cursor-pointer hover:bg-white/[0.02]" : ""
            } ${item.active ? "bg-[var(--nexo-accent-muted)]" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--nexo-text-tertiary)]">
                {item.label}
              </p>
              {item.topRight ? <div className="shrink-0 text-[var(--nexo-text-tertiary)]">{item.topRight}</div> : null}
            </div>

            {item.loading ? (
              <div className="nexo-skeleton mt-2 h-8 w-16" />
            ) : (
              <p
                className={`mt-1.5 font-mono text-[26px] font-light leading-none tabular-nums tracking-tight lg:text-[28px] ${toneValueClass[item.tone ?? "neutral"]}`}
              >
                {item.value}
              </p>
            )}

            {item.hint && !item.loading ? (
              <div className="mt-2 text-[12px] leading-relaxed text-[var(--nexo-text-secondary)]">{item.hint}</div>
            ) : null}
          </Wrapper>
        );
      })}
    </section>
  );
}
