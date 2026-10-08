import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Frontera del bundle: solo `/api/internal/render` puede llegar (directa o indirectamente) a
 * Chromium, sharp o playwright. Se recorre el grafo de importaciones de cada ruta pública, igual que
 * lo hace el trazado de Next (los `import type` se borran al compilar y no cuentan).
 */

const ROOT = process.cwd();
const HEAVY_PACKAGES = ["playwright-core", "playwright", "@sparticuz/chromium", "sharp", "puppeteer", "puppeteer-core"];
const HEAVY_FILES = [
  "lib/reports/monthly/browser",
  "lib/reports/monthly/pdf",
  "lib/reports/monthly/image/capture",
  "lib/reports/monthly/html",
  "lib/reports/network-summary/capture-image",
  "lib/reports/network-summary/optimize-png",
  "lib/templates/negative-review-alert/capture-image",
  "lib/templates/negative-review-alert/optimize-png",
  "lib/render/renderer.server",
  "lib/render/network-guard",
];

const PUBLIC_ROUTES = [
  "app/api/informes/mensual/[id]/route.ts",
  "app/api/informes/mensual/[id]/imagen/route.ts",
  "app/api/informes/mensual/route.ts",
  "app/api/generate-negative-review-image/route.ts",
  "app/api/generate-network-summary-image/route.ts",
  "app/api/notifications/whatsapp-alert-image/route.ts",
  "app/api/conversations/[conversationId]/reports/route.ts",
  "app/api/conversations/report-options/route.ts",
];

const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

function resolveLocal(spec: string, from: string): string | null {
  const base = spec.startsWith("@/") ? path.join(ROOT, spec.slice(2)) : path.resolve(path.dirname(from), spec);
  for (const extension of EXTENSIONS) {
    const candidate = base + extension;
    if (existsSync(candidate) && /\.(ts|tsx)$/.test(candidate)) return candidate;
  }
  return null;
}

function importsOf(file: string): string[] {
  const source = readFileSync(file, "utf-8");
  const specs: string[] = [];
  const statement = /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[^;"']*?\s+from\s+)?["']([^"']+)["']/g;
  for (const match of source.matchAll(statement)) if (!match[1]) specs.push(match[2]!);
  for (const match of source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) specs.push(match[1]!);
  for (const match of source.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g)) specs.push(match[1]!);
  return specs;
}

function reachable(entry: string): { packages: Set<string>; files: Set<string> } {
  const packages = new Set<string>();
  const files = new Set<string>();
  const queue = [path.join(ROOT, entry)];
  while (queue.length) {
    const file = queue.pop()!;
    if (files.has(file)) continue;
    files.add(file);
    for (const spec of importsOf(file)) {
      if (spec.startsWith("@/") || spec.startsWith(".")) {
        const local = resolveLocal(spec, file);
        if (local) queue.push(local);
      } else {
        packages.add(spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]!);
      }
    }
  }
  return { packages, files };
}

const rel = (file: string) => path.relative(ROOT, file).split(path.sep).join("/").replace(/\.(ts|tsx)$/, "").replace(/\/index$/, "");

describe("las rutas públicas no empaquetan Chromium, sharp ni playwright", () => {
  it.each(PUBLIC_ROUTES)("%s", (entry) => {
    const { packages, files } = reachable(entry);
    expect(HEAVY_PACKAGES.filter((name) => packages.has(name))).toEqual([]);
    const heavy = [...files].map(rel).filter((name) => HEAVY_FILES.includes(name));
    expect(heavy).toEqual([]);
  });

  it("el cliente interno solo depende del protocolo", () => {
    const { packages, files } = reachable("lib/render/internal-render-client.ts");
    expect(HEAVY_PACKAGES.filter((name) => packages.has(name))).toEqual([]);
    expect([...files].map(rel).filter((name) => HEAVY_FILES.includes(name))).toEqual([]);
  });

  it("el renderer sí llega a Chromium y sharp (la comprobación detecta lo que debe)", () => {
    const { packages } = reachable("app/api/internal/render/route.ts");
    expect(packages.has("playwright-core") || packages.has("@sparticuz/chromium")).toBe(true);
    expect(packages.has("sharp")).toBe(true);
  });
});
