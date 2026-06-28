import fs from "node:fs";
import path from "node:path";

export function loadLogoDataUri(): string | null {
  try {
    const logoPath = path.join(process.cwd(), "public", "nexo-origen-logo.png");
    const buffer = fs.readFileSync(logoPath);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

export function formatInformeMedia(value: number): string {
  return value.toFixed(2);
}

export function formatInformeCount(value: number): string {
  return new Intl.NumberFormat("es-ES").format(value);
}

export function getInformeReportStyles(extra = ""): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }

    @page {
      size: A4;
      margin: 0;
    }

    body {
      font-family: Inter, "Segoe UI", system-ui, sans-serif;
      background: #05030a;
      color: #f4f0ff;
      min-height: 100vh;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 18mm 16mm 16mm;
      background:
        radial-gradient(ellipse 80% 50% at 50% -10%, rgba(124, 58, 237, 0.28), transparent 55%),
        radial-gradient(ellipse 60% 40% at 100% 100%, rgba(91, 33, 182, 0.18), transparent 50%),
        #05030a;
      position: relative;
      overflow: hidden;
    }

    .page::before {
      content: "";
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
      background-size: 28px 28px;
      opacity: 0.35;
      pointer-events: none;
    }

    .content {
      position: relative;
      z-index: 1;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14mm;
      padding-bottom: 6mm;
      border-bottom: 1px solid rgba(167, 139, 250, 0.18);
    }

    .brand-logo {
      width: 140px;
      height: auto;
      display: block;
    }

    .brand-fallback {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.22em;
      color: #e9d5ff;
    }

    .badge {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #c4b5fd;
      border: 1px solid rgba(167, 139, 250, 0.35);
      background: rgba(124, 58, 237, 0.12);
      padding: 8px 12px;
      border-radius: 999px;
    }

    .hero {
      margin-bottom: 12mm;
    }

    .hero h1 {
      font-size: 30px;
      font-weight: 600;
      letter-spacing: -0.02em;
      line-height: 1.15;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #ffffff 0%, #ddd6fe 45%, #a78bfa 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    .hero p {
      font-size: 13px;
      color: #a8a3b8;
      letter-spacing: 0.04em;
    }

    .kpi-card {
      border-radius: 18px;
      border: 1px solid rgba(167, 139, 250, 0.22);
      background: linear-gradient(145deg, rgba(255, 255, 255, 0.06), rgba(124, 58, 237, 0.08));
      box-shadow:
        0 0 0 1px rgba(255, 255, 255, 0.04) inset,
        0 18px 48px rgba(0, 0, 0, 0.35),
        0 0 40px rgba(124, 58, 237, 0.12);
      padding: 10mm;
    }

    .kpi-card h2 {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #c4b5fd;
      margin-bottom: 8mm;
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6mm;
    }

    .kpi-item {
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(0, 0, 0, 0.28);
      padding: 6mm 5mm;
    }

    .kpi-item--span {
      grid-column: 1 / -1;
    }

    .kpi-label {
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #8b85a1;
      margin-bottom: 6px;
    }

    .kpi-value {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #f5f3ff;
      line-height: 1;
    }

    .kpi-value.accent { color: #c4b5fd; }
    .kpi-value.warn { color: #fca5a5; }
    .kpi-value.status-verde { color: #86efac; }
    .kpi-value.status-amarillo { color: #fcd34d; }
    .kpi-value.status-rojo { color: #fca5a5; }

    .footer {
      margin-top: 14mm;
      padding-top: 5mm;
      border-top: 1px solid rgba(167, 139, 250, 0.14);
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #6b6680;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    ${extra}
  `;
}

export function buildInformeBrandMarkup(): string {
  const logoSrc = loadLogoDataUri();
  return logoSrc
    ? `<img src="${logoSrc}" alt="Nexo Origen" class="brand-logo" />`
    : `<div class="brand-fallback">NEXO ORIGEN</div>`;
}

export function escapeInformeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
