"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildNegativeReviewFilename,
  downloadDataUrl,
  exportElementToPng,
  NEGATIVE_REVIEW_CARD_HEIGHT,
  NEGATIVE_REVIEW_CARD_WIDTH,
  NEGATIVE_REVIEW_RENDER_HEIGHT,
  NEGATIVE_REVIEW_RENDER_WIDTH,
} from "@/lib/reports/negative-reviews/export-image";
import { EDITABLE_HANDOFF_KEY } from "@/lib/templates/negative-review-alert/editable-handoff";
import { mapReportRowToAlertTemplateProps } from "@/lib/reports/negative-reviews/templates";
import type { NegativeReviewReportRow } from "@/lib/reports/negative-reviews/types";
import { NegativeReviewAlertTemplate } from "@/templates/negative-review-alert";
import { BurgerKingAlertTemplate } from "@/templates/negative-review-alert/brands/burger-king-alert-template";
import { PopeyesAlertTemplate } from "@/templates/negative-review-alert/brands/popeyes-alert-template";
import { SantaGloriaAlertTemplate } from "@/templates/negative-review-alert/brands/santa-gloria-alert-template";
import { btnGhost, btnPrimary, card, shell } from "./ui/informes-styles";

type InformesNegativeReviewsImageModalProps = {
  row: NegativeReviewReportRow | null;
  onClose: () => void;
};

export function InformesNegativeReviewsImageModal({
  row,
  onClose,
}: InformesNegativeReviewsImageModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // assetBaseUrl must be resolved client-side only to avoid hydration mismatch.
  const [assetBaseUrl, setAssetBaseUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    setAssetBaseUrl(window.location.origin);
  }, []);

  const templateProps = useMemo(
    () => (row ? mapReportRowToAlertTemplateProps(row, assetBaseUrl) : null),
    [assetBaseUrl, row]
  );
  const isBk = row?.brand === "bk";
  const isPopeyes = row?.brand === "pp";
  const isSantaGloria = row?.brand === "sg";

  const generatePreview = useCallback(async () => {
    if (!row || !cardRef.current || !templateProps) return;

    setGenerating(true);
    setError(null);

    try {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

      const images = cardRef.current.querySelectorAll("img");
      await Promise.all(
        Array.from(images).map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) {
                resolve();
                return;
              }
              img.onload = () => resolve();
              img.onerror = () => resolve();
            })
        )
      );

      await new Promise((resolve) => setTimeout(resolve, 120));

      const dataUrl = await exportElementToPng(cardRef.current);
      setPreviewUrl(dataUrl);
    } catch (err) {
      console.error("[InformesNegativeReviewsImageModal]", err);
      setError("No se pudo generar la imagen. Inténtalo de nuevo.");
    } finally {
      setGenerating(false);
    }
  }, [row, templateProps]);

  useEffect(() => {
    if (!row || !templateProps || !assetBaseUrl) return;
    setPreviewUrl(null);
    void generatePreview();
  }, [assetBaseUrl, generatePreview, row, templateProps]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!row || !templateProps) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center py-4">
        <div
          className={`relative w-full max-w-3xl ${shell} p-4 sm:p-5`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-4 flex shrink-0 items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--nexo-accent)]">
                Vista previa del informe
              </p>
              <h3 className="mt-1 truncate text-lg font-semibold text-[var(--nexo-text)]">
                {row.restaurant}
              </h3>
              <p className="mt-1 text-[13px] text-[var(--nexo-text-secondary)]">
                {row.dateLabel} · {row.author}
              </p>
            </div>
            <button type="button" onClick={onClose} className={`${btnGhost} shrink-0`}>
              Cerrar
            </button>
          </div>

          <div className={`${card} flex max-h-[52vh] min-h-[200px] items-center justify-center overflow-hidden p-2`}>
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={`Informe reseña negativa ${row.restaurant}`}
                className="mx-auto block max-h-[50vh] w-auto max-w-full object-contain"
              />
            ) : (
              <div className="flex items-center justify-center py-16 text-[13px] text-[var(--nexo-text-secondary)]">
                {generating ? "Generando imagen…" : "Preparando vista previa…"}
              </div>
            )}
          </div>

          <p className="mt-2 text-center text-[11px] text-[var(--nexo-text-secondary)]">
            Vista reducida · el PNG se descarga a {NEGATIVE_REVIEW_CARD_WIDTH}×
            {NEGATIVE_REVIEW_CARD_HEIGHT} px
          </p>

          {error ? <p className="mt-2 text-[13px] text-red-300">{error}</p> : null}

          <div className="mt-4 flex shrink-0 flex-wrap justify-end gap-2">
            <button type="button" onClick={() => void generatePreview()} className={btnGhost}>
              Regenerar
            </button>
            <button
              type="button"
              className={btnGhost}
              onClick={() => {
                window.sessionStorage.setItem(
                  EDITABLE_HANDOFF_KEY,
                  JSON.stringify({ data: templateProps.data })
                );
                window.open("/preview/negative-review-alert", "_blank");
              }}
            >
              ¿No te gusta? Editar
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={!previewUrl || generating}
              onClick={() => {
                if (!previewUrl) return;
                void downloadDataUrl(previewUrl, buildNegativeReviewFilename(row));
              }}
            >
              Descargar PNG
            </button>
          </div>

          {/* Render off-screen a tamaño real para la captura PNG */}
          <div
            aria-hidden
            className="pointer-events-none fixed overflow-hidden"
            style={{
              left: -20000,
              top: 0,
              width: NEGATIVE_REVIEW_RENDER_WIDTH,
              height: NEGATIVE_REVIEW_RENDER_HEIGHT,
              opacity: 0,
            }}
          >
            {isBk ? (
              <BurgerKingAlertTemplate ref={cardRef} {...templateProps} />
            ) : isPopeyes ? (
              <PopeyesAlertTemplate ref={cardRef} {...templateProps} />
            ) : isSantaGloria ? (
              <SantaGloriaAlertTemplate ref={cardRef} {...templateProps} />
            ) : (
              <NegativeReviewAlertTemplate ref={cardRef} {...templateProps} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
