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

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export function buildNegativeReviewFilename(row: {
  restaurantSlug: string;
  id: string;
  dateIso: string;
}): string {
  const datePart = row.dateIso.slice(0, 10);
  return `nexo-reseña-negativa-${row.restaurantSlug}-${datePart}-${row.id}.png`;
}
