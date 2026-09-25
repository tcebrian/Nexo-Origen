import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { MonthlyReportData, MonthlyReview } from "./data";

const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (v: unknown) => Number(v) || 0;
const decimal = (v: number | null, digits = 2) => v === null ? "—" : v.toLocaleString("es-ES", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (n: number, total: number) => total ? decimal(n / total * 100, 1) + " %" : "—";
const dateLabel = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "Fecha no disponible";
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
};
const status = (v: number | null, target: number) => v === null ? "Sin reseñas" : v >= target ? "En objetivo" : v >= 4 ? "En vigilancia" : "Fuera de objetivo";
const tone = (v: number | null, target: number) => v === null ? "empty" : v >= target ? "green" : v >= 4 ? "amber" : "red";

function reviewPages(reviews: MonthlyReview[]): MonthlyReview[][] {
  if (!reviews.length) return [[]];
  const pages: MonthlyReview[][] = [];
  let group: MonthlyReview[] = [];
  let cost = 0;
  for (const review of reviews) {
    // Allow entire comments, including long ones, to flow on their own page.
    const weight = Math.max(120, review.comment.length + review.author.length);
    if (group.length && (group.length >= 6 || cost + weight > 1150)) {
      pages.push(group); group = []; cost = 0;
    }
    group.push(review); cost += weight;
  }
  if (group.length) pages.push(group);
  return pages;
}

