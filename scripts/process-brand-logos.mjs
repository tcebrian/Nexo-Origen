import sharp from "sharp";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const brandsDir = join(__dirname, "..", "public", "brands");

/** @type {{ file: string; mode: "dark" | "light"; invert?: boolean }[]} */
const files = [
  { file: "burger-king.png", mode: "dark" },
  { file: "popeyes.png", mode: "dark" },
  { file: "ribs.png", mode: "dark" },
  { file: "santa-gloria.png", mode: "light", invert: true },
  { file: "tim-hortons.png", mode: "light", invert: false },
  { file: "taberna-volapie.png", mode: "dark" },
  { file: "sibuya.png", mode: "dark" },
  { file: "grupo-hambar.png", mode: "light", invert: true },
];

function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

async function processLogo(inputPath, outputPath, { mode, invert = false }) {
  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const threshold = mode === "dark" ? 48 : 228;
  const feather = 32;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = luminance(r, g, b);

    if (mode === "dark") {
      if (lum <= threshold) {
        data[i + 3] = 0;
        continue;
      }
      if (lum <= threshold + feather) {
        const edgeAlpha = Math.round(((lum - threshold) / feather) * 255);
        data[i + 3] = Math.min(data[i + 3], edgeAlpha);
      }
    } else {
      if (lum >= threshold) {
        data[i + 3] = 0;
        continue;
      }
      if (lum >= threshold - feather) {
        const edgeAlpha = Math.round(((threshold - lum) / feather) * 255);
        data[i + 3] = Math.min(data[i + 3], edgeAlpha);
      }
    }

    if (invert && data[i + 3] > 0) {
      data[i] = 255 - r;
      data[i + 1] = 255 - g;
      data[i + 2] = 255 - b;
    }
  }

  const processed = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ threshold: 1 })
    .sharpen({ sigma: 0.6, m1: 0.7, m2: 0.3 })
    .png({ compressionLevel: 3, adaptiveFiltering: true })
    .toBuffer();

  await sharp(processed).toFile(outputPath);

  const meta = await sharp(outputPath).metadata();
  console.log(`  -> ${meta.width}x${meta.height}px`);
}

for (const { file, mode, invert } of files) {
  const input = join(brandsDir, file);
  const output = join(brandsDir, file.replace(".png", "-transparent.png"));
  console.log(`Processing ${file} (${mode}${invert ? ", invert" : ""})`);
  await processLogo(input, output, { mode, invert });
}
