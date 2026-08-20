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
  SAMPLE_BK_SHORT,
  SAMPLE_PP_FULL,
  SAMPLE_PP_LONG,
  SAMPLE_PP_SHORT,
} from "@/lib/templates/negative-review-alert/sample-data";
import { EDITABLE_HANDOFF_KEY } from "@/lib/templates/negative-review-alert/editable-handoff";
import type { NegativeReviewAlertData } from "@/lib/templates/negative-review-alert/types";
import { NegativeReviewAlertTemplate } from "@/templates/negative-review-alert";
import { BurgerKingAlertTemplate } from "@/templates/negative-review-alert/brands/burger-king-alert-template";
import { PopeyesAlertTemplate } from "@/templates/negative-review-alert/brands/popeyes-alert-template";

const REFERENCE_PATH = "/design/negative-review-alert-reference.png";

const BRAND_SAMPLE_VARIANTS = {
  bk: {
    label: "Burger King",
    variants: {
      normal: { label: "Diseño reseña media", data: SAMPLE_BK_FULL },
      corta: { label: "Diseño corta", data: SAMPLE_BK_SHORT },
      largo: { label: "Diseño largo", data: SAMPLE_BK_LONG },
      editable: { label: "Editable", data: SAMPLE_BK_FULL },
    },
  },
  pp: {
    label: "Popeyes",
    variants: {
      normal: { label: "Diseño reseña media", data: SAMPLE_PP_FULL },
      corta: { label: "Diseño corta", data: SAMPLE_PP_SHORT },
      largo: { label: "Diseño largo", data: SAMPLE_PP_LONG },
      editable: { label: "Editable", data: SAMPLE_PP_FULL },
    },
  },
} as const;

type BrandKey = keyof typeof BRAND_SAMPLE_VARIANTS;
type SampleKey = keyof (typeof BRAND_SAMPLE_VARIANTS)["bk"]["variants"];

/** Bloques que se pueden arrastrar en modo "Mover elementos" — cada uno es
 * una unidad visual independiente, sin anidarse unos dentro de otros. Los
 * selectores combinan la clase de cada marca (bka-/ppa-) para que el modo
 * editable funcione igual sea cual sea la marca activa. */
const DRAG_TARGETS: { selector: string; label: string; isImage?: boolean }[] = [
  { selector: ".bka-review, .ppa-review", label: "Reseña / comentario" },
  { selector: ".bka-mini, .ppa-mini", label: "Impacto en la media" },
  { selector: ".bka-insights, .ppa-insights", label: "Análisis + Diagnóstico" },
  { selector: ".bka-footer, .ppa-footer", label: "Conclusión / Acción" },
  { selector: ".bka-product--burger, .ppa-product--tenders", label: "Producto principal", isImage: true },
  { selector: ".bka-product--fries, .ppa-product--fries", label: "Patatas", isImage: true },
  { selector: ".bka-product--drink, .ppa-product--drink", label: "Bebida", isImage: true },
];

/** Bloques (no imágenes) a los que se les puede añadir tiradores de
 * redimensionado — un <img> no puede tener hijos renderizados en el DOM. */
const RESIZE_TARGETS = DRAG_TARGETS.filter(({ isImage }) => !isImage);

/** Textos cuyo tamaño de letra se puede ajustar en modo edición. */
const FONT_TARGETS: { selector: string; label: string }[] = [
  { selector: ".bka-review__name, .ppa-review__name", label: "Nombre autor" },
  { selector: ".bka-review__datetime, .ppa-review__datetime", label: "Fecha / hora" },
  { selector: ".bka-quote__text, .ppa-quote__text", label: "Comentario" },
  { selector: ".bka-impact__value, .ppa-impact__value", label: "Impacto — valores" },
  { selector: ".bka-impact__delta, .ppa-impact__delta", label: "Impacto — variación" },
  { selector: ".bka-impact__label, .ppa-impact__label", label: "Impacto — etiquetas" },
  { selector: ".bka-analysis__value, .ppa-analysis__value", label: "Análisis Nexo — texto" },
  { selector: ".bka-analysis__label, .ppa-analysis__label", label: "Análisis Nexo — etiquetas" },
  { selector: ".bka-diagnostics__value, .ppa-diagnostics__value", label: "Diagnóstico Nexo — texto" },
  { selector: ".bka-diagnostics__label, .ppa-diagnostics__label", label: "Diagnóstico Nexo — etiquetas" },
  { selector: ".bka-footer__text, .ppa-footer__text", label: "Conclusión / Acción" },
];

