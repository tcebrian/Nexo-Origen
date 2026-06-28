import fs from "node:fs";
import path from "node:path";
import { loadLogoDataUri } from "@/lib/informes/report-html-base";
import { marcaToBrandId } from "@/lib/restaurants/brand-resolve";
import { BRAND_VISUALS } from "@/lib/restaurants/brand-visuals";

const COVER_IMAGE_CANDIDATES = [
  "informe-cover-default.png",
  "informe-cover-default.jpg",
];

export function loadInformeCoverImageDataUri(): string | null {
  for (const filename of COVER_IMAGE_CANDIDATES) {
    try {
      const imagePath = path.join(process.cwd(), "public", "design", filename);
      const buffer = fs.readFileSync(imagePath);
      const ext = path.extname(filename).slice(1).toLowerCase();
      const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
      return `data:${mime};base64,${buffer.toString("base64")}`;
    } catch {
      continue;
    }
  }
  return null;
}

export function loadInformeCoverLogoDataUri(): string | null {
  return loadLogoDataUri();
}

function loadPublicPngDataUri(filename: string): string | null {
  try {
    const imagePath = path.join(process.cwd(), "public", filename);
    const buffer = fs.readFileSync(imagePath);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Logo horizontal completo (icono + wordmark) — máxima calidad */
export function loadInformeCoverFullLogoDataUri(): string | null {
  return loadPublicPngDataUri("nexo-origen-logo.png");
}

/** Icono Nexo (mano + cerebro) — PNG con fondo transparente */
export function loadInformeCoverIconDataUri(): string | null {
  return loadPublicPngDataUri("nexo-origen-icon.png");
}

/** Wordmark "NEXO ORIGEN" — PNG con fondo transparente */
export function loadInformeCoverWordmarkDataUri(): string | null {
  return loadPublicPngDataUri("nexo-origen-wordmark-text.png");
}

/** Logo de cadena (Burger King, Popeyes, etc.) como data URI */
export function loadBrandLogoDataUri(marca: string): string | null {
  const brandId = marcaToBrandId(marca);
  const visual = BRAND_VISUALS[brandId];
  if (!visual?.logo) return null;
  const relative = visual.logo.replace(/^\//, "");
  return loadPublicPngDataUri(relative);
}

export function getBrandMonogram(marca: string): string {
  const brandId = marcaToBrandId(marca);
  return BRAND_VISUALS[brandId]?.monogram ?? marca.slice(0, 2).toUpperCase();
}

export function formatInformeMediaEs(value: number): string {
  return value.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatInformeVariation(value: number | null): string {
  if (value == null) return "—";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatInformeMediaEs(value)}`;
}

export function formatInformeVariationLabel(value: number | null): string {
  if (value == null) return "Sin semana anterior";
  if (value > 0) return "Evolución positiva";
  if (value < 0) return "Evolución negativa";
  return "Sin cambios";
}

export function renderStarRating(rating: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  const stars = Array.from({ length: 5 })
    .map((_, index) => {
      const on = index < filled;
      return `<span class="cover-star ${on ? "cover-star--on" : ""}">★</span>`;
    })
    .join("");
  return `<span class="cover-stars" aria-hidden="true">${stars}</span>`;
}
