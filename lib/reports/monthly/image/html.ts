import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { MonthlyImageModel, MonthlyImageStatus } from "./model";

/**
 * Plantilla única (HTML + CSS + SVG) del informe mensual en imagen, 1920×1080.
 * El diseño es fijo: solo cambian los datos del modelo y los colores de marca.
 * Todo (fuentes y logos) va incrustado en data-URIs para que el render sea
 * idéntico en local y en Vercel, sin peticiones de red.
 */

export const MONTHLY_IMAGE_WIDTH = 1920;
export const MONTHLY_IMAGE_HEIGHT = 1080;

const GREEN = "#087C43";
const AMBER = "#D98200";
const RED = "#F3151C";
const STAR_COLORS = [GREEN, "#FF8500", "#F5A000", RED, RED];
const STATUS_COLOR: Record<MonthlyImageStatus, string> = { positive: GREEN, watch: AMBER, critical: RED, empty: "#8A8580" };

const MIME: Record<string, string> = { ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const fileCache = new Map<string, string>();

async function dataUri(file: string): Promise<string> {
  const cached = fileCache.get(file);
  if (cached) return cached;
  const buffer = await readFile(path.join(process.cwd(), "public", file));
  const uri = `data:${MIME[path.extname(file)] ?? "application/octet-stream"};base64,${buffer.toString("base64")}`;
  fileCache.set(file, uri);
  return uri;
}

const esc = (value: string | number) =>
  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt2 = (value: number) => value.toFixed(2);
const pct1 = (count: number, total: number) => `${(total ? (count / total) * 100 : 0).toFixed(1)}%`;

/* ---------- iconos y gráficos (SVG) ---------- */

const STAR_PATH = "M12 1.6l3.1 6.7 7.3.9-5.4 5 1.4 7.2L12 17.8l-6.4 3.6 1.4-7.2-5.4-5 7.3-.9z";

function star(size: number, color: string): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><path d="${STAR_PATH}" fill="${color}"/></svg>`;
}

/** Cinco estrellas; la última se rellena de forma proporcional a la media. */
function ratingStars(average: number | null, primary: string): string {
  const stars = [0, 1, 2, 3, 4].map((i) => {
    const fraction = average === null ? 0 : Math.max(0, Math.min(1, average - i));
    const id = `sg${i}`;
    return `<svg width="58" height="58" viewBox="0 0 24 24"><defs><linearGradient id="${id}" x1="0" x2="1" y1="0" y2="0"><stop offset="${fraction * 100}%" stop-color="${primary}"/><stop offset="${fraction * 100}%" stop-color="#E8E4E1"/></linearGradient></defs><path d="${STAR_PATH}" fill="url(#${id})"/></svg>`;
  });
  return stars.join("");
}

const calendarCheck = (stroke: string, size: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" stroke="${stroke}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="12" width="50" height="46" rx="8"/><path d="M7 25h50M19 6v12M45 6v12"/><path d="M21 41l8 8 15-16"/></svg>`;

const targetArrow = (stroke: string, size: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" stroke="${stroke}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="30" cy="34" r="22"/><circle cx="30" cy="34" r="12"/><circle cx="30" cy="34" r="2.5" fill="${stroke}"/><path d="M31 33L56 8M56 8h-9M56 8v9"/></svg>`;

function shield(status: MonthlyImageStatus): string {
  const color = STATUS_COLOR[status];
  const mark = status === "positive"
    ? `<path d="M23 44l10 10 20-22" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
    : `<path d="M38 28v22" stroke="${color}" stroke-width="7" stroke-linecap="round"/><circle cx="38" cy="60" r="4" fill="${color}"/>`;
  return `<svg width="82" height="96" viewBox="0 0 76 88" fill="none"><path d="M38 4L8 16v24c0 22 13 38 30 44 17-6 30-22 30-44V16L38 4z" stroke="${color}" stroke-width="6" stroke-linejoin="round" fill="#FFFFFF"/>${mark}</svg>`;
}

function bubble(primary: string): string {
  return `<svg width="165" height="110" viewBox="0 0 190 126"><g fill="#E3DFDC"><path d="M112 22h46a22 22 0 0 1 22 22v28a22 22 0 0 1-22 22h-4l2 18-20-18h-24a22 22 0 0 1-22-22V44a22 22 0 0 1 22-22z"/></g><g fill="#fff" opacity=".9"><circle cx="124" cy="58" r="5"/><circle cx="142" cy="58" r="5"/><circle cx="160" cy="58" r="5"/></g><path d="M32 12h62a28 28 0 0 1 28 28v28a28 28 0 0 1-28 28H62L36 116l4-20h-8A28 28 0 0 1 4 68V40A28 28 0 0 1 32 12z" fill="${primary}"/><g fill="#fff"><circle cx="35" cy="54" r="7.5"/><circle cx="63" cy="54" r="7.5"/><circle cx="91" cy="54" r="7.5"/></g></svg>`;
}

/* ---------- bloques ---------- */

function reasonsBlock(m: MonthlyImageModel): string {
  const colors = [GREEN, m.theme.secondary, m.theme.brown];
  const R = 52;
  const C = 2 * Math.PI * R;
  const shown = m.reasons.reduce((sum, r) => sum + r.count, 0);
  const slices = [...m.reasons.map((r, i) => ({ count: r.count, color: colors[i] })),
    ...(m.critical > shown ? [{ count: m.critical - shown, color: "#D9D3CF" }] : [])];
  let offset = 0;
  const arcs = m.critical
    ? slices.map((slice) => {
        const length = (slice.count / m.critical) * C;
        const arc = `<circle cx="65" cy="65" r="${R}" fill="none" stroke="${slice.color}" stroke-width="18" stroke-dasharray="${Math.max(length - (slices.length > 1 ? 2 : 0), 0)} ${C}" stroke-dashoffset="${-offset}" transform="rotate(-90 65 65)"/>`;
        offset += length;
        return arc;
      }).join("")
    : `<circle cx="65" cy="65" r="${R}" fill="none" stroke="#E7F3EC" stroke-width="18"/>`;
  const legend = m.critical
    ? m.reasons.map((r, i) => `<li><i style="background:${colors[i]}"></i><span>${esc(r.name)}</span><b>${r.percent.toFixed(1)}%</b></li>`).join("")
    : `<li class="none"><span>Sin reseñas críticas este mes</span></li>`;
  return `<div class="reasons-title">MOTIVOS DE RESEÑAS CRÍTICAS (1–2★)</div>
    <div class="reasons">
      <div class="donut"><svg width="132" height="132" viewBox="0 0 130 130">${arcs}</svg><div><b>${m.critical}</b><small>INCIDENCIAS</small></div></div>
      <ul>${legend}</ul>
    </div>`;
}

function weekCards(m: MonthlyImageModel): string {
  return m.weeks.map((week) => {
    const max = Math.max(1, ...week.ratings);
    const rows = week.ratings.map((count, i) => {
      const starNumber = 5 - i;
      return `<div class="wrow"><span>${starNumber}</span>${star(15, STAR_COLORS[i])}<em><i style="width:${(count / max) * 100}%;background:${STAR_COLORS[i]}"></i></em><b>${count}</b></div>`;
    }).join("");
    const footer = week.average === null
      ? `<div class="wavg idle"><small>SIN ACTIVIDAD</small><strong>—</strong></div>`
      : `<div class="wavg"><small>MEDIA SEMANAL</small><strong>${fmt2(week.average)}</strong></div>`;
    return `<div class="week"><span class="pill">SEMANA ${week.index}</span><p class="range">${esc(week.label)}</p><div class="wrows">${rows}</div>${footer}</div>`;
  }).join("");
}

function evolutionChart(m: MonthlyImageModel): string {
  const left = 58, right = 755, top = 24, bottom = 162;
  const scale = (bottom - top) / 5;
  const y = (value: number) => bottom - value * scale;
  const n = Math.max(1, m.weeks.length);
  const colW = (right - left) / n;
  const x = (i: number) => left + colW * (i + 0.5);
  const grid = [0, 1, 2, 3, 4, 5].map((v) =>
    `<line x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}" stroke="#EAE7E5" stroke-width="1.5"/><text x="${left - 14}" y="${y(v) + 5}" text-anchor="end" class="axis">${v}</text>`).join("");
  const labels = m.weeks.map((week, i) => {
    const [from, rest] = week.label.split(" – ");
    const [to, month] = rest.split(" ");
    return `<text x="${x(i)}" y="192" text-anchor="middle" class="axis x">${from}–${to} ${month.slice(0, 3)}</text>`;
  }).join("");
  const segments: string[][] = [[]];
  m.weeks.forEach((week, i) => {
    if (week.average === null) { if (segments[segments.length - 1].length) segments.push([]); return; }
    segments[segments.length - 1].push(`${x(i)},${y(week.average)}`);
  });
  const lines = segments.filter((s) => s.length > 1).map((s) =>
    `<polyline points="${s.join(" ")}" fill="none" stroke="${RED}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`).join("");
  const points = m.weeks.map((week, i) => week.average === null
    ? `<text x="${x(i)}" y="${y(2.9)}" text-anchor="middle" class="idle-label">SIN ACTIVIDAD</text>`
    : `<circle cx="${x(i)}" cy="${y(week.average)}" r="7.5" fill="${RED}" stroke="#fff" stroke-width="2"/><text x="${x(i)}" y="${y(week.average) - 15}" text-anchor="middle" class="point">${fmt2(week.average)}</text>`).join("");
  const target = `<line x1="${left}" x2="${right}" y1="${y(m.objective)}" y2="${y(m.objective)}" stroke="#E51B23" stroke-width="2" stroke-dasharray="10 8"/>`;
  return `${grid}${target}${lines}${points}${labels}`;
}

function titleFontSize(title: string): number {
  return Math.max(17, Math.min(29, Math.floor(560 / (title.length * 0.52))));
}

/* ---------- documento ---------- */

export async function buildMonthlyImageHtml(m: MonthlyImageModel): Promise<string> {
  const [condensed, inter400, inter500, inter700, brandLogo, nexoIcon, nexoWord] = await Promise.all([
    dataUri("fonts/roboto-condensed-variable.woff2"), dataUri("fonts/inter-400-normal.woff2"),
    dataUri("fonts/inter-500-normal.woff2"), dataUri("fonts/inter-700-normal.woff2"),
    dataUri(m.theme.logo), dataUri("nexo-origen-report-icon.png"), dataUri("nexo-origen-report-wordmark.png"),
  ]);
  const t = m.theme;
  const nexoLogo = (iconHeight: number, wordWidth: number) =>
    `<div class="nexo" style="gap:${Math.round(iconHeight * 0.14)}px"><img src="${nexoIcon}" alt="" style="height:${iconHeight}px"/><img src="${nexoWord}" alt="Nexo Origen" style="width:${wordWidth}px"/></div>`;
  const statusColor = STATUS_COLOR[m.status];
  const totalWeeks = m.weeks.length;
  const summaryLines = m.status === "empty"
    ? `<p class="s-line">No hay reseñas registradas en este periodo.</p>`
    : `<p class="s-line">${m.positivePct.toFixed(1)}% de valoraciones 4–5★</p><p class="s-line">y ${m.weeksOnTarget} de ${totalWeeks} semanas en objetivo.</p>`;
  const ratingRows = m.ratings.map((count, i) =>
    `<div class="drow"><span class="dn">${5 - i}</span>${star(26, STAR_COLORS[i])}<em><i style="width:${m.total ? (count / m.total) * 100 : 0}%;background:${STAR_COLORS[i]}"></i></em><b>${count} <small>(${pct1(count, m.total)})</small></b></div>`).join("");

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>Informe mensual ${esc(m.restaurantTitle)}</title><style>
    @font-face{font-family:'Roboto Condensed';src:url('${condensed}') format('woff2');font-weight:100 900}
    @font-face{font-family:Inter;src:url('${inter400}') format('woff2');font-weight:400}
    @font-face{font-family:Inter;src:url('${inter500}') format('woff2');font-weight:500}
    @font-face{font-family:Inter;src:url('${inter700}') format('woff2');font-weight:700}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:${MONTHLY_IMAGE_WIDTH}px;height:${MONTHLY_IMAGE_HEIGHT}px;overflow:hidden;background:#fff}
    .canvas{position:relative;width:${MONTHLY_IMAGE_WIDTH}px;height:${MONTHLY_IMAGE_HEIGHT}px;overflow:hidden;background:#fff;color:#101010;font-family:Inter,Roboto,Arial,sans-serif;--primary:${t.primary};--secondary:${t.secondary};--brown:${t.brown}}
    .cond{font-family:'Roboto Condensed','Barlow Condensed','Arial Narrow',sans-serif}
    .abs{position:absolute}
    /* cabecera */
    .brand-logo{left:45px;top:17px;width:145px;height:140px;object-fit:contain}
    .h-title{left:245px;top:20px;width:600px}
    .h-title h1{font:700 60px/1 'Roboto Condensed',sans-serif;letter-spacing:-1px;color:#080808}
    .h-title h2{margin-top:12px;font:700 33px/1 'Roboto Condensed',sans-serif;color:var(--primary);letter-spacing:.2px}
    .h-title h3{margin-top:12px;font-family:'Roboto Condensed',sans-serif;font-weight:700;color:#111;white-space:nowrap;letter-spacing:.2px}
    .nexo{display:flex;align-items:center}
    .nexo img{display:block;object-fit:contain}
    .h-nexo{left:830px;top:20px;width:450px;height:140px;display:flex;align-items:center;justify-content:center}
    .h-sep{left:1370px;top:28px;width:2px;height:125px;background:#333}
    .h-date-icon{left:1412px;top:58px}
    .h-date{left:1504px;top:58px}
    .h-date small{display:block;font:700 25px/1 'Roboto Condensed',sans-serif;color:#101010;letter-spacing:.3px}
    .h-date b{display:block;margin-top:8px;font:700 36px/1 'Roboto Condensed',sans-serif;color:#E51B23;letter-spacing:.3px}
    /* tarjetas */
    .card{position:absolute;background:#fff;border:1px solid #E6DDD8;border-radius:18px;box-shadow:0 4px 15px rgba(70,40,20,.05)}
    .card>h4{margin-top:20px;text-align:center;font:700 27px/1 'Roboto Condensed',sans-serif;letter-spacing:.2px;color:#101010}
    .c1{left:30px;top:185px;width:410px;height:390px;text-align:center}
    .c2{left:460px;top:185px;width:350px;height:390px;text-align:center}
    .c3{left:830px;top:185px;width:475px;height:390px}
    .c4{left:1325px;top:185px;width:565px;height:390px}
    .kpi{display:block;font:700 96px/1 'Roboto Condensed',sans-serif;color:var(--primary);margin-top:26px;letter-spacing:-1px}
    .stars{display:flex;justify-content:center;gap:6px;margin-top:20px}
    .sub{font-size:27px;font-weight:400;margin-top:18px;color:#111}
    .bar{width:260px;height:5px;margin:42px auto 0;border-radius:99px;background:#E8E4E1;overflow:hidden}
    .bar i{display:block;height:100%;background:var(--primary);border-radius:99px}
    .c2 .kpi{margin-top:22px}
    .c2 .sub{font-size:25px;margin-top:14px}
    .c2 .bubble{margin-top:8px;display:flex;justify-content:center}
    .c2 .split{margin-top:10px;font-size:21px;color:#222}
    /* resumen */
    .summary{margin:16px 22px 0;height:112px;border:1.5px solid #E6DDD8;border-radius:14px;display:flex;align-items:center;gap:18px;padding:0 20px}
    .summary p.t{font:700 25px/1.1 'Roboto Condensed',sans-serif;margin-bottom:4px;white-space:nowrap;color:${statusColor}}
    .s-line{font-size:18.5px;line-height:1.45;color:#222;font-weight:400}
    .reasons-title{margin:16px 22px 0;font:700 21px/1 'Roboto Condensed',sans-serif;letter-spacing:.2px;color:#101010}
    .reasons{display:flex;align-items:center;gap:20px;margin:8px 22px 0}
    .donut{position:relative;width:132px;height:132px;flex:none}
    .donut>div{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
    .donut b{font:700 36px/1 'Roboto Condensed',sans-serif;color:#101010}
    .donut small{margin-top:3px;font-size:9px;font-weight:700;letter-spacing:.4px;color:#555}
    .reasons ul{list-style:none;flex:1;min-width:0}
    .reasons li{display:flex;align-items:center;gap:9px;padding:9px 0;font-size:16px;color:#222}
    .reasons li i{width:13px;height:13px;border-radius:50%;flex:none}
    .reasons li span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .reasons li b{font-weight:700;font-size:16px}
    .reasons li.none{color:#666}
    /* distribución */
    .dist{margin:16px 34px 0 36px}
    .drow{display:flex;align-items:center;gap:12px;height:48px}
    .dn{width:20px;font:700 28px/1 'Roboto Condensed',sans-serif;text-align:center}
    .drow em{flex:1;height:17px;border-radius:99px;background:#F3F1EF;overflow:hidden}
    .drow em i{display:block;height:100%;border-radius:99px;min-width:0}
    .drow b{width:150px;text-align:right;font-weight:500;font-size:23px;white-space:nowrap;color:#111}
    .drow b small{font-size:23px;font-weight:400}
    .dtotal{margin:14px 36px 0;font:500 31px/1 'Roboto Condensed',sans-serif}
    .dnote{margin:10px 36px 0;font-size:16px;color:#777}
    /* semanas */
    .sec-title{position:absolute;display:flex;align-items:center;gap:16px;top:588px;height:36px}
    .sec-title h3{font:700 30px/1 'Roboto Condensed',sans-serif;letter-spacing:.2px;color:#101010;white-space:nowrap}
    .sec-title i{flex:1;height:2px;background:#E51B23}
    .weeks{position:absolute;left:30px;top:632px;width:1060px;height:330px;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:10px}
    .week{background:#fff;border:1px solid #E6DDD8;border-radius:16px;box-shadow:0 4px 15px rgba(70,40,20,.05);padding:14px 12px 0;text-align:center;display:flex;flex-direction:column}
    .pill{align-self:center;background:var(--primary);color:#fff;border-radius:6px;padding:7px 0;width:124px;font:700 19px/1 'Roboto Condensed',sans-serif;letter-spacing:.4px}
    .range{margin-top:12px;font:700 15.5px/1 'Roboto Condensed',sans-serif;color:#111;white-space:nowrap}
    .wrows{margin-top:14px;display:flex;flex-direction:column;gap:9px}
    .wrow{display:flex;align-items:center;gap:6px;height:22px}
    .wrow span{width:12px;font:700 15px/1 'Roboto Condensed',sans-serif;text-align:right}
    .wrow em{flex:1;height:10px;border-radius:99px;background:#F2F0EE;overflow:hidden;min-width:0}
    .wrow em i{display:block;height:100%;border-radius:99px}
    .wrow b{min-width:24px;text-align:right;font-weight:500;font-size:15px}
    .wavg{margin-top:auto;padding-bottom:12px}
    .wavg small{display:block;font:700 15px/1 'Roboto Condensed',sans-serif;color:#111;letter-spacing:.2px}
    .wavg strong{display:block;margin-top:6px;font:700 42px/1 'Roboto Condensed',sans-serif;color:var(--primary)}
    .wavg.idle small{color:#8A8580}.wavg.idle strong{color:#B9B4AF}
    .evo{position:absolute;left:1115px;top:632px;width:775px;height:330px;background:#fff;border:1px solid #E6DDD8;border-radius:16px;box-shadow:0 4px 15px rgba(70,40,20,.05);overflow:hidden}
    .legend{position:absolute;left:0;right:0;top:12px;display:flex;justify-content:space-between;padding:0 40px 0 62px;font-size:14.5px;font-weight:500;color:#222}
    .legend span{display:flex;align-items:center;gap:8px}
    .legend svg{display:block}
    .evo svg.chart{position:absolute;left:0;top:44px}
    .axis{font:500 14px Inter,sans-serif;fill:#666}.axis.x{font-size:14.5px;fill:#333}
    .point{font:700 17px 'Roboto Condensed',sans-serif;fill:#222;paint-order:stroke;stroke:#fff;stroke-width:5px;stroke-linejoin:round}
    .idle-label{font:700 13px Inter,sans-serif;fill:#8A8580;letter-spacing:.3px}
    .strip{position:absolute;left:12px;right:12px;bottom:10px;height:62px;background:#FAF8F6;border-radius:12px;display:grid;grid-template-columns:1fr 1fr 1fr}
    .strip>div{display:flex;flex-direction:column;align-items:center;justify-content:center;border-left:1.5px solid #E6DDD8}
    .strip>div:first-child{border-left:0}
    .strip small{font:700 13.5px/1 'Roboto Condensed',sans-serif;color:#222;letter-spacing:.2px}
    .strip b{margin-top:6px;font:700 28px/1 'Roboto Condensed',sans-serif}
    /* pie */
    .footer{position:absolute;left:0;top:980px;width:${MONTHLY_IMAGE_WIDTH}px;height:100px;background:linear-gradient(90deg,${t.footer},${t.footer} 60%,${t.footer})}
    .f-logo{position:absolute;left:30px;top:14px;width:355px;height:72px;background:#fff;border-radius:13px;display:flex;align-items:center;justify-content:center}
    .f-sep{position:absolute;top:22px;width:2px;height:56px;background:rgba(255,255,255,.28)}
    .f-claim{position:absolute;left:420px;right:610px;top:0;height:100px;display:flex;align-items:center;justify-content:center;gap:26px}
    .f-claim p{font:400 33px/1 'Roboto Condensed',sans-serif;color:#fff;letter-spacing:.3px;white-space:nowrap}
    .f-claim p em{font-style:normal}
    .f-date{position:absolute;left:1346px;top:0;height:100px;display:flex;align-items:center;gap:20px}
    .f-date small{display:block;font:400 20px/1 'Roboto Condensed',sans-serif;color:#fff}
    .f-date b{display:block;margin-top:7px;font:500 29px/1 'Roboto Condensed',sans-serif;color:${t.footerAccent}}
  </style></head><body><div class="canvas" data-report="monthly-image">
    <img class="abs brand-logo" src="${brandLogo}" alt="${esc(t.displayName)}"${t.logoTile ? ` style="background:${t.logoTile};border-radius:20px;padding:18px"` : ""}/>
    <div class="abs h-title"><h1>INFORME MENSUAL</h1><h2>REPUTACIÓN ONLINE</h2><h3 style="font-size:${titleFontSize(m.restaurantTitle)}px">${esc(m.restaurantTitle)}</h3></div>
    <div class="abs h-nexo">${nexoLogo(130, 268)}</div>
    <div class="abs h-sep"></div>
    <div class="abs h-date-icon">${calendarCheck("#E51B23", 76)}</div>
    <div class="abs h-date"><small>FECHA DEL INFORME</small><b>${esc(m.monthName)} ${m.year}</b></div>

    <section class="card c1"><h4>MEDIA MENSUAL</h4>
      <span class="kpi">${m.average === null ? "—" : fmt2(m.average)}</span>
      <div class="stars">${ratingStars(m.average, "#FF7300")}</div>
      <p class="sub">Sobre 5.0</p>
      <div class="bar"><i style="width:${m.average === null ? 0 : Math.min(100, (m.average / 5) * 100)}%"></i></div>
    </section>

    <section class="card c2"><h4>TOTAL RESEÑAS</h4>
      <span class="kpi">${m.total}</span>
      <p class="sub">en el mes de ${esc(m.monthLower)}</p>
      <div class="bubble">${bubble(t.primary)}</div>
      <p class="split">${m.positive} (4–5★) · ${m.belowPositive} (1–3★)</p>
    </section>

    <section class="card c3"><h4>RESUMEN DEL MES</h4>
      <div class="summary">${shield(m.status)}<div><p class="t">${esc(m.statusTitle)}</p>${summaryLines}</div></div>
      ${reasonsBlock(m)}
    </section>

    <section class="card c4"><h4>DISTRIBUCIÓN GENERAL</h4>
      <div class="dist">${ratingRows}</div>
      <p class="dtotal">Total: ${m.total} reseñas</p>
      <p class="dnote">Media exacta: ${m.average === null ? "—" : m.average.toFixed(4)} · Objetivo: ${fmt2(m.objective)}</p>
    </section>

    <div class="sec-title" style="left:40px;width:1050px"><h3>DESGLOSE SEMANAL</h3><i></i></div>
    <div class="weeks">${weekCards(m)}</div>

    <div class="sec-title" style="left:1115px;width:775px"><h3>EVOLUCIÓN DE LA MEDIA SEMANAL</h3><i></i></div>
    <div class="evo">
      <div class="legend"><span><svg width="46" height="14"><line x1="0" x2="46" y1="7" y2="7" stroke="${RED}" stroke-width="3.5"/><circle cx="23" cy="7" r="5.5" fill="${RED}"/></svg>Media semanal</span><span><svg width="42" height="6"><line x1="0" x2="42" y1="3" y2="3" stroke="#E51B23" stroke-width="2" stroke-dasharray="8 6"/></svg>Objetivo de marca (${fmt2(m.objective)})</span></div>
      <svg class="chart" width="775" height="220" viewBox="0 0 775 220" style="overflow:visible">${evolutionChart(m)}</svg>
      <div class="strip">
        <div><small>SEMANAS EN OBJETIVO</small><b style="color:${GREEN}">${m.weeksOnTarget} / ${totalWeeks}</b></div>
        <div><small>SEMANAS SIN ACTIVIDAD</small><b style="color:#FF6500">${m.weeksWithoutActivity} / ${totalWeeks}</b></div>
        <div><small>SEMANAS BAJO OBJETIVO</small><b style="color:${RED}">${m.weeksBelowTarget} / ${totalWeeks}</b></div>
      </div>
    </div>

    <footer class="footer">
      <div class="f-logo">${nexoLogo(58, 256)}</div>
      <div class="f-sep" style="left:420px"></div>
      <div class="f-claim">${targetArrow("#fff", 62)}<p>Convertimos <em style="color:#FFB400">reseñas</em> en <em style="color:#FF6500">crecimiento.</em></p></div>
      <div class="f-sep" style="left:1306px"></div>
      <div class="f-date">${calendarCheck("#fff", 60)}<div><small>Informe generado el</small><b>${esc(m.generatedDate)}</b></div></div>
    </footer>
  </div></body></html>`;
}
