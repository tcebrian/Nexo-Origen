import { forwardRef } from "react";
import { resolveDesignCanvasSize } from "@/lib/templates/negative-review-alert/dimensions";
import type { NegativeReviewAlertData } from "@/lib/templates/negative-review-alert/types";
import { StarRating } from "../icons";
import {
  RbIconArrowDown,
  RbIconArrowUp,
  RbIconBars,
  RbIconBulb,
  RbIconCalendar,
  RbIconClipboardBig,
  RbIconClipboardText,
  RbIconClock,
  RbIconMagnifier,
  RbIconMinus,
  RbIconMood,
  RbIconPin,
  RbIconShield,
} from "./ribs-alert-icons";
import "./ribs-alert.css";

type RibsAlertTemplateProps = {
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
  if (length <= 260) return "rba-quote__text--lg";
  if (length <= 650) return "rba-quote__text--md";
  if (length <= 900) return "rba-quote__text--sm";
  if (length <= 1300) return "rba-quote__text--xs";
  return "rba-quote__text--xxs";
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

/** "RB Lleida" / "Ribs Lleida" -> "Lleida" (quita el prefijo de marca). */
function stripBrandPrefix(name: string): string {
  return name.replace(/^\s*(rb|ribs)\s+/i, "").trim();
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
      <span className="rba-impact__delta rba-impact__delta--up">
        <RbIconArrowUp />
        {`+${delta.toFixed(2)}`}
      </span>
    );
  }
  if (delta < -0.005) {
    return (
      <span className="rba-impact__delta rba-impact__delta--down">
        <RbIconArrowDown />
        {delta.toFixed(2)}
      </span>
    );
  }
  return (
    <span className="rba-impact__delta rba-impact__delta--flat">
      <RbIconMinus />
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

export const RibsAlertTemplate = forwardRef<HTMLDivElement, RibsAlertTemplateProps>(
  function RibsAlertTemplate({ data, assetBaseUrl }, ref) {
    const design = resolveDesignCanvasSize(data.aspect_ratio);
    const fullComment = truncateComment(normalizeComment(data.review_comment));
    const target = data.target_rating ?? 4.4;
    const delta = data.rating_impact;
    const sentiment = cleanValue(data.sentiment);
    const risk = cleanValue(data.risk_level);
    const tone = mediaTone(data.current_rating, target);

    const analysisRows: AnalysisRow[] = [
      { key: "resumen", icon: <RbIconClipboardText />, label: "Resumen IA", value: cleanValue(data.ai_summary) as string },
      { key: "motivo", icon: <RbIconMagnifier />, label: "Motivo principal", value: cleanValue(data.main_motive) as string },
      { key: "impacto", icon: <RbIconBars />, label: "Impacto detectado", value: cleanValue(data.detected_impact) as string },
      { key: "recomendacion", icon: <RbIconBulb />, label: "Recomendación", value: cleanValue(data.recommendation) as string },
    ].filter((row) => row.value);
    const analysisTotalLength = analysisRows.reduce((sum, row) => sum + row.value.length, 0);
    const analysisTier = insightsTier(analysisTotalLength);

    const isExtremeComment = fullComment.length > EXTREME_COMMENT_CHARS;
    const shiftTier = isExtremeComment ? "" : commentShiftTier(fullComment.length);

    const conclusion = cleanValue(data.ai_summary) ?? cleanValue(data.recommendation);
    const locationLabel = stripBrandPrefix(data.restaurant_name) || data.restaurant_name;

    return (
      <div ref={ref} className="rba-canvas" style={{ width: design.width, height: design.height }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/ribs/rb-ribs.png")}
          alt=""
          aria-hidden
          className="rba-product rba-product--ribs"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/ribs/rb-fries.png")}
          alt=""
          aria-hidden
          className="rba-product rba-product--fries"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/ribs/rb-sauce.png")}
          alt=""
          aria-hidden
          className="rba-product rba-product--sauce"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/ribs/rb-coleslaw.png")}
          alt=""
          aria-hidden
          className="rba-product rba-product--coleslaw"
        />

        <div className={`rba-sheet ${isExtremeComment ? "rba-sheet--extreme" : ""}`}>
          {/* Header editorial */}
          <header className="rba-header">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={absUrl(assetBaseUrl, "/design/ribs/rb-logo.png")}
              alt=""
              aria-hidden
              className="rba-header__wordmark"
            />

            <div className="rba-header__alert">
              <div>
                <p className="rba-header__title">
                  RESEÑA
                  <br />
                  <span className="rba-header__title-neg">NEGATIVA</span>
                </p>
                <p className="rba-header__sub">NUEVO COMENTARIO RECIBIDO</p>
              </div>
            </div>

            <div className="rba-header__restaurant">
              <p className="rba-header__restaurant-location">
                <RbIconPin />
                {locationLabel}
              </p>
            </div>
          </header>

          <span className="rba-header__divider" aria-hidden />

          <div className="rba-header__nexo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={absUrl(assetBaseUrl, "/design/ribs/nexo-origen-logo.png")}
              alt="Nexo Origen"
              className="rba-header__nexo-logo"
            />
          </div>

          {isExtremeComment ? (
            <div className="rba-body rba-body--extreme">
              <section className="rba-review rba-review--extreme">
                <div className="rba-review__head">
                  <span className="rba-review__avatar">{data.review_author.trim().charAt(0).toUpperCase() || "?"}</span>
                  <div className="rba-review__meta">
                    <p className="rba-review__name">{data.review_author}</p>
                    <p className="rba-review__datetime">
                      <RbIconCalendar />
                      <span>{data.review_date}</span>
                      <span className="rba-review__sep" aria-hidden>
                        |
                      </span>
                      <RbIconClock />
                      <span>{data.review_time}</span>
                    </p>
                  </div>
                  <div className="rba-review__rating">
                    <StarRating stars={data.review_stars} size="lg" />
                    <span className="rba-review__rating-value">{data.review_stars}/5</span>
                  </div>
                </div>

                <div className="rba-quote rba-quote--extreme">
                  <span className="rba-quote__mark rba-quote__mark--open" aria-hidden>
                    &ldquo;
                  </span>
                  <p className={`rba-quote__text ${quoteSizeClass(fullComment.length)}`}>
                    {fullComment}
                  </p>
                  <span className="rba-quote__mark rba-quote__mark--close" aria-hidden>
                    &rdquo;
                  </span>
                </div>
              </section>

              <section className="rba-mini rba-mini--extreme">
                <p className="rba-mini__band">IMPACTO EN LA MEDIA</p>
                <div className="rba-impact">
                  <div className="rba-impact__col">
                    <p className="rba-impact__label">Media anterior</p>
                    <p className="rba-impact__value">{data.previous_rating.toFixed(2)}</p>
                    <span className="rba-impact__stars">
                      <StarRating stars={data.previous_rating} size="md" />
                    </span>
                  </div>
                  <div className="rba-impact__col">
                    <p className="rba-impact__label">Media actual</p>
                    <p className={`rba-impact__value rba-impact__value--tone-${tone}`}>
                      {data.current_rating.toFixed(2)}
                    </p>
                    <span className="rba-impact__stars">
                      <StarRating stars={data.current_rating} size="md" />
                    </span>
                  </div>
                  <div className="rba-impact__col">
                    <p className="rba-impact__label">Variación</p>
                    <ImpactDelta delta={delta} />
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <div className="rba-body">
              <div className="rba-review-col">
                {/* Tarjeta grande de la reseña — protagonista */}
                <section className="rba-review">
                  <div className="rba-review__head">
                    <span className="rba-review__avatar">{data.review_author.trim().charAt(0).toUpperCase() || "?"}</span>
                    <div className="rba-review__meta">
                      <p className="rba-review__name">{data.review_author}</p>
                      <p className="rba-review__datetime">
                        <RbIconCalendar />
                        <span>{data.review_date}</span>
                        <span className="rba-review__sep" aria-hidden>
                          |
                        </span>
                        <RbIconClock />
                        <span>{data.review_time}</span>
                      </p>
                    </div>
                    <div className="rba-review__rating">
                      <StarRating stars={data.review_stars} size="lg" />
                      <span className="rba-review__rating-value">{data.review_stars}/5</span>
                    </div>
                  </div>

                  <div className="rba-quote">
                    <span className="rba-quote__mark rba-quote__mark--open" aria-hidden>
                      &ldquo;
                    </span>
                    <p className={`rba-quote__text ${quoteSizeClass(fullComment.length)}`}>
                      {fullComment}
                    </p>
                    <span className="rba-quote__mark rba-quote__mark--close" aria-hidden>
                      &rdquo;
                    </span>
                  </div>
                </section>

                <section
                  className={`rba-mini rba-mini--under-quote ${fullComment.length < 500 ? "rba-mini--short" : ""} ${shiftTier ? `rba-mini--shift-${shiftTier}` : ""}`}
                >
                  <p className="rba-mini__band">IMPACTO EN LA MEDIA</p>
                  <div className="rba-impact">
                    <div className="rba-impact__col">
                      <p className="rba-impact__label">Media anterior</p>
                      <p className="rba-impact__value">{data.previous_rating.toFixed(2)}</p>
                      <span className="rba-impact__stars">
                        <StarRating stars={data.previous_rating} size="md" />
                      </span>
                    </div>
                    <div className="rba-impact__col">
                      <p className="rba-impact__label">Media actual</p>
                      <p className={`rba-impact__value rba-impact__value--tone-${tone}`}>
                        {data.current_rating.toFixed(2)}
                      </p>
                      <span className="rba-impact__stars">
                        <StarRating stars={data.current_rating} size="md" />
                      </span>
                    </div>
                    <div className="rba-impact__col">
                      <p className="rba-impact__label">Variación</p>
                      <ImpactDelta delta={delta} />
                    </div>
                  </div>
                </section>
              </div>

              {/* Columna de inteligencia artificial */}
              <section className="rba-insights">
                {analysisRows.length > 0 ? (
                  <>
                    <p className="rba-ribbon">ANÁLISIS NEXO</p>
                    <ul className={`rba-analysis rba-analysis--${analysisTier}`}>
                      {analysisRows.map((row) => (
                        <li key={row.key}>
                          <span className="rba-analysis__icon">{row.icon}</span>
                          <div className="rba-analysis__copy">
                            <p className="rba-analysis__label">{row.label}</p>
                            <p className="rba-analysis__value">{row.value}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}

                <p className={`rba-ribbon ${analysisRows.length > 0 ? "rba-ribbon--mt" : ""}`}>DIAGNÓSTICO NEXO</p>
                <div className={`rba-diagnostics rba-diagnostics--${analysisTier}`}>
                  <div className="rba-diagnostics__item">
                    <span className="rba-diagnostics__icon rba-diagnostics__icon--neutral">
                      <RbIconMood />
                    </span>
                    <p className="rba-diagnostics__label">Sentimiento</p>
                    <p className="rba-diagnostics__value">{sentiment ?? "Sin datos"}</p>
                  </div>
                  <div className="rba-diagnostics__item">
                    <span className={`rba-diagnostics__icon rba-diagnostics__icon--${riskTone(risk)}`}>
                      <RbIconShield />
                    </span>
                    <p className="rba-diagnostics__label">Riesgo</p>
                    <p className="rba-diagnostics__value">{risk ?? "Sin datos"}</p>
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
                  <footer className={`rba-footer rba-footer--${footerSizeTier}`}>
                    <span className="rba-footer__icon">
                      <RbIconClipboardBig />
                    </span>
                    <div className="rba-footer__body">
                      <p className="rba-footer__label">CONCLUSIÓN / ACCIÓN</p>
                      <p className={`rba-footer__text rba-footer__text--${footerSizeTier}`}>{conclusion}</p>
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
