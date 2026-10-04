import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

/** Helpers comunes de las plantillas de imagen mensual (1920×1080). */

export const MONTHLY_IMAGE_WIDTH = 1920;
export const MONTHLY_IMAGE_HEIGHT = 1080;

const MIME: Record<string, string> = { ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const fileCache = new Map<string, string>();

/** Lee un archivo de /public y lo devuelve como data-URI (el render no hace peticiones de red). */
export async function dataUri(file: string): Promise<string> {
  const cached = fileCache.get(file);
  if (cached) return cached;
  const buffer = await readFile(path.join(process.cwd(), "public", file));
  const uri = `data:${MIME[path.extname(file)] ?? "application/octet-stream"};base64,${buffer.toString("base64")}`;
  fileCache.set(file, uri);
  return uri;
}

export const esc = (value: string | number) =>
  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const fmt2 = (value: number) => value.toFixed(2);
export const pct1 = (count: number, total: number) => `${(total ? (count / total) * 100 : 0).toFixed(1)}%`;

export const STAR_PATH = "M12 1.6l3.1 6.7 7.3.9-5.4 5 1.4 7.2L12 17.8l-6.4 3.6 1.4-7.2-5.4-5 7.3-.9z";

export function star(size: number, color: string): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><path d="${STAR_PATH}" fill="${color}"/></svg>`;
}

/** Cinco estrellas; la última se rellena de forma proporcional a la media (o por tramos con `snap`). */
export function ratingStars(average: number | null, fill: string, empty: string, size: number, snap = false): string {
  return [0, 1, 2, 3, 4].map((i) => {
    let fraction = average === null ? 0 : Math.max(0, Math.min(1, average - i));
    // snap: la última estrella solo se pinta vacía, media o llena (evita astillas con medias como 4.19).
    if (snap) fraction = fraction < 0.25 ? 0 : fraction < 0.75 ? 0.5 : 1;
    const id = `sg${i}`;
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><defs><linearGradient id="${id}" x1="0" x2="1" y1="0" y2="0"><stop offset="${fraction * 100}%" stop-color="${fill}"/><stop offset="${fraction * 100}%" stop-color="${empty}"/></linearGradient></defs><path d="${STAR_PATH}" fill="url(#${id})"/></svg>`;
  }).join("");
}

export const calendarCheck = (stroke: string, size: number, strokeWidth = 4.5) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="12" width="50" height="46" rx="8"/><path d="M7 25h50M19 6v12M45 6v12"/><path d="M21 41l8 8 15-16"/></svg>`;

/** Logo oficial de Nexo Origen para fondo claro: icono + nombre (archivos oficiales, sin recrear). */
export async function nexoLogoHtml(iconHeight: number, wordWidth: number): Promise<string> {
  const [icon, word] = await Promise.all([dataUri("nexo-origen-report-icon.png"), dataUri("nexo-origen-report-wordmark.png")]);
  return `<div class="nexo" style="gap:${Math.round(iconHeight * 0.14)}px"><img src="${icon}" alt="" style="height:${iconHeight}px"/><img src="${word}" alt="Nexo Origen" style="width:${wordWidth}px"/></div>`;
}
