"use client";

import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import {
  NEGATIVE_REVIEW_CARD_HEIGHT,
  NEGATIVE_REVIEW_CARD_WIDTH,
  NEGATIVE_REVIEW_RENDER_HEIGHT,
  NEGATIVE_REVIEW_RENDER_WIDTH,
} from "@/lib/reports/negative-reviews/export-image";
import {
  SAMPLE_BK_FULL,
  SAMPLE_BK_LONG,
} from "@/lib/templates/negative-review-alert/sample-data";
import { NegativeReviewAlertTemplate } from "@/templates/negative-review-alert";
import { BurgerKingAlertTemplate } from "@/templates/negative-review-alert/brands/burger-king-alert-template";

const REFERENCE_PATH = "/design/negative-review-alert-reference.png";

const SAMPLE_VARIANTS = {
  normal: { label: "Diseño normal", data: SAMPLE_BK_FULL },
  largo: { label: "Diseño largo", data: SAMPLE_BK_LONG },
} as const;

type SampleKey = keyof typeof SAMPLE_VARIANTS;

export default function NegativeReviewAlertPreviewPage() {
  const captureRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [compareMode, setCompareMode] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(50);
  const [referenceOk, setReferenceOk] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sampleKey, setSampleKey] = useState<SampleKey>("normal");
  const sample = SAMPLE_VARIANTS[sampleKey];
  const isBk = sample.data.brand === "bk";
  const renderWidth = NEGATIVE_REVIEW_RENDER_WIDTH;
  const renderHeight = NEGATIVE_REVIEW_RENDER_HEIGHT;

  const previewScale = 0.55;

  useEffect(() => {
    setMounted(true);
  }, []);

  async function downloadClientPng() {
    const node = captureRef.current;
    if (!node) return;
    setLoading(true);
    setStatus(null);
    try {
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
        width: NEGATIVE_REVIEW_RENDER_WIDTH,
        height: NEGATIVE_REVIEW_RENDER_HEIGHT,
        backgroundColor: "#e8ebf2",
        style: {
          width: `${NEGATIVE_REVIEW_RENDER_WIDTH}px`,
          height: `${NEGATIVE_REVIEW_RENDER_HEIGHT}px`,
          transform: "none",
          margin: "0",
          padding: "0",
        },
      });
      const link = document.createElement("a");
      link.download = "nexo-alerta-reseña-negativa-preview.png";
      link.href = dataUrl;
      link.click();
      setStatus("PNG generado en el navegador.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo generar la imagen.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadServerPng() {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/generate-negative-review-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sample.data),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Error ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = "nexo-alerta-reseña-negativa-api.png";
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      setStatus("PNG generado vía API (Playwright).");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falló la API de generación.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#ece8e1] px-6 py-10 text-[#1f1630]">
      <div className="mx-auto max-w-[1700px]">
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5b2d8e]">
              Preview · Alerta reseña negativa
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Plantilla premium {NEGATIVE_REVIEW_CARD_WIDTH}×{NEGATIVE_REVIEW_CARD_HEIGHT}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#5f5670]">
              Compara con el mockup superpuesto. Guarda tu PNG de referencia en{" "}
              <code className="rounded bg-white/80 px-1.5 py-0.5 text-xs">
                public/design/negative-review-alert-reference.png
              </code>
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setCompareMode((v) => !v)}
              className="rounded-xl border border-[#d8d0e5] bg-white px-4 py-2.5 text-sm font-medium"
            >
              {compareMode ? "Ocultar comparador" : "Modo comparar"}
            </button>
            <a
              href="/templates/negative-review-alert"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-[#d8d0e5] bg-white px-4 py-2.5 text-sm font-medium"
            >
              Plantilla HTML
            </a>
            <button
              type="button"
              onClick={downloadClientPng}
              disabled={loading}
              className="rounded-xl border border-[#d8d0e5] bg-white px-4 py-2.5 text-sm font-medium disabled:opacity-60"
            >
              PNG navegador
            </button>
            <button
              type="button"
              onClick={downloadServerPng}
              disabled={loading}
              className="rounded-xl bg-[#5b2d8e] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              PNG API
            </button>
          </div>
        </header>

        {compareMode ? (
          <div className="mb-6 rounded-xl border border-[#d8d0e5] bg-white px-4 py-4">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-[#5f5670]">
                Ejemplo
                <select
                  value={sampleKey}
                  onChange={(e) => setSampleKey(e.target.value as SampleKey)}
                  className="rounded-lg border border-[#d8d0e5] bg-white px-2 py-1.5 text-sm"
                >
                  {Object.entries(SAMPLE_VARIANTS).map(([key, { label }]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-3 text-sm text-[#5f5670]">
                Opacidad referencia
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={overlayOpacity}
                  onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                  className="w-40"
                />
                <span className="w-10 font-mono text-xs">{overlayOpacity}%</span>
              </label>
              {!referenceOk ? (
                <span className="text-xs text-amber-700">
                  Falta el archivo de referencia en public/design/
                </span>
              ) : (
                <span className="text-xs text-emerald-700">Referencia cargada ✓</span>
              )}
            </div>
          </div>
        ) : null}

        {status ? (
          <p className="mb-6 rounded-xl border border-[#d8d0e5] bg-white px-4 py-3 text-sm text-[#5f5670]">
            {status}
          </p>
        ) : null}

        <div className="overflow-auto rounded-[28px] border border-[#d8d0e5] bg-[#ddd8d0] p-6">
          <div
            className="relative mx-auto origin-top-left"
            style={{
              width: renderWidth * previewScale,
              height: renderHeight * previewScale,
            }}
          >
            <div
              style={{
                transform: `scale(${previewScale})`,
                transformOrigin: "top left",
                width: renderWidth,
                height: renderHeight,
              }}
            >
              <div
                className="relative"
                style={{ width: renderWidth, height: renderHeight }}
              >
                {isBk ? (
                  <BurgerKingAlertTemplate ref={captureRef} data={sample.data} />
                ) : (
                  <NegativeReviewAlertTemplate ref={captureRef} data={sample.data} />
                )}
                {compareMode && mounted && referenceOk ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={REFERENCE_PATH}
                    alt="Referencia"
                    className="pointer-events-none absolute inset-0 h-full w-full object-fill"
                    style={{ opacity: overlayOpacity / 100 }}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Precarga referencia */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={REFERENCE_PATH}
          alt=""
          className="hidden"
          onLoad={() => setReferenceOk(true)}
          onError={() => setReferenceOk(false)}
        />
      </div>
    </main>
  );
}
