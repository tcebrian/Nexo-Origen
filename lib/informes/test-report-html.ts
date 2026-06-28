import type { InformeKpiDatos } from "@/lib/informes/types";
import {
  buildInformeBrandMarkup,
  formatInformeCount,
  formatInformeMedia,
  getInformeReportStyles,
} from "@/lib/informes/report-html-base";

export function buildTestReportHtml(datos: InformeKpiDatos): string {
  const brandMarkup = buildInformeBrandMarkup();

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Informe de prueba — Nexo Origen</title>
  <style>${getInformeReportStyles()}</style>
</head>
<body>
  <div class="page">
    <div class="content">
      <header class="topbar">
        ${brandMarkup}
        <span class="badge">Informe automático</span>
      </header>

      <section class="hero">
        <h1>Informe automático de prueba</h1>
        <p>Sistema de informes reputacionales</p>
      </section>

      <section class="kpi-card">
        <h2>Resumen ejecutivo</h2>
        <div class="kpi-grid">
          <div class="kpi-item">
            <div class="kpi-label">Media global</div>
            <div class="kpi-value accent">${formatInformeMedia(datos.media)}</div>
          </div>
          <div class="kpi-item">
            <div class="kpi-label">Reseñas totales</div>
            <div class="kpi-value">${formatInformeCount(datos.resenas)}</div>
          </div>
          <div class="kpi-item">
            <div class="kpi-label">Negativas</div>
            <div class="kpi-value warn">${formatInformeCount(datos.negativas)}</div>
          </div>
          <div class="kpi-item">
            <div class="kpi-label">Restaurantes</div>
            <div class="kpi-value">${formatInformeCount(datos.restaurantes)}</div>
          </div>
        </div>
      </section>

      <footer class="footer">
        <span>Nexo Origen</span>
        <span>Generado con Puppeteer</span>
      </footer>
    </div>
  </div>
</body>
</html>`;
}
