import type { NetworkSummaryData } from "@/lib/reports/network-summary/types";
import type { NetworkSummaryGroupVisual } from "@/lib/reports/network-summary/group-visuals";
import { NegativeReasonsDonutPp } from "./negative-reasons-donut-pp";
import "./network-summary-pp.css";

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

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#F76800" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#F76800" strokeWidth="2.4" aria-hidden>
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#F76800" strokeWidth="2" aria-hidden>
      <circle cx="9" cy="8" r="3.3" />
      <path d="M2.5 20c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2" strokeLinecap="round" />
      <path d="M16 8.2a3.2 3.2 0 0 1 0 6.3" strokeLinecap="round" />
      <path d="M18.5 13.9c2.3.5 4 2.4 4 5.1" strokeLinecap="round" />
    </svg>
  );
}

function FrownIcon({ color = "#F76800" }: { color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke={color} strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 15c1-1.3 2.5-2 4-2s3 .7 4 2" strokeLinecap="round" />
      <path d="M9 9h.01M15 9h.01" strokeLinecap="round" strokeWidth="2.6" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="#F76800" aria-hidden>
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.6l-5.9 3 1.3-6.6-4.9-4.6 6.6-.8L12 2.5Z" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#F76800" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

function StatusDot({ status }: { status: NetworkSummaryData["locations"][number]["status"] }) {
  const color =
    status === "risk" ? "#FF2D20" : status === "watch" ? "#FF9813" : status === "no_reviews" ? "#B0B0B0" : "#159A35";
  return <span className="nwspp-dot" style={{ background: color }} aria-hidden />;
}

export function NetworkSummaryPpTemplate({ data, visual, periodoAdjective, assetBaseUrl }: Props) {
  const decimalAverage = data.weightedAverage.toFixed(2).replace(".", ",");

  return (
    <div className="nwspp-canvas">
      <header className="nwspp-header">
        <div
          className="nwspp-header__main"
          style={{
            backgroundImage: visual.headerBackgroundImage
              ? `url(${absUrl(assetBaseUrl, visual.headerBackgroundImage)})`
              : undefined,
          }}
        >
          <div className="nwspp-header__blend" aria-hidden />

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={absUrl(assetBaseUrl, "/design/popeyes/pp-wordmark-2.png")}
            alt=""
            aria-hidden
            className="nwspp-header__logo"
          />

          <div className="nwspp-header__title-block">
            <p className="nwspp-header__kicker">Informe {periodoAdjective}</p>
            <p className="nwspp-header__title">{visual.brandTitle}</p>
            <p className="nwspp-header__subtitle">{visual.brandSubtitle}</p>
            <p className="nwspp-header__pin">
              <PinIcon />
              {data.groupSublabel ?? "Red de Restaurantes"}
            </p>
          </div>

          <p className="nwspp-date-bar">
            <CalendarIcon />
            <span className="nwspp-date-bar__label">Fecha analizada:</span>
            <span className="nwspp-date-bar__value">{data.periodLabel}</span>
          </p>
        </div>

        <div className="nwspp-header__nexo">
          <div className="nwspp-header__nexo-logo-slot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={absUrl(assetBaseUrl, "/design/popeyes/nexo-origen-logo-2.png")}
              alt="Nexo Origen"
              className="nwspp-header__nexo-logo"
            />
          </div>
          <div className="nwspp-header__nexo-splash" aria-hidden />
          <div className="nwspp-header__nexo-claim">
            <SearchIcon />
            <p>
              <span className="nwspp-header__nexo-claim-accent">Analizamos</span> cada reseña para seguir mejorando.
            </p>
          </div>
        </div>
      </header>

      <section className="nwspp-kpis">
        <div className="nwspp-kpi">
          <div className="nwspp-kpi__body">
            <p className="nwspp-kpi__label">Impacto en media {periodoAdjective}</p>
            <p className="nwspp-kpi__sub-caption">
              Locales fuera de objetivo ({data.targetAverage.toFixed(1).replace(".", ",")})
            </p>
            {data.belowTargetCount > 0 ? (
              <ul className="nwspp-kpi__dot-list">
                {data.belowTargetLocations.slice(0, 4).map((name) => (
                  <li key={name}>{name}</li>
                ))}
                {data.belowTargetLocations.length > 4 ? <li>+{data.belowTargetLocations.length - 4} más</li> : null}
              </ul>
            ) : (
              <p className="nwspp-kpi__sub">Todos los locales alcanzan el objetivo</p>
            )}
          </div>
          <span className="nwspp-kpi__icon">
            <CheckCircleIcon />
          </span>
        </div>

        <div className="nwspp-kpi">
          <div className="nwspp-kpi__body">
            <p className="nwspp-kpi__label">Nº de reseñas</p>
            <p className="nwspp-kpi__value">{data.totalReviews}</p>
            <p className="nwspp-kpi__sub">
              Total de reseñas esta {periodoAdjective === "semanal" ? "semana" : periodoAdjective === "mensual" ? "mes" : "trimestre"}
            </p>
          </div>
          <span className="nwspp-kpi__icon">
            <PeopleIcon />
          </span>
        </div>

        <div className="nwspp-kpi">
          <div className="nwspp-kpi__body">
            <p className="nwspp-kpi__label">Reseñas negativas</p>
            <p className="nwspp-kpi__value nwspp-kpi__value--bad">{data.negativeReviews}</p>
            <p className="nwspp-kpi__sub">{data.negativePercent.toFixed(1).replace(".", ",")}% del total</p>
          </div>
          <span className="nwspp-kpi__icon nwspp-kpi__icon--bad">
            <FrownIcon color="#FF2D20" />
          </span>
        </div>

        <div className="nwspp-kpi">
          <div className="nwspp-kpi__body">
            <p className="nwspp-kpi__label">Media {periodoAdjective}</p>
            <p className="nwspp-kpi__value">{decimalAverage}</p>
            <p className="nwspp-kpi__sub">Sobre 5 estrellas · Objetivo: {data.targetAverage.toFixed(1).replace(".", ",")}</p>
          </div>
          <span className="nwspp-kpi__icon">
            <StarIcon />
          </span>
        </div>
      </section>

      <section className="nwspp-body">
        <div className="nwspp-panel">
          <p className="nwspp-panel__title">Tabla de locales</p>
          <div className="nwspp-table">
            <div className="nwspp-table__row nwspp-table__row--head">
              <span>Local</span>
              <span>Media {periodoAdjective}</span>
              <span>Nº reseñas</span>
              <span>Estado</span>
              <span>Motivo</span>
            </div>
            {data.locations.map((loc) => (
              <div className="nwspp-table__row" key={loc.name}>
                <span className="nwspp-table__name">{loc.name}</span>
                <span
                  className={
                    loc.status === "risk"
                      ? "nwspp-table__rating--bad"
                      : loc.status === "watch"
                        ? "nwspp-table__rating--watch"
                        : "nwspp-table__rating--good"
                  }
                >
                  {loc.rating != null ? loc.rating.toFixed(2).replace(".", ",") : "—"}
                </span>
                <span className="nwspp-table__reviews">{loc.reviewCount}</span>
                <span className="nwspp-table__status">
                  <StatusDot status={loc.status} />
                  {loc.statusLabel}
                </span>
                <span className="nwspp-table__motive">{loc.mainNegativeMotive}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="nwspp-panel nwspp-panel--donut">
          <p className="nwspp-panel__title">% de reseñas negativas</p>
          <p className="nwspp-panel__hint">
            Total reseñas negativas: <strong>{data.negativeReviews}</strong> ({data.negativePercent.toFixed(1).replace(".", ",")}% del total)
          </p>

          <div className="nwspp-donut-row">
            <NegativeReasonsDonutPp segments={data.negativeReasons} />
            {data.negativeReasons.length > 0 ? (
              <ul className="nwspp-legend">
                {data.negativeReasons.map((segment, index) => (
                  <li key={segment.label}>
                    <span
                      className="nwspp-legend__swatch"
                      style={{
                        background: ["#F76800", "#FF9B17", "#35B8B4", "#FFCB3D", "#E85500", "#FFE08A"][index % 6],
                      }}
                      aria-hidden
                    />
                    <span className="nwspp-legend__label">{segment.label}</span>
                    <span className="nwspp-legend__count">{segment.count}</span>
                    <span className="nwspp-legend__percent">{segment.percent.toFixed(1).replace(".", ",")}%</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={absUrl(assetBaseUrl, "/design/popeyes/pp-rooster.png")}
            alt=""
            aria-hidden
            className="nwspp-donut-card__splash"
          />
        </div>
      </section>

      <footer className="nwspp-footer">
        <span className="nwspp-footer__pillar">
          <span className="nwspp-footer__brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={absUrl(assetBaseUrl, "/design/popeyes/pp-fleur.png")} alt="" aria-hidden className="nwspp-footer__logo" />
            Famous Louisiana Chicken
          </span>
        </span>
        <span className="nwspp-footer__pillar">
          <span className="nwspp-footer__item">Fuente: Google Maps (Reseñas)</span>
        </span>
        <span className="nwspp-footer__pillar">
          <span className="nwspp-footer__item">Nexo Origen – {data.periodLabel.split(" de ").slice(-2).join(" de ")}</span>
        </span>
        <span className="nwspp-footer__pillar">
          <span className="nwspp-footer__item nwspp-footer__item--web">
            <GlobeIcon />
            www.nexoorigen.com
          </span>
        </span>
      </footer>
    </div>
  );
}
