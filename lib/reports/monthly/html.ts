import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { MonthlyReportData, MonthlyReview } from "./data";

/**
 * Informe mensual por restaurante — A4 vertical, una hoja por bloque:
 * portada · resumen · evolución · motivos · lectura · registro íntegro.
 * Solo presentación: todas las cifras vienen ya calculadas en MonthlyReportData
 * (Supabase); aquí únicamente se formatean, se ordenan y se dibujan.
 */

const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (v: unknown) => Number(v) || 0;
const decimal = (v: number | null, digits = 2) => v === null ? "—" : v.toLocaleString("es-ES", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = (v: number, digits = 2) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${decimal(Math.abs(v), digits)}`;
const pct = (n: number, total: number) => total ? decimal(n / total * 100, 1) + " %" : "—";
const dateLabel = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "Fecha no disponible";
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
};
const status = (v: number | null, target: number) => v === null ? "Sin reseñas" : v >= target ? "En objetivo" : v >= 4 ? "En vigilancia" : "Fuera de objetivo";
const tone = (v: number | null, target: number) => v === null ? "empty" : v >= target ? "green" : v >= 4 ? "amber" : "red";
const TONE_COLOR: Record<string, string> = { green: "#12805f", amber: "#b9770e", red: "#b83d55", empty: "#9a94a8" };
const NO_COMMENT = "Sin comentario";

function dataUri(bytes: Buffer, mime: string) { return `data:${mime};base64,${bytes.toString("base64")}`; }

/* ---------- registro íntegro: reparto en hojas por altura estimada ---------- */

/**
 * Texto de una reseña en el registro. Una reseña de miles de caracteres no cabría ni
 * ella sola en una hoja: a partir de MAX_REGISTER_CHARS se corta en una palabra y se avisa.
 */
const MAX_REGISTER_CHARS = 1700;
function registerText(review: MonthlyReview): string {
  if (review.comment.length <= MAX_REGISTER_CHARS) return review.comment;
  return `${review.comment.slice(0, MAX_REGISTER_CHARS - 1).replace(/\s+\S*$/, "")}… (recortado por longitud; el texto completo está en la reseña original)`;
}

/** Altura estimada (px) de una reseña en el registro: fila compacta si no hay texto, tarjeta si lo hay. */
function reviewHeight(review: MonthlyReview): number {
  if (review.comment === NO_COMMENT) return 34;
  const lines = registerText(review).split("\n").reduce((sum, paragraph) => sum + Math.max(1, Math.ceil(paragraph.length / 90)), 0);
  return 72 + lines * 17.5;
}

function reviewPages(reviews: MonthlyReview[]): MonthlyReview[][] {
  if (!reviews.length) return [[]];
  const BUDGET = 865;
  const GAP = 9;
  const pages: MonthlyReview[][] = [];
  let group: MonthlyReview[] = [];
  let used = 0;
  for (const review of reviews) {
    const height = reviewHeight(review) + GAP;
    if (group.length && used + height > BUDGET) { pages.push(group); group = []; used = 0; }
    group.push(review); used += height;
  }
  if (group.length) pages.push(group);
  return pages;
}

/* ---------- gráficos SVG ---------- */

type Week = MonthlyReportData["weeks"][number];

/** Media por tramo semanal: línea con puntos (escala ajustada al rango real) y línea de objetivo. */
function evolutionChart(weeks: Week[], target: number): string {
  const values = weeks.filter((w) => w.average !== null).map((w) => w.average as number);
  if (!values.length) return `<div class="chart-empty">Este mes no hay reseñas: no hay evolución que dibujar.</div>`;
  const W = 706, H = 236, left = 40, right = 696, top = 24, bottom = 190;
  const yMin = Math.max(1, Math.floor(Math.min(...values, target) - 0.5));
  const y = (v: number) => bottom - ((v - yMin) / (5 - yMin)) * (bottom - top);
  const step = (right - left) / weeks.length;
  const x = (i: number) => left + step * (i + 0.5);
  const grid: string[] = [];
  for (let v = yMin; v <= 5; v++) grid.push(`<line x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}" stroke="#ebe7f3" stroke-width="1"/><text x="${left - 10}" y="${y(v) + 3.5}" text-anchor="end" class="ax">${v}</text>`);
  const segments: string[] = [];
  let current: string[] = [];
  weeks.forEach((w, i) => {
    if (w.average === null) { if (current.length) segments.push(current.join(" ")); current = []; return; }
    current.push(`${x(i).toFixed(1)},${y(w.average).toFixed(1)}`);
  });
  if (current.length) segments.push(current.join(" "));
  const lines = segments.filter((s) => s.includes(" ")).map((s) => `<polyline points="${s}" fill="none" stroke="#a978e8" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`).join("");
  const points = weeks.map((w, i) => w.average === null
    ? `<text x="${x(i)}" y="${(top + bottom) / 2}" text-anchor="middle" class="ax">sin reseñas</text>`
    : `<circle cx="${x(i)}" cy="${y(w.average)}" r="6" fill="${TONE_COLOR[tone(w.average, target)]}" stroke="#fff" stroke-width="2.5"/><text x="${x(i)}" y="${y(w.average) - 14}" text-anchor="middle" class="pv" fill="${TONE_COLOR[tone(w.average, target)]}">${decimal(w.average)}</text>`).join("");
  const labels = weeks.map((w, i) => `<text x="${x(i)}" y="${bottom + 22}" text-anchor="middle" class="ax">${esc(w.label.replace(" - ", "–"))}</text><text x="${x(i)}" y="${bottom + 36}" text-anchor="middle" class="ax2">${w.total} reseñas</text>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Evolución de la media por tramo">${grid.join("")}
    <line x1="${left}" x2="${right}" y1="${y(target)}" y2="${y(target)}" stroke="#793acf" stroke-width="1.5" stroke-dasharray="5 4"/>
    <text x="${left + 6}" y="${y(target) - 7}" text-anchor="start" class="tg">OBJETIVO ${decimal(target)}</text>${lines}${points}${labels}</svg>`;
}

