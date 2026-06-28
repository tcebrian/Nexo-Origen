import { forwardRef } from "react";
import { NEXO_ORIGEN_LOGO_SRC } from "@/app/_components/nexo-brand";
import { getCommentDisplay } from "@/lib/templates/negative-review-alert/comment-layout";
import { resolveDesignCanvasSize } from "@/lib/templates/negative-review-alert/dimensions";
import { resolveGoalRecovery } from "@/lib/templates/negative-review-alert/goal-recovery";
import type { NegativeReviewAlertData } from "@/lib/templates/negative-review-alert/types";
import {
  IconAngryFace,
  IconBrain,
  IconCalendar,
  IconClipboard,
  IconClock,
  IconLightbulb,
  IconPin,
  IconRatingArrow,
  IconReasonAlert,
  IconShieldX,
  IconTarget,
  IconUser,
  IconWarning,
  NexoHeaderBrand,
  StarRating,
} from "./icons";
import "./negative-review-alert.css";

type NegativeReviewAlertTemplateProps = {
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

function splitReportDate(reportDate?: string): { date: string; time: string } {
  if (!reportDate) return { date: "—", time: "" };
  const parts = reportDate.split(",").map((p) => p.trim());
  return { date: parts[0] ?? reportDate, time: parts[1] ?? "" };
}

export const NegativeReviewAlertTemplate = forwardRef<
  HTMLDivElement,
  NegativeReviewAlertTemplateProps
>(function NegativeReviewAlertTemplate({ data, assetBaseUrl }, ref) {
  const design = resolveDesignCanvasSize(data.aspect_ratio);
  const comment = getCommentDisplay(data.review_comment);
  const location = data.restaurant_location || data.restaurant_address;
  const reportHeader = splitReportDate(data.report_date);
  const goalRecovery = resolveGoalRecovery(
    data.lifetime_rating,
    data.review_count,
    data.target_rating
  );

  return (
    <div
      ref={ref}
      className={`nra-canvas nra-canvas--${design.aspectRatio.replace(":", "-")}`}
      style={{ width: design.width, height: design.height }}
    >
      <div
        className="nra-canvas__design"
        style={{
          width: design.width,
          height: design.height,
        }}
      >
        <div className="nra-sheet">
        <header className="nra-topbar">
          <NexoHeaderBrand
            logoUrl={data.nexo_logo_url || NEXO_ORIGEN_LOGO_SRC}
            assetBaseUrl={assetBaseUrl}
          />
          <div className="nra-topbar__date">
            <IconCalendar />
            <div className="nra-topbar__date-text">
              <span className="nra-topbar__date-day">{reportHeader.date}</span>
              {reportHeader.time ? (
                <span className="nra-topbar__date-time">{reportHeader.time}</span>
              ) : null}
            </div>
          </div>
        </header>

        <aside className="nra-side">
          <div className="nra-side__premium">
            <div className="nra-side__panel">
              <div className="nra-side__slot nra-side__slot--logo">
                <div className="nra-side__logo-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={absUrl(assetBaseUrl, data.brand_logo_url)}
                    alt={data.brand_name}
                    className="nra-side__logo"
                  />
                </div>
              </div>

              <div className="nra-side__slot nra-side__slot--name">
                <h1 className="nra-side__name">{data.restaurant_name}</h1>
              </div>

              <div className="nra-side__slot nra-side__slot--location">
                <p className="nra-side__location">
                  <IconPin />
                  <span>{location}</span>
                </p>
              </div>

              <div className="nra-side__slot nra-side__slot--divider">
                <div className="nra-side__divider" aria-hidden />
              </div>

              <section className="nra-side__slot nra-side__slot--impact nra-side__impact">
                <div className="nra-side__impact-inner">
                  <p className="nra-label nra-label--section">IMPACTO EN LA MEDIA</p>
                  <div className="nra-side__impact-row">
                    <div className="nra-side__impact-col">
                      <span className="nra-score nra-score--prev">{data.previous_rating.toFixed(2)}</span>
                      <span className="nra-score-caption">MEDIA ANTERIOR</span>
                    </div>
                    <IconRatingArrow />
                    <div className="nra-side__impact-col">
                      <span className="nra-score nra-score--curr">{data.current_rating.toFixed(2)}</span>
                      <span className="nra-score-caption">MEDIA ACTUAL</span>
                    </div>
                  </div>
                </div>
              </section>

              <div className="nra-side__slot nra-side__slot--divider">
                <div className="nra-side__divider" aria-hidden />
              </div>

              <section className="nra-side__slot nra-side__slot--risk nra-side__risk">
                <div className="nra-side__risk-icon">
                  <IconShieldX />
                </div>
                <div className="nra-side__risk-copy">
                  <p className="nra-side__risk-label">NIVEL DE RIESGO</p>
                  <p className="nra-side__risk-value">{data.risk_level.toUpperCase()}</p>
                </div>
              </section>

              <div className="nra-side__slot nra-side__slot--divider nra-side__slot--divider-tight">
                <div className="nra-side__divider" aria-hidden />
              </div>

              <footer className="nra-side__slot nra-side__slot--source nra-side__source">
                <p className="nra-label nra-label--muted">FUENTE</p>
                <div className="nra-side__source-row">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={absUrl(assetBaseUrl, "/brands/google-maps-logo.svg")}
                    alt=""
                    className="nra-side__gmaps-logo"
                    aria-hidden
                  />
                  <span>{data.source}</span>
                </div>
              </footer>
            </div>
          </div>
        </aside>

        <div className="nra-main">
          <div className="nra-pill-alert">
            <span className="nra-pill-alert__icon">
              <IconWarning />
            </span>
            <p className="nra-pill-alert__title">
              <span className="nra-pill-alert__muted">RESEÑA NEGATIVA </span>
              <span className="nra-pill-alert__accent">DETECTADA</span>
            </p>
          </div>

          <div className="nra-quote">
            <div className="nra-quote__surface">
              <div className="nra-quote__inner">
                <span className="nra-quote__mark nra-quote__mark--open">“</span>
                <p className={`nra-quote__text ${comment.sizeClass}`}>{comment.text}</p>
                {comment.showReadMore ? (
                  <p className="nra-quote__more">Ver comentario completo →</p>
                ) : null}
                <span className="nra-quote__mark nra-quote__mark--close">”</span>
              </div>
            </div>
          </div>

          <aside
            className={`nra-author-rail${goalRecovery.show ? " nra-author-rail--recovery" : ""}`}
            aria-label="Autor y recuperación de objetivo"
          >
            <div className="nra-author-rail__surface">
              <div className="nra-author-card__section nra-author-card__section--stars">
                <StarRating stars={data.review_stars} size="lg" />
              </div>
              <div className="nra-author-card__divider" />
              <div className="nra-author-card__section">
                <span className="nra-author-card__icon-wrap">
                  <IconUser />
                </span>
                <span className="nra-author-card__name">{data.review_author}</span>
              </div>
              <div className="nra-author-card__divider" />
              <div className="nra-author-card__section">
                <span className="nra-author-card__icon-wrap">
                  <IconClock />
                </span>
                <div className="nra-author-card__datetime">
                  <span className="nra-author-card__date">{data.review_date}</span>
                  <span className="nra-author-card__time">{data.review_time}</span>
                </div>
              </div>

              {goalRecovery.show ? (
                <>
                  <div className="nra-author-card__divider nra-author-card__divider--recovery" />
                  <section className="nra-recovery" aria-label="Recuperación de objetivo">
                    <div className="nra-recovery__head">
                      <span className="nra-recovery__icon-wrap">
                        <IconTarget />
                      </span>
                      <p className="nra-recovery__title">RECUPERACIÓN DE OBJETIVO</p>
                    </div>
                    <div className="nra-recovery__scores">
                      <div className="nra-recovery__score-col">
                        <span className="nra-recovery__caption">MEDIA ACTUAL</span>
                        <span className="nra-recovery__value nra-recovery__value--curr">
                          {goalRecovery.currentRating.toFixed(2)}
                        </span>
                      </div>
                      <div className="nra-recovery__score-col">
                        <span className="nra-recovery__caption">OBJETIVO</span>
                        <span className="nra-recovery__value nra-recovery__value--goal">
                          {goalRecovery.targetRating.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="nra-recovery__box">
                      <p className="nra-recovery__box-label">RESEÑAS POSITIVAS NECESARIAS</p>
                      <p className="nra-recovery__count">{goalRecovery.positivesNeeded}</p>
                      <p className="nra-recovery__hint">reseñas de 5 ★ para volver al objetivo</p>
                    </div>
                  </section>
                </>
              ) : null}
            </div>
          </aside>

          <section className="nra-insights">
            <div className="nra-insights__col nra-insights__col--ai">
              <div className="nra-insights__head nra-insights__head--ai">
                <span className="nra-insights__icon nra-insights__icon--ai">
                  <IconBrain />
                </span>
                <p className="nra-label">ANÁLISIS IA</p>
              </div>
              <p className="nra-insights__sub">TIPO DE RIESGO</p>
              <p className="nra-insights__risk-value">{data.risk_level.toUpperCase()}</p>
              {data.detected_reasons.length > 0 ? (
                <>
                  <p className="nra-insights__sub nra-insights__sub--motives">MOTIVOS DETECTADOS</p>
                  <ul className="nra-reasons">
                    {data.detected_reasons.map((reason) => (
                      <li key={reason}>
                        <span className="nra-reasons__icon">
                          <IconReasonAlert />
                        </span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>

            <div className="nra-insights__col nra-insights__col--center">
              <p className="nra-label">SENTIMIENTO</p>
              <div className="nra-mood__circle">
                <IconAngryFace />
              </div>
              <p className="nra-mood__text">{data.sentiment}</p>
            </div>
          </section>
        </div>

        <div className="nra-footer-wrap">
          <footer className="nra-footer">
            <div className="nra-footer__bulb">
              <IconLightbulb />
            </div>
            <div className="nra-footer__body">
              <p className="nra-footer__label">RECOMENDACIÓN</p>
              <p className="nra-footer__text">{data.recommendation}</p>
            </div>
            <div className="nra-footer__clip">
              <IconClipboard />
            </div>
          </footer>
        </div>
      </div>
    </div>
    </div>
  );
});
