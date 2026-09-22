import type { NetworkSummaryData } from "@/lib/reports/network-summary/types";
import type { NetworkSummaryGroupVisual } from "@/lib/reports/network-summary/group-visuals";
import { NegativeReasonsDonutTh } from "./negative-reasons-donut-th";
import "./network-summary-th.css";

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
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" strokeWidth="2" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke={color} strokeWidth="3.2" aria-hidden>
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WarningIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke={color} strokeWidth="2.4" aria-hidden>
      <path d="M12 8v5" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="0.9" fill={color} stroke="none" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function ChatDotsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#C8102E" strokeWidth="2" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" strokeLinejoin="round" />
      <circle cx="8.5" cy="10.5" r="1.1" fill="#C8102E" stroke="none" />
      <circle cx="12" cy="10.5" r="1.1" fill="#C8102E" stroke="none" />
      <circle cx="15.5" cy="10.5" r="1.1" fill="#C8102E" stroke="none" />
    </svg>
  );
}

function SmileIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#08712F" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 13c1 1.3 2.5 2 4 2s3-.7 4-2" strokeLinecap="round" />
      <path d="M9 9h.01M15 9h.01" strokeLinecap="round" strokeWidth="2.6" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="#C8102E" aria-hidden>
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.6l-5.9 3 1.3-6.6-4.9-4.6 6.6-.8L12 2.5Z" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#C8102E" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#fff" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#fff" strokeWidth="2" aria-hidden>
      <path d="M12 20.5S3 14.8 3 8.9C3 5.9 5.3 4 7.8 4c1.6 0 3.2.9 4.2 2.4C13 4.9 14.6 4 16.2 4c2.5 0 4.8 1.9 4.8 4.9 0 5.9-9 11.6-9 11.6Z" strokeLinejoin="round" />
    </svg>
  );
}

function ratingClass(status: NetworkSummaryData["locations"][number]["status"]): string {
  if (status === "risk") return "nwsth-table__rating--bad";
  if (status === "watch") return "nwsth-table__rating--watch";
  return "nwsth-table__rating--good";
}

function dotColor(status: NetworkSummaryData["locations"][number]["status"]): string {
  if (status === "risk") return "#CC0A12";
  if (status === "watch") return "#E39113";
  if (status === "no_reviews") return "#B0B0B0";
  return "#08712F";
}

function periodNounPhrase(periodoAdjective: string): string {
  if (periodoAdjective === "semanal") return "esta semana";
  if (periodoAdjective === "mensual") return "este mes";
  return "este trimestre";
}

