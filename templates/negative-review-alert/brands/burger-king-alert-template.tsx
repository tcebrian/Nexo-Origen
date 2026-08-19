import { forwardRef } from "react";
import { resolveDesignCanvasSize } from "@/lib/templates/negative-review-alert/dimensions";
import type { NegativeReviewAlertData } from "@/lib/templates/negative-review-alert/types";
import { StarRating } from "../icons";
import {
  BkIconArrowDown,
  BkIconArrowUp,
  BkIconBars,
  BkIconBulb,
  BkIconCalendar,
  BkIconClipboardBig,
  BkIconClipboardText,
  BkIconClock,
  BkIconMagnifier,
  BkIconMinus,
  BkIconMood,
  BkIconPin,
  BkIconShield,
} from "./burger-king-alert-icons";
import "./burger-king-alert.css";

type BurgerKingAlertTemplateProps = {
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
  if (length <= 260) return "bka-quote__text--lg";
  if (length <= 650) return "bka-quote__text--md";
  if (length <= 900) return "bka-quote__text--sm";
  if (length <= 1300) return "bka-quote__text--xs";
  return "bka-quote__text--xxs";
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
 * Cuando el comentario es muy largo, la tarjeta de reseña crece y "Impacto en
 * la media" baja hasta la zona donde sangra la hamburguesa. A partir de ahí
 * se desplaza hacia la derecha y se reduce, para no quedar tapada por ella.
 * El mismo nivel se usa para recortar el fondo de la tarjeta (clip-path) por
 * donde el bloque se ha desplazado, así el fondo no sigue siendo un
 * rectángulo hasta abajo y la hamburguesa puede asomar con naturalidad.
 */
function commentShiftTier(commentLength: number): "" | "sm" | "md" | "lg" {
  if (commentLength <= 650) return "";
  if (commentLength <= 900) return "sm";
  if (commentLength <= 1300) return "md";
  return "lg";
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

/** "BK Utebo" / "BK ZIZUR MAYOR" -> "Utebo" / "ZIZUR MAYOR" (quita el prefijo de marca). */
function stripBrandPrefix(name: string): string {
  return name.replace(/^\s*bk\s+/i, "").trim();
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
      <span className="bka-impact__delta bka-impact__delta--up">
        <BkIconArrowUp />
        {`+${delta.toFixed(2)}`}
      </span>
    );
  }
  if (delta < -0.005) {
    return (
      <span className="bka-impact__delta bka-impact__delta--down">
        <BkIconArrowDown />
        {delta.toFixed(2)}
      </span>
    );
  }
  return (
    <span className="bka-impact__delta bka-impact__delta--flat">
      <BkIconMinus />
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

export const BurgerKingAlertTemplate = forwardRef<HTMLDivElement, BurgerKingAlertTemplateProps>(
  function BurgerKingAlertTemplate({ data, assetBaseUrl }, ref) {
    const design = resolveDesignCanvasSize(data.aspect_ratio);
    const fullComment = truncateComment(normalizeComment(data.review_comment));
    const location = data.restaurant_address || data.restaurant_location;
    const target = data.target_rating ?? 4.4;
    const delta = data.rating_impact;
    const sentiment = cleanValue(data.sentiment);
    const risk = cleanValue(data.risk_level);
    const tone = mediaTone(data.current_rating, target);

    const analysisRows: AnalysisRow[] = [
      { key: "resumen", icon: <BkIconClipboardText />, label: "Resumen IA", value: cleanValue(data.ai_summary) as string },
      { key: "motivo", icon: <BkIconMagnifier />, label: "Motivo principal", value: cleanValue(data.main_motive) as string },
      { key: "impacto", icon: <BkIconBars />, label: "Impacto detectado", value: cleanValue(data.detected_impact) as string },
      { key: "recomendacion", icon: <BkIconBulb />, label: "Recomendación", value: cleanValue(data.recommendation) as string },
    ].filter((row) => row.value);
    const analysisTotalLength = analysisRows.reduce((sum, row) => sum + row.value.length, 0);
    const analysisTier = insightsTier(analysisTotalLength);

    const isExtremeComment = fullComment.length > EXTREME_COMMENT_CHARS;
    const shiftTier = isExtremeComment ? "" : commentShiftTier(fullComment.length);

    const conclusion = cleanValue(data.ai_summary) ?? cleanValue(data.recommendation);
    const brandLabel = (cleanValue(data.brand_name) ?? "Burger King").toUpperCase();
    const locationLabel = stripBrandPrefix(data.restaurant_name) || data.restaurant_name;

    return (
      <div ref={ref} className="bka-canvas" style={{ width: design.width, height: design.height }}>

        {/* Producto — elementos editoriales, no contenidos en tarjeta */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/burger-king/bk-drink.png")}
          alt=""
          aria-hidden
          className="bka-product bka-product--drink"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/burger-king/bk-fries.png")}
          alt=""
          aria-hidden
          className="bka-product bka-product--fries"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absUrl(assetBaseUrl, "/design/burger-king/bk-burger.png")}
          alt=""
          aria-hidden
          className="bka-product bka-product--burger"
        />

        <div className="bka-sheet">
          {/* Header editorial */}
          <header className="bka-header">
            <div className="bka-header__alert">
              <div>
                <p className="bka-header__title">
                  RESEÑA
                  <span className="bka-header__crown">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={absUrl(assetBaseUrl, "/design/burger-king/bk-crown.png")}
                      alt=""
                      aria-hidden
                      className="bka-header__crown-img"
                    />
                  </span>
                  <br />
                  <span className="bka-header__title-neg">NEGATIVA</span>
                </p>
                <p className="bka-header__sub">NUEVO COMENTARIO RECIBIDO</p>
              </div>
            </div>

            <div className="bka-header__brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={absUrl(assetBaseUrl, "/design/burger-king/bk-logo.png")}
                alt={data.brand_name}
                className="bka-header__brand-logo"
              />
            </div>

            <div className="bka-header__restaurant">
              <p className="bka-header__restaurant-name">
                <BkIconPin />
                {brandLabel}
              </p>
              <p className="bka-header__restaurant-location">{locationLabel}</p>
              <p className="bka-header__restaurant-address">{location}</p>
            </div>
          </header>

          <span className="bka-header__divider" aria-hidden />

          <div className="bka-header__nexo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={absUrl(assetBaseUrl, "/design/burger-king/nexo-origen-logo.png")}
              alt="Nexo Origen"
              className="bka-header__nexo-logo"
            />
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={absUrl(assetBaseUrl, "/design/burger-king/bk-header-extra.png")}
            alt=""
            aria-hidden
            className="bka-header__extra-photo"
          />

          {isExtremeComment ? (
            <div className="bka-body bka-body--extreme">
              <section className="bka-review bka-review--extreme">
                <div className="bka-review__head">
                  <span className="bka-review__avatar">{data.review_author.trim().charAt(0).toUpperCase() || "?"}</span>
                  <div className="bka-review__meta">
                    <p className="bka-review__name">{data.review_author}</p>
                    <p className="bka-review__datetime">
                      <BkIconCalendar />
                      <span>{data.review_date}</span>
                      <span className="bka-review__sep" aria-hidden>
                        |
                      </span>
                      <BkIconClock />
                      <span>{data.review_time}</span>
                    </p>
                  </div>
                  <div className="bka-review__rating">
                    <StarRating stars={data.review_stars} size="lg" />
                    <span className="bka-review__rating-value">{data.review_stars}/5</span>
                  </div>
                </div>

                <div className="bka-quote bka-quote--extreme">
                  <span className="bka-quote__mark bka-quote__mark--open" aria-hidden>
                    &ldquo;
                  </span>
                  <p className={`bka-quote__text ${quoteSizeClass(fullComment.length)}`}>
                    {fullComment}
                  </p>
                  <span className="bka-quote__mark bka-quote__mark--close" aria-hidden>
                    &rdquo;
                  </span>
                </div>
              </section>

              <section className="bka-mini bka-mini--extreme">
                <p className="bka-mini__band">IMPACTO EN LA MEDIA</p>
                <div className="bka-impact">
                  <div className="bka-impact__col">
                    <p className="bka-impact__label">Media anterior</p>
                    <p className="bka-impact__value">{data.previous_rating.toFixed(2)}</p>
                    <span className="bka-impact__stars">
                      <StarRating stars={data.previous_rating} size="md" />
                    </span>
                  </div>
                  <div className="bka-impact__col">
                    <p className="bka-impact__label">Media actual</p>
                    <p className={`bka-impact__value bka-impact__value--tone-${tone}`}>
                      {data.current_rating.toFixed(2)}
                    </p>
                    <span className="bka-impact__stars">
                      <StarRating stars={data.current_rating} size="md" />
                    </span>
                  </div>
                  <div className="bka-impact__col">
                    <p className="bka-impact__label">Variación</p>
                    <ImpactDelta delta={delta} />
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <div className="bka-body">
              <div className="bka-review-col">
              {/* Tarjeta grande de la reseña — protagonista */}
              <section className="bka-review">
                <div className="bka-review__head">
                  <span className="bka-review__avatar">{data.review_author.trim().charAt(0).toUpperCase() || "?"}</span>
                  <div className="bka-review__meta">
                    <p className="bka-review__name">{data.review_author}</p>
                    <p className="bka-review__datetime">
                      <BkIconCalendar />
                      <span>{data.review_date}</span>
                      <span className="bka-review__sep" aria-hidden>
                        |
                      </span>
                      <BkIconClock />
                      <span>{data.review_time}</span>
                    </p>
                  </div>
                  <div className="bka-review__rating">
                    <StarRating stars={data.review_stars} size="lg" />
                    <span className="bka-review__rating-value">{data.review_stars}/5</span>
                  </div>
                </div>

                <div className="bka-quote">
                  <span className="bka-quote__mark bka-quote__mark--open" aria-hidden>
                    &ldquo;
                  </span>
                  <p className={`bka-quote__text ${quoteSizeClass(fullComment.length)}`}>
                    {fullComment}
                  </p>
                  <span className="bka-quote__mark bka-quote__mark--close" aria-hidden>
                    &rdquo;
                  </span>
                </div>
              </section>

              <section className={`bka-mini bka-mini--under-quote ${shiftTier ? `bka-mini--shift-${shiftTier}` : ""}`}>
                <p className="bka-mini__band">IMPACTO EN LA MEDIA</p>
                <div className="bka-impact">
                  <div className="bka-impact__col">
                    <p className="bka-impact__label">Media anterior</p>
                    <p className="bka-impact__value">{data.previous_rating.toFixed(2)}</p>
                    <span className="bka-impact__stars">
                      <StarRating stars={data.previous_rating} size="md" />
                    </span>
                  </div>
                  <div className="bka-impact__col">
                    <p className="bka-impact__label">Media actual</p>
                    <p className={`bka-impact__value bka-impact__value--tone-${tone}`}>
                      {data.current_rating.toFixed(2)}
                    </p>
                    <span className="bka-impact__stars">
                      <StarRating stars={data.current_rating} size="md" />
                    </span>
                  </div>
                  <div className="bka-impact__col">
                    <p className="bka-impact__label">Variación</p>
                    <ImpactDelta delta={delta} />
                  </div>
                </div>
              </section>
              </div>

              {/* Columna de inteligencia artificial */}
              <section className="bka-insights">
                {analysisRows.length > 0 ? (
                  <>
                    <p className="bka-ribbon">ANÁLISIS NEXO</p>
                    <ul className={`bka-analysis bka-analysis--${analysisTier}`}>
                      {analysisRows.map((row) => (
                        <li key={row.key}>
                          <span className="bka-analysis__icon">{row.icon}</span>
                          <div className="bka-analysis__copy">
                            <p className="bka-analysis__label">{row.label}</p>
                            <p className="bka-analysis__value">{row.value}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}

                <p className={`bka-ribbon ${analysisRows.length > 0 ? "bka-ribbon--mt" : ""}`}>DIAGNÓSTICO NEXO</p>
                <div className={`bka-diagnostics bka-diagnostics--${analysisTier}`}>
                  <div className="bka-diagnostics__item">
                    <span className="bka-diagnostics__icon bka-diagnostics__icon--neutral">
                      <BkIconMood />
                    </span>
                    <p className="bka-diagnostics__label">Sentimiento</p>
                    <p className="bka-diagnostics__value">{sentiment ?? "Sin datos"}</p>
                  </div>
                  <div className="bka-diagnostics__item">
                    <span className={`bka-diagnostics__icon bka-diagnostics__icon--${riskTone(risk)}`}>
                      <BkIconShield />
                    </span>
                    <p className="bka-diagnostics__label">Riesgo</p>
                    <p className="bka-diagnostics__value">{risk ?? "Sin datos"}</p>
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
                  <footer className={`bka-footer bka-footer--${footerSizeTier}`}>
                    <span className="bka-footer__icon">
                      <BkIconClipboardBig />
                    </span>
                    <div className="bka-footer__body">
                      <p className="bka-footer__label">CONCLUSIÓN / ACCIÓN</p>
                      <p className={`bka-footer__text bka-footer__text--${footerSizeTier}`}>{conclusion}</p>
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