/** Reseñas por día del mes (fecha de actividad); en rojo las de 1 y 2 estrellas. */
function dailyChart(reviews: MonthlyReview[], startKey: string, endKey: string): { svg: string; peak: string } {
  const days: string[] = [];
  for (let t = Date.parse(`${startKey}T12:00:00Z`); t <= Date.parse(`${endKey}T12:00:00Z`); t += 86_400_000) days.push(new Date(t).toISOString().slice(0, 10));
  const all = new Map<string, number>(), bad = new Map<string, number>();
  for (const r of reviews) {
    const key = (r.editedAt ?? r.date).slice(0, 10);
    all.set(key, (all.get(key) ?? 0) + 1);
    if (r.stars <= 2) bad.set(key, (bad.get(key) ?? 0) + 1);
  }
  const max = Math.max(1, ...days.map((k) => all.get(k) ?? 0));
  const W = 650, H = 118, left = 8, right = 642, top = 16, bottom = 92;
  const step = (right - left) / days.length;
  const barW = Math.min(16, step * 0.66);
  const bars = days.map((k, i) => {
    const n = all.get(k) ?? 0, b = bad.get(k) ?? 0;
    const cx = left + step * (i + 0.5);
    const h = n / max * (bottom - top), hb = b / max * (bottom - top);
    const day = Number(k.slice(8));
    const label = day === 1 || day % 5 === 0 || i === days.length - 1 ? `<text x="${cx}" y="${bottom + 16}" text-anchor="middle" class="ax">${day}</text>` : "";
    return `${n ? `<rect x="${cx - barW / 2}" y="${bottom - h}" width="${barW}" height="${h}" rx="2.5" fill="#a978e8"/>` : `<rect x="${cx - barW / 2}" y="${bottom - 1.5}" width="${barW}" height="1.5" rx="1" fill="#e2dcee"/>`}${b ? `<rect x="${cx - barW / 2}" y="${bottom - hb}" width="${barW}" height="${hb}" rx="2.5" fill="#b83d55"/>` : ""}${n === max && n > 0 ? `<text x="${cx}" y="${bottom - h - 5}" text-anchor="middle" class="pv" fill="#4d3a78">${n}</text>` : ""}${label}`;
  }).join("");
  const peakDay = days.filter((k) => (all.get(k) ?? 0) === max && max > 0)[0];
  return {
    svg: `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Reseñas por día"><line x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}" stroke="#e2dcee"/>${bars}</svg>`,
    peak: peakDay ? `${peakDay.slice(8)}/${peakDay.slice(5, 7)} · ${max} ${max === 1 ? "reseña" : "reseñas"}` : "—",
  };
}

/** Anillo con positivas / neutras / negativas. */
function balanceDonut(positives: number, neutrals: number, negatives: number): string {
  const total = positives + neutrals + negatives;
  const R = 52, C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = [[positives, "#12805f"], [neutrals, "#d6a23c"], [negatives, "#b83d55"]].map(([count, color]) => {
    const length = total ? (count as number) / total * C : 0;
    const arc = length > 0 ? `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${color}" stroke-width="20" stroke-dasharray="${Math.max(length - (length < C ? 2 : 0), 0)} ${C}" stroke-dashoffset="${-offset}" transform="rotate(-90 70 70)"/>` : "";
    offset += length;
    return arc;
  }).join("");
  return `<div class="donut"><svg viewBox="0 0 140 140" width="170" height="170"><circle cx="70" cy="70" r="${R}" fill="none" stroke="#eee9f6" stroke-width="20"/>${arcs}</svg><div class="donut-c"><b>${total}</b><span>RESEÑAS</span></div></div>`;
}

/* ---------- documento ---------- */