function dataUri(bytes: Buffer, mime: string) { return `data:${mime};base64,${bytes.toString("base64")}`; }

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
  const pages = reviewPages(d.reviews);
  const pageCount = 5 + pages.length;
  const logo = `<span class="logo"><img src="${dataUri(icon, "image/png")}" alt=""/><img src="${dataUri(mark, "image/png")}" alt="Nexo Origen"/></span>`;
  const frame = (section: string, title: string, subtitle: string, body: string, index: number) => `<section class="page inner">
    <header>${logo}<span>REPUTACIÓN / RESTAURANTE<br/><strong>${name}</strong></span></header>
    <main><div class="section-kicker">${esc(section)}</div><h1>${esc(title)}</h1><p class="lead">${esc(subtitle)}</p>${body}</main>
    <footer><span>NEXO ORIGEN · ${brand} · ${esc(d.label)}</span><span>${String(index).padStart(2, "0")} / ${String(pageCount).padStart(2, "0")}</span></footer>
  </section>`;

  const cover = `<section class="page cover" style="background-image:linear-gradient(180deg,#0b0911 24%,rgba(11,9,17,.08) 36%,rgba(11,9,17,.1) 61%,#0b0911 83%),url('${dataUri(brain, "image/png")}')">
    <div class="cover-top">${logo}<span>RESTAURANT<br/>REPUTATION REPORT</span></div>
    <div class="cover-title"><span>NEXO ORIGEN / INFORME MENSUAL DE REPUTACIÓN</span><h1>La voz de<br/><em>tus clientes.</em></h1><p>ANÁLISIS<br/>EVOLUCIÓN<br/>TODAS LAS RESEÑAS</p></div>
    <div class="cover-card"><small>RESTAURANTE · ${brand}</small><h2>${name}</h2><p>${esc(d.label)}${d.restaurant.city ? ` · ${esc(d.restaurant.city)}` : ""}</p>
      <div class="cover-metrics"><div><b>${decimal(avg)}</b><span>MEDIA</span></div><div><b>${total}</b><span>RESEÑAS</span></div><div><b>${pct(positives, total)}</b><span>POSITIVAS</span></div></div>
    </div><div class="cover-footer"><span>NEXO ORIGEN · DATOS DE RESEÑAS DEL PERIODO</span><span>01 / ${String(pageCount).padStart(2, "0")}</span></div>
  </section>`;

  const stars = [5, 4, 3, 2, 1].map((star) => {
    const count = num(c[`stars_${star}` as keyof typeof c]);
    return `<div class="star-row"><span>${star} ★</span><div class="track"><i style="width:${total ? count / total * 100 : 0}%"></i></div><strong>${count}</strong></div>`;
  }).join("");
  const summary = frame("01 / EL RESTAURANTE EN UN VISTAZO", "Tu reputación, de un vistazo", `Periodo completo: ${d.label}`, `
    <div class="kpis"><div><small>MEDIA PONDERADA</small><b class="${tone(avg,target)}">${decimal(avg)}</b><span>Objetivo: ${decimal(target)}</span></div><div><small>RESEÑAS</small><b>${total}</b><span>${prevTotal ? `${total - prevTotal >= 0 ? "+" : ""}${total - prevTotal} vs mes anterior` : "Mes anterior sin reseñas"}</span></div><div><small>POSITIVAS</small><b>${pct(positives,total)}</b><span>${positives} de 4 y 5 estrellas</span></div><div><small>NEGATIVAS</small><b>${negatives}</b><span>${prevTotal ? `${negatives - num(p.negativas) >= 0 ? "+" : ""}${negatives - num(p.negativas)} vs anterior` : "Sin comparación"}</span></div></div>
    <div class="two"><div class="panel"><small>ESTADO DEL PERIODO</small><div class="big ${tone(avg,target)}">${decimal(avg)}</div><p>Media del periodo</p><div class="pill ${tone(avg,target)}">${status(avg,target)}</div><p class="muted">${avg === null ? "Todavía no hay reseñas registradas en este mes." : avg < target ? `Faltan ${decimal(target - avg)} puntos para el objetivo.` : `Objetivo de ${decimal(target)} alcanzado.`}</p></div>
    <div class="panel"><small>RESEÑAS POR ESTRELLAS</small>${stars}<p class="muted">${total ? `${num(c.rating_sum)} estrellas / ${total} reseñas = ${decimal(avg)}` : "Sin reseñas en este periodo"}</p></div></div>
    <div class="panel"><small>BALANCE DE OPINIONES</small><div class="balance"><div class="balance-total"><b>${total}</b><span>RESEÑAS</span></div><div><p><b>${positives}</b> positivas <span>${pct(positives,total)}</span></p><p><b>${neutrals}</b> neutras <span>${pct(neutrals,total)}</span></p><p><b>${negatives}</b> negativas <span>${pct(negatives,total)}</span></p></div></div></div>
  `, 2);

  const weekCards = d.weeks.map((w) => `<div class="week"><div class="week-head"><strong>${esc(w.label)}</strong><b class="${tone(w.average,target)}">${decimal(w.average)}</b></div><div class="track"><i style="width:${w.average === null ? 0 : Math.max(0,(w.average - 1)/4*100)}%"></i></div><div class="week-end"><span>${w.total} reseñas</span><span>${w.positive} + · ${w.neutral} = · ${w.negative} −</span></div></div>`).join("");
  const validWeeks = d.weeks.filter((w) => w.total > 0);
  const reached = validWeeks.filter((w) => w.average !== null && w.average >= target).length;
  const variation = avg !== null && prevAvg !== null ? avg - prevAvg : null;
  const evolution = frame("02 / EVOLUCIÓN", "Una evolución que se puede medir", "Media y volumen por tramos semanales del mes. Cada tramo usa solo sus reseñas.", `
    <div class="panel"><div class="panel-title"><small>EVOLUCIÓN DE LA MEDIA</small><b class="${tone(avg,target)}">OBJETIVO ${decimal(target)}</b></div><div class="week-list">${weekCards}</div></div>
    <div class="two spaced"><div class="panel"><small>SEÑAL A SEGUIR</small><div class="big">${reached} de ${validWeeks.length}</div><p>tramos con reseñas alcanzan el objetivo de ${decimal(target)}.</p><p class="muted">Los tramos sin reseñas no se consideran mejoras ni caídas.</p></div>
    <div class="panel"><small>COMPARATIVA CON EL MES ANTERIOR</small><div class="compare"><span>Media</span><b>${decimal(prevAvg)} → ${decimal(avg)}</b></div><div class="compare"><span>Variación</span><b>${variation === null ? "—" : `${variation >= 0 ? "+" : ""}${decimal(variation)} puntos`}</b></div><div class="compare"><span>Reseñas</span><b>${prevTotal} → ${total}</b></div><div class="compare"><span>Negativas</span><b>${num(p.negativas)} → ${negatives}</b></div></div></div>
  `, 3);

  const reasonRows = d.reasons.length ? d.reasons.map((r) => `<div class="reason"><div><b>${esc(r.label)}</b><span>${r.count} · ${decimal(r.percent,1)} %</span></div><div class="track"><i style="width:${r.percent}%"></i></div></div>`).join("") : `<p class="empty-note">${negatives ? "No hay motivos clasificados." : "Sin reseñas negativas en este periodo."}</p>`;
  const motives = frame("03 / MOTIVOS", "Qué están diciendo los clientes", "Un motivo principal por reseña negativa (1 o 2 estrellas).", `
    <div class="panel"><div class="panel-title"><small>MOTIVOS DE INSATISFACCIÓN</small><b>${negatives} RESEÑAS NEGATIVAS</b></div><div class="reasons">${reasonRows}</div><p class="muted">Los porcentajes se calculan sobre ${negatives} reseñas negativas. Cada reseña se cuenta una sola vez.</p></div>
    <div class="two spaced"><div class="panel"><small>OPINIONES FAVORABLES</small><div class="big green">${positives}</div><p>reseñas de 4 y 5 estrellas, el ${pct(positives,total)} del mes.</p><p class="muted">Este dato describe la valoración; no atribuye un motivo sin evidencia en el texto.</p></div><div class="panel"><small>PRIMER FOCO DE REVISIÓN</small><h2>${d.reasons.length ? esc(d.reasons[0].label) : "Sin foco negativo"}</h2><p>${d.reasons.length ? `${d.reasons[0].count} de ${negatives} reseñas negativas con este motivo principal.` : "No se han recibido valoraciones de 1 o 2 estrellas."}</p><p class="muted">Las reseñas orientan la revisión; no prueban por sí solas una causa.</p></div></div>
  `, 4);

  const quotes = [d.reviews.find((r) => r.stars <= 2 && r.comment !== "Sin comentario"), d.reviews.find((r) => r.stars >= 4 && r.comment !== "Sin comentario")].filter((r): r is MonthlyReview => Boolean(r));
  const quoteHtml = quotes.length ? quotes.map((r) => `<blockquote><span>${r.stars} ★ · ${esc(r.author)} · ${dateLabel(r.date)}${r.editedAt ? ` · editada ${dateLabel(r.editedAt)}` : ""}</span><p>${esc(r.comment.length > 360 ? `${r.comment.slice(0, 357)}…` : r.comment)}</p></blockquote>`).join("") : `<p class="empty-note">No hay comentarios escritos en este periodo.</p>`;
  const reading = frame("04 / LECTURA NEXO", "De la reseña a la revisión", "Extractos reales del periodo. Los textos completos aparecen en el registro final.", `
    <div class="panel"><small>LA VOZ DEL CLIENTE</small>${quoteHtml}</div>
    <h3 class="subhead">PRIORIDADES SUGERIDAS</h3><div class="priorities"><div><b>01</b><h3>${d.reasons.length ? esc(d.reasons[0].label) : "Seguimiento"}</h3><p>${d.reasons.length ? `Leer las ${d.reasons[0].count} reseñas clasificadas en esta categoría.` : "Seguir la evolución del volumen de reseñas."}</p></div><div><b>02</b><h3>Comparación</h3><p>${prevAvg === null ? "Esperar una base de comparación con reseñas." : `Contrastar la media del mes anterior (${decimal(prevAvg)}) con la actual (${decimal(avg)}).`}</p></div><div><b>03</b><h3>Lo positivo</h3><p>Conservar las señales favorables observadas en ${positives} valoraciones positivas.</p></div></div>
    <p class="method">Criterio de estado: verde desde ${decimal(target)} · amarillo de 4,00 a menos de ${decimal(target)} · rojo por debajo de 4,00. Media ponderada de todas las estrellas del mes. La clasificación de motivos orienta la lectura; comprobar siempre la reseña original.</p>
  `, 5);

  const register = pages.map((group, groupIndex) => frame("05 / REGISTRO ÍNTEGRO", "Todas las reseñas del periodo", group.length ? `Reseñas ${pages.slice(0, groupIndex).reduce((sum, arr) => sum + arr.length, 0) + 1}–${pages.slice(0, groupIndex + 1).reduce((sum, arr) => sum + arr.length, 0)} de ${total} · Ordenadas de más reciente a más antigua` : "No hay reseñas registradas en este periodo.", `
    <div class="review-list">${group.map((r) => `<article class="review"><div class="review-top"><strong><i class="dot ${r.stars >= 4 ? "green" : r.stars === 3 ? "amber" : "red"}"></i>${esc(r.author)}</strong><span class="stars">${"★".repeat(r.stars)}<span>${"★".repeat(5-r.stars)}</span></span></div><div class="review-meta">${dateLabel(r.date)}${r.editedAt ? ` · editada ${dateLabel(r.editedAt)}` : ""}${r.reason ? ` · ${esc(r.reason)}` : ""}</div><p>${esc(r.comment)}</p></article>`).join("")}</div>
  `, 6 + groupIndex)).join("");

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/><style>
    @font-face{font-family:Inter;src:url('${dataUri(regular,"font/woff2")}') format('woff2');font-weight:400}
    @font-face{font-family:Inter;src:url('${dataUri(medium,"font/woff2")}') format('woff2');font-weight:500}
    @font-face{font-family:Inter;src:url('${dataUri(bold,"font/woff2")}') format('woff2');font-weight:700}
    @font-face{font-family:Inter;src:url('${dataUri(heavy,"font/woff2")}') format('woff2');font-weight:800}
    @page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;color:#242136;font-family:Inter,Arial,sans-serif}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{width:210mm;height:297mm;position:relative;overflow:hidden;page-break-after:always;break-after:page}.page:last-child{page-break-after:auto;break-after:auto}.logo{display:inline-flex;align-items:center;gap:6px}.logo img:first-child{width:44px;height:44px;object-fit:contain}.logo img:last-child{width:175px;height:auto;object-fit:contain}.cover{background-color:#0b0911;background-size:cover,1150px auto;background-position:center,112% 245px;background-repeat:no-repeat;color:#fff;padding:43px 47px}.cover:after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(10,9,15,.6),transparent 70%);z-index:0}.cover>*{position:relative;z-index:1}.cover-top{display:flex;justify-content:space-between;align-items:flex-start}.cover-top .logo img:first-child{width:64px;height:64px}.cover-top .logo img:last-child{width:220px}.cover-top>span{font-size:10px;letter-spacing:1px;line-height:1.55;text-align:right;color:#d4c8e0;font-weight:700}.cover-title{margin-top:62px}.cover-title>span{padding:9px 13px;background:#332641;border-radius:18px;color:#e5d5f7;font-size:10px;font-weight:700}.cover-title h1{font-size:56px;letter-spacing:-2.8px;line-height:1.08;margin:20px 0 34px;font-weight:800}.cover-title h1 em{font-style:normal;color:#e6cbff}.cover-title p{font-size:10px;font-weight:700;line-height:2.1;color:#e8d8f3}.cover-card{position:absolute;bottom:112px;left:47px;right:47px;background:#16111f;border:1px solid #67437f;border-radius:22px;padding:24px}.cover-card small{font-size:10px;color:#c7aed7;font-weight:700}.cover-card h2{font-size:28px;line-height:1.25;margin:9px 0 4px}.cover-card p{font-size:12px;color:#c5b4d0;margin:0}.cover-metrics{display:flex;justify-content:space-between;border-top:1px solid #46334f;margin-top:20px;padding-top:19px}.cover-metrics div{display:flex;gap:10px;align-items:baseline}.cover-metrics b{font-size:29px;color:#e6cbff}.cover-metrics span{font-size:10px;font-weight:700;color:#c6aed5}.cover-footer{position:absolute;bottom:49px;left:47px;right:47px;display:flex;justify-content:space-between;font-size:9px;font-weight:700;color:#ddcaeb}.inner{background:#f9f8ff}.inner header{height:108px;background:#181223;color:#e8deef;padding:25px 45px;display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #b773f2}.inner header>span{font-size:10px;line-height:1.7;text-align:right;font-weight:700;color:#c7b9d6}.inner header strong{color:#fff}.inner main{padding:27px 46px 55px;max-height:963px;overflow:hidden}.section-kicker{font-size:10px;color:#793acf;font-weight:800}.inner h1{font-size:29px;letter-spacing:-.8px;margin:13px 0 6px;font-weight:800}.lead{font-size:12px;color:#69647b;line-height:1.5;margin:0 0 26px}.inner footer{position:absolute;bottom:32px;left:45px;right:45px;border-top:1px solid #e3dfea;padding-top:14px;display:flex;justify-content:space-between;color:#706982;font-size:9px;font-weight:700}.inner footer span:last-child{color:#7738ce;font-size:11px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:18px}.kpis>div,.panel{border:1px solid #e3dfea;background:white;border-radius:16px;box-shadow:0 3px 8px #33205a0a}.kpis>div{padding:16px 13px;min-height:113px}.kpis small,.panel small{display:block;color:#66588a;font-size:10px;font-weight:800;letter-spacing:.3px}.kpis b{display:block;font-size:28px;margin:9px 0 5px}.kpis span{font-size:10px;color:#777082}.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}.panel{padding:20px}.panel .big{font-size:42px;font-weight:800;margin:21px 0 2px}.panel p{font-size:12px;line-height:1.55}.muted{color:#746f80;font-size:11px!important;margin-top:18px}.green{color:#148a68!important}.amber{color:#c38614!important}.red{color:#bb475c!important}.empty{color:#8a8492!important}.pill{display:inline-block;border-radius:22px;background:#f2eef9;padding:7px 11px;font-size:11px;font-weight:700}.star-row{display:flex;align-items:center;gap:12px;font-size:12px;margin:12px 0}.star-row>span{width:36px}.star-row strong{width:23px;text-align:right}.track{height:8px;border-radius:12px;background:#ede8f5;flex:1;overflow:hidden}.track i{display:block;height:100%;border-radius:12px;background:linear-gradient(90deg,#8150c9,#bd78f2)}.balance{display:flex;gap:40px;align-items:center}.balance-total{border-radius:50%;height:115px;width:115px;flex-shrink:0;background:#efe7fb;display:flex;flex-direction:column;align-items:center;justify-content:center}.balance-total b{font-size:30px}.balance-total span{font-size:10px}.balance>div:last-child{flex:1}.balance p{display:flex;gap:9px;margin:6px 0}.balance p span{margin-left:auto}.panel-title{display:flex;justify-content:space-between;align-items:center}.panel-title b{font-size:10px}.week-list{margin-top:22px}.week{margin:14px 0}.week-head,.week-end,.compare{display:flex;justify-content:space-between}.week-head{font-size:14px;margin-bottom:8px}.week .track{height:11px}.week-end{font-size:10px;color:#7c748d;margin-top:6px}.spaced{margin-top:16px}.compare{margin-top:13px;font-size:12px;gap:10px}.compare span{color:#756c86}.compare b{text-align:right}.reasons{margin:20px 0}.reason{margin:15px 0}.reason>div:first-child{display:flex;justify-content:space-between;font-size:13px;margin-bottom:7px}.reason span{font-weight:700;color:#6b478b}.empty-note{color:#7f748c;font-size:13px;margin:26px 0}.panel h2{font-size:19px;margin:23px 0 10px}blockquote{margin:18px 0;padding:15px 18px;background:#f7f2fc;border-left:3px solid #9c62dc;border-radius:7px}blockquote span{font-size:10px;color:#684799;font-weight:700}blockquote p{margin:7px 0 0;font-size:13px!important;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}.subhead{font-size:12px;color:#453365;letter-spacing:.5px;margin:24px 0 12px}.priorities{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.priorities>div{border:1px solid #e4ddec;background:#fff;border-radius:12px;padding:17px;min-height:155px}.priorities b{color:#8b55d1}.priorities h3{font-size:14px;margin:9px 0}.priorities p{margin:0;font-size:11px;line-height:1.5;color:#615c6d}.method{border-top:1px solid #e4ddec;margin-top:31px;padding-top:18px;color:#716a7d;line-height:1.6;font-size:10px}.review-list{display:flex;flex-direction:column;gap:13px}.review{border:1px solid #e4dfec;background:#fff;border-radius:15px;padding:15px 17px;box-shadow:0 3px 9px #41215a0c;min-height:103px}.review-top{display:flex;justify-content:space-between;gap:12px;font-size:12px}.review-top strong{display:flex;align-items:center;gap:8px;overflow-wrap:anywhere}.dot{height:8px;width:8px;flex-shrink:0;border-radius:50%;background:#148a68}.dot.amber{background:#c38614}.dot.red{background:#bb475c}.stars{color:#c28b2f;white-space:nowrap;letter-spacing:2px}.stars span{color:#ddd9e5}.review-meta{font-size:10px;color:#817a8b;margin:7px 0}.review p{font-size:11.5px;line-height:1.46;margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
  </style></head><body>${cover}${summary}${evolution}${motives}${reading}${register}</body></html>`;
}
