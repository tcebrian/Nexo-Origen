import sharp from "sharp";

const DELIVERY_WIDTH = 1920;
const DELIVERY_HEIGHT = 1080;

/** Redimensiona con Lanczos (si hace falta) y optimiza el PNG para entrega nítida. */
export async function optimizeNetworkSummaryPng(buffer: Buffer): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  let pipeline = sharp(buffer);

  if (meta.width !== DELIVERY_WIDTH || meta.height !== DELIVERY_HEIGHT) {
    pipeline = pipeline.resize(DELIVERY_WIDTH, DELIVERY_HEIGHT, {
      kernel: sharp.kernel.lanczos3,
      fit: "fill",
    });
  }

  return pipeline
    .png({ compressionLevel: 6, quality: 100, effort: 10, palette: false })
    .toBuffer();
}
