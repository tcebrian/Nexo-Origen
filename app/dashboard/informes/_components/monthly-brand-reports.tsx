"use client";

import { useState } from "react";

type Restaurant = { id: number; name: string; city: string; total: number; average: number | null };

function filenameFrom(response: Response, fallback: string): string {
  return response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? fallback;
}

function saveBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

export function MonthlyBrandReports({ brand, offset }: { brand: string; offset: number }) {
  const [expanded, setExpanded] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null);
  const [period, setPeriod] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  async function open() {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (restaurants) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/informes/mensual?brand=${encodeURIComponent(brand)}&offset=${offset}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudieron cargar los locales");
      setRestaurants(payload.restaurants);
      setPeriod(payload.period.startKey.slice(0, 7));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar los locales");
    } finally { setBusy(false); }
  }

  async function fetchPdf(restaurant: Restaurant): Promise<{ filename: string; blob: Blob }> {
    const response = await fetch(`/api/informes/mensual/${restaurant.id}?offset=${offset}`, { cache: "no-store" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(`${restaurant.name}: ${payload.error || "No se pudo generar el PDF"}`);
    }
    return { blob: await response.blob(), filename: filenameFrom(response, `Nexo_Origen_${restaurant.id}_${period}.pdf`) };
  }

  async function downloadOne(restaurant: Restaurant) {
    setBusy(true); setError(""); setProgress(`Preparando ${restaurant.name}…`);
    try {
      const pdf = await fetchPdf(restaurant);
      saveBlob(pdf.blob, pdf.filename);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Error de descarga"); }
    finally { setBusy(false); setProgress(""); }
  }

  async function downloadAll() {
    if (!restaurants?.length) return;
    setBusy(true); setError("");
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (let index = 0; index < restaurants.length; index++) {
        setProgress(`Generando ${index + 1} de ${restaurants.length}: ${restaurants[index].name}`);
        const { blob, filename } = await fetchPdf(restaurants[index]);
        zip.file(filename, blob);
      }
      setProgress("Preparando ZIP…");
      const archive = await zip.generateAsync({ type: "blob", compression: "STORE" });
      const slug = brand.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/[^a-z0-9]+/g, "-");
      saveBlob(archive, `Nexo_Origen_${slug}_${period}.zip`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo preparar el ZIP"); }
    finally { setBusy(false); setProgress(""); }
  }

  return <div className="w-full">
    <button type="button" onClick={open} disabled={busy} aria-expanded={expanded}
      className="inline-flex items-center gap-2 rounded-xl border border-violet-400/25 bg-violet-500/15 px-3.5 py-2 text-[13px] font-medium text-violet-100 transition hover:border-violet-300/40 hover:bg-violet-500/25 disabled:opacity-60">
      {expanded ? "Cerrar restaurantes" : `Ver restaurantes de ${brand}`}
    </button>
    {expanded && <div className="mt-4 border-t border-white/10 pt-4">
      {busy && !restaurants && <p className="text-xs text-gray-400">Cargando restaurantes…</p>}
      {restaurants && <>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-400">{restaurants.length} restaurantes · {period}</p>
          <button type="button" disabled={busy || !restaurants.length} onClick={downloadAll}
            className="rounded-lg bg-violet-500 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-400 disabled:opacity-60">
            Descargar PDF de la marca (ZIP)
          </button>
        </div>
        <div className="max-h-80 space-y-2 overflow-auto pr-1">
          {restaurants.map((restaurant) => <div key={restaurant.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
            <div className="min-w-0"><p className="truncate text-xs font-medium text-gray-100">{restaurant.name}</p><p className="text-[11px] text-gray-500">{restaurant.total} reseñas · {restaurant.average === null ? "Sin media" : restaurant.average.toFixed(2).replace(".", ",") + " ★"}</p></div>
            <button type="button" disabled={busy} onClick={() => downloadOne(restaurant)} className="shrink-0 text-xs font-semibold text-violet-300 hover:text-white disabled:opacity-50">PDF ↓</button>
          </div>)}
        </div>
      </>}
      {progress && <p role="status" className="mt-3 text-xs text-violet-300">{progress}</p>}
      {error && <p role="alert" className="mt-3 text-xs text-rose-300">{error}</p>}
    </div>}
  </div>;
}
