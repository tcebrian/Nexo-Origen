import { forwardRef } from "react";
import { resolveDesignCanvasSize } from "@/lib/templates/negative-review-alert/dimensions";
import type { NegativeReviewAlertData } from "@/lib/templates/negative-review-alert/types";
import { StarRating } from "../icons";
import {
  PpIconArrowDown,
  PpIconArrowUp,
  PpIconBars,
  PpIconBulb,
  PpIconCalendar,
  PpIconClipboardBig,
  PpIconClipboardText,
  PpIconClock,
  PpIconMagnifier,
  PpIconMinus,
  PpIconMood,
  PpIconPin,
  PpIconShield,
  PpIconSparkle,
} from "./popeyes-alert-icons";
import "./popeyes-alert.css";

type PopeyesAlertTemplateProps = {
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
  if (length <= 260) return "ppa-quote__text--lg";
  if (length <= 650) return "ppa-quote__text--md";
  if (length <= 900) return "ppa-quote__text--sm";
  if (length <= 1300) return "ppa-quote__text--xs";
  return "ppa-quote__text--xxs";
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

/** "PP Utebo" / "Popeyes ZIZUR MAYOR" -> "Utebo" / "ZIZUR MAYOR" (quita el prefijo de marca). */
function stripBrandPrefix(name: string): string {
  return name.replace(/^\s*(pp|popeyes)\s+/i, "").trim();
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
      <span className="ppa-impact__delta ppa-impact__delta--up">
        <PpIconArrowUp />
        {`+${delta.toFixed(2)}`}
      </span>
    );
  }
  if (delta < -0.005) {
    return (
      <span className="ppa-impact__delta ppa-impact__delta--down">
        <PpIconArrowDown />
        {delta.toFixed(2)}
      </span>
    );
  }
  return (
    <span className="ppa-impact__delta ppa-impact__delta--flat">
      <PpIconMinus />
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

export const PopeyesAlertTemplate = forwardRef<HTMLDivElement, PopeyesAlertTemplateProps>(
  function PopeyesAlertTemplate({ data, assetBaseUrl }, ref) {
    const design = resolveDesignCanvasSize(data.aspect_ratio);
    const fullComment = truncateComment(normalizeComment(data.review_comment));
    const location = data.restaurant_address || data.restaurant_location;
    const target = data.target_rating ?? 4.4;
    const delta = data.rating_impact;
    const sentiment = cleanValue(data.sentiment);
    const risk = cleanValue(data.risk_level);
    const tone = mediaTone(data.current_rating, target);

    const analysisRows: AnalysisRow[] = [
      { key: "resumen", icon: <PpIconClipboardText />, label: "Resumen IA", value: cleanValue(data.ai_summary) as string },
      { key: "motivo", icon: <PpIconMagnifier />, label: "Motivo principal", value: cleanValue(data.main_motive) as string },
      { key: "impacto", icon: <PpIconBars />, label: "Impacto detectado", value: cleanValue(data.detected_impact) as string },
      { key: "recomendacion", icon: <PpIconBulb />, label: "Recomendación", value: cleanValue(data.recommendation) as string },
    ].filter((row) => row.value);
    const analysisTotalLength = analysisRows.reduce((sum, row) => sum + row.value.length, 0);
    const analysisTier = insightsTier(analysisTotalLength);

    const isExtremeComment = fullComment.length > EXTREME_COMMENT_CHARS;
    const shiftTier = isExtremeComment ? "" : commentShiftTier(fullComment.length);

    const conclusion = cleanValue(data.ai_summary) ?? cleanValue(data.recommendation);
    const brandLabel = (cleanValue(data.brand_name) ?? "Popeyes").toUpperCase();
    const locationLabel = stripBrandPrefix(data.restaurant_name) || data.restaurant_name;

    return (
      <div ref={ref} className="ppa-canvas" style={{ width: design.width, height: design.height }}>

        {/* Producto — elementos editoriales, no contenidos en tarjeta */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/popeyes/pp-drink.png")}
          alt=""
          aria-hidden
          className="ppa-product ppa-product--drink"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/popeyes/pp-fries.png")}
          alt=""
          aria-hidden
          className="ppa-product ppa-product--fries"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/popeyes/pp-tenders.png")}
          alt=""
          aria-hidden
          className="ppa-product ppa-product--tenders"
        />

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/popeyes/pp-rooster.png")}
          alt=""
          aria-hidden
          className="ppa-rooster"
        />

        {/* Destellos decorativos alrededor de los productos */}
        <span className="ppa-sparkle ppa-sparkle--tenders-1" aria-hidden>
          <PpIconSparkle />
        </span>
        <span className="ppa-sparkle ppa-sparkle--tenders-2" aria-hidden>
          <PpIconSparkle />
        </span>
        <span className="ppa-sparkle ppa-sparkle--fries-1" aria-hidden>
          <PpIconSparkle />
        </span>
        <span className="ppa-sparkle ppa-sparkle--fries-2" aria-hidden>
          <PpIconSparkle />
        </span>
        <span className="ppa-sparkle ppa-sparkle--drink-1" aria-hidden>
          <PpIconSparkle />
        </span>
        <span className="ppa-sparkle ppa-sparkle--drink-2" aria-hidden>
          <PpIconSparkle />
        </span>

        <div className={`ppa-sheet ${isExtremeComment ? "ppa-sheet--extreme" : ""}`}>
          {/* Header editorial */}
          <header className="ppa-header">
            <div className="ppa-header__alert">
              <div>
                <p className="ppa-header__title">
                  RESEÑA
                  <br />
                  <span className="ppa-header__title-neg">NEGATIVA</span>
                </p>
                <p className="ppa-header__sub">NUEVO COMENTARIO RECIBIDO</p>
              </div>
            </div>

            <div className="ppa-header__restaurant">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={absUrl(assetBaseUrl, "/design/popeyes/pp-wordmark-2.png")}
                alt=""
                aria-hidden
                className="ppa-header__wordmark"
              />
              <p className="ppa-header__restaurant-location">
                <PpIconPin />
                {brandLabel} {locationLabel}
              </p>
            </div>
          </header>

          <span className="ppa-header__divider" aria-hidden />

          <div className="ppa-header__nexo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={absUrl(assetBaseUrl, "/design/popeyes/nexo-origen-logo-2.png")}
              alt="Nexo Origen"
              className="ppa-header__nexo-logo"
            />
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={absUrl(assetBaseUrl, "/design/popeyes/pp-header-extra.png")}
            alt=""
            aria-hidden
            className="ppa-header__extra-photo"
          />

          {isExtremeComment ? (
            <div className="ppa-body ppa-body--extreme">
              <section className="ppa-review ppa-review--extreme">
                <div className="ppa-review__head">
                  <span className="ppa-review__avatar">{data.review_author.trim().charAt(0).toUpperCase() || "?"}</span>
                  <div className="ppa-review__meta">
                    <p className="ppa-review__name">{data.review_author}</p>
                    <p className="ppa-review__datetime">
                      <PpIconCalendar />
                      <span>{data.review_date}</span>
                      <span className="ppa-review__sep" aria-hidden>
                        |
                      </span>
                      <PpIconClock />
                      <span>{data.review_time}</span>
                    </p>
                  </div>
                  <div className="ppa-review__rating">
                    <StarRating stars={data.review_stars} size="lg" />
                    <span className="ppa-review__rating-value">{data.review_stars}/5</span>
                  </div>
                </div>

                <div className="ppa-quote ppa-quote--extreme">
                  <span className="ppa-quote__mark ppa-quote__mark--open" aria-hidden>
                    &ldquo;
                  </span>
                  <p className={`ppa-quote__text ${quoteSizeClass(fullComment.length)}`}>
                    {fullComment}
                  </p>
                  <span className="ppa-quote__mark ppa-quote__mark--close" aria-hidden>
                    &rdquo;
                  </span>
                </div>
              </section>

              <section className="ppa-mini ppa-mini--extreme">
                <p className="ppa-mini__band">IMPACTO EN LA MEDIA</p>
                <div className="ppa-impact">
                  <div className="ppa-impact__col">
                    <p className="ppa-impact__label">Media anterior</p>
                    <p className="ppa-impact__value">{data.previous_rating.toFixed(2)}</p>
                    <span className="ppa-impact__stars">
                      <StarRating stars={data.previous_rating} size="md" />
                    </span>
                  </div>
                  <div className="ppa-impact__col">
                    <p className="ppa-impact__label">Media actual</p>
                    <p className={`ppa-impact__value ppa-impact__value--tone-${tone}`}>
                      {data.current_rating.toFixed(2)}
                    </p>
                    <span className="ppa-impact__stars">
                      <StarRating stars={data.current_rating} size="md" />
                    </span>
                  </div>
                  <div className="ppa-impact__col">
                    <p className="ppa-impact__label">Variación</p>
                    <ImpactDelta delta={delta} />
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <div className="ppa-body">
              <div className="ppa-review-col">
              {/* Tarjeta grande de la reseña — protagonista */}
              <section className="ppa-review">
                <div className="ppa-review__head">
                  <span className="ppa-review__avatar">{data.review_author.trim().charAt(0).toUpperCase() || "?"}</span>
                  <div className="ppa-review__meta">
                    <p className="ppa-review__name">{data.review_author}</p>
                    <p className="ppa-review__datetime">
                      <PpIconCalendar />
                      <span>{data.review_date}</span>
                      <span className="ppa-review__sep" aria-hidden>
                        |
                      </span>
                      <PpIconClock />
                      <span>{data.review_time}</span>
                    </p>
                  </div>
                  <div className="ppa-review__rating">
                    <StarRating stars={data.review_stars} size="lg" />
                    <span className="ppa-review__rating-value">{data.review_stars}/5</span>
                  </div>
                </div>

                <div className="ppa-quote">
                  <span className="ppa-quote__mark ppa-quote__mark--open" aria-hidden>
                    &ldquo;
                  </span>
                  <p className={`ppa-quote__text ${quoteSizeClass(fullComment.length)}`}>
                    {fullComment}
                  </p>
                  <span className="ppa-quote__mark ppa-quote__mark--close" aria-hidden>
                    &rdquo;
                  </span>
                </div>
              </section>

              <section className={`ppa-mini ppa-mini--under-quote ${fullComment.length < 500 ? "ppa-mini--short" : ""} ${shiftTier ? `ppa-mini--shift-${shiftTier}` : ""}`}>
                <p className="ppa-mini__band">IMPACTO EN LA MEDIA</p>
                <div className="ppa-impact">
                  <div className="ppa-impact__col">
                    <p className="ppa-impact__label">Media anterior</p>
                    <p className="ppa-impact__value">{data.previous_rating.toFixed(2)}</p>
                    <span className="ppa-impact__stars">
                      <StarRating stars={data.previous_rating} size="md" />
                    </span>
                  </div>
                  <div className="ppa-impact__col">
                    <p className="ppa-impact__label">Media actual</p>
                    <p className={`ppa-impact__value ppa-impact__value--tone-${tone}`}>
                      {data.current_rating.toFixed(2)}
                    </p>
                    <span className="ppa-impact__stars">
                      <StarRating stars={data.current_rating} size="md" />
                    </span>
                  </div>
                  <div className="ppa-impact__col">
                    <p className="ppa-impact__label">Variación</p>
                    <ImpactDelta delta={delta} />
                  </div>
                </div>
              </section>
              </div>

              {/* Columna de inteligencia artificial */}
              <section className="ppa-insights">
                {analysisRows.length > 0 ? (
                  <>
                    <p className="ppa-ribbon">ANÁLISIS NEXO</p>
                    <ul className={`ppa-analysis ppa-analysis--${analysisTier}`}>
                      {analysisRows.map((row) => (
                        <li key={row.key}>
                          <span className="ppa-analysis__icon">{row.icon}</span>
                          <div className="ppa-analysis__copy">
                            <p className="ppa-analysis__label">{row.label}</p>
                            <p className="ppa-analysis__value">{row.value}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}

                <p className={`ppa-ribbon ${analysisRows.length > 0 ? "ppa-ribbon--mt" : ""}`}>DIAGNÓSTICO NEXO</p>
                <div className={`ppa-diagnostics ppa-diagnostics--${analysisTier}`}>
                  <div className="ppa-diagnostics__item">
                    <span className="ppa-diagnostics__icon ppa-diagnostics__icon--neutral">
                      <PpIconMood />
                    </span>
                    <p className="ppa-diagnostics__label">Sentimiento</p>
                    <p className="ppa-diagnostics__value">{sentiment ?? "Sin datos"}</p>
                  </div>
                  <div className="ppa-diagnostics__item">
                    <span className={`ppa-diagnostics__icon ppa-diagnostics__icon--${riskTone(risk)}`}>
                      <PpIconShield />
                    </span>
                    <p className="ppa-diagnostics__label">Riesgo</p>
                    <p className="ppa-diagnostics__value">{risk ?? "Sin datos"}</p>
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
                  <footer className={`ppa-footer ppa-footer--${footerSizeTier}`}>
                    <span className="ppa-footer__icon">
                      <PpIconClipboardBig />
                    </span>
                    <div className="ppa-footer__body">
                      <p className="ppa-footer__label">CONCLUSIÓN / ACCIÓN</p>
                      <p className={`ppa-footer__text ppa-footer__text--${footerSizeTier}`}>{conclusion}</p>
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
