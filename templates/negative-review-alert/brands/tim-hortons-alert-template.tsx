import { forwardRef } from "react";
import { resolveDesignCanvasSize } from "@/lib/templates/negative-review-alert/dimensions";
import type { NegativeReviewAlertData } from "@/lib/templates/negative-review-alert/types";
import { StarRating } from "../icons";
import {
  ThIconArrowDown,
  ThIconArrowUp,
  ThIconBars,
  ThIconBulb,
  ThIconCalendar,
  ThIconClipboardBig,
  ThIconClipboardText,
  ThIconClock,
  ThIconMagnifier,
  ThIconMinus,
  ThIconMood,
  ThIconPin,
  ThIconShield,
} from "./tim-hortons-alert-icons";
import "./tim-hortons-alert.css";

type TimHortonsAlertTemplateProps = {
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
  if (length <= 260) return "tha-quote__text--lg";
  if (length <= 650) return "tha-quote__text--md";
  if (length <= 900) return "tha-quote__text--sm";
  if (length <= 1300) return "tha-quote__text--xs";
  return "tha-quote__text--xxs";
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

/** "TH Lleida" / "Tim Hortons Lleida" -> "Lleida" (quita el prefijo de marca). */
function stripBrandPrefix(name: string): string {
  return name.replace(/^\s*(th|tim\s*hortons)\s+/i, "").trim();
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
      <span className="tha-impact__delta tha-impact__delta--up">
        <ThIconArrowUp />
        {`+${delta.toFixed(2)}`}
      </span>
    );
  }
  if (delta < -0.005) {
    return (
      <span className="tha-impact__delta tha-impact__delta--down">
        <ThIconArrowDown />
        {delta.toFixed(2)}
      </span>
    );
  }
  return (
    <span className="tha-impact__delta tha-impact__delta--flat">
      <ThIconMinus />
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

export const TimHortonsAlertTemplate = forwardRef<HTMLDivElement, TimHortonsAlertTemplateProps>(
  function TimHortonsAlertTemplate({ data, assetBaseUrl }, ref) {
    const design = resolveDesignCanvasSize(data.aspect_ratio);
    const fullComment = truncateComment(normalizeComment(data.review_comment));
    const target = data.target_rating ?? 4.4;
    const delta = data.rating_impact;
    const sentiment = cleanValue(data.sentiment);
    const risk = cleanValue(data.risk_level);
    const tone = mediaTone(data.current_rating, target);

    const analysisRows: AnalysisRow[] = [
      { key: "resumen", icon: <ThIconClipboardText />, label: "Resumen IA", value: cleanValue(data.ai_summary) as string },
      { key: "motivo", icon: <ThIconMagnifier />, label: "Motivo principal", value: cleanValue(data.main_motive) as string },
      { key: "impacto", icon: <ThIconBars />, label: "Impacto detectado", value: cleanValue(data.detected_impact) as string },
      { key: "recomendacion", icon: <ThIconBulb />, label: "Recomendación", value: cleanValue(data.recommendation) as string },
    ].filter((row) => row.value);
    const analysisTotalLength = analysisRows.reduce((sum, row) => sum + row.value.length, 0);
    const analysisTier = insightsTier(analysisTotalLength);

    const isExtremeComment = fullComment.length > EXTREME_COMMENT_CHARS;
    const shiftTier = isExtremeComment ? "" : commentShiftTier(fullComment.length);

    const conclusion = cleanValue(data.ai_summary) ?? cleanValue(data.recommendation);
    const locationLabel = stripBrandPrefix(data.restaurant_name) || data.restaurant_name;

    return (
      <div ref={ref} className="tha-canvas" style={{ width: design.width, height: design.height }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/tim-hortons/th-coffee.png")}
          alt=""
          aria-hidden
          className="tha-product tha-product--coffee"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/tim-hortons/th-donuts.png")}
          alt=""
          aria-hidden
          className="tha-product tha-product--donuts"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/tim-hortons/th-muffin.png")}
          alt=""
          aria-hidden
          className="tha-product tha-product--muffin"
        />

        <div className={`tha-sheet ${isExtremeComment ? "tha-sheet--extreme" : ""}`}>
          {/* Header editorial */}
          <header className="tha-header">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={absUrl(assetBaseUrl, "/design/tim-hortons/th-logo.png")}
              alt=""
              aria-hidden
              className="tha-header__wordmark"
            />

            <div className="tha-header__alert">
              <div>
                <p className="tha-header__title">
                  RESEÑA
                  <br />
                  <span className="tha-header__title-neg">NEGATIVA</span>
                </p>
                <p className="tha-header__sub">NUEVO COMENTARIO RECIBIDO</p>
              </div>
            </div>

            <div className="tha-header__restaurant">
              <p className="tha-header__restaurant-location">
                <ThIconPin />
                {locationLabel}
              </p>
            </div>
          </header>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={absUrl(assetBaseUrl, "/design/tim-hortons/th-maple.png")}
            alt=""
            aria-hidden
            className="tha-header__maple"
          />

          <span className="tha-header__divider" aria-hidden />

          <div className="tha-header__nexo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={absUrl(assetBaseUrl, "/design/tim-hortons/nexo-origen-logo.png")}
              alt="Nexo Origen"
              className="tha-header__nexo-logo"
            />
          </div>

          {isExtremeComment ? (
            <div className="tha-body tha-body--extreme">
              <section className="tha-review tha-review--extreme">
                <div className="tha-review__head">
                  <span className="tha-review__avatar">{data.review_author.trim().charAt(0).toUpperCase() || "?"}</span>
                  <div className="tha-review__meta">
                    <p className="tha-review__name">{data.review_author}</p>
                    <p className="tha-review__datetime">
                      <ThIconCalendar />
                      <span>{data.review_date}</span>
                      <span className="tha-review__sep" aria-hidden>
                        |
                      </span>
                      <ThIconClock />
                      <span>{data.review_time}</span>
                    </p>
                  </div>
                  <div className="tha-review__rating">
                    <StarRating stars={data.review_stars} size="lg" />
                    <span className="tha-review__rating-value">{data.review_stars}/5</span>
                  </div>
                </div>

                <div className="tha-quote tha-quote--extreme">
                  <span className="tha-quote__mark tha-quote__mark--open" aria-hidden>
                    &ldquo;
                  </span>
                  <p className={`tha-quote__text ${quoteSizeClass(fullComment.length)}`}>
                    {fullComment}
                  </p>
                  <span className="tha-quote__mark tha-quote__mark--close" aria-hidden>
                    &rdquo;
                  </span>
                </div>
              </section>

              <section className="tha-mini tha-mini--extreme">
                <p className="tha-mini__band">IMPACTO EN LA MEDIA</p>
                <div className="tha-impact">
                  <div className="tha-impact__col">
                    <p className="tha-impact__label">Media anterior</p>
                    <p className="tha-impact__value">{data.previous_rating.toFixed(2)}</p>
                    <span className="tha-impact__stars">
                      <StarRating stars={data.previous_rating} size="md" />
                    </span>
                  </div>
                  <div className="tha-impact__col">
                    <p className="tha-impact__label">Media actual</p>
                    <p className={`tha-impact__value tha-impact__value--tone-${tone}`}>
                      {data.current_rating.toFixed(2)}
                    </p>
                    <span className="tha-impact__stars">
                      <StarRating stars={data.current_rating} size="md" />
                    </span>
                  </div>
                  <div className="tha-impact__col">
                    <p className="tha-impact__label">Variación</p>
                    <ImpactDelta delta={delta} />
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <div className="tha-body">
              <div className="tha-review-col">
                {/* Tarjeta grande de la reseña — protagonista */}
                <section className="tha-review">
                  <div className="tha-review__head">
                    <span className="tha-review__avatar">{data.review_author.trim().charAt(0).toUpperCase() || "?"}</span>
                    <div className="tha-review__meta">
                      <p className="tha-review__name">{data.review_author}</p>
                      <p className="tha-review__datetime">
                        <ThIconCalendar />
                        <span>{data.review_date}</span>
                        <span className="tha-review__sep" aria-hidden>
                          |
                        </span>
                        <ThIconClock />
                        <span>{data.review_time}</span>
                      </p>
                    </div>
                    <div className="tha-review__rating">
                      <StarRating stars={data.review_stars} size="lg" />
                      <span className="tha-review__rating-value">{data.review_stars}/5</span>
                    </div>
                  </div>

                  <div className="tha-quote">
                    <span className="tha-quote__mark tha-quote__mark--open" aria-hidden>
                      &ldquo;
                    </span>
                    <p className={`tha-quote__text ${quoteSizeClass(fullComment.length)}`}>
                      {fullComment}
                    </p>
                    <span className="tha-quote__mark tha-quote__mark--close" aria-hidden>
                      &rdquo;
                    </span>
                  </div>
                </section>

                <section
                  className={`tha-mini tha-mini--under-quote ${fullComment.length < 500 ? "tha-mini--short" : ""} ${shiftTier ? `tha-mini--shift-${shiftTier}` : ""}`}
                >
                  <p className="tha-mini__band">IMPACTO EN LA MEDIA</p>
                  <div className="tha-impact">
                    <div className="tha-impact__col">
                      <p className="tha-impact__label">Media anterior</p>
                      <p className="tha-impact__value">{data.previous_rating.toFixed(2)}</p>
                      <span className="tha-impact__stars">
                        <StarRating stars={data.previous_rating} size="md" />
                      </span>
                    </div>
                    <div className="tha-impact__col">
                      <p className="tha-impact__label">Media actual</p>
                      <p className={`tha-impact__value tha-impact__value--tone-${tone}`}>
                        {data.current_rating.toFixed(2)}
                      </p>
                      <span className="tha-impact__stars">
                        <StarRating stars={data.current_rating} size="md" />
                      </span>
                    </div>
                    <div className="tha-impact__col">
                      <p className="tha-impact__label">Variación</p>
                      <ImpactDelta delta={delta} />
                    </div>
                  </div>
                </section>
              </div>

              {/* Columna de inteligencia artificial */}
              <section className="tha-insights">
                {analysisRows.length > 0 ? (
                  <>
                    <p className="tha-ribbon">ANÁLISIS NEXO</p>
                    <ul className={`tha-analysis tha-analysis--${analysisTier}`}>
                      {analysisRows.map((row) => (
                        <li key={row.key}>
                          <span className="tha-analysis__icon">{row.icon}</span>
                          <div className="tha-analysis__copy">
                            <p className="tha-analysis__label">{row.label}</p>
                            <p className="tha-analysis__value">{row.value}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}

                <p className={`tha-ribbon ${analysisRows.length > 0 ? "tha-ribbon--mt" : ""}`}>DIAGNÓSTICO NEXO</p>
                <div className={`tha-diagnostics tha-diagnostics--${analysisTier}`}>
                  <div className="tha-diagnostics__item">
                    <span className="tha-diagnostics__icon tha-diagnostics__icon--neutral">
                      <ThIconMood />
                    </span>
                    <p className="tha-diagnostics__label">Sentimiento</p>
                    <p className="tha-diagnostics__value">{sentiment ?? "Sin datos"}</p>
                  </div>
                  <div className="tha-diagnostics__item">
                    <span className={`tha-diagnostics__icon tha-diagnostics__icon--${riskTone(risk)}`}>
                      <ThIconShield />
                    </span>
                    <p className="tha-diagnostics__label">Riesgo</p>
                    <p className="tha-diagnostics__value">{risk ?? "Sin datos"}</p>
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
                  <footer className={`tha-footer tha-footer--${footerSizeTier}`}>
                    <span className="tha-footer__icon">
                      <ThIconClipboardBig />
                    </span>
                    <div className="tha-footer__body">
                      <p className="tha-footer__label">CONCLUSIÓN / ACCIÓN</p>
                      <p className={`tha-footer__text tha-footer__text--${footerSizeTier}`}>{conclusion}</p>
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
