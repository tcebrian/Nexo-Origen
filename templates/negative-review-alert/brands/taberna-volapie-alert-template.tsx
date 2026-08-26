import { forwardRef } from "react";
import { resolveDesignCanvasSize } from "@/lib/templates/negative-review-alert/dimensions";
import type { NegativeReviewAlertData } from "@/lib/templates/negative-review-alert/types";
import { StarRating } from "../icons";
import {
  TvIconArrowDown,
  TvIconArrowUp,
  TvIconBars,
  TvIconBulb,
  TvIconCalendar,
  TvIconClipboardBig,
  TvIconClipboardText,
  TvIconClock,
  TvIconMagnifier,
  TvIconMinus,
  TvIconMood,
  TvIconPin,
  TvIconShield,
} from "./taberna-volapie-alert-icons";
import "./taberna-volapie-alert.css";

type TabernaVolapieAlertTemplateProps = {
  data: NegativeReviewAlertData;
  assetBaseUrl?: string;
};

function absUrl(base: string | undefined, path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  if (!base) return path;
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Tamaño del comentario adaptado a su longitud real. Los comentarios cortos
 * o de longitud normal usan siempre el mismo tamaño base (el de la reseña
 * normal/larga) — la letra solo se reduce a partir de aquí, cuanto más largo
 * es el comentario.
 */
function quoteSizeClass(length: number): string {
  if (length <= 260) return "tva-quote__text--lg";
  if (length <= 650) return "tva-quote__text--md";
  if (length <= 900) return "tva-quote__text--sm";
  if (length <= 1300) return "tva-quote__text--xs";
  return "tva-quote__text--xxs";
}

/**
 * A partir de aquí el comentario es tan largo que intentar mantenerlo en el
 * layout de dos columnas obliga a encoger demasiado el resto (Análisis,
 * Diagnóstico, Conclusión). En vez de eso se usa un diseño alternativo: solo
 * el comentario, centrado, y el Impacto en la media debajo — se quita todo
 * lo demás en vez de aplastarlo.
 */
const EXTREME_COMMENT_CHARS = 900;

const MAX_COMMENT_CHARS = 1400;
const READ_MORE_HINT = " (pulsa el enlace para leer más)";

function normalizeComment(comment: string): string {
  return comment.replace(/\s+/g, " ").trim();
}

function truncateComment(comment: string): string {
  if (comment.length <= MAX_COMMENT_CHARS) return comment;
  const limit = MAX_COMMENT_CHARS - READ_MORE_HINT.length - 1;
  const cut = comment.slice(0, limit).replace(/\s+\S*$/, "");
  return `${cut}…${READ_MORE_HINT}`;
}

/**
 * Mismo nivel para Análisis Nexo y Diagnóstico Nexo (Sentimiento/Riesgo):
 * cuando el análisis es muy largo, Diagnóstico se compacta un poco para
 * dejarle más sitio a Análisis, en vez de quedarse siempre igual de grande
 * mientras Análisis se aprieta solo.
 */
function insightsTier(totalLength: number): "lg" | "md" | "sm" | "xs" {
  if (totalLength <= 260) return "lg";
  if (totalLength <= 420) return "md";
  if (totalLength <= 600) return "sm";
  return "xs";
}

/** Tamaño de la conclusión final adaptado a su longitud — nunca se sale del recuadro. */
function footerTier(length: number): "lg" | "md" | "sm" | "xs" {
  if (length <= 110) return "lg";
  if (length <= 180) return "md";
  if (length <= 260) return "sm";
  return "xs";
}

/**
 * Dentro del diseño normal (comentarios ≤900 caracteres — por encima de eso
 * se usa el diseño alternativo centrado), cuando el comentario ya es
 * bastante largo "Impacto en la media" se desplaza hacia la derecha y se
 * compacta un poco.
 */
function commentShiftTier(commentLength: number): "" | "sm" {
  return commentLength <= 650 ? "" : "sm";
}

const EMPTY_TOKENS = new Set([
  "",
  "--",
  "-",
  ".",
  "/",
  "n/a",
  "na",
  "null",
  "empty",
  "ninguno",
  "no mencionado",
  "sin análisis ia",
  "sin analisis ia",
]);

function isEmptyValue(value: string | null | undefined): boolean {
  if (value == null) return true;
  return EMPTY_TOKENS.has(value.trim().toLowerCase());
}

function cleanValue(value: string | null | undefined): string | null {
  return isEmptyValue(value) ? null : (value as string).trim();
}

/** "TV Lleida" / "Taberna Volapié Lleida" -> "Lleida" (quita el prefijo de marca). */
function stripBrandPrefix(name: string): string {
  return name.replace(/^\s*(tv|taberna\s*volapi[eé])\s+/i, "").trim();
}

type RiskTone = "high" | "medium" | "low" | "neutral";

function riskTone(risk: string | null): RiskTone {
  if (!risk) return "neutral";
  const v = risk.toLowerCase();
  if (v.includes("alto")) return "high";
  if (v.includes("medio")) return "medium";
  if (v.includes("bajo")) return "low";
  return "neutral";
}

type MediaTone = "good" | "warn" | "bad";

function mediaTone(current: number, target: number): MediaTone {
  if (current >= target) return "good";
  if (target - current <= 0.15) return "warn";
  return "bad";
}

function ImpactDelta({ delta }: { delta: number }) {
  if (delta > 0.005) {
    return (
      <span className="tva-impact__delta tva-impact__delta--up">
        <TvIconArrowUp />
        {`+${delta.toFixed(2)}`}
      </span>
    );
  }
  if (delta < -0.005) {
    return (
      <span className="tva-impact__delta tva-impact__delta--down">
        <TvIconArrowDown />
        {delta.toFixed(2)}
      </span>
    );
  }
  return (
    <span className="tva-impact__delta tva-impact__delta--flat">
      <TvIconMinus />
      0.00
    </span>
  );
}

type AnalysisRow = {
  key: string;
  icon: React.ReactNode;
  label: string;
  value: string;
};

export const TabernaVolapieAlertTemplate = forwardRef<HTMLDivElement, TabernaVolapieAlertTemplateProps>(
  function TabernaVolapieAlertTemplate({ data, assetBaseUrl }, ref) {
    const design = resolveDesignCanvasSize(data.aspect_ratio);
    const fullComment = truncateComment(normalizeComment(data.review_comment));
    const target = data.target_rating ?? 4.4;
    const delta = data.rating_impact;
    const sentiment = cleanValue(data.sentiment);
    const risk = cleanValue(data.risk_level);
    const tone = mediaTone(data.current_rating, target);

    const analysisRows: AnalysisRow[] = [
      { key: "resumen", icon: <TvIconClipboardText />, label: "Resumen IA", value: cleanValue(data.ai_summary) as string },
      { key: "motivo", icon: <TvIconMagnifier />, label: "Motivo principal", value: cleanValue(data.main_motive) as string },
      { key: "impacto", icon: <TvIconBars />, label: "Impacto detectado", value: cleanValue(data.detected_impact) as string },
      { key: "recomendacion", icon: <TvIconBulb />, label: "Recomendación", value: cleanValue(data.recommendation) as string },
    ].filter((row) => row.value);
    const analysisTotalLength = analysisRows.reduce((sum, row) => sum + row.value.length, 0);
    const analysisTier = insightsTier(analysisTotalLength);

    const isExtremeComment = fullComment.length > EXTREME_COMMENT_CHARS;
    const shiftTier = isExtremeComment ? "" : commentShiftTier(fullComment.length);

    const conclusion = cleanValue(data.ai_summary) ?? cleanValue(data.recommendation);
    const locationLabel = stripBrandPrefix(data.restaurant_name) || data.restaurant_name;

    return (
      <div ref={ref} className="tva-canvas" style={{ width: design.width, height: design.height }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/taberna-volapie/tv-product1.png")}
          alt=""
          aria-hidden
          className="tva-product tva-product--1"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/taberna-volapie/tv-product2.png")}
          alt=""
          aria-hidden
          className="tva-product tva-product--2"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/taberna-volapie/tv-product3.png")}
          alt=""
          aria-hidden
          className="tva-product tva-product--3"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/taberna-volapie/tv-product5.png")}
          alt=""
          aria-hidden
          className="tva-product tva-product--5"
        />
        <div className={`tva-sheet ${isExtremeComment ? "tva-sheet--extreme" : ""}`}>
          {/* Header editorial */}
          <header className="tva-header">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={absUrl(assetBaseUrl, "/design/taberna-volapie/tv-logo.png")}
              alt=""
              aria-hidden
              className="tva-header__wordmark"
            />

            <div className="tva-header__alert">
              <div>
                <p className="tva-header__title">
                  RESEÑA
                  <br />
                  <span className="tva-header__title-neg">NEGATIVA</span>
                </p>
                <p className="tva-header__sub">NUEVO COMENTARIO RECIBIDO</p>
              </div>
            </div>

            <div className="tva-header__restaurant">
              <p className="tva-header__restaurant-location">
                <TvIconPin />
                {locationLabel}
              </p>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={absUrl(assetBaseUrl, "/design/taberna-volapie/tv-product3.png")}
              alt=""
              aria-hidden
              className="tva-product tva-product--4"
            />
          </header>

          <span className="tva-header__divider" aria-hidden />

          <div className="tva-header__nexo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={absUrl(assetBaseUrl, "/design/taberna-volapie/nexo-origen-logo.png")}
              alt="Nexo Origen"
              className="tva-header__nexo-logo"
            />
          </div>

          {isExtremeComment ? (
            <div className="tva-body tva-body--extreme">
              <section className="tva-review tva-review--extreme">
                <div className="tva-review__head">
                  <span className="tva-review__avatar">{data.review_author.trim().charAt(0).toUpperCase() || "?"}</span>
                  <div className="tva-review__meta">
                    <p className="tva-review__name">{data.review_author}</p>
                    <p className="tva-review__datetime">
                      <TvIconCalendar />
                      <span>{data.review_date}</span>
                      <span className="tva-review__sep" aria-hidden>
                        |
                      </span>
                      <TvIconClock />
                      <span>{data.review_time}</span>
                    </p>
                  </div>
                  <div className="tva-review__rating">
                    <StarRating stars={data.review_stars} size="lg" />
                    <span className="tva-review__rating-value">{data.review_stars}/5</span>
                  </div>
                </div>

                <div className="tva-quote tva-quote--extreme">
                  <span className="tva-quote__mark tva-quote__mark--open" aria-hidden>
                    &ldquo;
                  </span>
                  <p className={`tva-quote__text ${quoteSizeClass(fullComment.length)}`}>
                    {fullComment}
                  </p>
                  <span className="tva-quote__mark tva-quote__mark--close" aria-hidden>
                    &rdquo;
                  </span>
                </div>
              </section>

              <section className="tva-mini tva-mini--extreme">
                <p className="tva-mini__band">IMPACTO EN LA MEDIA</p>
                <div className="tva-impact">
                  <div className="tva-impact__col">
                    <p className="tva-impact__label">Media anterior</p>
                    <p className="tva-impact__value">{data.previous_rating.toFixed(2)}</p>
                    <span className="tva-impact__stars">
                      <StarRating stars={data.previous_rating} size="md" />
                    </span>
                  </div>
                  <div className="tva-impact__col">
                    <p className="tva-impact__label">Media actual</p>
                    <p className={`tva-impact__value tva-impact__value--tone-${tone}`}>
                      {data.current_rating.toFixed(2)}
                    </p>
                    <span className="tva-impact__stars">
                      <StarRating stars={data.current_rating} size="md" />
                    </span>
                  </div>
                  <div className="tva-impact__col">
                    <p className="tva-impact__label">Variación</p>
                    <ImpactDelta delta={delta} />
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <div className="tva-body">
              <div className="tva-review-col">
                {/* Tarjeta grande de la reseña — protagonista */}
                <section className="tva-review">
                  <div className="tva-review__head">
                    <span className="tva-review__avatar">{data.review_author.trim().charAt(0).toUpperCase() || "?"}</span>
                    <div className="tva-review__meta">
                      <p className="tva-review__name">{data.review_author}</p>
                      <p className="tva-review__datetime">
                        <TvIconCalendar />
                        <span>{data.review_date}</span>
                        <span className="tva-review__sep" aria-hidden>
                          |
                        </span>
                        <TvIconClock />
                        <span>{data.review_time}</span>
                      </p>
                    </div>
                    <div className="tva-review__rating">
                      <StarRating stars={data.review_stars} size="lg" />
                      <span className="tva-review__rating-value">{data.review_stars}/5</span>
                    </div>
                  </div>

                  <div className="tva-quote">
                    <span className="tva-quote__mark tva-quote__mark--open" aria-hidden>
                      &ldquo;
                    </span>
                    <p className={`tva-quote__text ${quoteSizeClass(fullComment.length)}`}>
                      {fullComment}
                    </p>
                    <span className="tva-quote__mark tva-quote__mark--close" aria-hidden>
                      &rdquo;
                    </span>
                  </div>
                </section>

                <section
                  className={`tva-mini tva-mini--under-quote ${fullComment.length < 500 ? "tva-mini--short" : ""} ${shiftTier ? `tva-mini--shift-${shiftTier}` : ""}`}
                >
                  <p className="tva-mini__band">IMPACTO EN LA MEDIA</p>
                  <div className="tva-impact">
                    <div className="tva-impact__col">
                      <p className="tva-impact__label">Media anterior</p>
                      <p className="tva-impact__value">{data.previous_rating.toFixed(2)}</p>
                      <span className="tva-impact__stars">
                        <StarRating stars={data.previous_rating} size="md" />
                      </span>
                    </div>
                    <div className="tva-impact__col">
                      <p className="tva-impact__label">Media actual</p>
                      <p className={`tva-impact__value tva-impact__value--tone-${tone}`}>
                        {data.current_rating.toFixed(2)}
                      </p>
                      <span className="tva-impact__stars">
                        <StarRating stars={data.current_rating} size="md" />
                      </span>
                    </div>
                    <div className="tva-impact__col">
                      <p className="tva-impact__label">Variación</p>
                      <ImpactDelta delta={delta} />
                    </div>
                  </div>
                </section>
              </div>

              {/* Columna de inteligencia artificial */}
              <section className="tva-insights">
                {analysisRows.length > 0 ? (
                  <>
                    <p className="tva-ribbon">ANÁLISIS NEXO</p>
                    <ul className={`tva-analysis tva-analysis--${analysisTier}`}>
                      {analysisRows.map((row) => (
                        <li key={row.key}>
                          <span className="tva-analysis__icon">{row.icon}</span>
                          <div className="tva-analysis__copy">
                            <p className="tva-analysis__label">{row.label}</p>
                            <p className="tva-analysis__value">{row.value}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}

                <p className={`tva-ribbon ${analysisRows.length > 0 ? "tva-ribbon--mt" : ""}`}>DIAGNÓSTICO NEXO</p>
                <div className={`tva-diagnostics tva-diagnostics--${analysisTier}`}>
                  <div className="tva-diagnostics__item">
                    <span className="tva-diagnostics__icon tva-diagnostics__icon--neutral">
                      <TvIconMood />
                    </span>
                    <p className="tva-diagnostics__label">Sentimiento</p>
                    <p className="tva-diagnostics__value">{sentiment ?? "Sin datos"}</p>
                  </div>
                  <div className="tva-diagnostics__item">
                    <span className={`tva-diagnostics__icon tva-diagnostics__icon--${riskTone(risk)}`}>
                      <TvIconShield />
                    </span>
                    <p className="tva-diagnostics__label">Riesgo</p>
                    <p className="tva-diagnostics__value">{risk ?? "Sin datos"}</p>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* Conclusión — se omite en el diseño extremo (solo comentario + Impacto en la media) */}
          {!isExtremeComment && conclusion
            ? (() => {
                const footerSizeTier = footerTier(conclusion.length);
                return (
                  <footer className={`tva-footer tva-footer--${footerSizeTier}`}>
                    <span className="tva-footer__icon">
                      <TvIconClipboardBig />
                    </span>
                    <div className="tva-footer__body">
                      <p className="tva-footer__label">CONCLUSIÓN / ACCIÓN</p>
                      <p className={`tva-footer__text tva-footer__text--${footerSizeTier}`}>{conclusion}</p>
                    </div>
                  </footer>
                );
              })()
            : null}
        </div>
      </div>
    );
  }
);
