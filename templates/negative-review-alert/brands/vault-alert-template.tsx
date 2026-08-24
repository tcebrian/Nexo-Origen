import { forwardRef } from "react";
import { resolveDesignCanvasSize } from "@/lib/templates/negative-review-alert/dimensions";
import type { NegativeReviewAlertData } from "@/lib/templates/negative-review-alert/types";
import { StarRating } from "../icons";
import {
  VaIconArrowDown,
  VaIconArrowUp,
  VaIconBars,
  VaIconBulb,
  VaIconCalendar,
  VaIconClipboardBig,
  VaIconClipboardText,
  VaIconClock,
  VaIconMagnifier,
  VaIconMinus,
  VaIconMood,
  VaIconPin,
  VaIconShield,
} from "./vault-alert-icons";
import "./vault-alert.css";

type VaultAlertTemplateProps = {
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
  if (length <= 260) return "vaa-quote__text--lg";
  if (length <= 650) return "vaa-quote__text--md";
  if (length <= 900) return "vaa-quote__text--sm";
  if (length <= 1300) return "vaa-quote__text--xs";
  return "vaa-quote__text--xxs";
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

/** "VA Lleida" / "Vault Lleida" -> "Lleida" (quita el prefijo de marca). */
function stripBrandPrefix(name: string): string {
  return name.replace(/^\s*(va|vault)\s+/i, "").trim();
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
      <span className="vaa-impact__delta vaa-impact__delta--up">
        <VaIconArrowUp />
        {`+${delta.toFixed(2)}`}
      </span>
    );
  }
  if (delta < -0.005) {
    return (
      <span className="vaa-impact__delta vaa-impact__delta--down">
        <VaIconArrowDown />
        {delta.toFixed(2)}
      </span>
    );
  }
  return (
    <span className="vaa-impact__delta vaa-impact__delta--flat">
      <VaIconMinus />
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

export const VaultAlertTemplate = forwardRef<HTMLDivElement, VaultAlertTemplateProps>(
  function VaultAlertTemplate({ data, assetBaseUrl }, ref) {
    const design = resolveDesignCanvasSize(data.aspect_ratio);
    const fullComment = truncateComment(normalizeComment(data.review_comment));
    const target = data.target_rating ?? 4.4;
    const delta = data.rating_impact;
    const sentiment = cleanValue(data.sentiment);
    const risk = cleanValue(data.risk_level);
    const tone = mediaTone(data.current_rating, target);

    const analysisRows: AnalysisRow[] = [
      { key: "resumen", icon: <VaIconClipboardText />, label: "Resumen IA", value: cleanValue(data.ai_summary) as string },
      { key: "motivo", icon: <VaIconMagnifier />, label: "Motivo principal", value: cleanValue(data.main_motive) as string },
      { key: "impacto", icon: <VaIconBars />, label: "Impacto detectado", value: cleanValue(data.detected_impact) as string },
      { key: "recomendacion", icon: <VaIconBulb />, label: "Recomendación", value: cleanValue(data.recommendation) as string },
    ].filter((row) => row.value);
    const analysisTotalLength = analysisRows.reduce((sum, row) => sum + row.value.length, 0);
    const analysisTier = insightsTier(analysisTotalLength);

    const isExtremeComment = fullComment.length > EXTREME_COMMENT_CHARS;
    const shiftTier = isExtremeComment ? "" : commentShiftTier(fullComment.length);

    const conclusion = cleanValue(data.ai_summary) ?? cleanValue(data.recommendation);
    const locationLabel = stripBrandPrefix(data.restaurant_name) || data.restaurant_name;

    return (
      <div ref={ref} className="vaa-canvas" style={{ width: design.width, height: design.height }}>
        <div className={`vaa-sheet ${isExtremeComment ? "vaa-sheet--extreme" : ""}`}>
          {/* Header editorial */}
          <header className="vaa-header">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={absUrl(assetBaseUrl, "/design/vault/va-logo.png")}
              alt=""
              aria-hidden
              className="vaa-header__wordmark"
            />

            <div className="vaa-header__alert">
              <div>
                <p className="vaa-header__title">
                  RESEÑA
                  <br />
                  <span className="vaa-header__title-neg">NEGATIVA</span>
                </p>
                <p className="vaa-header__sub">NUEVO COMENTARIO RECIBIDO</p>
              </div>
            </div>

            <div className="vaa-header__restaurant">
              <p className="vaa-header__restaurant-location">
                <VaIconPin />
                {locationLabel}
              </p>
            </div>
          </header>

          <span className="vaa-header__divider" aria-hidden />

          <div className="vaa-header__nexo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={absUrl(assetBaseUrl, "/design/vault/nexo-origen-logo.png")}
              alt="Nexo Origen"
              className="vaa-header__nexo-logo"
            />
          </div>

          {isExtremeComment ? (
            <div className="vaa-body vaa-body--extreme">
              <section className="vaa-review vaa-review--extreme">
                <div className="vaa-review__head">
                  <span className="vaa-review__avatar">{data.review_author.trim().charAt(0).toUpperCase() || "?"}</span>
                  <div className="vaa-review__meta">
                    <p className="vaa-review__name">{data.review_author}</p>
                    <p className="vaa-review__datetime">
                      <VaIconCalendar />
                      <span>{data.review_date}</span>
                      <span className="vaa-review__sep" aria-hidden>
                        |
                      </span>
                      <VaIconClock />
                      <span>{data.review_time}</span>
                    </p>
                  </div>
                  <div className="vaa-review__rating">
                    <StarRating stars={data.review_stars} size="lg" />
                    <span className="vaa-review__rating-value">{data.review_stars}/5</span>
                  </div>
                </div>

                <div className="vaa-quote vaa-quote--extreme">
                  <span className="vaa-quote__mark vaa-quote__mark--open" aria-hidden>
                    &ldquo;
                  </span>
                  <p className={`vaa-quote__text ${quoteSizeClass(fullComment.length)}`}>
                    {fullComment}
                  </p>
                  <span className="vaa-quote__mark vaa-quote__mark--close" aria-hidden>
                    &rdquo;
                  </span>
                </div>
              </section>

              <section className="vaa-mini vaa-mini--extreme">
                <p className="vaa-mini__band">IMPACTO EN LA MEDIA</p>
                <div className="vaa-impact">
                  <div className="vaa-impact__col">
                    <p className="vaa-impact__label">Media anterior</p>
                    <p className="vaa-impact__value">{data.previous_rating.toFixed(2)}</p>
                    <span className="vaa-impact__stars">
                      <StarRating stars={data.previous_rating} size="md" />
                    </span>
                  </div>
                  <div className="vaa-impact__col">
                    <p className="vaa-impact__label">Media actual</p>
                    <p className={`vaa-impact__value vaa-impact__value--tone-${tone}`}>
                      {data.current_rating.toFixed(2)}
                    </p>
                    <span className="vaa-impact__stars">
                      <StarRating stars={data.current_rating} size="md" />
                    </span>
                  </div>
                  <div className="vaa-impact__col">
                    <p className="vaa-impact__label">Variación</p>
                    <ImpactDelta delta={delta} />
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <div className="vaa-body">
              <div className="vaa-review-col">
                {/* Tarjeta grande de la reseña — protagonista */}
                <section className="vaa-review">
                  <div className="vaa-review__head">
                    <span className="vaa-review__avatar">{data.review_author.trim().charAt(0).toUpperCase() || "?"}</span>
                    <div className="vaa-review__meta">
                      <p className="vaa-review__name">{data.review_author}</p>
                      <p className="vaa-review__datetime">
                        <VaIconCalendar />
                        <span>{data.review_date}</span>
                        <span className="vaa-review__sep" aria-hidden>
                          |
                        </span>
                        <VaIconClock />
                        <span>{data.review_time}</span>
                      </p>
                    </div>
                    <div className="vaa-review__rating">
                      <StarRating stars={data.review_stars} size="lg" />
                      <span className="vaa-review__rating-value">{data.review_stars}/5</span>
                    </div>
                  </div>

                  <div className="vaa-quote">
                    <span className="vaa-quote__mark vaa-quote__mark--open" aria-hidden>
                      &ldquo;
                    </span>
                    <p className={`vaa-quote__text ${quoteSizeClass(fullComment.length)}`}>
                      {fullComment}
                    </p>
                    <span className="vaa-quote__mark vaa-quote__mark--close" aria-hidden>
                      &rdquo;
                    </span>
                  </div>
                </section>

                <section
                  className={`vaa-mini vaa-mini--under-quote ${fullComment.length < 500 ? "vaa-mini--short" : ""} ${shiftTier ? `vaa-mini--shift-${shiftTier}` : ""}`}
                >
                  <p className="vaa-mini__band">IMPACTO EN LA MEDIA</p>
                  <div className="vaa-impact">
                    <div className="vaa-impact__col">
                      <p className="vaa-impact__label">Media anterior</p>
                      <p className="vaa-impact__value">{data.previous_rating.toFixed(2)}</p>
                      <span className="vaa-impact__stars">
                        <StarRating stars={data.previous_rating} size="md" />
                      </span>
                    </div>
                    <div className="vaa-impact__col">
                      <p className="vaa-impact__label">Media actual</p>
                      <p className={`vaa-impact__value vaa-impact__value--tone-${tone}`}>
                        {data.current_rating.toFixed(2)}
                      </p>
                      <span className="vaa-impact__stars">
                        <StarRating stars={data.current_rating} size="md" />
                      </span>
                    </div>
                    <div className="vaa-impact__col">
                      <p className="vaa-impact__label">Variación</p>
                      <ImpactDelta delta={delta} />
                    </div>
                  </div>
                </section>
              </div>

              {/* Columna de inteligencia artificial */}
              <section className="vaa-insights">
                {analysisRows.length > 0 ? (
                  <>
                    <p className="vaa-ribbon">ANÁLISIS NEXO</p>
                    <ul className={`vaa-analysis vaa-analysis--${analysisTier}`}>
                      {analysisRows.map((row) => (
                        <li key={row.key}>
                          <span className="vaa-analysis__icon">{row.icon}</span>
                          <div className="vaa-analysis__copy">
                            <p className="vaa-analysis__label">{row.label}</p>
                            <p className="vaa-analysis__value">{row.value}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}

                <p className={`vaa-ribbon ${analysisRows.length > 0 ? "vaa-ribbon--mt" : ""}`}>DIAGNÓSTICO NEXO</p>
                <div className={`vaa-diagnostics vaa-diagnostics--${analysisTier}`}>
                  <div className="vaa-diagnostics__item">
                    <span className="vaa-diagnostics__icon vaa-diagnostics__icon--neutral">
                      <VaIconMood />
                    </span>
                    <p className="vaa-diagnostics__label">Sentimiento</p>
                    <p className="vaa-diagnostics__value">{sentiment ?? "Sin datos"}</p>
                  </div>
                  <div className="vaa-diagnostics__item">
                    <span className={`vaa-diagnostics__icon vaa-diagnostics__icon--${riskTone(risk)}`}>
                      <VaIconShield />
                    </span>
                    <p className="vaa-diagnostics__label">Riesgo</p>
                    <p className="vaa-diagnostics__value">{risk ?? "Sin datos"}</p>
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
                  <footer className={`vaa-footer vaa-footer--${footerSizeTier}`}>
                    <span className="vaa-footer__icon">
                      <VaIconClipboardBig />
                    </span>
                    <div className="vaa-footer__body">
                      <p className="vaa-footer__label">CONCLUSIÓN / ACCIÓN</p>
                      <p className={`vaa-footer__text vaa-footer__text--${footerSizeTier}`}>{conclusion}</p>
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
