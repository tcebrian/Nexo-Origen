import fs from "fs";
import path from "path";

const cache = new Map<string, string>();

export function loadHeaderImageBase64(filename: string): string | null {
  if (cache.has(filename)) return cache.get(filename)!;

  const filePath = path.join(process.cwd(), "public", "reports", "headers", filename);
  if (!fs.existsSync(filePath)) return null;

  const buffer = fs.readFileSync(filePath);
  const dataUrl = `data:image/png;base64,${buffer.toString("base64")}`;
  cache.set(filename, dataUrl);
  return dataUrl;
}
