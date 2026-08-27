import { NEXO_ORIGEN_LOGO_SRC } from "@/app/_components/nexo-brand";
import type { NetworkSummaryData } from "@/lib/reports/network-summary/types";
import type { NetworkSummaryGroupVisual } from "@/lib/reports/network-summary/group-visuals";
import { NegativeReasonsDonut } from "./negative-reasons-donut";
import "./network-summary.css";

type Props = {
  data: NetworkSummaryData;
  visual: NetworkSummaryGroupVisual;
  periodoAdjective: string; // "semanal" | "mensual" | "trimestral"
  assetBaseUrl?: string;
};

function absUrl(base: string | undefined, path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) return path;
  if (!base) return path;
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function StatusDot({ status }: { status: NetworkSummaryData["locations"][number]["status"] }) {
  const color =
    status === "risk" ? "#c0392b" : status === "watch" ? "#d99a1f" : status === "no_reviews" ? "#8c8c8c" : "#3f8f4a";
  return <span className="nws-dot" style={{ background: color }} aria-hidden />;
}

/**
 * La tarjeta de la tabla tiene una altura fija (el lienzo entero es
 * 1536×1024) — con más de ~11 restaurantes las filas dejaban de caber y se
 * cortaban silenciosamente por el overflow:hidden de la tarjeta (pasó de
 * verdad con Burger King: 13 locales, faltaban los 2 últimos). En vez de
 * eso, la fila se hace más compacta cuantos más locales haya, para que
 * siempre quepan todos.
 */
function locationsTier(count: number): "lg" | "md" | "sm" | "xs" {
  if (count <= 11) return "lg";
  if (count <= 15) return "md";
  if (count <= 20) return "sm";
  return "xs";
}

