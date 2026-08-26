"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReportPeriodSlug } from "@/lib/reports/period-ranges";
import type { NetworkReportGroupId } from "@/lib/reports/network-summary/brand-groups";
import { btnGhost, btnPrimary, card, shell } from "./ui/informes-styles";

type NetworkSummaryImageModalProps = {
  periodo: ReportPeriodSlug;
  grupo: { id: NetworkReportGroupId; label: string } | null;
  onClose: () => void;
};

/**
 * Igual patrón que ReviewImageModal (resenas) e
 * InformesNegativeReviewsImageModal: la imagen se genera siempre en el
 * servidor (Playwright), nunca en el navegador. Portal a document.body por
 * la misma razón que ReviewImageModal — evita que `position: fixed` quede
 * anclado a un ancestro con transform en vez de a la pantalla.
 */
export function NetworkSummaryImageModal({ periodo, grupo, onClose }: NetworkSummaryImageModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const generatePreview = useCallback(async () => {
    if (!grupo) return;
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/generate-network-summary-image?periodo=${periodo}&grupo=${grupo.id}`);
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
      console.error("[NetworkSummaryImageModal]", err);
      setError("No se pudo generar la imagen. Inténtalo de nuevo.");
    } finally {
      setGenerating(false);
    }
  }, [grupo, periodo]);

  useEffect(() => {
    if (!grupo) return;
    setPreviewUrl(null);
    void generatePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupo, periodo]);

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

  if (!grupo) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center py-4">
        <div className={`relative w-full max-w-4xl ${shell} p-4 sm:p-5`} onClick={(event) => event.stopPropagation()}>
          <div className="mb-4 flex shrink-0 items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--nexo-accent)]">
                Vista previa
              </p>
              <h3 className="mt-1 truncate text-lg font-semibold text-[var(--nexo-text)]">{grupo.label}</h3>
            </div>
            <button type="button" onClick={onClose} className={`${btnGhost} shrink-0`}>
              Cerrar
            </button>
          </div>

          <div className={`${card} flex max-h-[60vh] min-h-[200px] items-center justify-center overflow-hidden p-2`}>
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={`Informe ${grupo.label}`}
                className="mx-auto block max-h-[58vh] w-auto max-w-full object-contain"
              />
            ) : (
              <div className="flex items-center justify-center py-16 text-[13px] text-[var(--nexo-text-secondary)]">
                {generating ? "Generando imagen…" : "Preparando vista previa…"}
              </div>
            )}
          </div>

          {error ? <p className="mt-2 text-[13px] text-red-300">{error}</p> : null}

          <div className="mt-4 flex shrink-0 flex-wrap justify-end gap-2">
            <button type="button" onClick={() => void generatePreview()} className={btnGhost}>
              Regenerar
            </button>
            <a
              href={previewUrl ?? undefined}
              download={`nexo-informe-${periodo}-${grupo.id}.png`}
              className={`${btnPrimary} ${!previewUrl ? "pointer-events-none opacity-50" : ""}`}
            >
              Descargar PNG
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
