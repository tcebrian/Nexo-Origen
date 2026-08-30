import type { NetworkSummaryData } from "@/lib/reports/network-summary/types";
import type { NetworkSummaryGroupVisual } from "@/lib/reports/network-summary/group-visuals";
import { NegativeReasonsDonutBk } from "./negative-reasons-donut-bk";
import "./network-summary-bk.css";

type Props = {
  data: NetworkSummaryData;
  visual: NetworkSummaryGroupVisual;
  periodoAdjective: string;
  assetBaseUrl?: string;
};

function absUrl(base: string | undefined, path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) return path;
  if (!base) return path;
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#fff" strokeWidth="2" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" strokeLinejoin="round" />
    </svg>
  );
}

function SmileIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#fff" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 13c1 1.3 2.5 2 4 2s3-.7 4-2" strokeLinecap="round" />
      <path d="M9 9h.01M15 9h.01" strokeLinecap="round" strokeWidth="2.6" />
    </svg>
  );
}

function FrownIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#fff" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 15c1-1.3 2.5-2 4-2s3 .7 4 2" strokeLinecap="round" />
      <path d="M9 9h.01M15 9h.01" strokeLinecap="round" strokeWidth="2.6" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="25" height="25" fill="#fff" aria-hidden>
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.6l-5.9 3 1.3-6.6-4.9-4.6 6.6-.8L12 2.5Z" />
    </svg>
  );
}

function StatusDot({ status }: { status: NetworkSummaryData["locations"][number]["status"] }) {
  const color =
    status === "risk" ? "#E00000" : status === "watch" ? "#FF9500" : status === "no_reviews" ? "#B0B0B0" : "#08751D";
  return <span className="nwsbk-dot" style={{ background: color }} aria-hidden />;
}

