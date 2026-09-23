"use client";

import { useEffect, useRef, useState } from "react";
import type { ReportPeriodSlug } from "@/lib/reports/period-ranges";
import {
  NETWORK_REPORT_GROUP_IDS,
  NETWORK_REPORT_GROUPS,
  type NetworkReportEmpresa,
} from "@/lib/reports/network-summary/brand-groups";
import { createStoredZip, type ZipEntry } from "@/lib/zip/store-zip";
import { btnPrimary } from "./ui/informes-styles";

type DownloadAllImagesButtonProps = {
  periodo: ReportPeriodSlug;
  offset: number;
  rangeLabel: string;
};

type Notice = { tone: "ok" | "warn" | "error"; text: string };

/**
 * Cada imagen se genera en el servidor (Playwright) con la misma ruta que usa
 * la vista previa individual, de una en una por petición: así cada llamada
 * respeta el límite de tiempo de la función serverless, cosa que no
 * garantizaría un único endpoint que generase todas a la vez. El ZIP se
 * arma aquí, en el navegador.
 */
const CONCURRENCY = 3;
const ATTEMPTS = 2;

/**
 * El ZIP solo reúne los informes de UNA empresa (Grupo Hámbar): Vault es un
 * cliente distinto y se descarga aparte, desde su propia tarjeta, para que
 * nunca viajen juntas las marcas de empresas diferentes.
 */
const ZIP_EMPRESA: NetworkReportEmpresa = "grupo-hambar";
const ZIP_GROUP_IDS = NETWORK_REPORT_GROUP_IDS.filter((id) => NETWORK_REPORT_GROUPS[id].empresa === ZIP_EMPRESA);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function fetchPng(url: string, signal: AbortSignal): Promise<Uint8Array> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Error ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function DownloadIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 3v12m0 0-4-4m4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DownloadAllImagesButton({ periodo, offset, rangeLabel }: DownloadAllImagesButtonProps) {
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: ZIP_GROUP_IDS.length });
  const [notice, setNotice] = useState<Notice | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function downloadAll() {
    const controller = new AbortController();
    abortRef.current = controller;

    const ids = ZIP_GROUP_IDS;
    const results: (ZipEntry | null)[] = ids.map(() => null);
    const failed: string[] = [];
    let nextIndex = 0;
    let done = 0;

    setWorking(true);
    setNotice(null);
    setProgress({ done: 0, total: ids.length });

    const worker = async () => {
      while (!controller.signal.aborted) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= ids.length) return;

        const id = ids[index];
        const label = NETWORK_REPORT_GROUPS[id].label;
        const url = `/api/generate-network-summary-image?periodo=${periodo}&grupo=${id}&offset=${offset}`;

        for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
          try {
            const data = await fetchPng(url, controller.signal);
            results[index] = { name: `nexo-informe-${periodo}-${slugify(label)}.png`, data };
            break;
          } catch (err) {
            if (controller.signal.aborted) return;
            console.error(`[DownloadAllImagesButton] ${label} (intento ${attempt})`, err);
            if (attempt === ATTEMPTS) failed.push(label);
          }
        }

        done += 1;
        setProgress({ done, total: ids.length });
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));
    if (controller.signal.aborted) return;

    const entries = results.filter((entry): entry is ZipEntry => entry !== null);
    if (entries.length === 0) {
      setNotice({ tone: "error", text: "No se pudo generar ninguna imagen. Inténtalo de nuevo." });
      setWorking(false);
      return;
    }

    try {
      const zip = createStoredZip(entries);
      const blob = new Blob([zip as BlobPart], { type: "application/zip" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `nexo-informes-grupo-hambar-${periodo}-${slugify(rangeLabel)}.zip`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);

      setNotice(
        failed.length === 0
          ? { tone: "ok", text: `ZIP descargado con ${entries.length} imágenes.` }
          : {
              tone: "warn",
              text: `ZIP descargado con ${entries.length} de ${ids.length} imágenes. No se pudo generar: ${failed.join(", ")}. Vuelve a pulsar el botón para reintentarlo.`,
            }
      );
    } catch (err) {
      console.error("[DownloadAllImagesButton] zip", err);
      setNotice({ tone: "error", text: "No se pudo crear el ZIP. Inténtalo de nuevo." });
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        onClick={() => void downloadAll()}
        disabled={working}
        className={`${btnPrimary} inline-flex items-center gap-2 disabled:cursor-wait disabled:opacity-70`}
      >
        <DownloadIcon className="h-4 w-4" />
        {working ? `Generando ${Math.min(progress.done + 1, progress.total)} de ${progress.total}…` : "Descargar Grupo Hámbar (ZIP)"}
      </button>
      <p
        role="status"
        aria-live="polite"
        className={`max-w-sm text-[12px] leading-snug sm:text-right ${
          notice?.tone === "error"
            ? "text-red-300"
            : notice?.tone === "warn"
              ? "text-amber-300"
              : notice?.tone === "ok"
                ? "text-emerald-300"
                : "text-[var(--nexo-text-tertiary)]"
        }`}
      >
        {working
          ? "Generando las imágenes en el servidor. No cierres esta página."
          : (notice?.text ?? `Los ${ZIP_GROUP_IDS.length} PNG de Grupo Hámbar de ${rangeLabel} en un solo archivo. Vault se descarga aparte.`)}
      </p>
    </div>
  );
}
