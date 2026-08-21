import { forwardRef } from "react";
import { resolveDesignCanvasSize } from "@/lib/templates/negative-review-alert/dimensions";
import type { NegativeReviewAlertData } from "@/lib/templates/negative-review-alert/types";
import { StarRating } from "../icons";
import {
  SgIconArrowDown,
  SgIconArrowUp,
  SgIconBars,
  SgIconBulb,
  SgIconCalendar,
  SgIconClipboardBig,
  SgIconClipboardText,
  SgIconClock,
  SgIconMagnifier,
  SgIconMinus,
  SgIconMood,
  SgIconPin,
  SgIconShield,
} from "./santa-gloria-alert-icons";
import "./santa-gloria-alert.css";

type SantaGloriaAlertTemplateProps = {
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
  // El salto de línea real no es perfectamente proporcional a la longitud
  // (depende de cómo caigan las palabras), así que el límite de "lg" deja
  // margen de sobra por debajo del punto donde se confirmó por medición
  // real que empieza a invadir "Impacto en la media" (~300 caracteres).
  if (length <= 260) return "sga-quote__text--lg";
  if (length <= 650) return "sga-quote__text--md";
  if (length <= 900) return "sga-quote__text--sm";
  if (length <= 1300) return "sga-quote__text--xs";
  return "sga-quote__text--xxs";
}

/**
 * Los tamaños de letra ya se reducen hasta xxs (13.5px) para comentarios muy
 * largos, pero un comentario desmesuradamente largo seguiría creciendo sin
 * límite y rompería el diseño. A partir de MAX_COMMENT_CHARS se corta en un
 * límite de palabra y se avisa de que hay más para leer en el enlace.
 */
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

/**
 * Reseñas reales a veces traen saltos de línea manuales (el cliente escribe
 * en varios párrafos). Cada salto fuerza una línea más alta sin que cuente
 * como más caracteres, así que el cálculo de tamaño por longitud se queda
 * corto y el cuadro puede acabar más alto de lo previsto. Se normaliza a
 * espacios para que la altura real dependa solo de la longitud del texto.
 */
function normalizeComment(comment: string): string {
  return comment.replace(/\s+/g, " ").trim();
}

function truncateComment(comment: string): string {
  if (comment.length <= MAX_COMMENT_CHARS) return comment;
  const limit = MAX_COMMENT_CHARS - READ_MORE_HINT.length - 1;
  const cut = comment.slice(0, limit).replace(/\s+\S*$/, "");
  return `${cut}…${READ_MORE_HINT}`;
}

/** Tamaño de la lista de Análisis IA adaptado al total de texto — así nunca queda nada oculto. */
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
 * compacta un poco para no quedar tapada por la hamburguesa.
 */
function commentShiftTier(commentLength: number): "" | "sm" {
  return commentLength <= 650 ? "" : "sm";
}

/**
 * Valores que en la práctica significan "no hay dato" en Supabase
 * (placeholders, nulos convertidos a texto, vacíos) — se tratan como
 * ausencia real, no como contenido a mostrar.
 */
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

