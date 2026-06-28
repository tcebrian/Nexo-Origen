import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "public", "nexo-origen-report-hero-source.png");
const OUT_DIR = path.join(ROOT, "public");

/** Convierte fondo negro en alpha; conserva sombras y gradientes. */
function applyBlackKeyAlpha(data, width, height, { threshold = 28, softness = 18 } = {}) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      if (luminance <= threshold) {
        data[i + 3] = 0;
        continue;
      }

      if (luminance < threshold + softness) {
        const t = (luminance - threshold) / softness;
        data[i + 3] = Math.round(Math.min(255, data[i + 3] * t));
      }
    }
  }
}

/** Blanco de ORIGEN (mitad derecha) → negro para fondo blanco del informe. */
function blackenOrigenSide(data, width, height, { splitRatio = 0.4, threshold = 198 } = {}) {
  const splitX = Math.round(width * splitRatio);
  for (let y = 0; y < height; y++) {
    for (let x = splitX; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      if (a === 0) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      if (luminance >= threshold) {
        data[i] = 10;
        data[i + 1] = 10;
        data[i + 2] = 16;
        data[i + 3] = 255;
        continue;
      }

      // Reflejo/sombra clara de ORIGEN → gris oscuro legible sobre blanco.
      if (luminance >= 90) {
        const shade = Math.round(42 + (255 - luminance) * 0.22);
        data[i] = shade;
        data[i + 1] = shade;
        data[i + 2] = shade + 4;
      }
    }
  }
}

async function writePng(name, pixels, width, height) {
  const outPath = path.join(OUT_DIR, name);
  await sharp(Buffer.from(pixels), {
    raw: { width, height, channels: 4 },
  })
    .png({ compressionLevel: 6, quality: 100, effort: 10 })
    .toFile(outPath);
  console.log(`Wrote ${name} (${width}x${height})`);
}

async function exportIcon() {
  const { data, info } = await sharp(SOURCE)
    .extract({ left: 36, top: 88, width: 372, height: 360 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  applyBlackKeyAlpha(pixels, info.width, info.height);
  await writePng("nexo-origen-report-icon.png", pixels, info.width, info.height);
}

async function exportWordmark() {
  const { data, info } = await sharp(SOURCE)
    .extract({ left: 408, top: 238, width: 578, height: 62 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  applyBlackKeyAlpha(pixels, info.width, info.height);
  blackenOrigenSide(pixels, info.width, info.height);
  await writePng("nexo-origen-report-wordmark.png", pixels, info.width, info.height);
}

await mkdir(OUT_DIR, { recursive: true });
await exportIcon();
await exportWordmark();
console.log("Done.");