export function NetworkSummaryThTemplate({ data, visual, periodoAdjective, assetBaseUrl }: Props) {
  const decimalAverage = data.weightedAverage.toFixed(4).replace(".", ",");
  const decimalTarget = data.targetAverage.toFixed(1).replace(".", ",");
  const impactGood = data.belowTargetCount === 0;
  const periodNoun = periodNounPhrase(periodoAdjective);

  return (
    <div className="nwsth-canvas">
      <header className="nwsth-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={absUrl(assetBaseUrl, "/design/tim-hortons/th-logo.png")} alt="Tim Hortons" className="nwsth-header__logo" />

        <div className="nwsth-header__title-block">
          <p className="nwsth-header__kicker">Informe {periodoAdjective}</p>
          <p className="nwsth-header__title">{visual.brandTitle}</p>
          <p className="nwsth-header__subtitle">{visual.brandSubtitle}</p>
          <p className="nwsth-header__pin">
            <PinIcon />
            {data.groupSublabel ?? "Red de Locales"}
          </p>
        </div>

        <div className="nwsth-header__nexo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={absUrl(assetBaseUrl, "/design/tim-hortons/nexo-origen-logo.png")}
            alt="Nexo Origen"
            className="nwsth-header__nexo-logo"
          />
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/tim-hortons/th-network-header.png")}
          alt=""
          aria-hidden
          className="nwsth-header__photo"
        />

        <p className="nwsth-date-bar">
          <CalendarIcon />
          <span className="nwsth-date-bar__label">Fecha analizada:</span>
          <span className="nwsth-date-bar__value">{data.periodLabel}</span>
        </p>
      </header>

      <section className="nwsth-kpis">
        <div className="nwsth-kpi">
          <p className="nwsth-kpi__label">Impacto en media {periodoAdjective}</p>
          <p className="nwsth-kpi__sub-caption">Locales por debajo del objetivo ({decimalTarget}):</p>
          <p className={`nwsth-kpi__value ${impactGood ? "nwsth-kpi__value--good" : "nwsth-kpi__value--bad"}`}>
            {data.belowTargetCount}
          </p>
          {impactGood ? (
            <p className="nwsth-kpi__foot nwsth-kpi__foot--good">Todos los locales alcanzan el objetivo</p>
          ) : (
            <p className="nwsth-kpi__foot">{data.belowTargetLocations.join(", ")}</p>
          )}
          <span className={`nwsth-kpi__icon ${impactGood ? "nwsth-kpi__icon--good" : "nwsth-kpi__icon--bad"}`}>
            {impactGood ? <CheckIcon color="#08712F" /> : <WarningIcon color="#CC0A12" />}
          </span>
        </div>

        <div className="nwsth-kpi">
          <p className="nwsth-kpi__label">Nº de reseñas</p>
          <p className="nwsth-kpi__value nwsth-kpi__value--red">{data.totalReviews}</p>
          <p className="nwsth-kpi__foot">
            Total de reseñas
            <br />
            {periodNoun}
          </p>
          <span className="nwsth-kpi__icon nwsth-kpi__icon--bad">
            <ChatDotsIcon />
          </span>
        </div>

        <div className="nwsth-kpi">
          <p className="nwsth-kpi__label">Reseñas negativas</p>
          <p className="nwsth-kpi__value nwsth-kpi__value--red">{data.negativeReviews}</p>
          <p className="nwsth-kpi__foot">{data.negativePercent.toFixed(1).replace(".", ",")}% del total</p>
          {/* La referencia mantiene el icono verde/sonriente aquí a propósito,
              aunque haya reseñas negativas — no es un semáforo de estado. */}
          <span className="nwsth-kpi__icon nwsth-kpi__icon--good">
            <SmileIcon />
          </span>
        </div>

        <div className="nwsth-kpi">
          <p className="nwsth-kpi__label">Media {periodoAdjective}</p>
          <p className="nwsth-kpi__value nwsth-kpi__value--red">{decimalAverage}</p>
          <p className="nwsth-kpi__foot">
            Sobre 5 estrellas ·<br />
            Objetivo: {decimalTarget}
          </p>
          <span className="nwsth-kpi__icon nwsth-kpi__icon--bad">
            <StarIcon />
          </span>
        </div>
      </section>

      <section className="nwsth-body">
        <div className="nwsth-panel">
          <p className="nwsth-panel__title">Tabla de locales</p>
          <div className="nwsth-table">
            <div className="nwsth-table__row nwsth-table__row--head">
              <span>Local</span>
              <span>Media {periodoAdjective}</span>
              <span>Nº reseñas</span>
              <span>Estado</span>
              <span>Motivo</span>
            </div>
            {data.locations.map((loc) => (
              <div className="nwsth-table__row" key={loc.name}>
                <span className="nwsth-table__name">{loc.name}</span>
                <span className={ratingClass(loc.status)}>{loc.rating != null ? loc.rating.toFixed(2).replace(".", ",") : "—"}</span>
                <span className="nwsth-table__reviews">{loc.reviewCount}</span>
                <span className="nwsth-table__status">
                  <span className="nwsth-dot" style={{ background: dotColor(loc.status) }} aria-hidden />
                  {loc.statusLabel}
                </span>
                <span className="nwsth-tag">{loc.mainNegativeMotive}</span>
              </div>
            ))}
          </div>
          <p className="nwsth-table__target">
            <TargetIcon />
            Objetivo de media: {decimalTarget}
          </p>
        </div>

        <div className="nwsth-panel">
          <p className="nwsth-panel__title">Distribución de reseñas negativas</p>
          <p className="nwsth-panel__hint">
            Total reseñas negativas: <strong>{data.negativeReviews}</strong> ({data.negativePercent.toFixed(1).replace(".", ",")}% del total)
          </p>

          {data.negativeReasons.length > 0 ? (
            <div className="nwsth-donut-row">
              <NegativeReasonsDonutTh segments={data.negativeReasons} />
              <ul className="nwsth-legend">
                {data.negativeReasons.map((segment, index) => (
                  <li key={segment.label}>
                    <span
                      className="nwsth-legend__swatch"
                      style={{ background: ["#CC0008", "#A86A2E", "#E39113", "#08712F", "#4E4641", "#D30B16"][index % 6] }}
                      aria-hidden
                    />
                    <span className="nwsth-legend__text">
                      {segment.label} — {segment.count} reseña{segment.count === 1 ? "" : "s"} ({segment.percent.toFixed(1).replace(".", ",")}%)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="nwsth-donut-empty">
              Sin reseñas negativas
              <br />
              {periodNoun}
            </div>
          )}
        </div>
      </section>

      <footer className="nwsth-footer">
        <span className="nwsth-footer__pillar">
          <span className="nwsth-footer__item">Nexo Origen</span>
        </span>
        <span className="nwsth-footer__pillar">
          <span className="nwsth-footer__item nwsth-footer__item--web">
            <GlobeIcon />
            www.nexoorigen.com
          </span>
        </span>
        <span className="nwsth-footer__pillar">
          <span className="nwsth-footer__item nwsth-footer__item--tagline">
            <HeartIcon />
            <span className="nwsth-footer__tagline">{visual.footerTagline}</span>
          </span>
        </span>
      </footer>
    </div>
  );
}
