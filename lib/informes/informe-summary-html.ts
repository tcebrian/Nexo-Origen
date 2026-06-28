import type { InformeMarcaDatos } from "@/lib/informes/types";
import {
  buildInformeBrandMarkup,
  escapeInformeHtml,
  formatInformeCount,
  formatInformeMedia,
  getInformeReportStyles,
} from "@/lib/informes/report-html-base";

export function buildInformeSummaryHtml(datos: InformeMarcaDatos): string {
  const brandMarkup = buildInformeBrandMarkup();

  return `
  <div class="page page--summary">
    <div class="content">
      <header class="topbar">
        ${brandMarkup}
        <span class="badge">Informe semanal</span>
      </header>

      <section class="hero">
        <h1>Resumen ejecutivo</h1>
        <p>Marca: ${escapeInformeHtml(datos.marca)}</p>
      </section>

      <section class="kpi-card">
        <h2>Indicadores clave</h2>
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
          <div class="kpi-item kpi-item--span">
            <div class="kpi-label">Estado</div>
            <div class="kpi-value status-${datos.estado}">${escapeInformeHtml(datos.estadoLabel)}</div>
          </div>
        </div>
      </section>

      <footer class="footer">
        <span>Nexo Origen</span>
        <span>Informe por marca</span>
      </footer>
    </div>
  </div>`;
}

export function getInformeSummaryStyles(): string {
  return `
    .page--summary {
      page-break-before: always;
    }

    ${getInformeReportStyles()}
  `;
}
