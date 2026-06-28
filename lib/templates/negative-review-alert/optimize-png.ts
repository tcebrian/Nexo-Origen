import sharp from "sharp";
import { resolveCanvasSize } from "./dimensions";
import type { AlertAspectRatio } from "./types";

/** Redimensiona con Lanczos y optimiza el PNG para entrega nítida. */
export async function optimizeAlertPng(
  buffer: Buffer,
  aspectRatio: AlertAspectRatio = "4:3"
): Promise<Buffer> {
  const target = resolveCanvasSize(aspectRatio);
  const meta = await sharp(buffer).metadata();

  let pipeline = sharp(buffer);

  if (meta.width !== target.width || meta.height !== target.height) {
    pipeline = pipeline.resize(target.width, target.height, {
      kernel: sharp.kernel.lanczos3,
      fit: "fill",
    });
  }

  return pipeline
    .png({
      compressionLevel: 6,
      quality: 100,
      effort: 10,
      palette: false,
    })
    .toBuffer();
}
