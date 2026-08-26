"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  buildNegativeReviewFilename,
  downloadDataUrl,
  NEGATIVE_REVIEW_CARD_HEIGHT,
  NEGATIVE_REVIEW_CARD_WIDTH,
} from "@/lib/reports/negative-reviews/export-image";
import { EDITABLE_HANDOFF_KEY } from "@/lib/templates/negative-review-alert/editable-handoff";
import { mapReviewToAlertData } from "@/lib/templates/negative-review-alert/map-from-review";
import type { Review } from "@/lib/reviews/types";
import { btnGhost, btnPrimary, card, shell } from "@/app/dashboard/informes/_components/ui/informes-styles";

type ReviewImageModalProps = {
  review: Review | null;
  onClose: () => void;
};

/**
 * Igual que InformesNegativeReviewsImageModal (misma vía de generación: el
 * servidor vía Playwright, nunca el navegador del usuario — ver esa
 * plantilla para el porqué), pero para cualquier reseña de la bandeja
 * general, no solo las ≤3★ del informe de reseñas negativas.
 */
export function ReviewImageModal({ review, onClose }: ReviewImageModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [assetBaseUrl, setAssetBaseUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    setAssetBaseUrl(window.location.origin);
  }, []);

  const data = useMemo(() => (review ? mapReviewToAlertData(review) : null), [review]);

  const generatePreview = useCallback(async () => {
    if (!review || !data) return;

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/generate-negative-review-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Error ${response.status}`);
      }

      const blob = await response.blob();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setPreviewUrl(url);
    } catch (err) {
      console.error("[ReviewImageModal]", err);
      setError("No se pudo generar la imagen. Inténtalo de nuevo.");
    } finally {
      setGenerating(false);
    }
  }, [data, review]);

  useEffect(() => {
    if (!review || !data || !assetBaseUrl) return;
    setPreviewUrl(null);
    void generatePreview();
  }, [assetBaseUrl, generatePreview, review, data]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!review || !data) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
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
                Vista previa
              </p>
              <h3 className="mt-1 truncate text-lg font-semibold text-[var(--nexo-text)]">
                {review.restaurant}
              </h3>
              <p className="mt-1 text-[13px] text-[var(--nexo-text-secondary)]">
                {review.author}
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
                alt={`Imagen reseña ${review.restaurant}`}
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
                window.sessionStorage.setItem(EDITABLE_HANDOFF_KEY, JSON.stringify({ data }));
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
                void downloadDataUrl(
                  previewUrl,
                  buildNegativeReviewFilename({
                    restaurantSlug: review.restaurantSlug,
                    id: review.id,
                    dateIso: review.date.toISOString(),
                  })
                );
              }}
            >
              Descargar PNG
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
