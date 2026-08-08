import type { ReactNode } from "react";

type PageHeaderProps = {
  /** Etiqueta corta en mayúsculas encima del título. Omite si la página usa breadcrumb en su lugar. */
  kicker?: string;
  title: string;
  subtitle?: string;
  /** Botón(es) o control principal de la página, alineado a la derecha. */
  action?: ReactNode;
};

/**
 * Cabecera de página única para todo el dashboard — un solo tamaño de título en
 * toda la app en vez de que cada sección lo reinvente (28px / lg:32px, el tamaño
 * que ya seguían más secciones antes de esta skill). Ver nexo-saas-system.
 */
export function PageHeader({ kicker, title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {kicker ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--nexo-text-tertiary)]">
            {kicker}
          </p>
        ) : null}
        <h1
          className={`text-[28px] font-semibold tracking-tight text-[var(--nexo-text)] lg:text-[32px] ${
            kicker ? "mt-1" : ""
          }`}
        >
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--nexo-text-secondary)]">
            {subtitle}
          </p>
        ) : null}
      </div>

      {action ? <div className="flex shrink-0 flex-wrap items-center gap-3">{action}</div> : null}
    </header>
  );
}
