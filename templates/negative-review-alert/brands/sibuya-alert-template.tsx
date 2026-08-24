import { forwardRef } from "react";
import { resolveDesignCanvasSize } from "@/lib/templates/negative-review-alert/dimensions";
import type { NegativeReviewAlertData } from "@/lib/templates/negative-review-alert/types";
import { StarRating } from "../icons";
import {
  SbIconArrowDown,
  SbIconArrowUp,
  SbIconBars,
  SbIconBulb,
  SbIconCalendar,
  SbIconClipboardBig,
  SbIconClipboardText,
  SbIconClock,
  SbIconMagnifier,
  SbIconMinus,
  SbIconMood,
  SbIconPin,
  SbIconShield,
} from "./sibuya-alert-icons";
import "./sibuya-alert.css";

type SibuyaAlertTemplateProps = {
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
  if (length <= 260) return "sba-quote__text--lg";
  if (length <= 650) return "sba-quote__text--md";
  if (length <= 900) return "sba-quote__text--sm";
  if (length <= 1300) return "sba-quote__text--xs";
  return "sba-quote__text--xxs";
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

/** "SB Lleida" / "Sibuya Lleida" -> "Lleida" (quita el prefijo de marca). */
function stripBrandPrefix(name: string): string {
  return name.replace(/^\s*(sb|sibuya)\s+/i, "").trim();
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
      <span className="sba-impact__delta sba-impact__delta--up">
        <SbIconArrowUp />
        {`+${delta.toFixed(2)}`}
      </span>
    );
  }
  if (delta < -0.005) {
    return (
      <span className="sba-impact__delta sba-impact__delta--down">
        <SbIconArrowDown />
        {delta.toFixed(2)}
      </span>
    );
  }
  return (
    <span className="sba-impact__delta sba-impact__delta--flat">
      <SbIconMinus />
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

export const SibuyaAlertTemplate = forwardRef<HTMLDivElement, SibuyaAlertTemplateProps>(
  function SibuyaAlertTemplate({ data, assetBaseUrl }, ref) {
    const design = resolveDesignCanvasSize(data.aspect_ratio);
    const fullComment = truncateComment(normalizeComment(data.review_comment));
    const target = data.target_rating ?? 4.4;
    const delta = data.rating_impact;
    const sentiment = cleanValue(data.sentiment);
    const risk = cleanValue(data.risk_level);
    const tone = mediaTone(data.current_rating, target);

    const analysisRows: AnalysisRow[] = [
      { key: "resumen", icon: <SbIconClipboardText />, label: "Resumen IA", value: cleanValue(data.ai_summary) as string },
      { key: "motivo", icon: <SbIconMagnifier />, label: "Motivo principal", value: cleanValue(data.main_motive) as string },
      { key: "impacto", icon: <SbIconBars />, label: "Impacto detectado", value: cleanValue(data.detected_impact) as string },
      { key: "recomendacion", icon: <SbIconBulb />, label: "Recomendación", value: cleanValue(data.recommendation) as string },
    ].filter((row) => row.value);
    const analysisTotalLength = analysisRows.reduce((sum, row) => sum + row.value.length, 0);
    const analysisTier = insightsTier(analysisTotalLength);

    const isExtremeComment = fullComment.length > EXTREME_COMMENT_CHARS;
    const shiftTier = isExtremeComment ? "" : commentShiftTier(fullComment.length);

    const conclusion = cleanValue(data.ai_summary) ?? cleanValue(data.recommendation);
    const locationLabel = stripBrandPrefix(data.restaurant_name) || data.restaurant_name;

    return (
      <div ref={ref} className="sba-canvas" style={{ width: design.width, height: design.height }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/sibuya/sb-bamboo.png")}
          alt=""
          aria-hidden
          className="sba-decor sba-decor--bamboo-tl"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/sibuya/sb-sushi.png")}
          alt=""
          aria-hidden
          className="sba-product sba-product--sushi"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/sibuya/sb-soy.png")}
          alt=""
          aria-hidden
          className="sba-product sba-product--soy"
        />

        <div className={`sba-sheet ${isExtremeComment ? "sba-sheet--extreme" : ""}`}>
          {/* Header editorial */}
          <header className="sba-header">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={absUrl(assetBaseUrl, "/design/sibuya/sb-logo.png")}
              alt=""
              aria-hidden
              className="sba-header__wordmark"
            />

            <div className="sba-header__alert">
              <div>
                <p className="sba-header__title">
                  RESEÑA
                  <br />
                  <span className="sba-header__title-neg">NEGATIVA</span>
                </p>
                <p className="sba-header__sub">NUEVO COMENTARIO RECIBIDO</p>
              </div>
            </div>

            <div className="sba-header__restaurant">
              <p className="sba-header__restaurant-location">
                <SbIconPin />
                {locationLabel}
              </p>
            </div>
          </header>

          <span className="sba-header__divider" aria-hidden />

          <div className="sba-header__nexo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={absUrl(assetBaseUrl, "/design/sibuya/nexo-origen-logo.png")}
              alt="Nexo Origen"
              className="sba-header__nexo-logo"
            />
          </div>

          {isExtremeComment ? (
            <div className="sba-body sba-body--extreme">
              <section className="sba-review sba-review--extreme">
                <div className="sba-review__head">
                  <span className="sba-review__avatar">{data.review_author.trim().charAt(0).toUpperCase() || "?"}</span>
                  <div className="sba-review__meta">
                    <p className="sba-review__name">{data.review_author}</p>
                    <p className="sba-review__datetime">
                      <SbIconCalendar />
                      <span>{data.review_date}</span>
                      <span className="sba-review__sep" aria-hidden>
                        |
                      </span>
                      <SbIconClock />
                      <span>{data.review_time}</span>
                    </p>
                  </div>
                  <div className="sba-review__rating">
                    <StarRating stars={data.review_stars} size="lg" />
                    <span className="sba-review__rating-value">{data.review_stars}/5</span>
                  </div>
                </div>

                <div className="sba-quote sba-quote--extreme">
                  <span className="sba-quote__mark sba-quote__mark--open" aria-hidden>
                    &ldquo;
                  </span>
                  <p className={`sba-quote__text ${quoteSizeClass(fullComment.length)}`}>
                    {fullComment}
                  </p>
                  <span className="sba-quote__mark sba-quote__mark--close" aria-hidden>
                    &rdquo;
                  </span>
                </div>
              </section>

              <section className="sba-mini sba-mini--extreme">
                <p className="sba-mini__band">IMPACTO EN LA MEDIA</p>
                <div className="sba-impact">
                  <div className="sba-impact__col">
                    <p className="sba-impact__label">Media anterior</p>
                    <p className="sba-impact__value">{data.previous_rating.toFixed(2)}</p>
                    <span className="sba-impact__stars">
                      <StarRating stars={data.previous_rating} size="md" />
                    </span>
                  </div>
                  <div className="sba-impact__col">
                    <p className="sba-impact__label">Media actual</p>
                    <p className={`sba-impact__value sba-impact__value--tone-${tone}`}>
                      {data.current_rating.toFixed(2)}
                    </p>
                    <span className="sba-impact__stars">
                      <StarRating stars={data.current_rating} size="md" />
                    </span>
                  </div>
                  <div className="sba-impact__col">
                    <p className="sba-impact__label">Variación</p>
                    <ImpactDelta delta={delta} />
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <div className="sba-body">
              <div className="sba-review-col">
                {/* Tarjeta grande de la reseña — protagonista */}
                <section className="sba-review">
                  <div className="sba-review__head">
                    <span className="sba-review__avatar">{data.review_author.trim().charAt(0).toUpperCase() || "?"}</span>
                    <div className="sba-review__meta">
                      <p className="sba-review__name">{data.review_author}</p>
                      <p className="sba-review__datetime">
                        <SbIconCalendar />
                        <span>{data.review_date}</span>
                        <span className="sba-review__sep" aria-hidden>
                          |
                        </span>
                        <SbIconClock />
                        <span>{data.review_time}</span>
                      </p>
                    </div>
                    <div className="sba-review__rating">
                      <StarRating stars={data.review_stars} size="lg" />
                      <span className="sba-review__rating-value">{data.review_stars}/5</span>
                    </div>
                  </div>

                  <div className="sba-quote">
                    <span className="sba-quote__mark sba-quote__mark--open" aria-hidden>
                      &ldquo;
                    </span>
                    <p className={`sba-quote__text ${quoteSizeClass(fullComment.length)}`}>
                      {fullComment}
                    </p>
                    <span className="sba-quote__mark sba-quote__mark--close" aria-hidden>
                      &rdquo;
                    </span>
                  </div>
                </section>

                <section
                  className={`sba-mini sba-mini--under-quote ${fullComment.length < 500 ? "sba-mini--short" : ""} ${shiftTier ? `sba-mini--shift-${shiftTier}` : ""}`}
                >
                  <p className="sba-mini__band">IMPACTO EN LA MEDIA</p>
                  <div className="sba-impact">
                    <div className="sba-impact__col">
                      <p className="sba-impact__label">Media anterior</p>
                      <p className="sba-impact__value">{data.previous_rating.toFixed(2)}</p>
                      <span className="sba-impact__stars">
                        <StarRating stars={data.previous_rating} size="md" />
                      </span>
                    </div>
                    <div className="sba-impact__col">
                      <p className="sba-impact__label">Media actual</p>
                      <p className={`sba-impact__value sba-impact__value--tone-${tone}`}>
                        {data.current_rating.toFixed(2)}
                      </p>
                      <span className="sba-impact__stars">
                        <StarRating stars={data.current_rating} size="md" />
                      </span>
                    </div>
                    <div className="sba-impact__col">
                      <p className="sba-impact__label">Variación</p>
                      <ImpactDelta delta={delta} />
                    </div>
                  </div>
                </section>
              </div>

              {/* Columna de inteligencia artificial */}
              <section className="sba-insights">
                {analysisRows.length > 0 ? (
                  <>
                    <p className="sba-ribbon">ANÁLISIS NEXO</p>
                    <ul className={`sba-analysis sba-analysis--${analysisTier}`}>
                      {analysisRows.map((row) => (
                        <li key={row.key}>
                          <span className="sba-analysis__icon">{row.icon}</span>
                          <div className="sba-analysis__copy">
                            <p className="sba-analysis__label">{row.label}</p>
                            <p className="sba-analysis__value">{row.value}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}

                <p className={`sba-ribbon ${analysisRows.length > 0 ? "sba-ribbon--mt" : ""}`}>DIAGNÓSTICO NEXO</p>
                <div className={`sba-diagnostics sba-diagnostics--${analysisTier}`}>
                  <div className="sba-diagnostics__item">
                    <span className="sba-diagnostics__icon sba-diagnostics__icon--neutral">
                      <SbIconMood />
                    </span>
                    <p className="sba-diagnostics__label">Sentimiento</p>
                    <p className="sba-diagnostics__value">{sentiment ?? "Sin datos"}</p>
                  </div>
                  <div className="sba-diagnostics__item">
                    <span className={`sba-diagnostics__icon sba-diagnostics__icon--${riskTone(risk)}`}>
                      <SbIconShield />
                    </span>
                    <p className="sba-diagnostics__label">Riesgo</p>
                    <p className="sba-diagnostics__value">{risk ?? "Sin datos"}</p>
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
                  <footer className={`sba-footer sba-footer--${footerSizeTier}`}>
                    <span className="sba-footer__icon">
                      <SbIconClipboardBig />
                    </span>
                    <div className="sba-footer__body">
                      <p className="sba-footer__label">CONCLUSIÓN / ACCIÓN</p>
                      <p className={`sba-footer__text sba-footer__text--${footerSizeTier}`}>{conclusion}</p>
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
