import type { NetworkSummaryData } from "@/lib/reports/network-summary/types";
import type { NetworkSummaryGroupVisual } from "@/lib/reports/network-summary/group-visuals";
import { NegativeReasonsDonutSg } from "./negative-reasons-donut-sg";
import "./network-summary-sg.css";

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

/** "Sin reseñas negativas" / "Sin motivo" se marcan como neutrales (verde); cualquier motivo real es negativo (rojo). */
function isNeutralMotive(motive: string): boolean {
  return /^sin /i.test(motive.trim());
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

function SearchStarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#30251C" strokeWidth="1.7" aria-hidden>
      <circle cx="10.5" cy="10.5" r="7" />
      <path d="m20.5 20.5-4.3-4.3" strokeLinecap="round" />
      <path d="M10.5 7.2 11.3 9l1.9.2-1.4 1.3.4 1.9-1.7-1-1.7 1 .4-1.9-1.4-1.3 1.9-.2Z" />
    </svg>
  );
}

function TrendUpIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#C90812" strokeWidth="1.8" aria-hidden>
      <path d="M3 16 9.5 9l4 4L21 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 5h6v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#2A1808" strokeWidth="1.7" aria-hidden>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.7 20c0-3.5 2.8-6 6.3-6s6.3 2.5 6.3 6" strokeLinecap="round" />
      <path d="M15.7 8.4a3.1 3.1 0 0 1 0 6.1" strokeLinecap="round" />
      <path d="M18 14c2.2.5 3.8 2.3 3.8 4.9" strokeLinecap="round" />
    </svg>
  );
}

function FrownIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#C90812" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 15c1-1.3 2.5-2 4-2s3 .7 4 2" strokeLinecap="round" />
      <path d="M9 9h.01M15 9h.01" strokeLinecap="round" strokeWidth="2.5" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="#2A1808" aria-hidden>
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.6l-5.9 3 1.3-6.6-4.9-4.6 6.6-.8L12 2.5Z" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#2B1808" strokeWidth="1.7" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

function FlowerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#3A2513" strokeWidth="1.5" aria-hidden>
      <circle cx="12" cy="12" r="2.3" />
      <path d="M12 9.7c-1.6 0-3-1-3-2.9 0-1.3 1-2.3 2.3-2.3 1.9 0 2.9 1.4 2.9 3" />
      <path d="M14.3 12c0-1.6 1-3 2.9-3 1.3 0 2.3 1 2.3 2.3 0 1.9-1.4 2.9-3 2.9" />
      <path d="M12 14.3c1.6 0 3 1 3 2.9 0 1.3-1 2.3-2.3 2.3-1.9 0-2.9-1.4-2.9-3" />
      <path d="M9.7 12c0 1.6-1 3-2.9 3C5.5 15 4.5 14 4.5 12.7c0-1.9 1.4-2.9 3-2.9" />
    </svg>
  );
}

function BotanicalBranch() {
  return (
    <svg viewBox="0 0 300 300" width="290" height="290" className="nwssg-branch" aria-hidden>
      <g fill="none" stroke="#3A2513" strokeWidth="1.6" strokeLinecap="round">
        <path d="M290 290C230 250 190 210 160 160c-25-42-35-80-30-140" />
        <path d="M175 195c15-10 30-12 46-6" />
        <path d="M155 155c16-6 30-4 44 4" />
        <path d="M138 118c15-3 28 1 39 10" />
        <path d="M122 82c13-1 24 4 33 13" />
        <ellipse cx="221" cy="189" rx="17" ry="7" transform="rotate(-18 221 189)" />
        <ellipse cx="199" cy="149" rx="16" ry="6.5" transform="rotate(-12 199 149)" />
        <ellipse cx="182" cy="112" rx="14" ry="6" transform="rotate(-8 182 112)" />
        <ellipse cx="160" cy="80" rx="12" ry="5" transform="rotate(-4 160 80)" />
      </g>
    </svg>
  );
}

