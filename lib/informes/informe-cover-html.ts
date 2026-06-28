import type { InformeCoverDatos } from "@/lib/informes/types";
import {
  loadInformeCoverFullLogoDataUri,
  loadInformeCoverIconDataUri,
  loadInformeCoverWordmarkDataUri,
  loadBrandLogoDataUri,
  getBrandMonogram,
} from "@/lib/informes/informe-cover-assets";
import { escapeInformeHtml } from "@/lib/informes/report-html-base";

/** Resolución nativa de los assets transparentes */
const ICON_NATURAL = { w: 406, h: 413 };
const WORDMARK_NATURAL = { w: 715, h: 62 };
const HERO_ICON_H = 280;
const HERO_ICON_W = Math.round(HERO_ICON_H * (ICON_NATURAL.w / ICON_NATURAL.h));
const HERO_WORDMARK_W = 520;
const HERO_WORDMARK_H = Math.round(HERO_WORDMARK_W * (WORDMARK_NATURAL.h / WORDMARK_NATURAL.w));

export function getInformeCoverStyles(): string {
  return `
    .cover {
      width: 794px;
      height: 1123px;
      position: relative;
      overflow: hidden;
      font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      background: #06020f;
      color: #ffffff;
    }

    /* ── Background layers ── */
    .cover-bg-base {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse 80% 55% at 15% 10%, rgba(124,58,237,0.28) 0%, transparent 55%),
        radial-gradient(ellipse 70% 50% at 90% 85%, rgba(88,28,135,0.22) 0%, transparent 50%),
        linear-gradient(155deg, #06020f 0%, #0d0520 28%, #150a35 55%, #0a0418 100%);
    }

    .cover-bg-mesh {
      position: absolute;
      inset: 0;
      opacity: 0.35;
      background-image:
        linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 48px 48px;
      mask-image: radial-gradient(ellipse 90% 80% at 50% 45%, black 20%, transparent 75%);
    }

    .cover-bg-diagonal {
      position: absolute;
      top: -120px;
      right: -180px;
      width: 520px;
      height: 900px;
      background: linear-gradient(135deg, rgba(124,58,237,0.18) 0%, rgba(167,139,250,0.06) 50%, transparent 100%);
      transform: rotate(18deg);
      pointer-events: none;
    }

    .cover-bg-glow {
      position: absolute;
      width: 500px;
      height: 500px;
      border-radius: 50%;
      filter: blur(100px);
      pointer-events: none;
    }
    .cover-bg-glow--1 {
      top: 280px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(124,58,237,0.2);
    }

    /* Corner frame accents */
    .cover-corner {
      position: absolute;
      width: 48px;
      height: 48px;
      border-color: rgba(196,181,253,0.35);
      border-style: solid;
      pointer-events: none;
      z-index: 2;
    }
    .cover-corner--tl { top: 36px; left: 36px; border-width: 2px 0 0 2px; }
    .cover-corner--tr { top: 36px; right: 36px; border-width: 2px 2px 0 0; }
    .cover-corner--bl { bottom: 36px; left: 36px; border-width: 0 0 2px 2px; }
    .cover-corner--br { bottom: 36px; right: 36px; border-width: 0 2px 2px 0; }

    /* ── Top bar ── */
    .cover-topbar {
      position: relative;
      z-index: 4;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 28px 48px 0;
      flex-shrink: 0;
    }

    .cover-topbar-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .cover-topbar-icon {
      width: 28px;
      height: 28px;
      object-fit: contain;
      display: block;
      opacity: 0.9;
    }

    .cover-topbar-label {
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.32em;
      color: rgba(196,181,253,0.55);
      text-transform: uppercase;
    }

    .cover-brand-chip {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px 8px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(196,181,253,0.22);
      backdrop-filter: blur(12px);
      max-width: 260px;
    }

    .cover-brand-chip-logo {
      max-height: 32px;
      max-width: 72px;
      width: auto;
      height: auto;
      object-fit: contain;
      display: block;
    }

    .cover-brand-chip-fallback {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: linear-gradient(135deg, #7c3aed, #a78bfa);
      color: white;
      font-size: 10px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .cover-brand-chip-name {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: rgba(255,255,255,0.92);
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ── Main content ── */
    .cover-main {
      position: relative;
      z-index: 3;
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 56px 40px;
      text-align: center;
    }

    .cover-logo-wrap {
      position: relative;
      margin-bottom: 52px;
    }

    .cover-logo-glow {
      position: absolute;
      inset: -40px -60px;
      background: radial-gradient(ellipse at center, rgba(124,58,237,0.35) 0%, transparent 70%);
      pointer-events: none;
    }

    .cover-logo-row {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 22px;
    }

    .cover-logo-icon {
      width: ${HERO_ICON_W}px;
      height: ${HERO_ICON_H}px;
      object-fit: contain;
      object-position: center;
      display: block;
      flex-shrink: 0;
      filter: drop-shadow(0 8px 32px rgba(124,58,237,0.45));
    }

    .cover-logo-wordmark {
      width: ${HERO_WORDMARK_W}px;
      height: ${HERO_WORDMARK_H}px;
      object-fit: contain;
      object-position: center left;
      display: block;
      flex-shrink: 0;
      filter: drop-shadow(0 4px 20px rgba(124,58,237,0.25));
    }

    .cover-logo-img {
      position: relative;
      z-index: 1;
      max-width: 640px;
      width: auto;
      height: auto;
      object-fit: contain;
      display: block;
      mix-blend-mode: lighten;
    }

    .cover-divider {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 36px;
      width: 100%;
      max-width: 400px;
    }

    .cover-divider-line {
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(196,181,253,0.45), transparent);
    }

    .cover-divider-gem {
      width: 8px;
      height: 8px;
      background: linear-gradient(135deg, #c4b5fd, #7c3aed);
      transform: rotate(45deg);
      flex-shrink: 0;
      box-shadow: 0 0 12px rgba(124,58,237,0.6);
    }

    .cover-eyebrow {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.38em;
      color: rgba(196,181,253,0.65);
      text-transform: uppercase;
      margin-bottom: 14px;
    }

    .cover-title {
      font-family: 'Cormorant Garamond', 'Georgia', serif;
      font-size: 54px;
      font-weight: 600;
      letter-spacing: 0.06em;
      line-height: 1.05;
      color: #ffffff;
      text-transform: uppercase;
      margin-bottom: 22px;
      text-shadow: 0 2px 40px rgba(124,58,237,0.3);
    }

    .cover-date {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.22em;
      color: rgba(255,255,255,0.75);
      text-transform: uppercase;
      padding: 12px 28px;
      border: 1px solid rgba(196,181,253,0.28);
      border-radius: 2px;
      background: rgba(255,255,255,0.04);
    }

    /* ── Footer ── */
    .cover-footer {
      position: relative;
      z-index: 4;
      flex-shrink: 0;
      padding: 0 48px 32px;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
    }

    .cover-footer-left {
      font-size: 8px;
      font-weight: 600;
      letter-spacing: 0.28em;
      color: rgba(196,181,253,0.4);
      text-transform: uppercase;
      line-height: 1.8;
    }

    .cover-footer-right {
      text-align: right;
    }

    .cover-footer-url {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.18em;
      color: rgba(196,181,253,0.55);
    }

    .cover-footer-year {
      font-size: 8px;
      font-weight: 500;
      letter-spacing: 0.2em;
      color: rgba(255,255,255,0.2);
      margin-top: 4px;
    }
  `;
}

