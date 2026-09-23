import type { NetworkSummaryData, NetworkSummaryLocationRow } from "@/lib/reports/network-summary/types";
import type { NetworkSummaryGroupVisual } from "@/lib/reports/network-summary/group-visuals";
import { HB_REASON_PALETTE, NegativeReasonsDonutHb } from "./negative-reasons-donut-hb";
import "./network-summary-hb.css";

/**
 * Informe de red de Grupo Hámbar (Sibuya · Ribs · Volapié) — 1920×1080.
 * Diseño puro: no calcula nada. Recibe NetworkSummaryData ya construido por
 * lib/reports/network-summary/build.ts (fuente única: Supabase) y solo lo
 * formatea. Si un dato no existe se muestra "—", 0 o el texto de vacío que
 * toque; nunca un valor de relleno.
 */

type Props = {
  data: NetworkSummaryData;
  visual: NetworkSummaryGroupVisual;
  periodoAdjective: string;
  assetBaseUrl?: string;
};

const WATCH_THRESHOLD = 4.0;

const BRAND_LOGOS: Record<string, { src: string; alt: string }> = {
  sibuya: { src: "/design/grupo-hambar/sb-logo-trim.png", alt: "Sibuya" },
  ribs: { src: "/design/ribs/rb-logo.png", alt: "Ribs" },
  tv: { src: "/design/taberna-volapie/tv-logo.png", alt: "Taberna del Volapié" },
};

/** Orden de marcas de la cabecera (Sibuya · Ribs · Volapié): desempata locales con la misma media. */
const BRAND_ORDER = ["sibuya", "ribs", "tv"];

const STATUS_LABEL: Record<NetworkSummaryLocationRow["status"], string> = {
  on_target: "Sobre el objetivo",
  watch: "En vigilancia",
  risk: "Fuera del objetivo",
  no_reviews: "Sin reseñas",
};

const STATUS_COLOR: Record<NetworkSummaryLocationRow["status"], string> = {
  on_target: "#087D20",
  watch: "#E8C900",
  risk: "#E50000",
  no_reviews: "#71808A",
};

function absUrl(base: string | undefined, path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) return path;
  if (!base) return path;
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

/** 4.4 → "4,4"; 4.53 → "4,53". */
function commaNumber(value: number, decimals?: number): string {
  const text = decimals == null ? String(value) : value.toFixed(decimals);
  return text.replace(".", ",");
}

/** 0 → "0", 33.3 → "33,3" (sin ceros de relleno). */
function percentText(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}

function periodNounPhrase(periodoAdjective: string): string {
  if (periodoAdjective === "semanal") return "esta semana";
  if (periodoAdjective === "mensual") return "este mes";
  return "este trimestre";
}

/** "14 – 20 SEPT 2026" (mismo mes) · "28 SEPT – 4 OCT 2026" · "30 DIC 2025 – 5 ENE 2026". */
function headerPeriod(startIso: string, endIso: string): string {
  const parts = (iso: string) => {
    // periodStart/periodEnd son días de calendario a mediodía UTC (ver period-ranges.ts).
    const list = new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).formatToParts(new Date(iso));
    const pick = (type: string) => list.find((part) => part.type === type)?.value ?? "";
    return { day: pick("day"), month: pick("month").replace(/\.$/, "").toUpperCase(), year: pick("year") };
  };
  const a = parts(startIso);
  const b = parts(endIso);
  if (a.year === b.year && a.month === b.month) return `${a.day} – ${b.day} ${b.month} ${b.year}`;
  if (a.year === b.year) return `${a.day} ${a.month} – ${b.day} ${b.month} ${b.year}`;
  return `${a.day} ${a.month} ${a.year} – ${b.day} ${b.month} ${b.year}`;
}

/** Filas más compactas cuantos más locales haya, para que siempre quepan todos. */
function locationsTier(count: number): "n3" | "n4" | "n5" | "n6" | "n7" | "n8" {
  if (count <= 3) return "n3";
  if (count === 4) return "n4";
  if (count === 5) return "n5";
  if (count === 6) return "n6";
  if (count === 7) return "n7";
  return "n8";
}

/* ---------- iconos (SVG propios, trazo fino) ---------- */

