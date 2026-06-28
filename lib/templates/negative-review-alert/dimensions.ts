import type { AlertAspectRatio } from "./types";

export type AlertCanvasSize = {
  width: number;
  height: number;
  aspectRatio: AlertAspectRatio;
};

export type CanvasScale = {
  x: number;
  y: number;
};

/** Tamaño de diseño base (coordenadas CSS internas). */
export const DESIGN_CANVAS_SIZES: Record<AlertAspectRatio, AlertCanvasSize> = {
  "4:3": { width: 1600, height: 1200, aspectRatio: "4:3" },
  "9:16": { width: 1080, height: 1920, aspectRatio: "9:16" },
};

/** Tamaño final de imagen exportada. */
export const ALERT_CANVAS_SIZES: Record<AlertAspectRatio, AlertCanvasSize> = {
  "4:3": { width: 1402, height: 1122, aspectRatio: "4:3" },
  "9:16": { width: 946, height: 1795, aspectRatio: "9:16" },
};

export function resolveCanvasSize(aspectRatio: AlertAspectRatio = "4:3"): AlertCanvasSize {
  return ALERT_CANVAS_SIZES[aspectRatio] ?? ALERT_CANVAS_SIZES["4:3"];
}

export function resolveDesignCanvasSize(aspectRatio: AlertAspectRatio = "4:3"): AlertCanvasSize {
  return DESIGN_CANVAS_SIZES[aspectRatio] ?? DESIGN_CANVAS_SIZES["4:3"];
}

/**
 * Escala CSS del lienzo de diseño.
 * Se renderiza 1:1 en resolución de diseño; el reescalado final a entrega
 * se hace en post-proceso (Lanczos) para máxima nitidez.
 */
export function getCanvasScale(_aspectRatio: AlertAspectRatio = "4:3"): CanvasScale {
  return { x: 1, y: 1 };
}