export function NetworkSummaryStandardTemplate({ data, visual, periodoAdjective, assetBaseUrl }: Props) {
  const style = {
    "--nws-ink": visual.ink,
    "--nws-accent": visual.accent,
    "--nws-accent-dark": visual.accentDark,
    "--nws-cream": visual.cream,
    "--nws-cream-deep": visual.creamDeep,
    "--nws-card": visual.card,
    "--nws-wordmark-font": visual.wordmarkFont,
  } as React.CSSProperties;

  const capitalizedAdjective = periodoAdjective.charAt(0).toUpperCase() + periodoAdjective.slice(1);

  const headerStyle = visual.headerBackgroundImage
    ? {
        backgroundImage: `url(${absUrl(assetBaseUrl, visual.headerBackgroundImage)})`,
        backgroundSize: "cover",
        backgroundPosition: "right center",
      }
    : undefined;

  return (
    <div className="nws-canvas" style={style}>
      <header className={`nws-header ${visual.headerBackgroundImage ? "nws-header--photo" : ""}`} style={headerStyle}>
        <div className="nws-header__brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={absUrl(assetBaseUrl, visual.logo)} alt="" aria-hidden className="nws-header__logo" />
          <div>
            <p className="nws-header__kicker">Informe {periodoAdjective}</p>
            <p className="nws-header__title">{visual.brandTitle}</p>
            <p className="nws-header__subtitle">{visual.brandSubtitle}</p>
            <p className="nws-header__pin">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
              {data.groupSublabel ?? "Red de Restaurantes"}
            </p>
            <p className="nws-header__date">{data.periodLabel}</p>
          </div>
        </div>

        {visual.heroImages && visual.heroImages.length > 0 ? (
          <div className="nws-header__hero-strip">
            {visual.heroImages.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={absUrl(assetBaseUrl, src)} alt="" aria-hidden className="nws-header__hero-strip-item" />
            ))}
          </div>
        ) : visual.heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={absUrl(assetBaseUrl, visual.heroImage)} alt="" aria-hidden className="nws-header__hero" />
        ) : (
          <div className="nws-header__hero nws-header__hero--empty" aria-hidden />
        )}

        <div className="nws-header__nexo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={absUrl(assetBaseUrl, NEXO_ORIGEN_LOGO_SRC)} alt="Nexo Origen" className="nws-header__nexo-logo" />
          <p className="nws-header__nexo-tag">Analizamos cada reseña para seguir mejorando.</p>
        </div>
      </header>

      <p className="nws-period-banner">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
        {capitalizedAdjective === "Semanal" ? "Semana analizada" : capitalizedAdjective === "Mensual" ? "Mes analizado" : "Trimestre analizado"}
        <span className="nws-period-banner__value">{data.periodLabel}</span>
      </p>

      <section className="nws-kpis">
        <div className="nws-kpi-card">
          <p className="nws-kpi-card__label">Impacto en media {periodoAdjective}</p>
          <p className="nws-kpi-card__hint">Locales por debajo del objetivo ({data.targetAverage.toFixed(1)}):</p>
          <div className="nws-kpi-card__row">
            <span className={`nws-kpi-card__value ${data.belowTargetCount > 0 ? "nws-kpi-card__value--bad" : "nws-kpi-card__value--good"}`}>
              {data.belowTargetCount}
            </span>
            <span className={`nws-kpi-card__icon ${data.belowTargetCount > 0 ? "nws-kpi-card__icon--bad" : "nws-kpi-card__icon--good"}`}>
              {data.belowTargetCount > 0 ? "!" : "✓"}
            </span>
          </div>
          {data.belowTargetCount > 0 ? (
            <p className="nws-kpi-card__foot">{data.belowTargetLocations.slice(0, 3).join(", ")}</p>
          ) : (
            <p className="nws-kpi-card__foot nws-kpi-card__foot--good">Todos los locales alcanzan el objetivo</p>
          )}
        </div>

        <div className="nws-kpi-card">
          <p className="nws-kpi-card__label">Nº de reseñas</p>
          <div className="nws-kpi-card__row">
            <span className="nws-kpi-card__value">{data.totalReviews}</span>
            <span className="nws-kpi-card__icon">💬</span>
          </div>
          <p className="nws-kpi-card__foot">Total de reseñas este {periodoAdjective === "semanal" ? "periodo" : periodoAdjective}</p>
        </div>

        <div className="nws-kpi-card">
          <p className="nws-kpi-card__label">Reseñas negativas</p>
          <div className="nws-kpi-card__row">
            <span className="nws-kpi-card__value nws-kpi-card__value--bad">{data.negativeReviews}</span>
            <span className="nws-kpi-card__icon nws-kpi-card__icon--bad">☹</span>
          </div>
          <p className="nws-kpi-card__foot">{data.negativePercent.toFixed(1)}% del total</p>
        </div>

        <div className="nws-kpi-card">
          <p className="nws-kpi-card__label">Media {periodoAdjective}</p>
          <div className="nws-kpi-card__row">
            <span className="nws-kpi-card__value">{data.weightedAverage.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}</span>
            <span className="nws-kpi-card__icon">★</span>
          </div>
          <p className="nws-kpi-card__foot">Sobre 5 estrellas · Objetivo: {data.targetAverage.toFixed(1)}</p>
        </div>
      </section>

      <section className="nws-body">
        <div className="nws-table-card">
          <p className="nws-section-title">Tabla de locales</p>
          <div
            className={`nws-table nws-table--tier-${locationsTier(data.locations.length)} ${visual.showBrandColumn ? "nws-table--with-brand" : ""}`}
          >
            <div className="nws-table__row nws-table__row--head">
              {visual.showBrandColumn ? <span>Marca</span> : null}
              <span>Local</span>
              <span>Media {periodoAdjective}</span>
              <span>Nº reseñas</span>
              <span>Estado</span>
              <span>Motivo</span>
            </div>
            {data.locations.map((loc) => (
              <div className="nws-table__row" key={loc.name}>
                {visual.showBrandColumn ? <span className="nws-table__brand">{loc.brandLabel}</span> : null}
                <span className="nws-table__name">{loc.name}</span>
                <span className={loc.status === "risk" ? "nws-table__rating--bad" : loc.status === "watch" ? "nws-table__rating--watch" : "nws-table__rating--good"}>
                  {loc.rating != null ? loc.rating.toFixed(2) : "—"}
                </span>
                <span>{loc.reviewCount}</span>
                <span className="nws-table__status">
                  <StatusDot status={loc.status} />
                  {loc.statusLabel}
                </span>
                <span className="nws-table__motive">{loc.mainNegativeMotive}</span>
              </div>
            ))}
          </div>
          <p className="nws-table__target">Objetivo de media: {data.targetAverage.toFixed(1)}</p>
        </div>

        <div className="nws-donut-card">
          <p className="nws-section-title">% de reseñas negativas</p>
          <p className="nws-donut-card__total">
            Total reseñas negativas: <strong>{data.negativeReviews}</strong> ({data.negativePercent.toFixed(1)}% del total)
          </p>
          <NegativeReasonsDonut segments={data.negativeReasons} accent={visual.accent} />
        </div>
      </section>

      <footer className="nws-footer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={absUrl(assetBaseUrl, visual.logo)} alt="" aria-hidden className="nws-footer__logo" />
        <p className="nws-footer__tagline">{visual.footerTagline}</p>
        <p className="nws-footer__meta">
          Fuente: Google Maps (Reseñas) &nbsp;|&nbsp; Nexo Origen &nbsp;|&nbsp; www.nexoorigen.com
        </p>
      </footer>
    </div>
  );
}