function UsersIcon({ size = 30, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="11" r="4.2" />
      <path d="M3.8 26c.6-4.6 3.9-7.2 8.2-7.2s7.6 2.6 8.2 7.2" />
      <circle cx="22.5" cy="12" r="3.3" />
      <path d="M22.6 18.6c3.4.3 5.2 2.6 5.7 6.4" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 32 32" width="40" height="40" fill="none" stroke="#C67A00" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4.5" y="6.5" width="23" height="21" rx="3.2" />
      <path d="M10.5 4v5.2M21.5 4v5.2M4.5 12.8h23" />
      <path d="M10.5 18.5h.01M16 18.5h.01M21.5 18.5h.01M10.5 23h.01M16 23h.01" strokeWidth="2.6" />
    </svg>
  );
}

function ChartCheckIcon() {
  return (
    <svg viewBox="0 0 48 48" width="52" height="52" fill="none" aria-hidden>
      <rect x="8" y="24" width="6.5" height="15" rx="1.4" fill="#087D20" />
      <rect x="18.5" y="16" width="6.5" height="23" rx="1.4" fill="#087D20" />
      <rect x="29" y="28" width="6.5" height="11" rx="1.4" fill="#087D20" />
      <path d="M5 41.5h34" stroke="#087D20" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="35.5" cy="14" r="9" fill="#087D20" />
      <path d="m31 14 3.2 3.3 6-6.4" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertChartIcon() {
  return (
    <svg viewBox="0 0 48 48" width="52" height="52" fill="none" aria-hidden>
      <rect x="8" y="24" width="6.5" height="15" rx="1.4" fill="#E50000" />
      <rect x="18.5" y="16" width="6.5" height="23" rx="1.4" fill="#E50000" />
      <rect x="29" y="28" width="6.5" height="11" rx="1.4" fill="#E50000" />
      <path d="M5 41.5h34" stroke="#E50000" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="35.5" cy="14" r="9" fill="#E50000" />
      <path d="M35.5 9.5v5.6" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="35.5" cy="18.6" r="1.5" fill="#fff" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 48 48" width="50" height="50" fill="none" aria-hidden>
      <path d="M8 9.5h32a3 3 0 0 1 3 3v19a3 3 0 0 1-3 3H21l-8.5 7v-7H8a3 3 0 0 1-3-3v-19a3 3 0 0 1 3-3Z" fill="#D98A00" />
      <path d="M12.5 17.5h23M12.5 23.2h23M12.5 28.8h13" stroke="#FFF3D9" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

function SmileIcon() {
  return (
    <svg viewBox="0 0 48 48" width="54" height="54" fill="none" aria-hidden>
      <circle cx="24" cy="24" r="19" fill="#087D20" />
      <path d="M15.5 27c1.8 3.4 4.7 5 8.5 5s6.7-1.6 8.5-5" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="17.5" cy="19" r="2.3" fill="#fff" />
      <circle cx="30.5" cy="19" r="2.3" fill="#fff" />
    </svg>
  );
}

function StarBadgeIcon() {
  return (
    <svg viewBox="0 0 48 48" width="54" height="54" fill="none" aria-hidden>
      <path d="M24 4.5l5.7 12 13.1 1.6-9.7 9.1 2.6 13L24 33.6l-11.7 6.6 2.6-13-9.7-9.1 13.1-1.6L24 4.5Z" fill="#C67A00" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg viewBox="0 0 32 32" width="38" height="38" fill="none" aria-hidden>
      <rect x="4" y="5" width="15" height="23" rx="1.6" fill="#D98A00" />
      <rect x="19" y="12" width="9" height="16" rx="1.6" fill="#E9A82C" />
      <path d="M8 10h2.6M12.6 10h2.6M8 15h2.6M12.6 15h2.6M8 20h2.6M12.6 20h2.6M22 17h2.6M22 22h2.6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ShieldStarIcon({ size = 34, fill = "#E50000", star = "#fff" }: { size?: number; fill?: string; star?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="none" aria-hidden>
      <path d="M16 2.5 4.5 6.6v8.1c0 7 4.8 11.7 11.5 14.8 6.7-3.1 11.5-7.8 11.5-14.8V6.6L16 2.5Z" fill={fill} />
      <path d="m16 9.2 1.9 4 4.3.5-3.2 3 .9 4.3-3.9-2.2-3.9 2.2.9-4.3-3.2-3 4.3-.5 1.9-4Z" fill={star} />
    </svg>
  );
}

function ShieldOutlineStarIcon() {
  return (
    <svg viewBox="0 0 40 40" width="46" height="46" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" aria-hidden>
      <path d="M20 4 6.5 9v10c0 8.4 5.7 14 13.5 17.6C27.800 33 33.500 27.400 33.500 19V9L20 4Z" />
      <path d="m20 12.2 2.3 4.8 5.2.6-3.8 3.6 1 5.2-4.7-2.6-4.7 2.6 1-5.2-3.800-3.600 5.200-.6 2.300-4.800Z" fill="#fff" stroke="none" />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg viewBox="0 0 40 40" width="46" height="46" fill="none" aria-hidden>
      <rect x="8" y="22" width="6" height="12" rx="1.2" fill="#fff" />
      <rect x="17" y="16" width="6" height="18" rx="1.2" fill="#fff" />
      <rect x="26" y="10" width="6" height="24" rx="1.2" fill="#fff" />
      <path d="M7 15.5 15 9l6 4.500L31.500 5" stroke="#fff" strokeWidth="2.400" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M26 4.800h6v6" stroke="#fff" strokeWidth="2.400" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- plantilla ---------- */

export function NetworkSummaryHbTemplate({ data, visual, periodoAdjective, assetBaseUrl }: Props) {
  const target = commaNumber(data.targetAverage);
  const periodNoun = periodNounPhrase(periodoAdjective);
  const hasReviews = data.totalReviews > 0;
  const neutralReviews = Math.max(data.totalReviews - data.positiveReviews - data.negativeReviews, 0);

  const locations = [...data.locations].sort(
    (a, b) =>
      (b.rating ?? -1) - (a.rating ?? -1) ||
      BRAND_ORDER.indexOf(a.brandId) - BRAND_ORDER.indexOf(b.brandId) ||
      a.fullName.localeCompare(b.fullName, "es")
  );

  const belowTargetNames = locations
    .filter((loc) => loc.status === "watch" || loc.status === "risk")
    .map((loc) => loc.fullName);
  const impactGood = data.belowTargetCount === 0;

  const averageText = hasReviews ? commaNumber(data.weightedAverage, 2) : "—";
  const averageClass = !hasReviews
    ? "nwshb-kpi__value--none"
    : data.weightedAverage >= data.targetAverage
      ? "nwshb-kpi__value--gold"
      : data.weightedAverage >= WATCH_THRESHOLD
        ? "nwshb-kpi__value--amber"
        : "nwshb-kpi__value--red";

  const periodText = headerPeriod(data.periodStart, data.periodEnd);
  const periodSize = periodText.length <= 17 ? "" : periodText.length <= 21 ? " nwshb-header__period-value--md" : " nwshb-header__period-value--sm";
  const negativePercentText = percentText(hasReviews ? data.negativePercent : 0);
  const donutPctSize = negativePercentText.length <= 3 ? "" : negativePercentText.length === 4 ? " nwshb-donut__pct--md" : " nwshb-donut__pct--sm";
  const noNegatives = data.negativeReviews === 0;
  const mainReason = data.negativeReasons[0]?.label ?? null;
  const reasonRows = Math.max(data.negativeReasons.length, 4);

  return (
    <div className="nwshb-canvas">
      <header className="nwshb-header">
        <div className="nwshb-header__panel">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={absUrl(assetBaseUrl, visual.logo)} alt="Grupo Hámbar" className="nwshb-header__logo" />
          <p className="nwshb-header__kicker">{visual.brandSubtitle}</p>
          <div className="nwshb-header__rule" />
          <p className="nwshb-header__network">
            <UsersIcon />
            Red multi-marca
          </p>
          <div className="nwshb-header__period">
            <CalendarIcon />
            <div>
              <p className="nwshb-header__period-label">Periodo analizado</p>
              <p className={`nwshb-header__period-value${periodSize}`}>{periodText}</p>
            </div>
          </div>
        </div>
        {/* Fotografía real de las tres marcas: no se recompone ni se rotula (los nombres ya vienen en el archivo). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/grupo-hambar/hb-header.png")}
          alt="Sibuya, Ribs y Volapié"
          className="nwshb-header__photo"
        />
      </header>

      <section className="nwshb-kpis">
        <div className="nwshb-kpi">
          <p className="nwshb-kpi__label">Impacto en media {periodoAdjective}</p>
          <p className="nwshb-kpi__sub">Locales por debajo del objetivo ({target}):</p>
          <p className={`nwshb-kpi__value ${impactGood ? "nwshb-kpi__value--green" : "nwshb-kpi__value--red"}`}>
            {data.belowTargetCount}
          </p>
          <p className="nwshb-kpi__foot nwshb-kpi__foot--dot">
            <span className="nwshb-dot" style={{ background: impactGood ? "#087D20" : "#E50000" }} aria-hidden />
            <span className="nwshb-kpi__foot-text">
              {impactGood ? "Ningún local por debajo del objetivo" : belowTargetNames.join(", ")}
            </span>
          </p>
          <span className={`nwshb-kpi__icon ${impactGood ? "nwshb-kpi__icon--green" : "nwshb-kpi__icon--red"}`}>
            {impactGood ? <ChartCheckIcon /> : <AlertChartIcon />}
          </span>
        </div>

        <div className="nwshb-kpi">
          <p className="nwshb-kpi__label">Nº de reseñas</p>
          <p className="nwshb-kpi__value nwshb-kpi__value--gold">{data.totalReviews}</p>
          <p className="nwshb-kpi__foot">
            Total de reseñas
            <br />
            {periodNoun}
          </p>
          <span className="nwshb-kpi__icon nwshb-kpi__icon--gold">
            <CommentIcon />
          </span>
        </div>

        <div className="nwshb-kpi">
          <p className="nwshb-kpi__label">Reseñas negativas</p>
          <p className="nwshb-kpi__value nwshb-kpi__value--red">{data.negativeReviews}</p>
          <p className="nwshb-kpi__foot">{negativePercentText}% del total</p>
          <span className="nwshb-kpi__icon nwshb-kpi__icon--green">
            <SmileIcon />
          </span>
        </div>

        <div className="nwshb-kpi">
          <p className="nwshb-kpi__label">Media {periodoAdjective} global</p>
          <p className={`nwshb-kpi__value ${averageClass}`}>{averageText}</p>
          <p className="nwshb-kpi__foot">
            Sobre 5 estrellas
            <br />
            Objetivo: {target}
          </p>
          <span className="nwshb-kpi__icon nwshb-kpi__icon--gold">
            <StarBadgeIcon />
          </span>
        </div>
      </section>

      <section className="nwshb-body">
        <div className="nwshb-panel">
          <p className="nwshb-panel__title">
            <BuildingIcon />
            Tabla de locales
          </p>
          <div className={`nwshb-table nwshb-table--${locationsTier(locations.length)}`}>
            <div className="nwshb-table__row nwshb-table__row--head">
              <span>Marca</span>
              <span>Local</span>
              <span className="c">Media {periodoAdjective}</span>
              <span className="c">Nº reseñas</span>
              <span className="c">Positivas</span>
              <span className="c">Negativas</span>
              <span>Estado (Objetivo: {target})</span>
              <span>Motivo principal</span>
            </div>
            {locations.map((loc) => {
              const logo = BRAND_LOGOS[loc.brandId];
              const rated = loc.rating != null && loc.reviewCount > 0;
              const ratingTone =
                loc.status === "risk" ? "bad" : loc.status === "watch" ? "watch" : rated ? "good" : "none";
              return (
                <div className="nwshb-table__row" key={loc.fullName}>
                  <span className="nwshb-table__brand">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={absUrl(assetBaseUrl, logo.src)} alt={logo.alt} />
                    ) : (
                      <em>{loc.brandLabel}</em>
                    )}
                  </span>
                  <span className="nwshb-table__name">{loc.fullName}</span>
                  <span className={`nwshb-table__rating nwshb-table__rating--${ratingTone} c`}>
                    {rated ? commaNumber(loc.rating as number, 2) : "—"}
                  </span>
                  <span className="nwshb-table__num c">{loc.reviewCount}</span>
                  <span className="nwshb-table__num nwshb-table__num--pos c">{loc.positiveReviews}</span>
                  <span className="nwshb-table__num nwshb-table__num--neg c">{loc.negativeReviews}</span>
                  <span className="nwshb-table__status">
                    <span className="nwshb-dot" style={{ background: STATUS_COLOR[loc.status] }} aria-hidden />
                    {STATUS_LABEL[loc.status]}
                  </span>
                  <span className="nwshb-table__motive">
                    {loc.negativeReviews > 0 && loc.topNegativeMotive ? loc.topNegativeMotive : "—"}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="nwshb-table__target">Objetivo de media: {target}</p>
        </div>

        <div className="nwshb-panel nwshb-panel--reasons">
          <p className="nwshb-panel__title">
            <ShieldStarIcon />
            Distribución de reseñas negativas
          </p>
          <p className="nwshb-panel__hint">
            Total reseñas negativas:{" "}
            <strong className={noNegatives ? "nwshb-good" : "nwshb-bad"}>
              {data.negativeReviews} ({negativePercentText}% del total)
            </strong>
          </p>

          <div className="nwshb-reasons-row">
            <div className="nwshb-donut">
              <NegativeReasonsDonutHb segments={data.negativeReasons} />
              <div className="nwshb-donut__center">
                <span className={`nwshb-donut__pct${donutPctSize}`}>{negativePercentText}%</span>
                <span className="nwshb-donut__of">del total</span>
                <span className="nwshb-donut__cap">
                  {data.negativeReviews} reseña{data.negativeReviews === 1 ? "" : "s"}
                  <br />
                  negativa{data.negativeReviews === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            <div className={`nwshb-reasons${reasonRows > 4 ? " nwshb-reasons--dense" : ""}`}>
              <div className={`nwshb-reasons__table nwshb-reasons__table--r${reasonRows > 4 ? "6" : "4"}`}>
                <div className="nwshb-reasons__row nwshb-reasons__row--head">
                  <span>Motivos detectados</span>
                  <span className="c">Nº</span>
                  <span className="c">%</span>
                </div>
                {data.negativeReasons.length === 0 ? (
                  <div className="nwshb-reasons__row">
                    <span className="nwshb-reasons__label">
                      <span className="nwshb-dot" style={{ background: "#189B2B" }} aria-hidden />
                      Sin incidencias registradas
                    </span>
                    <span className="c">0</span>
                    <span className="c">0%</span>
                  </div>
                ) : (
                  data.negativeReasons.map((segment, index) => (
                    <div className="nwshb-reasons__row" key={segment.categoria}>
                      <span className="nwshb-reasons__label">
                        <span
                          className="nwshb-dot"
                          style={{ background: HB_REASON_PALETTE[index % HB_REASON_PALETTE.length] }}
                          aria-hidden
                        />
                        {segment.label}
                      </span>
                      <span className="c">{segment.count}</span>
                      <span className="c">{percentText(segment.percent)}%</span>
                    </div>
                  ))
                )}
                {Array.from({ length: Math.max(reasonRows - Math.max(data.negativeReasons.length, 1), 0) }).map((_, i) => (
                  <div className="nwshb-reasons__row nwshb-reasons__row--empty" key={`empty-${i}`}>
                    <span />
                    <span />
                    <span />
                  </div>
                ))}
              </div>
              <div className="nwshb-reasons__main">
                <p className="nwshb-reasons__main-label">Motivo principal</p>
                <p className="nwshb-reasons__main-value">{mainReason ?? "Sin incidencias registradas"}</p>
              </div>
            </div>
          </div>

          <div className="nwshb-bar">
            <div className="nwshb-bar__track" role="img" aria-label="Reparto de reseñas positivas, neutras y negativas">
              {hasReviews ? (
                <>
                  <span className="nwshb-bar__seg nwshb-bar__seg--pos" style={{ flexGrow: data.positiveReviews }} />
                  <span className="nwshb-bar__seg nwshb-bar__seg--neu" style={{ flexGrow: neutralReviews }} />
                  <span className="nwshb-bar__seg nwshb-bar__seg--neg" style={{ flexGrow: data.negativeReviews }} />
                </>
              ) : null}
            </div>
            <span className="nwshb-bar__pct">{hasReviews ? `${percentText(data.positivePercent)}%` : "—"}</span>
            <span className="nwshb-bar__cap">positivas</span>
          </div>
        </div>
      </section>

      <footer className="nwshb-footer">
        <div className="nwshb-pillar">
          <span className="nwshb-pillar__icon nwshb-pillar__icon--green">
            <UsersIcon size={44} color="#fff" />
          </span>
          <div>
            <p className="nwshb-pillar__title">Nuestro compromiso</p>
            <p className="nwshb-pillar__text">
              Analizamos cada reseña para
              <br />
              mejorar la experiencia del cliente.
            </p>
          </div>
        </div>
        <div className="nwshb-pillar">
          <span className="nwshb-pillar__icon nwshb-pillar__icon--gold">
            <ShieldOutlineStarIcon />
          </span>
          <div>
            <p className="nwshb-pillar__title">Transparencia</p>
            <p className="nwshb-pillar__text">
              Datos reales, decisiones inteligentes
              <br />y mejora continua.
            </p>
          </div>
        </div>
        <div className="nwshb-pillar">
          <span className="nwshb-pillar__icon nwshb-pillar__icon--red">
            <TrendIcon />
          </span>
          <div>
            <p className="nwshb-pillar__title">Decisiones que suman</p>
            <p className="nwshb-pillar__text">
              Información clara para ofrecer siempre
              <br />
              la mejor experiencia.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