export function NetworkSummarySgTemplate({ data, visual, periodoAdjective, assetBaseUrl }: Props) {
  const decimalAverage = data.weightedAverage.toFixed(2).replace(".", ",");
  const decimalTarget = data.targetAverage.toFixed(1).replace(".", ",");

  return (
    <div className="nwssg-canvas">
      <header className="nwssg-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={absUrl(assetBaseUrl, "/design/santa-gloria/sg-logo.png")} alt="" aria-hidden className="nwssg-header__logo" />
        <span className="nwssg-header__sep" aria-hidden />

        <div className="nwssg-header__title-block">
          <p className="nwssg-header__kicker">Informe {periodoAdjective}</p>
          <p className="nwssg-header__title">{visual.brandTitle}</p>
          <p className="nwssg-header__cities">{visual.brandSubtitle}</p>
          <p className="nwssg-header__subtitle">EXPERIENCIA DEL CLIENTE</p>
          <p className="nwssg-header__pin">
            <PinIcon />
            {data.groupSublabel ?? "Red de Locales"}
          </p>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/santa-gloria/sg-network-header.png")}
          alt=""
          aria-hidden
          className="nwssg-header__photo"
        />

        <div className="nwssg-header__nexo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={absUrl(assetBaseUrl, "/design/santa-gloria/nexo-origen-logo.png")}
            alt="Nexo Origen"
            className="nwssg-header__nexo-logo"
          />
          <div className="nwssg-header__nexo-claim">
            <SearchStarIcon />
            <p>
              <span className="nwssg-header__nexo-claim-accent">Analizamos</span> cada reseña
              <br />
              para seguir mejorando.
            </p>
          </div>
        </div>

        <p className="nwssg-date-bar">
          <CalendarIcon />
          <span className="nwssg-date-bar__label">Fecha analizada:</span>
          <span className="nwssg-date-bar__value">{data.periodLabel}</span>
        </p>
      </header>

      <section className="nwssg-kpis">
        <div className="nwssg-kpi">
          <div className="nwssg-kpi__body">
            <p className="nwssg-kpi__label">Impacto en media {periodoAdjective}</p>
            <div className="nwssg-kpi__row">
              <span className="nwssg-kpi__value nwssg-kpi__value--bad">{data.belowTargetCount}</span>
              <span className="nwssg-kpi__icon nwssg-kpi__icon--bad">
                <TrendUpIcon />
              </span>
            </div>
            <p className="nwssg-kpi__sub">
              Locales por debajo del objetivo ({decimalTarget}):{" "}
              <strong>{data.belowTargetCount > 0 ? data.belowTargetLocations.join(", ") : "ninguno"}</strong>
            </p>
          </div>
        </div>

        <div className="nwssg-kpi">
          <div className="nwssg-kpi__body">
            <p className="nwssg-kpi__label">Nº de reseñas</p>
            <div className="nwssg-kpi__row">
              <span className="nwssg-kpi__value">{data.totalReviews}</span>
              <span className="nwssg-kpi__icon">
                <PeopleIcon />
              </span>
            </div>
            <p className="nwssg-kpi__sub">
              Total de reseñas esta {periodoAdjective === "semanal" ? "semana" : periodoAdjective === "mensual" ? "mes" : "trimestre"}
            </p>
          </div>
        </div>

        <div className="nwssg-kpi">
          <div className="nwssg-kpi__body">
            <p className="nwssg-kpi__label">Reseñas negativas</p>
            <div className="nwssg-kpi__row">
              <span className="nwssg-kpi__value nwssg-kpi__value--bad">{data.negativeReviews}</span>
              <span className="nwssg-kpi__icon nwssg-kpi__icon--bad">
                <FrownIcon />
              </span>
            </div>
            <p className="nwssg-kpi__sub">{data.negativePercent.toFixed(1).replace(".", ",")}% del total</p>
          </div>
        </div>

        <div className="nwssg-kpi">
          <div className="nwssg-kpi__body">
            <p className="nwssg-kpi__label">Media {periodoAdjective}</p>
            <div className="nwssg-kpi__row">
              <span className="nwssg-kpi__value">{decimalAverage}</span>
              <span className="nwssg-kpi__icon">
                <StarIcon />
              </span>
            </div>
            <p className="nwssg-kpi__sub">Sobre 5 estrellas · Objetivo: {decimalTarget}</p>
          </div>
        </div>
      </section>

      <section className="nwssg-body">
        <div className="nwssg-panel">
          <p className="nwssg-panel__title">Tabla de locales</p>
          <div className="nwssg-table">
            <div className="nwssg-table__row nwssg-table__row--head">
              <span>Local</span>
              <span>Media {periodoAdjective}</span>
              <span>Nº reseñas</span>
              <span>Estado</span>
              <span>Motivo principal</span>
            </div>
            {data.locations.map((loc) => (
              <div className="nwssg-table__row" key={loc.name}>
                <span className="nwssg-table__name">{loc.name}</span>
                <span
                  className={
                    loc.status === "risk"
                      ? "nwssg-table__rating--bad"
                      : loc.status === "watch"
                        ? "nwssg-table__rating--watch"
                        : "nwssg-table__rating--good"
                  }
                >
                  {loc.rating != null ? loc.rating.toFixed(2).replace(".", ",") : "—"}
                </span>
                <span className="nwssg-table__reviews">{loc.reviewCount}</span>
                <span className="nwssg-table__status">
                  <span
                    className="nwssg-dot"
                    style={{
                      background:
                        loc.status === "risk" ? "#D00810" : loc.status === "watch" ? "#C98A1D" : "#006B2C",
                    }}
                    aria-hidden
                  />
                </span>
                <span className={`nwssg-tag ${isNeutralMotive(loc.mainNegativeMotive) ? "nwssg-tag--good" : "nwssg-tag--bad"}`}>
                  {loc.mainNegativeMotive}
                </span>
              </div>
            ))}
          </div>
          <p className="nwssg-table__target">Objetivo de media: {decimalTarget}</p>
        </div>

        <div className="nwssg-panel nwssg-panel--donut">
          <p className="nwssg-panel__title">% de reseñas negativas</p>
          <p className="nwssg-panel__hint">
            Total reseñas negativas: <strong>{data.negativeReviews}</strong> ({data.negativePercent.toFixed(1).replace(".", ",")}% del total)
          </p>

          <div className="nwssg-donut-row">
            <NegativeReasonsDonutSg segments={data.negativeReasons} />
            {data.negativeReasons.length > 0 ? (
              <ul className="nwssg-legend">
                {data.negativeReasons.map((segment, index) => (
                  <li key={segment.label}>
                    <span
                      className="nwssg-legend__swatch"
                      style={{
                        background: ["#4A290A", "#D6A166", "#8B5A2B", "#C9A876", "#2B1808", "#E8C896"][index % 6],
                      }}
                      aria-hidden
                    />
                    <span className="nwssg-legend__text">
                      <span className="nwssg-legend__label">{segment.label}</span>
                      <span className="nwssg-legend__detail">
                        {segment.count} reseña{segment.count === 1 ? "" : "s"} ({segment.percent.toFixed(1).replace(".", ",")}%)
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <BotanicalBranch />
        </div>
      </section>

      <footer className="nwssg-footer">
        <FlowerIcon />
        <span className="nwssg-footer__script">{visual.footerTagline}</span>
        <span className="nwssg-footer__sep" aria-hidden />
        <span className="nwssg-footer__item">Fuente: Google Maps (Reseñas)</span>
        <span className="nwssg-footer__sep" aria-hidden />
        <span className="nwssg-footer__item">Nexo Origen – {data.periodLabel.split(" de ").slice(-2).join(" de ")}</span>
        <span className="nwssg-footer__sep" aria-hidden />
        <span className="nwssg-footer__item nwssg-footer__item--web">
          <GlobeIcon />
          www.nexoorigen.com
        </span>
      </footer>
    </div>
  );
}