export default function NegativeReviewAlertPreviewPage() {
  const captureRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [compareMode, setCompareMode] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(50);
  const [referenceOk, setReferenceOk] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [brandKey, setBrandKey] = useState<BrandKey>("bk");
  const [sampleKey, setSampleKey] = useState<SampleKey>("normal");
  const [externalEditableData, setExternalEditableData] = useState<NegativeReviewAlertData | null>(
    null
  );
  const sample = BRAND_SAMPLE_VARIANTS[brandKey].variants[sampleKey];
  const isEditable = sampleKey === "editable";
  const activeData = isEditable && externalEditableData ? externalEditableData : sample.data;
  const isBk = activeData.brand === "bk";
  const isPopeyes = activeData.brand === "pp";
  const renderWidth = NEGATIVE_REVIEW_RENDER_WIDTH;
  const renderHeight = NEGATIVE_REVIEW_RENDER_HEIGHT;

  const previewScale = 0.55;

  // Si venimos del botón "Editar" del modal real de generación de PNG, carga
  // la reseña exacta que se estaba viendo (una sola vez) en vez de la
  // muestra genérica.
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(EDITABLE_HANDOFF_KEY);
      if (!raw) return;
      window.sessionStorage.removeItem(EDITABLE_HANDOFF_KEY);
      const parsed = JSON.parse(raw) as { data: NegativeReviewAlertData };
      if (parsed?.data) {
        setExternalEditableData(parsed.data);
        if (parsed.data.brand === "bk" || parsed.data.brand === "pp") {
          setBrandKey(parsed.data.brand);
        }
        setSampleKey("editable");
      }
    } catch {
      // payload inválido o inaccesible: se queda en la muestra genérica
    }
  }, []);

  const [offsets, setOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const offsetsRef = useRef(offsets);
  offsetsRef.current = offsets;
  const dragStateRef = useRef<{
    el: HTMLElement;
    label: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const [fontDeltas, setFontDeltas] = useState<Record<string, number>>({});
  const fontBaseRef = useRef<Record<string, number>>({});
  const [availableFontTargets, setAvailableFontTargets] = useState<string[]>([]);

  const [sizes, setSizes] = useState<Record<string, { width: number; height: number }>>({});
  const sizesRef = useRef(sizes);
  sizesRef.current = sizes;
  const resizeStateRef = useRef<{
    el: HTMLElement;
    label: string;
    startX: number;
    startY: number;
    origW: number;
    origH: number;
    axis: "x" | "y" | "both";
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Al cambiar de diseño, los bloques son otros (o tienen otro contenido):
  // se limpian los desplazamientos, tamaños y tamaños de letra para no
  // arrastrar ajustes que ya no tienen sentido en el nuevo diseño.
  useEffect(() => {
    setOffsets({});
    setFontDeltas({});
    setSizes({});
    const root = captureRef.current;
    if (!root) return;
    for (const { selector } of DRAG_TARGETS) {
      root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
        el.style.translate = "";
      });
    }
    for (const { selector } of RESIZE_TARGETS) {
      root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
        el.style.width = "";
        el.style.height = "";
      });
    }
    const base: Record<string, number> = {};
    const available: string[] = [];
    for (const { selector, label } of FONT_TARGETS) {
      const els = root.querySelectorAll<HTMLElement>(selector);
      els.forEach((el) => {
        el.style.fontSize = "";
      });
      const first = els[0];
      if (first) {
        base[label] = parseFloat(getComputedStyle(first).fontSize);
        available.push(label);
      }
    }
    fontBaseRef.current = base;
    setAvailableFontTargets(available);
  }, [sampleKey, brandKey]);

  useEffect(() => {
    const root = captureRef.current;
    if (!root) return;
    for (const { selector, label } of FONT_TARGETS) {
      const delta = fontDeltas[label];
      const base = fontBaseRef.current[label];
      if (delta === undefined || base === undefined) continue;
      root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
        el.style.fontSize = `${Math.max(6, base + delta)}px`;
      });
    }
  }, [fontDeltas, sampleKey, brandKey]);

  useEffect(() => {
    const root = captureRef.current;
    if (!root || !isEditable) return;

    const cleanups: (() => void)[] = [];

    for (const { selector, label } of DRAG_TARGETS) {
      const elements = root.querySelectorAll<HTMLElement>(selector);
      elements.forEach((el) => {
        el.style.cursor = "grab";
        el.style.outline = "2px dashed #5b2d8e";
        el.style.outlineOffset = "2px";

        const onPointerDown = (e: PointerEvent) => {
          e.preventDefault();
          e.stopPropagation();
          const current = offsetsRef.current[label] ?? { x: 0, y: 0 };
          dragStateRef.current = {
            el,
            label,
            startX: e.clientX,
            startY: e.clientY,
            origX: current.x,
            origY: current.y,
          };
          el.style.cursor = "grabbing";
          window.addEventListener("pointermove", onPointerMove);
          window.addEventListener("pointerup", onPointerUp);
        };

        el.addEventListener("pointerdown", onPointerDown);
        cleanups.push(() => {
          el.removeEventListener("pointerdown", onPointerDown);
          el.style.cursor = "";
          el.style.outline = "";
          el.style.outlineOffset = "";
        });
      });
    }

    function onPointerMove(e: PointerEvent) {
      const drag = dragStateRef.current;
      if (!drag) return;
      const dx = (e.clientX - drag.startX) / previewScale;
      const dy = (e.clientY - drag.startY) / previewScale;
      const x = Math.round(drag.origX + dx);
      const y = Math.round(drag.origY + dy);
      drag.el.style.translate = `${x}px ${y}px`;
      setOffsets((prev) => ({ ...prev, [drag.label]: { x, y } }));
    }

    function onPointerUp() {
      const drag = dragStateRef.current;
      if (drag) drag.el.style.cursor = "grab";
      dragStateRef.current = null;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    }

    // Tiradores de redimensionado: lateral derecho (ancho), inferior (alto)
    // y esquina (ambos), añadidos como hijos absolutos de cada bloque.
    const HANDLE_SPECS: { axis: "x" | "y" | "both"; cursor: string; style: Partial<CSSStyleDeclaration> }[] = [
      {
        axis: "x",
        cursor: "ew-resize",
        style: { right: "-5px", top: "0", width: "10px", height: "100%" },
      },
      {
        axis: "y",
        cursor: "ns-resize",
        style: { bottom: "-5px", left: "0", width: "100%", height: "10px" },
      },
      {
        axis: "both",
        cursor: "nwse-resize",
        style: { right: "-6px", bottom: "-6px", width: "14px", height: "14px", borderRadius: "999px" },
      },
    ];

    for (const { selector, label } of RESIZE_TARGETS) {
      const elements = root.querySelectorAll<HTMLElement>(selector);
      elements.forEach((el) => {
        const prevPosition = el.style.position;
        if (getComputedStyle(el).position === "static") {
          el.style.position = "relative";
        }

        const handles: HTMLElement[] = [];
        for (const spec of HANDLE_SPECS) {
          const handle = document.createElement("div");
          handle.style.position = "absolute";
          handle.style.background = "#5b2d8e";
          handle.style.opacity = "0.85";
          handle.style.zIndex = "50";
          handle.style.cursor = spec.cursor;
          Object.assign(handle.style, spec.style);

          const onHandlePointerDown = (e: PointerEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const current = sizesRef.current[label] ?? {
              width: el.offsetWidth,
              height: el.offsetHeight,
            };
            resizeStateRef.current = {
              el,
              label,
              startX: e.clientX,
              startY: e.clientY,
              origW: current.width,
              origH: current.height,
              axis: spec.axis,
            };
            window.addEventListener("pointermove", onResizeMove);
            window.addEventListener("pointerup", onResizeUp);
          };
          handle.addEventListener("pointerdown", onHandlePointerDown);
          el.appendChild(handle);
          handles.push(handle);
        }

        cleanups.push(() => {
          handles.forEach((h) => h.remove());
          el.style.position = prevPosition;
        });
      });
    }

    function onResizeMove(e: PointerEvent) {
      const resize = resizeStateRef.current;
      if (!resize) return;
      const dx = (e.clientX - resize.startX) / previewScale;
      const dy = (e.clientY - resize.startY) / previewScale;
      const width = Math.round(
        resize.axis === "y" ? resize.origW : Math.max(40, resize.origW + dx),
      );
      const height = Math.round(
        resize.axis === "x" ? resize.origH : Math.max(30, resize.origH + dy),
      );
      resize.el.style.width = `${width}px`;
      resize.el.style.height = `${height}px`;
      setSizes((prev) => ({ ...prev, [resize.label]: { width, height } }));
    }

    function onResizeUp() {
      resizeStateRef.current = null;
      window.removeEventListener("pointermove", onResizeMove);
      window.removeEventListener("pointerup", onResizeUp);
    }

    return () => {
      cleanups.forEach((fn) => fn());
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointermove", onResizeMove);
      window.removeEventListener("pointerup", onResizeUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditable, sampleKey, brandKey]);

  function resetPositions() {
    const root = captureRef.current;
    if (root) {
      for (const { selector } of DRAG_TARGETS) {
        root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
          el.style.translate = "";
        });
      }
      for (const { selector } of FONT_TARGETS) {
        root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
          el.style.fontSize = "";
        });
      }
      for (const { selector } of RESIZE_TARGETS) {
        root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
          el.style.width = "";
          el.style.height = "";
        });
      }
    }
    setOffsets({});
    setFontDeltas({});
    setSizes({});
  }

  async function copyPositions() {
    const fontSizes: Record<string, number> = {};
    for (const label of availableFontTargets) {
      const base = fontBaseRef.current[label] ?? 0;
      const delta = fontDeltas[label] ?? 0;
      fontSizes[label] = Math.round((base + delta) * 10) / 10;
    }
    const text = JSON.stringify(
      { posiciones: offsets, tamanos: sizes, tamanosLetra: fontSizes },
      null,
      2,
    );
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Posiciones, tamaños y letra copiados al portapapeles.");
    } catch {
      setStatus(text);
    }
  }

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
        body: JSON.stringify(activeData),
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
                Marca
                <select
                  value={brandKey}
                  onChange={(e) => {
                    setBrandKey(e.target.value as BrandKey);
                    setExternalEditableData(null);
                  }}
                  className="rounded-lg border border-[#d8d0e5] bg-white px-2 py-1.5 text-sm"
                >
                  {Object.entries(BRAND_SAMPLE_VARIANTS).map(([key, { label }]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-[#5f5670]">
                Ejemplo
                <select
                  value={sampleKey}
                  onChange={(e) => setSampleKey(e.target.value as SampleKey)}
                  className="rounded-lg border border-[#d8d0e5] bg-white px-2 py-1.5 text-sm"
                >
                  {Object.entries(BRAND_SAMPLE_VARIANTS[brandKey].variants).map(([key, { label }]) => (
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

        {isEditable ? (
          <div className="mb-6 rounded-xl border border-[#5b2d8e]/40 bg-white px-4 py-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[#5f5670]">
                Estás en el diseño Editable: arrastra el interior de cualquier bloque con borde
                morado discontinuo para moverlo, o coge uno de los tiradores morados del borde
                (lateral, inferior o esquina) para agrandarlo o encogerlo. Los sliders de abajo
                cambian el tamaño de letra. Todo se resetea si cambias a otro diseño.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={copyPositions}
                  disabled={
                    Object.keys(offsets).length === 0 &&
                    Object.keys(sizes).length === 0 &&
                    Object.keys(fontDeltas).length === 0
                  }
                  className="rounded-lg border border-[#d8d0e5] bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                >
                  Copiar cambios
                </button>
                <button
                  type="button"
                  onClick={resetPositions}
                  disabled={
                    Object.keys(offsets).length === 0 &&
                    Object.keys(sizes).length === 0 &&
                    Object.keys(fontDeltas).length === 0
                  }
                  className="rounded-lg border border-[#d8d0e5] bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                >
                  Reiniciar todo
                </button>
              </div>
            </div>

            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#5b2d8e]">
              Posiciones
            </p>
            {Object.keys(offsets).length > 0 ? (
              <ul className="mb-4 grid grid-cols-2 gap-x-6 gap-y-1 text-xs font-mono text-[#5f5670] sm:grid-cols-3">
                {Object.entries(offsets).map(([label, { x, y }]) => (
                  <li key={label}>
                    {label}: x {x >= 0 ? "+" : ""}
                    {x}px, y {y >= 0 ? "+" : ""}
                    {y}px
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-4 text-xs text-[#9b93a8]">Sin desplazamientos todavía.</p>
            )}

            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#5b2d8e]">
              Tamaños
            </p>
            {Object.keys(sizes).length > 0 ? (
              <ul className="mb-4 grid grid-cols-2 gap-x-6 gap-y-1 text-xs font-mono text-[#5f5670] sm:grid-cols-3">
                {Object.entries(sizes).map(([label, { width, height }]) => (
                  <li key={label}>
                    {label}: {width}×{height}px
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-4 text-xs text-[#9b93a8]">Sin cambios de tamaño todavía.</p>
            )}

            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#5b2d8e]">
              Tamaño de letra
            </p>
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {availableFontTargets.map((label) => {
                const base = fontBaseRef.current[label] ?? 0;
                const delta = fontDeltas[label] ?? 0;
                const current = Math.max(6, base + delta);
                return (
                  <label key={label} className="flex items-center gap-3 text-xs text-[#5f5670]">
                    <span className="w-40 shrink-0">{label}</span>
                    <input
                      type="range"
                      min={-20}
                      max={20}
                      step={1}
                      value={delta}
                      onChange={(e) =>
                        setFontDeltas((prev) => ({ ...prev, [label]: Number(e.target.value) }))
                      }
                      className="flex-1"
                    />
                    <span className="w-12 shrink-0 font-mono">{Math.round(current)}px</span>
                  </label>
                );
              })}
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
                  <BurgerKingAlertTemplate ref={captureRef} data={activeData} />
                ) : isPopeyes ? (
                  <PopeyesAlertTemplate ref={captureRef} data={activeData} />
                ) : (
                  <NegativeReviewAlertTemplate ref={captureRef} data={activeData} />
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