export function NetworkSummaryBkTemplate({ data, visual, periodoAdjective, assetBaseUrl }: Props) {
  const decimalAverage = data.weightedAverage.toFixed(2).replace(".", ",");

  return (
    <div className="nwsbk-canvas">
      <header className="nwsbk-header">
        <div
          className="nwsbk-header__main"
          style={{
            backgroundImage: visual.headerBackgroundImage
              ? `url(${absUrl(assetBaseUrl, visual.headerBackgroundImage)})`
              : undefined,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={absUrl(assetBaseUrl, visual.logo)} alt="" aria-hidden className="nwsbk-header__logo" />

          <div className="nwsbk-header__title-block">
            <p className="nwsbk-header__kicker">Informe {periodoAdjective}</p>
            <p className="nwsbk-header__title">{visual.brandTitle}</p>
            <p className="nwsbk-header__subtitle">{visual.brandSubtitle}</p>
          </div>

          <p className="nwsbk-date-bar">
            <span className="nwsbk-date-bar__label">
              <CalendarIcon />
              {periodoAdjective === "semanal"
                ? "SEMANA ANALIZADA"
                : periodoAdjective === "mensual"
                  ? "MES ANALIZADO"
                  : "TRIMESTRE ANALIZADO"}
            </span>
            <span className="nwsbk-date-bar__sep" aria-hidden />
            <span className="nwsbk-date-bar__value">{data.periodLabel}</span>
          </p>
        </div>

        <div className="nwsbk-header__nexo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={absUrl(assetBaseUrl, "/design/burger-king/nexo-origen-logo-2.png")}
            alt="Nexo Origen"
            className="nwsbk-header__nexo-logo"
          />
          <div className="nwsbk-header__nexo-claim">
            <span className="nwsbk-header__nexo-bar" aria-hidden />
            <p>
              INTELIGENCIA
              <br />
              QUE GENERA
              <br />
              RESULTADOS
            </p>
          </div>
        </div>
      </header>

      <section className="nwsbk-kpis">
        <div className="nwsbk-kpi">
          <span className={`nwsbk-kpi__icon ${data.belowTargetCount > 0 ? "nwsbk-kpi__icon--red" : "nwsbk-kpi__icon--green"}`}>
            {data.belowTargetCount > 0 ? <span className="nwsbk-kpi__icon-glyph">!</span> : <SmileIcon />}
          </span>
          <div className="nwsbk-kpi__body">
            <p className="nwsbk-kpi__label">Impacto en media {periodoAdjective}</p>
            <p className="nwsbk-kpi__sub-caption">Locales fuera de objetivo ({data.targetAverage.toFixed(1)})</p>
            {data.belowTargetCount > 0 ? (
              <ul className="nwsbk-kpi__dot-list">
                {data.belowTargetLocations.slice(0, 4).map((name) => (
                  <li key={name}>{name}</li>
                ))}
                {data.belowTargetLocations.length > 4 ? <li>+{data.belowTargetLocations.length - 4} más</li> : null}
              </ul>
            ) : (
              <p className="nwsbk-kpi__sub-list">Todos los locales alcanzan el objetivo</p>
            )}
          </div>
        </div>

        <div className="nwsbk-kpi">
          <span className="nwsbk-kpi__icon nwsbk-kpi__icon--orange">
            <ChatIcon />
          </span>
          <div className="nwsbk-kpi__body">
            <p className="nwsbk-kpi__label">Total de reseñas</p>
            <p className="nwsbk-kpi__value">{data.totalReviews}</p>
            <p className="nwsbk-kpi__sub">Esta {periodoAdjective === "semanal" ? "semana" : periodoAdjective === "mensual" ? "mes" : "trimestre"}</p>
          </div>
        </div>

        <div className="nwsbk-kpi">
          <span className="nwsbk-kpi__icon nwsbk-kpi__icon--green">
            <SmileIcon />
          </span>
          <div className="nwsbk-kpi__body">
            <p className="nwsbk-kpi__label">Reseñas positivas</p>
            <p className="nwsbk-kpi__value nwsbk-kpi__value--green">{data.positiveReviews}</p>
            <p className="nwsbk-kpi__sub">{data.positivePercent.toFixed(1)}% del total</p>
          </div>
        </div>

        <div className="nwsbk-kpi">
          <span className="nwsbk-kpi__icon nwsbk-kpi__icon--red">
            <FrownIcon />
          </span>
          <div className="nwsbk-kpi__body">
            <p className="nwsbk-kpi__label">Reseñas negativas</p>
            <p className="nwsbk-kpi__value nwsbk-kpi__value--red">{data.negativeReviews}</p>
            <p className="nwsbk-kpi__sub">{data.negativePercent.toFixed(1)}% del total</p>
          </div>
        </div>

        <div className="nwsbk-kpi">
          <span className="nwsbk-kpi__icon nwsbk-kpi__icon--orange">
            <StarIcon />
          </span>
          <div className="nwsbk-kpi__body">
            <p className="nwsbk-kpi__label">Media {periodoAdjective}</p>
            <p className="nwsbk-kpi__value">{decimalAverage}</p>
            <p className="nwsbk-kpi__sub">Sobre 5 estrellas</p>
          </div>
        </div>

      </section>

      <section className="nwsbk-body">
        <div className="nwsbk-panel">
          <p className="nwsbk-panel__title">Rendimiento por restaurante</p>
          <div className="nwsbk-table">
            <div className="nwsbk-table__row nwsbk-table__row--head">
              <span>#</span>
              <span>Restaurante</span>
              <span>Reseñas</span>
              <span>Media</span>
              <span>Estado</span>
              <span>Motivo principal</span>
            </div>
            {data.locations.map((loc, index) => (
              <div className="nwsbk-table__row" key={loc.name}>
                <span className="nwsbk-table__index">{index + 1}</span>
                <span className="nwsbk-table__name">{loc.name}</span>
                <span className="nwsbk-table__reviews">{loc.reviewCount}</span>
                <span
                  className={
                    loc.status === "risk"
                      ? "nwsbk-table__rating--bad"
                      : loc.status === "watch"
                        ? "nwsbk-table__rating--watch"
                        : "nwsbk-table__rating--good"
                  }
                >
                  {loc.rating != null ? loc.rating.toFixed(2) : "—"}
                </span>
                <span className="nwsbk-table__status">
                  <StatusDot status={loc.status} />
                </span>
                <span className="nwsbk-table__motive">{loc.mainNegativeMotive}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="nwsbk-panel nwsbk-panel--donut">
          <p className="nwsbk-panel__title">Distribución de motivos negativos</p>
          <p className="nwsbk-panel__hint">
            Basado en {data.negativeReasonsTotal} reseña{data.negativeReasonsTotal === 1 ? "" : "s"} con motivo identificado.
          </p>

          <div className="nwsbk-donut-row">
            <NegativeReasonsDonutBk segments={data.negativeReasons} />
            {data.negativeReasons.length > 0 ? (
              <ul className="nwsbk-legend">
                {data.negativeReasons.map((segment, index) => (
                  <li key={segment.label}>
                    <span
                      className="nwsbk-legend__swatch"
                      style={{
                        background: ["#E00000", "#E85D2A", "#FF6500", "#FF9500", "#08751D", "#046014"][index % 6],
                      }}
                      aria-hidden
                    />
                    <span className="nwsbk-legend__label">{segment.label}</span>
                    <span className="nwsbk-legend__count">{segment.count}</span>
                    <span className="nwsbk-legend__percent">({segment.percent.toFixed(1)}%)</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </section>

      <footer className="nwsbk-footer">
        <span className="nwsbk-footer__pillar">
          <span className="nwsbk-footer__item">Fuente: Google Maps (Reseñas)</span>
        </span>
        <span className="nwsbk-footer__pillar">
          <span className="nwsbk-footer__item">Nexo Origen – {data.periodLabel.split(" de ").slice(-2).join(" de ")}</span>
        </span>
        <span className="nwsbk-footer__pillar">
          <span className="nwsbk-footer__item nwsbk-footer__item--web">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
            </svg>
            www.nexoorigen.com
          </span>
        </span>
      </footer>
    </div>
  );
}