/** "SG Utebo" / "Santa Gloria ZIZUR MAYOR" -> "Utebo" / "ZIZUR MAYOR" (quita el prefijo de marca). */
function stripBrandPrefix(name: string): string {
  return name.replace(/^\s*(sg|santa gloria)\s+/i, "").trim();
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
      <span className="sga-impact__delta sga-impact__delta--up">
        <SgIconArrowUp />
        {`+${delta.toFixed(2)}`}
      </span>
    );
  }
  if (delta < -0.005) {
    return (
      <span className="sga-impact__delta sga-impact__delta--down">
        <SgIconArrowDown />
        {delta.toFixed(2)}
      </span>
    );
  }
  return (
    <span className="sga-impact__delta sga-impact__delta--flat">
      <SgIconMinus />
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

export const SantaGloriaAlertTemplate = forwardRef<HTMLDivElement, SantaGloriaAlertTemplateProps>(
  function SantaGloriaAlertTemplate({ data, assetBaseUrl }, ref) {
    const design = resolveDesignCanvasSize(data.aspect_ratio);
    const fullComment = truncateComment(normalizeComment(data.review_comment));
    const location = data.restaurant_address || data.restaurant_location;
    const target = data.target_rating ?? 4.4;
    const delta = data.rating_impact;
    const sentiment = cleanValue(data.sentiment);
    const risk = cleanValue(data.risk_level);
    const tone = mediaTone(data.current_rating, target);

    const analysisRows: AnalysisRow[] = [
      { key: "resumen", icon: <SgIconClipboardText />, label: "Resumen IA", value: cleanValue(data.ai_summary) as string },
      { key: "motivo", icon: <SgIconMagnifier />, label: "Motivo principal", value: cleanValue(data.main_motive) as string },
      { key: "impacto", icon: <SgIconBars />, label: "Impacto detectado", value: cleanValue(data.detected_impact) as string },
      { key: "recomendacion", icon: <SgIconBulb />, label: "Recomendación", value: cleanValue(data.recommendation) as string },
    ].filter((row) => row.value);
    const analysisTotalLength = analysisRows.reduce((sum, row) => sum + row.value.length, 0);
    const analysisTier = insightsTier(analysisTotalLength);

    const isExtremeComment = fullComment.length > EXTREME_COMMENT_CHARS;
    const shiftTier = isExtremeComment ? "" : commentShiftTier(fullComment.length);

    const conclusion = cleanValue(data.ai_summary) ?? cleanValue(data.recommendation);
    const locationLabel = stripBrandPrefix(data.restaurant_name) || data.restaurant_name;

    return (
      <div ref={ref} className="sga-canvas" style={{ width: design.width, height: design.height }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/santa-gloria/sg-napkin.png")}
          alt=""
          aria-hidden
          className="sga-product sga-product--napkin"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/santa-gloria/sg-coffee-2.png")}
          alt=""
          aria-hidden
          className="sga-product sga-product--coffee"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/santa-gloria/sg-flowers.png")}
          alt=""
          aria-hidden
          className="sga-product sga-product--flowers"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/santa-gloria/sg-flowers.png")}
          alt=""
          aria-hidden
          className="sga-product sga-product--flowers-tl"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/santa-gloria/sg-napkin.png")}
          alt=""
          aria-hidden
          className="sga-product sga-product--napkin-right"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/santa-gloria/sg-plate.png")}
          alt=""
          aria-hidden
          className="sga-product sga-product--plate"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/santa-gloria/sg-crumbs.png")}
          alt=""
          aria-hidden
          className="sga-product sga-product--crumbs"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/santa-gloria/sg-croissant.png")}
          alt=""
          aria-hidden
          className="sga-product sga-product--croissant"
        />

        <div className={`sga-sheet ${isExtremeComment ? "sga-sheet--extreme" : ""}`}>
          {/* Header editorial */}
          <header className="sga-header">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={absUrl(assetBaseUrl, "/design/santa-gloria/sg-logo.png")}
              alt=""
              aria-hidden
              className="sga-header__wordmark"
            />

            <div className="sga-header__alert">
              <div>
                <p className="sga-header__title">
                  RESEÑA
                  <br />
                  <span className="sga-header__title-neg">NEGATIVA</span>
                </p>
                <p className="sga-header__sub">NUEVO COMENTARIO RECIBIDO</p>
              </div>
            </div>

            <div className="sga-header__restaurant">
              <p className="sga-header__restaurant-location">
                <SgIconPin />
                {locationLabel}
              </p>
            </div>
          </header>

          <span className="sga-header__divider" aria-hidden />

          <div className="sga-header__nexo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={absUrl(assetBaseUrl, "/design/santa-gloria/nexo-origen-logo.png")}
              alt="Nexo Origen"
              className="sga-header__nexo-logo"
            />
          </div>

          {isExtremeComment ? (
            <div className="sga-body sga-body--extreme">
              <section className="sga-review sga-review--extreme">
                <div className="sga-review__head">
                  <span className="sga-review__avatar">{data.review_author.trim().charAt(0).toUpperCase() || "?"}</span>
                  <div className="sga-review__meta">
                    <p className="sga-review__name">{data.review_author}</p>
                    <p className="sga-review__datetime">
                      <SgIconCalendar />
                      <span>{data.review_date}</span>
                      <span className="sga-review__sep" aria-hidden>
                        |
                      </span>
                      <SgIconClock />
                      <span>{data.review_time}</span>
                    </p>
                  </div>
                  <div className="sga-review__rating">
                    <StarRating stars={data.review_stars} size="lg" />
                    <span className="sga-review__rating-value">{data.review_stars}/5</span>
                  </div>
                </div>

                <div className="sga-quote sga-quote--extreme">
                  <span className="sga-quote__mark sga-quote__mark--open" aria-hidden>
                    &ldquo;
                  </span>
                  <p className={`sga-quote__text ${quoteSizeClass(fullComment.length)}`}>
                    {fullComment}
                  </p>
                  <span className="sga-quote__mark sga-quote__mark--close" aria-hidden>
                    &rdquo;
                  </span>
                </div>
              </section>

              <section className="sga-mini sga-mini--extreme">
                <p className="sga-mini__band">IMPACTO EN LA MEDIA</p>
                <div className="sga-impact">
                  <div className="sga-impact__col">
                    <p className="sga-impact__label">Media anterior</p>
                    <p className="sga-impact__value">{data.previous_rating.toFixed(2)}</p>
                    <span className="sga-impact__stars">
                      <StarRating stars={data.previous_rating} size="md" />
                    </span>
                  </div>
                  <div className="sga-impact__col">
                    <p className="sga-impact__label">Media actual</p>
                    <p className={`sga-impact__value sga-impact__value--tone-${tone}`}>
                      {data.current_rating.toFixed(2)}
                    </p>
                    <span className="sga-impact__stars">
                      <StarRating stars={data.current_rating} size="md" />
                    </span>
                  </div>
                  <div className="sga-impact__col">
                    <p className="sga-impact__label">Variación</p>
                    <ImpactDelta delta={delta} />
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <div className="sga-body">
              <div className="sga-review-col">
              {/* Tarjeta grande de la reseña — protagonista */}
              <section className="sga-review">
                <div className="sga-review__head">
                  <span className="sga-review__avatar">{data.review_author.trim().charAt(0).toUpperCase() || "?"}</span>
                  <div className="sga-review__meta">
                    <p className="sga-review__name">{data.review_author}</p>
                    <p className="sga-review__datetime">
                      <SgIconCalendar />
                      <span>{data.review_date}</span>
                      <span className="sga-review__sep" aria-hidden>
                        |
                      </span>
                      <SgIconClock />
                      <span>{data.review_time}</span>
                    </p>
                  </div>
                  <div className="sga-review__rating">
                    <StarRating stars={data.review_stars} size="lg" />
                    <span className="sga-review__rating-value">{data.review_stars}/5</span>
                  </div>
                </div>

                <div className="sga-quote">
                  <span className="sga-quote__mark sga-quote__mark--open" aria-hidden>
                    &ldquo;
                  </span>
                  <p className={`sga-quote__text ${quoteSizeClass(fullComment.length)}`}>
                    {fullComment}
                  </p>
                  <span className="sga-quote__mark sga-quote__mark--close" aria-hidden>
                    &rdquo;
                  </span>
                </div>
              </section>

              <section className={`sga-mini sga-mini--under-quote ${fullComment.length < 500 ? "sga-mini--short" : ""} ${shiftTier ? `sga-mini--shift-${shiftTier}` : ""}`}>
                <p className="sga-mini__band">IMPACTO EN LA MEDIA</p>
                <div className="sga-impact">
                  <div className="sga-impact__col">
                    <p className="sga-impact__label">Media anterior</p>
                    <p className="sga-impact__value">{data.previous_rating.toFixed(2)}</p>
                    <span className="sga-impact__stars">
                      <StarRating stars={data.previous_rating} size="md" />
                    </span>
                  </div>
                  <div className="sga-impact__col">
                    <p className="sga-impact__label">Media actual</p>
                    <p className={`sga-impact__value sga-impact__value--tone-${tone}`}>
                      {data.current_rating.toFixed(2)}
                    </p>
                    <span className="sga-impact__stars">
                      <StarRating stars={data.current_rating} size="md" />
                    </span>
                  </div>
                  <div className="sga-impact__col">
                    <p className="sga-impact__label">Variación</p>
                    <ImpactDelta delta={delta} />
                  </div>
                </div>
              </section>
              </div>

              {/* Columna de inteligencia artificial */}
              <section className="sga-insights">
                {analysisRows.length > 0 ? (
                  <>
                    <p className="sga-ribbon">ANÁLISIS NEXO</p>
                    <ul className={`sga-analysis sga-analysis--${analysisTier}`}>
                      {analysisRows.map((row) => (
                        <li key={row.key}>
                          <span className="sga-analysis__icon">{row.icon}</span>
                          <div className="sga-analysis__copy">
                            <p className="sga-analysis__label">{row.label}</p>
                            <p className="sga-analysis__value">{row.value}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}

                <p className={`sga-ribbon ${analysisRows.length > 0 ? "sga-ribbon--mt" : ""}`}>DIAGNÓSTICO NEXO</p>
                <div className={`sga-diagnostics sga-diagnostics--${analysisTier}`}>
                  <div className="sga-diagnostics__item">
                    <span className="sga-diagnostics__icon sga-diagnostics__icon--neutral">
                      <SgIconMood />
                    </span>
                    <p className="sga-diagnostics__label">Sentimiento</p>
                    <p className="sga-diagnostics__value">{sentiment ?? "Sin datos"}</p>
                  </div>
                  <div className="sga-diagnostics__item">
                    <span className={`sga-diagnostics__icon sga-diagnostics__icon--${riskTone(risk)}`}>
                      <SgIconShield />
                    </span>
                    <p className="sga-diagnostics__label">Riesgo</p>
                    <p className="sga-diagnostics__value">{risk ?? "Sin datos"}</p>
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
                  <footer className={`sga-footer sga-footer--${footerSizeTier}`}>
                    <span className="sga-footer__icon">
                      <SgIconClipboardBig />
                    </span>
                    <div className="sga-footer__body">
                      <p className="sga-footer__label">CONCLUSIÓN / ACCIÓN</p>
                      <p className={`sga-footer__text sga-footer__text--${footerSizeTier}`}>{conclusion}</p>
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
