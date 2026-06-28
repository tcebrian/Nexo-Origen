"use client";

import { forwardRef, useMemo } from "react";
import type { NegativeReviewReportRow } from "../types";
import { mapRowToTemplateData } from "./map-template-data";
import type { NegativeReviewTemplateData, TemplateListItem } from "./template-data";
import "./premium-negative-review-template.css";

export type PremiumNegativeReviewTemplateProps = {
  data: NegativeReviewReportRow;
  assetBaseUrl?: string;
  templateData?: NegativeReviewTemplateData;
};

function ratingToStars(rating: string, tone: "green" | "red") {
  const value = Number.parseFloat(rating);
  const filled = Number.isFinite(value) ? Math.max(0, Math.min(5, Math.round(value))) : 0;
  if (!Number.isFinite(value)) {
    return { className: tone === "red" ? "nrv-red-stars" : "nrv-green-stars", text: "—" };
  }
  const text = Array.from({ length: 5 })
    .map((_, index) => (index < filled ? "★" : "☆"))
    .join("");
  return { className: tone === "red" ? "nrv-red-stars" : "nrv-green-stars", text };
}

function StarRating({ stars }: { stars: number }) {
  const on = Math.max(0, Math.min(5, stars));
  const off = 5 - on;
  return (
    <div className="nrv-stars">
      <span className="on">{"★".repeat(on)}</span>
      <span className="off">{"★".repeat(off)}</span>
    </div>
  );
}

function PanelItems({ items }: { items: TemplateListItem[] }) {
  return (
    <>
      {items.map((item, index) => (
        <div key={index} className="nrv-item">
          <div className="nrv-icon">{item.icon}</div>
          <div>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </div>
        </div>
      ))}
    </>
  );
}

export const PremiumNegativeReviewTemplate = forwardRef<
  HTMLDivElement,
  PremiumNegativeReviewTemplateProps
>(function PremiumNegativeReviewTemplate({ data, assetBaseUrl, templateData }, ref) {
  const view = useMemo(
    () => templateData ?? mapRowToTemplateData(data, assetBaseUrl),
    [assetBaseUrl, data, templateData]
  );

  const previousStars = ratingToStars(view.previousRating, "green");
  const currentStars = ratingToStars(view.currentRating, "red");

  return (
    <div ref={ref} className="nrv-canvas">
      {view.showBkDecor ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={view.decor.beans} alt="" className="nrv-decor-beans" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={view.decor.burger} alt="" className="nrv-decor-burger" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={view.decor.cup} alt="" className="nrv-decor-cup" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={view.decor.fries} alt="" className="nrv-decor-fries" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={view.decor.sad} alt="" className="nrv-decor-sad" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={view.decor.bkSticker} alt="" className="nrv-decor-sticker" />
        </>
      ) : null}

      <div className="nrv-title">
        <div className="top">RESEÑA</div>
        <div className="bottom">NEGATIVA</div>
      </div>

      <div className="nrv-crown">♛</div>
      <div className="nrv-subtitle">NUEVO COMENTARIO RECIBIDO</div>

      <div className="nrv-nexo-block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={view.nexoLogoUrl} alt="Nexo Origen" />
        <span className="nrv-nexo-tagline">Reputación que impulsa</span>
      </div>

      <div className="nrv-top-brand">
        <div className="nrv-bk-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={view.logoUrl} alt={view.brandName} />
        </div>
        <div className="nrv-divider" />
        <div className="nrv-brand-text">
          <div className="nrv-brand-name">{view.brandName}</div>
          <div className="nrv-local-name">{view.localName}</div>
        </div>
      </div>

      <div className="nrv-left-card">
        <div className="nrv-date">
          ▣ Comentario recibido hoy <b>{view.reviewDate}</b> a las <b>{view.reviewTime}</b>
        </div>

        <div className="nrv-user">
          <div className="nrv-avatar">{view.authorInitial}</div>
          <div>
            <div className="nrv-author">{view.authorName}</div>
            <div className="nrv-guide">Local Guide · 1 reseña</div>
          </div>
          <div className="nrv-dots">⋮</div>
        </div>

        <div className="nrv-stars-row">
          <StarRating stars={view.stars} />
          <span className="nrv-info-icon">i</span>
        </div>

        <div className="nrv-info">
          <span>Comí allí</span>
          <span>|</span>
          <span>10-20 €</span>
        </div>

        <div className="nrv-comment">{view.comment}</div>

        <div className="nrv-score-pills">
          <span className="nrv-score-pill">Comida: {view.foodScore}</span>
          <span className="nrv-score-pill">Servicio: {view.serviceScore}</span>
          <span className="nrv-score-pill">Ambiente: {view.atmosphereScore}</span>
        </div>
      </div>

      <div className="nrv-media-box">
        <div className="nrv-green-label">IMPACTO EN LA MEDIA</div>
        <p>Este comentario ha hecho bajar nuestra valoración</p>

        <div className="nrv-ratings">
          <div>
            <div className="nrv-num">{view.previousRating}</div>
            <div className={previousStars.className}>{previousStars.text}</div>
            <div className="nrv-r-label">
              MEDIA ANTERIOR
              <br />
              AL COMENTARIO
            </div>
          </div>
          <div className="nrv-down">↓</div>
          <div>
            <div className="nrv-num">{view.currentRating}</div>
            <div className={currentStars.className}>{currentStars.text}</div>
            <div className="nrv-r-label">MEDIA ACTUAL</div>
          </div>
        </div>
      </div>

      <div className="nrv-drop">
        <div className="circle">↘</div>
        DISMINUCIÓN DE
        <strong>{view.ratingDrop} PUNTOS</strong>
        EN LA MEDIA GLOBAL
      </div>

      <div className="nrv-panel nrv-summary">
        <div className="nrv-red-title">RESUMEN RÁPIDO</div>
        <div className="nrv-panel-body">
          <PanelItems items={view.quickSummaryItems} />
        </div>
      </div>

      <div className="nrv-panel nrv-impact">
        <div className="nrv-red-title">IMPACTO</div>
        <div className="nrv-panel-body">
          <PanelItems items={view.impactItems} />
        </div>
      </div>

      <div className="nrv-footer">
        <div className="nrv-footer-badge">♛ NOTA:</div>
        <div className="nrv-footer-text">{view.finalNote}</div>
        <div className="nrv-fire">🔥</div>
      </div>
    </div>
  );
});