function buildHeroLogo(): string {
  const iconSrc = loadInformeCoverIconDataUri();
  const wordmarkSrc = loadInformeCoverWordmarkDataUri();

  if (iconSrc && wordmarkSrc) {
    return `<div class="cover-logo-wrap">
      <div class="cover-logo-glow"></div>
      <div class="cover-logo-row">
        <img
          class="cover-logo-icon"
          src="${iconSrc}"
          alt=""
          width="${HERO_ICON_W}"
          height="${HERO_ICON_H}"
        />
        <img
          class="cover-logo-wordmark"
          src="${wordmarkSrc}"
          alt="Nexo Origen"
          width="${HERO_WORDMARK_W}"
          height="${HERO_WORDMARK_H}"
        />
      </div>
    </div>`;
  }

  const fullLogo = loadInformeCoverFullLogoDataUri();
  if (fullLogo) {
    return `<div class="cover-logo-wrap">
      <div class="cover-logo-glow"></div>
      <img class="cover-logo-img" src="${fullLogo}" alt="Nexo Origen" />
    </div>`;
  }

  return `<div class="cover-title" style="margin-bottom:52px;font-size:36px">Nexo Origen</div>`;
}

function buildBrandChip(cover: InformeCoverDatos): string {
  const marca = cover.marca ?? cover.marcaDisplay ?? cover.restauranteDisplay;
  const brandName = (cover.marcaDisplay ?? marca).trim().toUpperCase();
  const brandLogoSrc = loadBrandLogoDataUri(marca);
  const monogram = getBrandMonogram(marca);

  const logoHtml = brandLogoSrc
    ? `<img class="cover-brand-chip-logo" src="${brandLogoSrc}" alt="" />`
    : `<div class="cover-brand-chip-fallback">${escapeInformeHtml(monogram)}</div>`;

  return `<div class="cover-brand-chip">
    ${logoHtml}
    <span class="cover-brand-chip-name">${escapeInformeHtml(brandName)}</span>
  </div>`;
}