export async function buildMonthlyHtml(d: MonthlyReportData): Promise<string> {
  const asset = (file: string) => readFile(path.join(process.cwd(), "public", file));
  const [brain, mark, icon, regular, medium, bold, heavy] = await Promise.all([
    asset("reports/monthly/cover-brain.png"), asset("nexo-origen-wordmark-text.png"), asset("nexo-origen-report-icon.png"),
    asset("fonts/inter-400-normal.woff2"), asset("fonts/inter-500-normal.woff2"),
    asset("fonts/inter-700-normal.woff2"), asset("fonts/inter-800-normal.woff2"),
  ]);
  const name = esc(d.restaurant.name);
  const brand = esc(d.restaurant.brand);
  const target = d.restaurant.target;
  const c = d.current;
  const p = d.previous;
  const total = num(c.total_resenas);
  const prevTotal = num(p.total_resenas);
  const avg = total ? num(c.media_exacta) : null;
  const prevAvg = prevTotal ? num(p.media_exacta) : null;
  const positives = num(c.positivas);
  const neutrals = num(c.neutras);
  const negatives = num(c.negativas);
  const prevNegatives = num(p.negativas);
  const prevPositives = num(p.positivas);
  const pages = reviewPages(d.reviews);
  const pageCount = 5 + pages.length;
  const monthTitle = new Date(`${d.startKey}T12:00:00Z`).toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).replace(" de ", " ");
  const logo = `<span class="logo"><img src="${dataUri(icon, "image/png")}" alt=""/><img src="${dataUri(mark, "image/png")}" alt="Nexo Origen"/></span>`;
  const frame = (section: string, title: string, subtitle: string, body: string, index: number) => `<section class="page inner">
    <header>${logo}<span>INFORME MENSUAL · ${esc(monthTitle).toUpperCase()}<br/><strong>${name}</strong></span></header>
    <main><div class="section-kicker">${esc(section)}</div><h1>${esc(title)}</h1><p class="lead">${esc(subtitle)}</p><div class="stack">${body}</div></main>
    <footer><span>NEXO ORIGEN · ${brand} · ${esc(d.label)}</span><span>${String(index).padStart(2, "0")} / ${String(pageCount).padStart(2, "0")}</span></footer>
  </section>`;

  const chip = (delta: number | null, digits: number, goodWhen: "up" | "down" | "none", unit = "") => {
    if (delta === null) return `<em class="chip flat">sin comparación</em>`;
    if (Math.abs(delta) < 0.005) return `<em class="chip flat">= sin cambios</em>`;
    const up = delta > 0;
    const good = goodWhen === "none" ? "flat" : (up === (goodWhen === "up")) ? "good" : "bad";
    return `<em class="chip ${good}">${up ? "▲" : "▼"} ${signed(delta, digits)}${unit} vs mes ant.</em>`;
  };

  /* ---- portada ---- */
  const cover = `<section class="page cover" style="background-image:linear-gradient(180deg,#0b0911 24%,rgba(11,9,17,.08) 36%,rgba(11,9,17,.1) 61%,#0b0911 83%),url('${dataUri(brain, "image/png")}')">
    <div class="cover-top">${logo}<span>RESTAURANT<br/>REPUTATION REPORT</span></div>
    <div class="cover-title"><span>NEXO ORIGEN / INFORME MENSUAL DE REPUTACIÓN</span><h1>La voz de<br/><em>tus clientes.</em></h1><p>ANÁLISIS<br/>EVOLUCIÓN<br/>TODAS LAS RESEÑAS</p></div>
    <div class="cover-card"><small>RESTAURANTE · ${brand}${d.restaurant.city ? ` · ${esc(d.restaurant.city).toUpperCase()}` : ""}</small><h2>${name}</h2><p>${esc(d.label)}</p>
      <div class="cover-metrics"><div><b>${decimal(avg)}</b><span>MEDIA</span></div><div><b>${total}</b><span>RESEÑAS</span></div><div><b>${pct(positives, total)}</b><span>POSITIVAS</span></div></div>
    </div><div class="cover-footer"><span>NEXO ORIGEN · DATOS DE RESEÑAS DEL PERIODO</span><span>01 / ${String(pageCount).padStart(2, "0")}</span></div>
  </section>`;

  /* ---- 02 resumen ---- */
  const stars = [5, 4, 3, 2, 1].map((star) => {
    const count = num(c[`stars_${star}` as keyof typeof c]);
    const color = star >= 4 ? "#12805f" : star === 3 ? "#d6a23c" : "#b83d55";
    return `<div class="star-row"><span>${star} ★</span><div class="track"><i style="width:${total ? count / total * 100 : 0}%;background:${color}"></i></div><strong>${count}</strong><small>${pct(count, total)}</small></div>`;
  }).join("");
  const weeksWithData = d.weeks.filter((w) => w.total > 0 && w.average !== null);
  const best = [...weeksWithData].sort((a, b) => (b.average as number) - (a.average as number) || b.total - a.total)[0];
  const worst = [...weeksWithData].sort((a, b) => (a.average as number) - (b.average as number) || b.total - a.total)[0];
  const busiest = [...weeksWithData].sort((a, b) => b.total - a.total)[0];
  const highlights: string[] = [];
  if (best && worst && best !== worst) {
    highlights.push(`<div><small>MEJOR TRAMO</small><b class="${tone(best.average, target)}">${decimal(best.average)}</b><p>${esc(best.label)} · ${best.total} reseñas</p></div>`);
    highlights.push(`<div><small>TRAMO MÁS BAJO</small><b class="${tone(worst.average, target)}">${decimal(worst.average)}</b><p>${esc(worst.label)} · ${worst.total} reseñas</p></div>`);
  } else if (best) {
    highlights.push(`<div><small>ÚNICO TRAMO CON RESEÑAS</small><b class="${tone(best.average, target)}">${decimal(best.average)}</b><p>${esc(best.label)} · ${best.total} reseñas</p></div>`);
  }
  if (busiest && highlights.length < 3) highlights.push(`<div><small>MÁS ACTIVIDAD</small><b>${busiest.total}</b><p>reseñas en ${esc(busiest.label)}</p></div>`);
  if (highlights.length < 3) highlights.push(`<div><small>PRINCIPAL MOTIVO NEGATIVO</small><b class="small">${d.reasons.length ? esc(d.reasons[0].label) : "Ninguno"}</b><p>${d.reasons.length ? `${d.reasons[0].count} de ${negatives} negativas` : "Sin reseñas de 1 o 2 estrellas"}</p></div>`);
  if (!total) {
    highlights.length = 0;
    highlights.push(`<div><small>ESTE MES</small><b class="small">Sin reseñas registradas</b><p>Los indicadores, la evolución y los motivos aparecerán en cuanto haya reseñas en el periodo.</p></div>`);
  }
  const gap = avg === null ? null : target - avg;
  const scaleMin = 3;
  const meterPos = avg === null ? 0 : Math.max(0, Math.min(100, (avg - scaleMin) / (5 - scaleMin) * 100));
  const targetMark = Math.max(0, Math.min(100, (target - scaleMin) / (5 - scaleMin) * 100));
  const summary = frame("01 / EL RESTAURANTE EN UN VISTAZO", "Tu reputación, de un vistazo", `Periodo completo: ${d.label}`, `
    <div class="kpis panel">
      <div><small>MEDIA PONDERADA</small><b class="${tone(avg, target)}">${decimal(avg)}</b>${chip(avg !== null && prevAvg !== null ? avg - prevAvg : null, 2, "up")}</div>
      <div><small>RESEÑAS</small><b>${total}</b>${chip(prevTotal ? total - prevTotal : null, 0, "none")}</div>
      <div><small>POSITIVAS</small><b>${pct(positives, total)}</b>${chip(total && prevTotal ? positives / total * 100 - prevPositives / prevTotal * 100 : null, 1, "up", " pts")}</div>
      <div><small>NEGATIVAS</small><b>${negatives}</b>${chip(prevTotal ? negatives - prevNegatives : null, 0, "down")}</div>
    </div>
    <div class="two">
      <div class="panel score"><small>ESTADO DEL PERIODO</small><div class="big ${tone(avg, target)}">${decimal(avg)}</div><div class="pill ${tone(avg, target)}">${status(avg, target)}</div>
        <div class="meter"><i style="width:${meterPos}%" class="${tone(avg, target)}"></i><u style="left:${targetMark}%"></u></div>
        <div class="meter-scale"><span>3,0</span><span style="left:${targetMark}%">objetivo ${decimal(target)}</span><span>5,0</span></div>
        <p class="muted">${avg === null ? "Todavía no hay reseñas registradas en este mes." : gap !== null && gap > 0 ? `Faltan ${decimal(gap)} puntos para el objetivo de ${decimal(target)}.` : `Objetivo de ${decimal(target)} alcanzado.`}</p></div>
      <div class="panel"><small>RESEÑAS POR ESTRELLAS</small><div class="starlist">${stars}</div><p class="muted">${total ? `${num(c.rating_sum)} estrellas / ${total} reseñas = ${decimal(avg)}` : "Sin reseñas en este periodo"}</p></div>
    </div>
    <div class="panel grow"><small>BALANCE DE OPINIONES</small><div class="balance">${balanceDonut(positives, neutrals, negatives)}
      <div class="legend"><p><i style="background:#12805f"></i><span>Positivas · 4 y 5 estrellas</span><b>${positives}</b><em>${pct(positives, total)}</em></p><p><i style="background:#d6a23c"></i><span>Neutras · 3 estrellas</span><b>${neutrals}</b><em>${pct(neutrals, total)}</em></p><p><i style="background:#b83d55"></i><span>Negativas · 1 y 2 estrellas</span><b>${negatives}</b><em>${pct(negatives, total)}</em></p></div></div></div>
    <div class="highlights${highlights.length === 1 ? " one" : ""}">${highlights.join("")}</div>
  `, 2);

  /* ---- 03 evolución ---- */
  const weekRows = d.weeks.map((w) => `<tr><td>${esc(w.label)}</td><td>${w.total}</td><td class="green">${w.positive}</td><td>${w.neutral}</td><td class="red">${w.negative}</td><td><b class="${tone(w.average, target)}">${decimal(w.average)}</b></td></tr>`).join("");
  const validWeeks = d.weeks.filter((w) => w.total > 0);
  const reached = validWeeks.filter((w) => w.average !== null && w.average >= target).length;
  const compareRow = (label: string, before: string, after: string, delta: string, cls: string) => `<tr><td>${label}</td><td>${before}</td><td><b>${after}</b></td><td class="${cls}">${delta}</td></tr>`;
  const mediaDelta = avg !== null && prevAvg !== null ? avg - prevAvg : null;
  const evolution = frame("02 / EVOLUCIÓN", "Una evolución que se puede medir", "Media por tramos semanales del mes. Cada tramo usa solo sus propias reseñas.", `
    <div class="panel"><div class="panel-title"><small>EVOLUCIÓN DE LA MEDIA</small><b class="signal">${reached} de ${validWeeks.length} tramos en objetivo</b></div>${evolutionChart(d.weeks, target)}</div>
    <div class="panel"><small>DETALLE POR TRAMO</small><table class="table"><thead><tr><th>Tramo</th><th>Reseñas</th><th>Positivas</th><th>Neutras</th><th>Negativas</th><th>Media</th></tr></thead><tbody>${weekRows}</tbody></table><p class="muted">Los tramos sin reseñas no cuentan como mejora ni como caída.</p></div>
    <div class="panel grow"><small>COMPARATIVA CON EL MES ANTERIOR</small><table class="table"><thead><tr><th>Indicador</th><th>Mes anterior</th><th>Este mes</th><th>Variación</th></tr></thead><tbody>
      ${compareRow("Media", decimal(prevAvg), decimal(avg), mediaDelta === null ? "—" : `${signed(mediaDelta)} puntos`, mediaDelta === null ? "" : mediaDelta >= 0 ? "green" : "red")}
      ${compareRow("Reseñas", String(prevTotal), String(total), `${total - prevTotal >= 0 ? "+" : "−"}${Math.abs(total - prevTotal)}`, "")}
      ${compareRow("Positivas", String(prevPositives), String(positives), `${positives - prevPositives >= 0 ? "+" : "−"}${Math.abs(positives - prevPositives)}`, "")}
      ${compareRow("Negativas", String(prevNegatives), String(negatives), `${negatives - prevNegatives >= 0 ? "+" : "−"}${Math.abs(negatives - prevNegatives)}`, negatives > prevNegatives ? "red" : negatives < prevNegatives ? "green" : "")}
    </tbody></table></div>
  `, 3);

  /* ---- 04 motivos ---- */
  const restReasons = d.reasons.slice(6);
  const shownReasons = d.reasons.length > 7
    ? [...d.reasons.slice(0, 6), { label: `Otros motivos (${restReasons.length})`, count: restReasons.reduce((sum, r) => sum + r.count, 0), percent: restReasons.reduce((sum, r) => sum + r.percent, 0) }]
    : d.reasons;
  const reasonRows = d.reasons.length ? shownReasons.map((r) => `<div class="reason"><div><b>${esc(r.label)}</b><span>${r.count} · ${decimal(r.percent, 1)} %</span></div><div class="track"><i style="width:${r.percent}%"></i></div></div>`).join("") : `<p class="empty-note">${negatives ? "No hay motivos clasificados." : "Sin reseñas negativas en este periodo. Buen mes."}</p>`;
  const negativeReviews = d.reviews.filter((r) => r.stars <= 2).slice(0, d.reasons.length > 5 ? 3 : 4);
  const negativeHtml = negativeReviews.length ? negativeReviews.map((r) => `<article class="neg"><div class="neg-top"><strong><i class="dot red"></i>${esc(r.author)}</strong><span class="stars">${"★".repeat(r.stars)}<span>${"★".repeat(5 - r.stars)}</span></span></div><div class="review-meta">${dateLabel(r.date)}${r.editedAt ? ` · editada ${dateLabel(r.editedAt)}` : ""}${r.reason ? `<em class="tag">${esc(r.reason)}</em>` : ""}</div><p>${esc(r.comment.length > 230 ? `${r.comment.slice(0, 227)}…` : r.comment)}</p></article>`).join("") : `<p class="empty-note">No se han recibido valoraciones de 1 o 2 estrellas.</p>`;
  const motives = frame("03 / MOTIVOS", "Qué están diciendo los clientes", "Un motivo principal por cada reseña negativa (1 o 2 estrellas).", `
    <div class="two wide-left">
      <div class="panel"><div class="panel-title"><small>MOTIVOS DE INSATISFACCIÓN</small><b>${negatives} NEGATIVAS</b></div><div class="reasons">${reasonRows}</div><p class="muted">Porcentajes sobre ${negatives} reseñas negativas; cada una cuenta una sola vez.</p></div>
      <div class="panel focus"><small>PRIMER FOCO DE REVISIÓN</small><h2>${d.reasons.length ? esc(d.reasons[0].label) : "Sin foco negativo"}</h2><p>${d.reasons.length ? `${d.reasons[0].count} de ${negatives} reseñas negativas señalan este motivo.` : "Este mes no hay reseñas de 1 o 2 estrellas."}</p><div class="focus-fav"><b class="red">${pct(negatives, total)}</b><span>de negativas este mes<br/>(${negatives} de ${total})${prevTotal ? `<br/>Mes anterior: ${pct(prevNegatives, prevTotal)}` : ""}</span></div><div class="focus-fav"><b class="green">${pct(positives, total)}</b><span>de reseñas favorables<br/>(${positives} de ${total})</span></div></div>
    </div>
    <div class="panel grow"><small>ÚLTIMAS RESEÑAS NEGATIVAS</small><div class="neg-list">${negativeHtml}</div></div>
  `, 4);

  /* ---- 05 lectura ---- */
  const quotes = [d.reviews.find((r) => r.stars <= 2 && r.comment !== NO_COMMENT), d.reviews.find((r) => r.stars >= 4 && r.comment !== NO_COMMENT)].filter((r): r is MonthlyReview => Boolean(r));
  const quoteHtml = quotes.length ? quotes.map((r) => `<blockquote class="${r.stars <= 2 ? "q-neg" : "q-pos"}"><span>${r.stars} ★ · ${esc(r.author)} · ${dateLabel(r.date)}${r.editedAt ? ` · editada ${dateLabel(r.editedAt)}` : ""}</span><p>${esc(r.comment.length > 300 ? `${r.comment.slice(0, 297)}…` : r.comment)}</p></blockquote>`).join("") : `<p class="empty-note">No hay comentarios escritos en este periodo.</p>`;
  const daily = dailyChart(d.reviews, d.startKey, d.endKey);
  const reading = frame("04 / LECTURA NEXO", "De la reseña a la revisión", "Extractos reales del periodo. Los textos completos aparecen en el registro final.", `
    <div class="panel"><small>LA VOZ DEL CLIENTE</small>${quoteHtml}</div>
    <div class="panel"><div class="panel-title"><small>ACTIVIDAD DEL MES · RESEÑAS POR DÍA</small><b class="signal">Día con más reseñas: ${daily.peak}</b></div>${daily.svg}<p class="legend-line"><i style="background:#a978e8"></i>Reseñas del día <i style="background:#b83d55"></i>De ellas, de 1 y 2 estrellas</p></div>
    <div class="panel grow"><small>PRIORIDADES SUGERIDAS</small><ol class="priorities">
      <li><b>01</b><div><h3>${d.reasons.length ? esc(d.reasons[0].label) : "Seguimiento"}</h3><p>${d.reasons.length ? `Leer las ${d.reasons[0].count} reseñas clasificadas en esta categoría.` : "Seguir la evolución del volumen de reseñas."}</p></div></li>
      <li><b>02</b><div><h3>Comparación con el mes anterior</h3><p>${prevAvg === null ? "Esperar una base de comparación con reseñas." : `Contrastar la media del mes anterior (${decimal(prevAvg)}) con la actual (${decimal(avg)}).`}</p></div></li>
      <li><b>03</b><div><h3>Lo positivo</h3><p>Conservar las señales favorables observadas en ${positives} valoraciones positivas.</p></div></li>
    </ol></div>
    <p class="method">Criterio de estado: verde desde ${decimal(target)} · amarillo de 4,00 a menos de ${decimal(target)} · rojo por debajo de 4,00. Media ponderada de todas las estrellas del mes. La clasificación de motivos orienta la lectura; comprobar siempre la reseña original.</p>
  `, 5);

  /* ---- 06+ registro íntegro ---- */
  const register = pages.map((group, groupIndex) => {
    const from = pages.slice(0, groupIndex).reduce((sum, arr) => sum + arr.length, 0) + 1;
    const to = pages.slice(0, groupIndex + 1).reduce((sum, arr) => sum + arr.length, 0);
    const items = group.map((r) => {
      const dot = r.stars >= 4 ? "green" : r.stars === 3 ? "amber" : "red";
      const meta = `${dateLabel(r.date)}${r.editedAt ? ` · editada ${dateLabel(r.editedAt)}` : ""}`;
      const starsHtml = `<span class="stars">${"★".repeat(r.stars)}<span>${"★".repeat(5 - r.stars)}</span></span>`;
      if (r.comment === NO_COMMENT) return `<article class="review slim"><strong><i class="dot ${dot}"></i>${esc(r.author)}</strong><span class="review-meta">${meta} · sin comentario</span>${starsHtml}</article>`;
      return `<article class="review"><div class="review-top"><strong><i class="dot ${dot}"></i>${esc(r.author)}</strong>${starsHtml}</div><div class="review-meta">${meta}${r.reason ? `<em class="tag">${esc(r.reason)}</em>` : ""}</div><p>${esc(registerText(r))}</p></article>`;
    }).join("");
    return frame("05 / REGISTRO ÍNTEGRO", "Todas las reseñas del periodo", group.length ? `Reseñas ${from}–${to} de ${total} · de la más reciente a la más antigua` : "No hay reseñas registradas en este periodo.", `<div class="review-list">${items}</div>`, 6 + groupIndex);
  }).join("");

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/><style>
    @font-face{font-family:Inter;src:url('${dataUri(regular, "font/woff2")}') format('woff2');font-weight:400}
    @font-face{font-family:Inter;src:url('${dataUri(medium, "font/woff2")}') format('woff2');font-weight:500}
    @font-face{font-family:Inter;src:url('${dataUri(bold, "font/woff2")}') format('woff2');font-weight:700}
    @font-face{font-family:Inter;src:url('${dataUri(heavy, "font/woff2")}') format('woff2');font-weight:800}
    @page{size:A4;margin:0}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;color:#1d1830;font-family:Inter,Arial,sans-serif;font-variant-numeric:tabular-nums}
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    p{margin:0}
    .page{width:210mm;height:297mm;position:relative;overflow:hidden;page-break-after:always;break-after:page}
    .page:last-child{page-break-after:auto;break-after:auto}
    .logo{display:inline-flex;align-items:center;gap:6px}
    .logo img:first-child{width:44px;height:44px;object-fit:contain}
    .logo img:last-child{width:175px;height:auto;object-fit:contain}

    /* portada */
    .cover{background-color:#0b0911;background-size:cover,1150px auto;background-position:center,112% 245px;background-repeat:no-repeat;color:#fff;padding:43px 47px}
    .cover:after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(10,9,15,.6),transparent 70%);z-index:0}
    .cover>*{position:relative;z-index:1}
    .cover-top{display:flex;justify-content:space-between;align-items:flex-start}
    .cover-top .logo img:first-child{width:64px;height:64px}
    .cover-top .logo img:last-child{width:220px}
    .cover-top>span{font-size:10px;letter-spacing:1px;line-height:1.55;text-align:right;color:#d4c8e0;font-weight:700}
    .cover-title{margin-top:62px}
    .cover-title>span{display:inline-block;padding:9px 13px;background:#332641;border-radius:18px;color:#e5d5f7;font-size:10px;font-weight:700}
    .cover-title h1{font-size:58px;letter-spacing:-2.8px;line-height:1.06;margin:20px 0 34px;font-weight:800}
    .cover-title h1 em{font-style:normal;color:#e6cbff}
    .cover-title p{font-size:10px;font-weight:700;line-height:2.1;color:#e8d8f3}
    .cover-card{position:absolute;bottom:112px;left:47px;right:47px;background:rgba(22,17,31,.94);border:1px solid #67437f;border-radius:22px;padding:26px 28px}
    .cover-card small{font-size:10px;color:#c7aed7;font-weight:700;letter-spacing:.6px}
    .cover-card h2{font-size:34px;line-height:1.15;margin:10px 0 6px;font-weight:800;letter-spacing:-.8px}
    .cover-card p{font-size:12.5px;color:#c5b4d0}
    .cover-metrics{display:flex;justify-content:space-between;border-top:1px solid #46334f;margin-top:22px;padding-top:20px}
    .cover-metrics div{display:flex;gap:10px;align-items:baseline}
    .cover-metrics b{font-size:32px;color:#e6cbff;font-weight:800}
    .cover-metrics span{font-size:10px;font-weight:700;color:#c6aed5;letter-spacing:.6px}
    .cover-footer{position:absolute;bottom:49px;left:47px;right:47px;display:flex;justify-content:space-between;font-size:9px;font-weight:700;color:#ddcaeb}

    /* hoja interior: cabecera · contenido que rellena la hoja · pie */
    .inner{background:#f8f6fd;display:flex;flex-direction:column}
    .inner header{height:76px;flex:none;background:#181223;color:#e8deef;padding:0 44px;display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #b773f2}
    .inner header .logo img:first-child{width:38px;height:38px}
    .inner header .logo img:last-child{width:158px}
    .inner header>span{font-size:9.5px;line-height:1.7;text-align:right;font-weight:700;color:#c7b9d6;letter-spacing:.5px}
    .inner header strong{color:#fff;font-size:12px;letter-spacing:0}
    .inner main{flex:1;min-height:0;padding:30px 44px 0;display:flex;flex-direction:column;overflow:hidden}
    .section-kicker{font-size:10px;color:#793acf;font-weight:800;letter-spacing:.8px}
    .inner h1{font-size:31px;letter-spacing:-.9px;margin:10px 0 6px;font-weight:800;line-height:1.1}
    .lead{font-size:12.5px;color:#6d6780;line-height:1.5;margin:0 0 20px}
    .stack{flex:1;min-height:0;display:flex;flex-direction:column;gap:14px}
    .inner footer{flex:none;height:56px;margin:0 44px;border-top:1px solid #e3dfea;display:flex;justify-content:space-between;align-items:center;color:#706982;font-size:9px;font-weight:700}
    .inner footer span:last-child{color:#7738ce;font-size:11px}

    /* componentes */
    .panel{border:1px solid #e6e1ef;background:#fff;border-radius:16px;box-shadow:0 2px 10px rgba(52,30,92,.05);padding:20px 22px}
    .panel.grow{flex:1;min-height:0;display:flex;flex-direction:column}
    .panel.grow>.balance{flex:1;margin-top:0}
    .panel>small,.panel-title small,.kpis small,.highlights small{display:block;color:#66588a;font-size:9.5px;font-weight:800;letter-spacing:.6px}
    .panel-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
    .panel-title b{font-size:9.5px;letter-spacing:.5px;color:#4d3a78}
    .panel-title .signal{background:#f1eafb;border-radius:20px;padding:5px 11px}
    .two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .two.wide-left{grid-template-columns:1.35fr 1fr}
    .muted{color:#7a7488;font-size:11px;line-height:1.5;margin-top:14px}
    .green{color:#12805f!important}.amber{color:#b9770e!important}.red{color:#b83d55!important}.empty{color:#9a94a8!important}
    .track{height:9px;border-radius:12px;background:#eee9f6;flex:1;overflow:hidden}
    .track i{display:block;height:100%;border-radius:12px;background:linear-gradient(90deg,#8150c9,#bd78f2)}

    .kpis{display:grid;grid-template-columns:repeat(4,1fr);padding:0}
    .kpis>div{padding:20px 20px 18px;border-left:1px solid #eee9f6}
    .kpis>div:first-child{border-left:0}
    .kpis b{display:block;font-size:34px;font-weight:800;letter-spacing:-1px;margin:10px 0 9px;line-height:1}
    .chip{display:inline-block;white-space:nowrap;font-style:normal;font-size:9.5px;font-weight:700;border-radius:20px;padding:4px 9px;background:#f0edf5;color:#6d6780}
    .chip.good{background:#e3f4ee;color:#12805f}.chip.bad{background:#fbe8ec;color:#b83d55}

    .score .big{font-size:60px;font-weight:800;letter-spacing:-2px;line-height:1;margin:22px 0 14px}
    .pill{display:inline-block;border-radius:22px;background:#f2eef9;padding:7px 13px;font-size:11px;font-weight:700}
    .pill.green{background:#e3f4ee}.pill.amber{background:#fbf0dc}.pill.red{background:#fbe8ec}
    .meter{position:relative;height:10px;border-radius:12px;background:#eee9f6;margin-top:26px}
    .meter i{display:block;height:100%;border-radius:12px;background:#9a94a8}
    .meter i.green{background:#12805f}.meter i.amber{background:#d6a23c}.meter i.red{background:#b83d55}
    .meter u{position:absolute;top:-5px;width:2px;height:20px;background:#793acf;border-radius:2px}
    .meter-scale{position:relative;display:flex;justify-content:space-between;font-size:9px;color:#8a8498;margin-top:8px;font-weight:600}
    .meter-scale span:nth-child(2){position:absolute;transform:translateX(-50%);color:#793acf;font-weight:800;white-space:nowrap}
    .starlist .star-row{display:flex;align-items:center;gap:10px;font-size:12px;margin:15px 0}
    .starlist .star-row>span{width:34px;font-weight:600}
    .starlist .star-row strong{width:28px;text-align:right}
    .starlist .star-row small{width:46px;text-align:right;color:#7a7488;font-size:10.5px;letter-spacing:0;font-weight:500}

    .balance{display:flex;gap:34px;align-items:center;margin-top:12px}
    .donut{position:relative;width:170px;height:170px;flex:none}
    .donut-c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
    .donut-c b{font-size:30px;font-weight:800;line-height:1}
    .donut-c span{font-size:8.5px;font-weight:700;color:#7a7488;letter-spacing:.6px;margin-top:3px}
    .legend{flex:1}
    .legend p{display:flex;align-items:center;gap:11px;font-size:13px;padding:14px 0;border-bottom:1px solid #f0ecf6}
    .legend p:last-child{border-bottom:0}
    .legend i{width:11px;height:11px;border-radius:4px;flex:none}
    .legend span{flex:1;color:#4a4560}
    .legend b{font-size:15px;width:38px;text-align:right}
    .legend em{font-style:normal;color:#7a7488;font-size:11.5px;width:58px;text-align:right}
    .highlights{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
    .highlights.one{grid-template-columns:1fr}
    .highlights>div{border:1px solid #e6e1ef;background:#fbf9ff;border-radius:14px;padding:15px 18px}
    .highlights b{display:block;font-size:26px;font-weight:800;margin:8px 0 4px;letter-spacing:-.6px}
    .highlights b.small{font-size:16px;line-height:1.3;margin:10px 0 6px;letter-spacing:0}
    .highlights p{font-size:11px;color:#6d6780;line-height:1.4}

    .chart-empty{padding:60px 0;text-align:center;color:#8a8498;font-size:13px}
    .ax{font-size:10px;fill:#8a8498;font-weight:600}.ax2{font-size:9px;fill:#a39dae}.pv{font-size:12.5px;font-weight:800}.tg{font-size:9px;font-weight:800;fill:#793acf;letter-spacing:.5px}
    .table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px}
    .table th{text-align:left;font-size:9.5px;letter-spacing:.5px;color:#7a7488;font-weight:700;padding:7px 10px;border-bottom:1px solid #e6e1ef;text-transform:uppercase}
    .table td{padding:7.5px 10px;border-bottom:1px solid #f0ecf6}
    .table tr:last-child td{border-bottom:0}
    .table th:not(:first-child),.table td:not(:first-child){text-align:right}

    .reasons{margin:14px 0 4px}
    .reason{margin:11px 0}
    .reason>div:first-child{display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:6px}
    .reason span{font-weight:700;color:#6b478b}
    .empty-note{color:#7f748c;font-size:13px;margin:22px 0;line-height:1.5}
    .focus h2{font-size:22px;line-height:1.2;margin:18px 0 10px;font-weight:800;letter-spacing:-.4px}
    .focus p{font-size:12px;line-height:1.55;color:#4a4560}
    .focus-fav{display:flex;align-items:center;gap:12px;margin-top:22px;padding-top:18px;border-top:1px solid #eee9f6}
    .focus-fav b{font-size:34px;font-weight:800}
    .focus-fav span{font-size:11px;color:#6d6780;line-height:1.4}
    .neg-list{display:flex;flex-direction:column;gap:8px;margin-top:10px}
    .neg{border-left:3px solid #b83d55;background:#fdf6f8;border-radius:8px;padding:9px 15px}
    .neg-top{display:flex;justify-content:space-between;font-size:12px}
    .neg p{font-size:11.5px;line-height:1.5;margin-top:5px;overflow-wrap:anywhere;white-space:pre-wrap}

    blockquote{margin:14px 0 0;padding:15px 18px;background:#f7f2fc;border-left:3px solid #9c62dc;border-radius:8px}
    blockquote.q-neg{background:#fdf6f8;border-left-color:#b83d55}
    blockquote.q-pos{background:#f1f8f5;border-left-color:#12805f}
    blockquote span{font-size:10px;color:#684799;font-weight:700}
    blockquote p{margin:7px 0 0;font-size:13px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}
    .priorities{list-style:none;margin:8px 0 0;padding:0}
    .priorities li{display:flex;gap:18px;padding:12px 0;border-bottom:1px solid #f0ecf6}
    .priorities li:last-child{border-bottom:0}
    .priorities b{font-size:22px;font-weight:800;color:#a978e8;width:34px;flex:none;line-height:1.1}
    .priorities h3{font-size:14px;margin:0 0 5px}
    .priorities p{font-size:11.5px;line-height:1.55;color:#615c6d}
    .legend-line{display:flex;align-items:center;gap:7px;font-size:10px;color:#7a7488;margin-top:8px;font-weight:600}
    .legend-line i{width:9px;height:9px;border-radius:3px;display:inline-block}
    .legend-line i:not(:first-child){margin-left:14px}
    .method{margin-top:-2px;font-size:10px;line-height:1.6;color:#716a7d;padding:0 4px}

    .review-list{display:flex;flex-direction:column;gap:9px}
    .review{border:1px solid #e6e1ef;background:#fff;border-radius:12px;padding:12px 16px}
    .review.slim{display:flex;align-items:center;gap:14px;padding:8px 16px;background:#fcfbff}
    .review.slim strong{flex:1;min-width:0}
    .review-top{display:flex;justify-content:space-between;gap:12px;font-size:12px}
    .review strong,.neg strong{display:flex;align-items:center;gap:8px;overflow-wrap:anywhere;font-size:12px}
    .dot{height:8px;width:8px;flex:none;border-radius:50%;background:#12805f;display:inline-block}
    .dot.amber{background:#d6a23c}.dot.red{background:#b83d55}
    .stars{color:#c28b2f;white-space:nowrap;letter-spacing:2px;font-size:11px}
    .stars span{color:#ddd9e5}
    .review-meta{font-size:10px;color:#857e92;margin:5px 0 6px}
    .review.slim .review-meta{margin:0}
    .tag{font-style:normal;margin-left:9px;padding:2px 8px;border-radius:12px;background:#f1eafb;color:#5d3b93;font-weight:700}
    .review p{font-size:11.5px;line-height:1.46;white-space:pre-wrap;overflow-wrap:anywhere}
  </style></head><body>${cover}${summary}${evolution}${motives}${reading}${register}</body></html>`;
}
