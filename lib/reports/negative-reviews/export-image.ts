import { toPng } from "html-to-image";
import { resolveCanvasSize, resolveDesignCanvasSize } from "@/lib/templates/negative-review-alert/dimensions";

const defaultDesign = resolveDesignCanvasSize("4:3");
const defaultDelivery = resolveCanvasSize("4:3");

/** Tamaño de entrega final del PNG (1402×1122). */
export const NEGATIVE_REVIEW_CARD_WIDTH = defaultDelivery.width;
export const NEGATIVE_REVIEW_CARD_HEIGHT = defaultDelivery.height;

/** Tamaño de render del lienzo (1600×1200, 1:1 sin escala CSS). */
export const NEGATIVE_REVIEW_RENDER_WIDTH = defaultDesign.width;
export const NEGATIVE_REVIEW_RENDER_HEIGHT = defaultDesign.height;

export type ExportImageOptions = {
  pixelRatio?: number;
  filename?: string;
};

function resolveCaptureNode(node: HTMLElement): HTMLElement {
  if (node.classList.contains("nra-canvas")) return node;
  const canvas = node.querySelector<HTMLElement>(".nra-canvas");
  return canvas ?? node;
}

export async function exportElementToPng(
  node: HTMLElement,
  _options: ExportImageOptions = {}
): Promise<string> {
  const target = resolveCaptureNode(node);
  const width = NEGATIVE_REVIEW_RENDER_WIDTH;
  const height = NEGATIVE_REVIEW_RENDER_HEIGHT;
  const pixelRatio = _options.pixelRatio ?? 3;

  // skipFonts evita que html-to-image intente reincrustar las fuentes de
  // Google Fonts (falla por CORS) — pero eso significa que el lienzo clonado
  // para la captura puede no tener aún la fuente aplicada si el navegador
  // no ha terminado de cargarla, y el texto se mide con una de reserva más
  // ancha (rompe badges de una sola línea como "IMPACTO EN LA MEDIA").
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const capture = (ratio: number) =>
    toPng(target, {
      cacheBust: true,
      pixelRatio: ratio,
      width,
      height,
      skipFonts: true,
      backgroundColor: "#e8ebf2",
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: "none",
        margin: "0",
        padding: "0",
      },
    });

  try {
    return await capture(pixelRatio);
  } catch (primaryError) {
    if (pixelRatio <= 2) throw primaryError;
    console.warn("[exportElementToPng] Reintentando con menor pixelRatio", primaryError);
    return capture(2);
  }
}

/**
 * Detecta iOS de verdad (no solo si el navegador soporta la Web Share API,
 * que en escritorio también existe en Edge/Chrome/Safari y desviaba la
 * descarga hacia la hoja de compartir del sistema en vez de guardar
 * directamente en Descargas).
 */
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}

/**
 * Descarga una imagen a partir de un data URL, con varias estrategias
 * según el navegador. El truco de `<a download>` con un data: URL directo
 * funciona en escritorio y en Android, pero iOS Safari IGNORA el atributo
 * `download` en enlaces (solo lo respeta en algunos casos con blob:), así
 * que ahí hace falta una vía distinta para que el usuario pueda guardar
 * la imagen de verdad.
 */
export async function downloadDataUrl(dataUrl: string, filename: string) {
  let blob: Blob | null = null;
  try {
    blob = await (await fetch(dataUrl)).blob();
  } catch {
    blob = null;
  }

  // Solo iOS: la hoja de compartir nativa incluye "Guardar imagen" y es el
  // único camino fiable en iOS Safari, donde el atributo download de <a>
  // no dispara una descarga real. En escritorio y Android, aunque exista
  // navigator.share, se prefiere el camino directo de abajo.
  if (blob && isIOS() && typeof navigator !== "undefined" && navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: blob.type || "image/png" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      // el usuario canceló o el share falló: seguimos con el resto de vías
    }
  }

  // Escritorio y la mayoría de Android: blob: URL + <a download>.
  if (blob) {
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = filename;
    link.href = blobUrl;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    return;
  }

  // Último recurso (p.ej. si fetch del data: URL falla): abrir en pestaña
  // nueva para que el usuario la guarde a mano (mantener pulsado > Guardar).
  window.open(dataUrl, "_blank");
}

export function buildNegativeReviewFilename(row: {
  restaurantSlug: string;
  id: string;
  dateIso: string;
}): string {
  const datePart = row.dateIso.slice(0, 10);
  return `nexo-reseña-negativa-${row.restaurantSlug}-${datePart}-${row.id}.png`;
}
