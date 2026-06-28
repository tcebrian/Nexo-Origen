import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { resolveDesignCanvasSize } from "@/lib/templates/negative-review-alert/dimensions";
import type { NegativeReviewAlertData } from "@/lib/templates/negative-review-alert/types";
import { NegativeReviewAlertTemplate } from "@/templates/negative-review-alert";

let cachedCss: string | null = null;

function getTemplateCss(): string {
  if (cachedCss) return cachedCss;
  const cssPath = path.join(process.cwd(), "templates/negative-review-alert/negative-review-alert.css");
  cachedCss = readFileSync(cssPath, "utf8");
  return cachedCss;
}

export function renderNegativeReviewAlertHtml(
  data: NegativeReviewAlertData,
  assetBaseUrl?: string
): string {
  const design = resolveDesignCanvasSize(data.aspect_ratio);
  const markup = renderToStaticMarkup(
    createElement(NegativeReviewAlertTemplate, { data, assetBaseUrl })
  );

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=${design.width}, height=${design.height}, initial-scale=1" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap"
      rel="stylesheet"
    />
    <title>Alerta reseña negativa · ${data.restaurant_name}</title>
    <style>${getTemplateCss()}</style>
  </head>
  <body style="margin:0;background:#e8ebf2;width:${design.width}px;height:${design.height}px;overflow:hidden;">
    ${markup}
  </body>
</html>`;
}