function buildTopbarIcon(): string {
  const iconSrc = loadInformeCoverIconDataUri();
  if (iconSrc) {
    return `<img class="cover-topbar-icon" src="${iconSrc}" alt="" width="28" height="28" />`;
  }
  return "";
}

export function buildInformeCoverHtml(cover: InformeCoverDatos): string {
  const dateLine = cover.periodTitle.trim()
    ? cover.periodTitle.toUpperCase()
    : cover.periodRange;
  const year = new Date().getFullYear();
  const analisisTipo = cover.analisisTipo ?? "semanal";

  return `<div class="cover">
  <div class="cover-bg-base"></div>
  <div class="cover-bg-mesh"></div>
  <div class="cover-bg-diagonal"></div>
  <div class="cover-bg-glow cover-bg-glow--1"></div>

  <div class="cover-corner cover-corner--tl"></div>
  <div class="cover-corner cover-corner--tr"></div>
  <div class="cover-corner cover-corner--br"></div>
  <div class="cover-corner cover-corner--bl"></div>

  <div class="cover-topbar">
    <div class="cover-topbar-left">
      ${buildTopbarIcon()}
      <span class="cover-topbar-label">Reputation Intelligence</span>
    </div>
    ${buildBrandChip(cover)}
  </div>

  <main class="cover-main">
    ${buildHeroLogo()}

    <div class="cover-divider">
      <div class="cover-divider-line"></div>
      <div class="cover-divider-gem"></div>
      <div class="cover-divider-line"></div>
    </div>

    <p class="cover-eyebrow">Análisis ${escapeInformeHtml(analisisTipo)} de reputación</p>
    <h1 class="cover-title">Informe ejecutivo</h1>
    <p class="cover-date">${escapeInformeHtml(dateLine)}</p>
  </main>

  <footer class="cover-footer">
    <div class="cover-footer-left">
      Documento confidencial<br />
      Nexo Origen
    </div>
    <div class="cover-footer-right">
      <div class="cover-footer-url">www.nexoorigen.com</div>
      <div class="cover-footer-year">${year}</div>
    </div>
  </footer>
</div>`;
}

const GOOGLE_FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />`;

export function buildStandaloneCoverHtml(cover: InformeCoverDatos): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=794px" />
  ${GOOGLE_FONTS}
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 794px;
      height: 1123px;
      overflow: hidden;
      background: #06020f;
    }
    body {
      font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    ${getInformeCoverStyles()}
  </style>
</head>
<body>
  ${buildInformeCoverHtml(cover)}
</body>
</html>`;
}

export function buildLeftColHtml(cover: InformeCoverDatos): string {
  return buildStandaloneCoverHtml(cover);
}

export function buildCoverCompositeHtml(
  coverB64: string,
  _cover: InformeCoverDatos
): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 794px; height: 1123px; overflow: hidden; background: #06020f; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .cover-img-wrap {
      width: 794px; height: 1123px;
      display: block; overflow: hidden;
    }
    .cover-img-wrap img {
      width: 794px; height: 1123px;
      display: block; object-fit: fill;
    }
  </style>
</head>
<body>
  <div class="cover-img-wrap">
    <img src="data:image/png;base64,${coverB64}" alt="" />
  </div>
</body>
</html>`;
}
