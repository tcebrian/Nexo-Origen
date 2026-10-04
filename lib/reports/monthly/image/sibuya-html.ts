import "server-only";

import type { MonthlyImageModel, MonthlyImageWeek } from "./model";
import { calendarCheck, dataUri, esc, fmt2, nexoLogoHtml, pct1, ratingStars, star, MONTHLY_IMAGE_HEIGHT, MONTHLY_IMAGE_WIDTH } from "./shared";

/**
 * Plantilla dedicada de Sibuya (1920×1080), sin fotografía en la cabecera.
 * Diseño fijo: solo cambian los datos del modelo. Cada bloque es una función
 * independiente para retocar una sección sin tocar el resto.
 *
 * Reglas de Sibuya: positivas = 4–5★, neutras = 3★ (no cuentan como incidencia),
 * incidencias negativas = 1–2★.
 */

const RED = "#D0020B";
const RED_LIGHT = "#F13C43";
const GREEN = "#087D43";
const INK = "#090909";
const BORDER = "#DDDDDA";
const BG = "#FCFCFB";
const FOOTER = "#050505";
const REASON_COLORS = [RED, RED_LIGHT, "#8A1015"];

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/* ---------- iconos (SVG) ---------- */

function statusShield(critical: boolean): string {
  const mark = critical
    ? `<path d="M38 28v24" stroke="${RED}" stroke-width="5.5" stroke-linecap="round"/><circle cx="38" cy="62" r="3.6" fill="${RED}"/>`
    : `<path d="M23 44l10 10 20-22" stroke="${RED}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  return `<svg width="80" height="94" viewBox="0 0 76 88" fill="none"><path d="M38 4L8 16v24c0 22 13 38 30 44 17-6 30-22 30-44V16L38 4z" stroke="${RED}" stroke-width="4" stroke-linejoin="round" fill="#fff"/>${mark}</svg>`;
}

function reviewBubbles(): string {
  return `<svg width="186" height="124" viewBox="0 0 190 124"><path d="M112 20h46a22 22 0 0 1 22 22v28a22 22 0 0 1-22 22h-4l2 18-20-18h-24a22 22 0 0 1-22-22V42a22 22 0 0 1 22-22z" fill="#DADADA"/><path d="M32 8h62a28 28 0 0 1 28 28v28a28 28 0 0 1-28 28H62L36 116l4-24h-8A28 28 0 0 1 4 64V36A28 28 0 0 1 32 8z" fill="${RED}"/><g fill="#fff"><circle cx="35" cy="50" r="8"/><circle cx="63" cy="50" r="8"/><circle cx="91" cy="50" r="8"/></g></svg>`;
}

/** Círculo (ensō) del pie: anillo blanco abierto con un tramo rojo. */
const ensoIcon = (size: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 80 80" fill="none" stroke-linecap="round"><circle cx="40" cy="40" r="30" stroke="#fff" stroke-width="9" stroke-dasharray="140 50" transform="rotate(-70 40 40)"/><circle cx="40" cy="40" r="30" stroke="${RED}" stroke-width="9" stroke-dasharray="48 141" transform="rotate(95 40 40)"/></svg>`;

const sushiBowl = (size: number) =>
  `<svg width="${size}" height="${size * 0.84}" viewBox="0 0 100 84" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 44h80c0 20-14 34-40 34S10 64 10 44z"/><path d="M32 44c0-8 8-12 18-12s18 4 18 12"/><path d="M42 36c2-4 6-4 8 0M56 38c2-4 6-4 8 0"/><path d="M58 28L92 6M66 30L98 12"/></svg>`;

/* ---------- lógica de presentación ---------- */

/** Tercera viñeta del resumen: siempre derivada de los datos, nunca fija. */
function trendLine(m: MonthlyImageModel): string {
  const active = m.weeks.filter((w) => w.average !== null);
  if (!active.length) return "";
  if (m.weeksOnTarget === active.length) return "Todas las semanas con actividad, en objetivo.";
  if (m.weeksOnTarget === 0) return "Ninguna semana alcanza el objetivo.";
  const weeks = m.weeks;
  let start = weeks.length;
  while (start > 0 && weeks[start - 1].onTarget === true) start -= 1;
  const streak = weeks.length - start;
  const earlierBelow = weeks.slice(0, start).some((w) => w.onTarget === false);
  if (streak >= 2 && start > 0 && earlierBelow) return `Mejora clara desde la semana ${weeks[start].index}.`;
  return `${m.weeksOnTarget} de ${weeks.length} semanas en objetivo.`;
}

/* ---------- bloques ---------- */

const center = (top: number, html: string, extra = "") => `<div class="mid" style="top:${top}px;${extra}">${html}</div>`;

function header(m: MonthlyImageModel, logo: string, nexo: string): string {
  const shortDate = m.generatedDate.replace(/ de /g, " ").toUpperCase();
  const showCity = m.city && m.city !== m.locality;
  const nameSize = Math.max(14, Math.min(21, Math.floor(255 / (m.restaurantTitle.length * 0.5))));
  const citySize = Math.max(14, Math.min(21, Math.floor(175 / (Math.max(1, m.city.length) * 0.5))));
  return `
    <img class="abs" src="${logo}" alt="Sibuya" style="left:29px;top:22px;width:270px;height:114px;object-fit:contain"/>
    <div class="abs" style="left:328px;top:19px;width:1px;height:115px;background:#A8A8A8"></div>
    <div class="abs" style="left:359px;top:16px;white-space:nowrap">
      <h1 style="font-size:56px;line-height:1;font-weight:700;letter-spacing:-1px;color:${INK}">INFORME MENSUAL</h1>
      <h2 style="margin-top:4px;font-size:34px;line-height:1;font-weight:700;color:${RED}">REPUTACIÓN ONLINE</h2>
    </div>
    <div class="abs meta" style="left:361px;top:118px">
      <b style="font-size:${nameSize}px;width:262px">${esc(m.restaurantTitle)}</b>
      ${showCity ? `<i></i><b style="font-size:${citySize}px;width:178px">${esc(m.city)}</b>` : ""}<i></i>
      <b style="color:${RED};font-size:21px">${esc(m.monthName)} ${m.year}</b>
    </div>
    <div class="abs" style="left:960px;top:16px;width:440px;height:112px;display:flex;align-items:center;justify-content:center">${nexo}</div>
    <div class="abs" style="left:1462px;top:19px;width:1px;height:115px;background:#A8A8A8"></div>
    <div class="abs" style="left:1508px;top:38px">${calendarCheck(RED, 66, 3.4)}</div>
    <div class="abs" style="left:1596px;top:42px;white-space:nowrap">
      <small style="display:block;font-size:19px;line-height:1;font-weight:700;color:#111">FECHA DEL INFORME</small>
      <b style="display:block;margin-top:10px;font-size:23px;line-height:1;font-weight:700;color:${RED}">${esc(shortDate)}</b>
    </div>`;
}

function averageCard(m: MonthlyImageModel): string {
  const progress = m.average === null ? 0 : Math.min(100, (m.average / 5) * 100);
  return `<section class="card" style="left:26px;width:364px">
    ${center(30, '<span class="title">MEDIA MENSUAL</span>')}
    ${center(125, `<span class="kpi" style="color:${RED}">${m.average === null ? "—" : fmt2(m.average)}</span>`)}
    ${center(221, `<span class="row" style="gap:11px">${ratingStars(m.average, RED, "#D3D3D1", 52)}</span>`)}
    ${center(288, '<span style="font-size:25px;font-weight:400;color:#111">Sobre 5.0</span>')}
    <div class="abs" style="left:58px;top:351px;width:247px;height:6px;border-radius:99px;background:#D9D9D7;overflow:hidden"><i style="display:block;height:100%;width:${progress}%;background:${RED};border-radius:99px"></i></div>
  </section>`;
}

function totalCard(m: MonthlyImageModel): string {
  return `<section class="card" style="left:407px;width:310px">
    ${center(30, '<span class="title">TOTAL RESEÑAS</span>')}
    ${center(125, `<span class="kpi" style="color:#000">${m.total}</span>`)}
    ${center(207, `<span style="font-size:22px;font-weight:400;color:#111">en el mes de ${esc(m.monthLower)}</span>`)}
    <div class="abs" style="left:0;right:0;top:233px;display:flex;justify-content:center">${reviewBubbles()}</div>
    ${center(365, `<span style="font-size:15.5px;font-weight:400;color:#77716E">${m.positive} ${plural(m.positive, "positiva", "positivas")} · ${m.critical} ${plural(m.critical, "incidencia", "incidencias")}</span>`)}
  </section>`;
}

function reasonsBlock(m: MonthlyImageModel): string {
  const R = 50;
  const C = 2 * Math.PI * R;
  const classified = m.classifiedIncidents;
  let offset = 0;
  const arcs = classified
    ? m.causalReasons.map((r, i) => {
        const length = (r.count / classified) * C;
        const arc = `<circle cx="64" cy="64" r="${R}" fill="none" stroke="${REASON_COLORS[i]}" stroke-width="24" stroke-dasharray="${Math.max(length - (m.causalReasons.length > 1 ? 1.5 : 0), 0)} ${C}" stroke-dashoffset="${-offset}" transform="rotate(-90 64 64)"/>`;
        offset += length;
        return arc;
      }).join("")
    : `<circle cx="64" cy="64" r="${R}" fill="none" stroke="#F0EFED" stroke-width="24"/>`;
  const legend = classified
    ? m.causalReasons.map((r, i) => `<li><i style="background:${REASON_COLORS[i]}"></i><span>${esc(r.name)}</span><b>${r.percent.toFixed(1)}%</b></li>`).join("")
    : `<li class="none"><span>${m.critical ? "Sin causa clasificada" : "Sin reseñas negativas este mes"}</span></li>`;
  const note = m.unclassifiedCritical > 0
    ? `<p style="margin-top:6px;padding-left:29px;font-size:13.5px;line-height:1;color:#77716E">${m.unclassifiedCritical} ${plural(m.unclassifiedCritical, "valoración sin detalle no incluida", "valoraciones sin detalle no incluidas")} en los porcentajes.</p>`
    : "";
  return `
    <div class="abs" style="left:17px;top:190px;width:535px;height:1px;background:#E0E0DE"></div>
    <div class="abs" style="left:17px;top:206px;font-size:21px;line-height:1;font-weight:700;color:#111">MOTIVOS DE RESEÑAS NEGATIVAS</div>
    <div class="abs" style="left:27px;top:247px;width:128px;height:128px">
      <svg width="128" height="128" viewBox="0 0 128 128">${arcs}</svg>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
        <b style="font-size:34px;line-height:1;font-weight:700;color:#111">${m.critical}</b>
        <small style="margin-top:4px;font-size:10.5px;line-height:1.15;font-weight:700;text-align:center;color:#222">${plural(m.critical, "INCIDENCIA", "INCIDENCIAS")}<br/><span style="font-weight:400;font-size:10px">EN TOTAL</span></small>
      </div>
    </div>
    <div class="abs" style="left:190px;top:232px;width:350px"><ul class="legend">${legend}</ul>${note}</div>`;
}

function summaryCard(m: MonthlyImageModel): string {
  const title = m.status === "positive" ? "Mes por encima del objetivo."
    : m.status === "watch" ? "Mes ligeramente por debajo del objetivo."
    : m.status === "critical" ? "Mes por debajo del objetivo, requiere atención." : "Sin actividad durante el periodo.";
  const color = m.status === "positive" ? GREEN : m.status === "critical" ? RED : "#111";
  const trend = trendLine(m);
  const bullets = m.status === "empty"
    ? ""
    : `<li>${m.positivePct.toFixed(1)}% de valoraciones de 4 y 5 <span style="font-size:15px">★</span>.</li>
       <li>${m.critical} ${plural(m.critical, "incidencia negativa detectada", "incidencias negativas detectadas")}.</li>
       ${trend ? `<li>${esc(trend)}</li>` : ""}`;
  const titleSize = Math.max(14, Math.min(20, Math.floor(400 / (title.length * 0.42))));
  return `<section class="card" style="left:734px;width:568px">
    ${center(30, '<span class="title">RESUMEN DEL MES</span>')}
    <div class="abs" style="left:28px;top:46px">${statusShield(m.status === "critical")}</div>
    <p class="abs" style="left:132px;top:49px;font-size:${titleSize}px;line-height:24px;font-weight:700;color:${color};white-space:nowrap">${esc(title)}</p>
    <ul class="bullets abs" style="left:132px;top:80px">${bullets}</ul>
    ${reasonsBlock(m)}
  </section>`;
}

function distributionCard(m: MonthlyImageModel): string {
  const BAR = 322;
  const rows = m.ratings.map((count, i) => {
    const width = count > 0 ? Math.max(12, (count / m.total) * BAR) : 0;
    return `<div class="drow" style="top:${79 + i * 53}px"><span class="dn">${5 - i}</span><span class="dstar">${star(21, RED)}</span>
      <em><i style="width:${width}px"></i></em><b>${count} (${pct1(count, m.total)})</b></div>`;
  }).join("");
  return `<section class="card" style="left:1319px;width:574px">
    ${center(30, '<span class="title">DISTRIBUCIÓN GENERAL</span>')}
    ${rows}
    <div class="abs" style="left:23px;top:339px;font-size:26px;line-height:1;font-weight:700;color:#111">Total: ${m.total} reseñas</div>
  </section>`;
}

function weekColumn(week: MonthlyImageWeek, m: MonthlyImageModel): string {
  const max = Math.max(1, ...week.ratings);
  const rows = week.ratings.map((count, i) =>
    `<div class="wrow"><span>${5 - i}</span>${star(14, RED)}<em><i style="width:${count > 0 ? Math.max(10, (count / max) * 100) : 0}%"></i></em><b>${count}</b></div>`).join("");
  const value = week.average === null
    ? `<small class="idle">SIN ACTIVIDAD</small><strong style="color:#B9B4AF">—</strong>`
    : `<small>MEDIA SEMANAL</small><strong style="color:${week.average >= m.objective ? GREEN : RED}">${fmt2(week.average)}</strong>`;
  return `<div class="week"><span class="pill">SEMANA ${week.index}</span><p class="range">${esc(week.label.replace(" – ", " - "))}</p><div class="wrows">${rows}</div><div class="wavg">${value}</div></div>`;
}

function evolutionPanel(m: MonthlyImageModel): string {
  const left = 52, right = 846, top = 29, bottom = 194;
  const scale = (bottom - top) / 5;
  const y = (v: number) => bottom - v * scale;
  const n = m.weeks.length;
  const x = (i: number) => (n === 1 ? 449 : 112 + (i * 674) / (n - 1));
  const grid = [0, 1, 2, 3, 4, 5].map((v) =>
    `<line x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}" stroke="#E4E4E2" stroke-width="1.2"/><text x="${left - 14}" y="${y(v) + 5}" text-anchor="end" class="axis">${v}</text>`).join("");
  const labels = m.weeks.map((week, i) => {
    const [from, rest] = week.label.split(" – ");
    const [to, month] = rest.split(" ");
    return `<text x="${x(i)}" y="219" text-anchor="middle" class="axis x">${from}-${to} ${month.slice(0, 3)}</text>`;
  }).join("");
  const segments: string[][] = [[]];
  m.weeks.forEach((week, i) => {
    if (week.average === null) { if (segments[segments.length - 1].length) segments.push([]); return; }
    segments[segments.length - 1].push(`${x(i)},${y(week.average)}`);
  });
  const lines = segments.filter((s) => s.length > 1).map((s) =>
    `<polyline points="${s.join(" ")}" fill="none" stroke="${RED}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`).join("");
  const points = m.weeks.map((week, i) => week.average === null
    ? `<text x="${x(i)}" y="${y(2.9)}" text-anchor="middle" class="idle-label">SIN ACTIVIDAD</text>`
    : `<circle cx="${x(i)}" cy="${y(week.average)}" r="6" fill="${RED}"/><text x="${x(i)}" y="${y(week.average) - 14}" text-anchor="middle" class="point">${fmt2(week.average)}</text>`).join("");
  const target = `<line x1="${left}" x2="${right}" y1="${y(m.objective)}" y2="${y(m.objective)}" stroke="#555" stroke-width="2" stroke-dasharray="10 8"/>`;
  return `<div class="evo"><svg width="871" height="308" viewBox="0 0 871 308" style="position:absolute;left:0;top:0">${grid}${target}${lines}${points}${labels}</svg>
    <div class="strip">
      <div><small>SEMANAS EN OBJETIVO</small><b style="color:${GREEN}">${m.weeksOnTarget} / ${m.weeks.length}</b></div>
      <div><small>SEMANAS SIN ACTIVIDAD</small><b style="color:${RED}">${m.weeksWithoutActivity} / ${m.weeks.length}</b></div>
      <div><small>SEMANAS BAJO OBJETIVO</small><b style="color:${RED}">${m.weeksBelowTarget} / ${m.weeks.length}</b></div>
    </div></div>`;
}

function legendRow(m: MonthlyImageModel): string {
  return `<div class="abs legendrow"><span><svg width="44" height="14"><line x1="0" x2="44" y1="7" y2="7" stroke="${RED}" stroke-width="3"/><circle cx="22" cy="7" r="5.5" fill="${RED}"/></svg>Media semanal</span>
    <span><svg width="40" height="6"><line x1="0" x2="40" y1="3" y2="3" stroke="#555" stroke-width="2.2" stroke-dasharray="8 6"/></svg>Objetivo de marca (${fmt2(m.objective)})</span></div>`;
}

function footer(m: MonthlyImageModel): string {
  return `<footer class="footer">
    <div class="abs" style="left:61px;top:16px">${ensoIcon(86)}</div>
    <p class="abs" style="left:172px;top:27px;font-size:26px;line-height:34px;font-weight:700;color:#fff;letter-spacing:.2px">NUESTRO COMPROMISO,<br/><span style="color:${RED}">TU EXPERIENCIA.</span></p>
    <div class="abs" style="left:548px;top:20px;width:1px;height:76px;background:rgba(255,255,255,.4)"></div>
    <div class="abs" style="left:610px;top:30px">${sushiBowl(86)}</div>
    <p class="abs" style="left:753px;top:26px;font-size:26px;line-height:36px;color:#fff;white-space:nowrap">Cada reseña nos ayuda a mejorar.<br/><span style="font-weight:700">¡Gracias por ser parte de <span style="color:${RED}">Sibuya</span>!</span></p>
    <div class="abs" style="left:1222px;top:20px;width:1px;height:76px;background:rgba(255,255,255,.4)"></div>
    <div class="abs" style="left:1319px;top:26px">${calendarCheck(RED, 66, 3.4)}</div>
    <div class="abs" style="left:1430px;top:27px;white-space:nowrap"><small style="display:block;font-size:21px;line-height:1;font-weight:400;color:#fff">Informe generado el</small><b style="display:block;margin-top:12px;font-size:27px;line-height:1;font-weight:700;color:${RED}">${esc(m.generatedDate)}</b></div>
  </footer>`;
}

/* ---------- documento ---------- */

export async function buildSibuyaImageHtml(m: MonthlyImageModel): Promise<string> {
  const [condensed, logo, nexo] = await Promise.all([
    dataUri("fonts/roboto-condensed-variable.woff2"), dataUri("design/sibuya/sb-logo.png"), nexoLogoHtml(92, 232),
  ]);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>Informe mensual ${esc(m.restaurantTitle)}</title><style>
    @font-face{font-family:'Roboto Condensed';src:url('${condensed}') format('woff2');font-weight:100 900}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:${MONTHLY_IMAGE_WIDTH}px;height:${MONTHLY_IMAGE_HEIGHT}px;overflow:hidden;background:${BG}}
    .canvas{position:relative;width:${MONTHLY_IMAGE_WIDTH}px;height:${MONTHLY_IMAGE_HEIGHT}px;overflow:hidden;background:${BG};color:${INK};font-family:'Roboto Condensed','Barlow Condensed','Arial Narrow',sans-serif}
    .abs{position:absolute}
    .nexo{display:flex;align-items:center}.nexo img{display:block;object-fit:contain}
    .meta{display:flex;align-items:center;gap:0;white-space:nowrap}
    .meta b{display:block;font-weight:700;color:#111;overflow:hidden;text-overflow:ellipsis;letter-spacing:.2px;line-height:1.2}
    .meta i{display:block;width:1px;height:24px;background:#BDBDBB;margin:0 14px}
    .card{position:absolute;top:158px;height:387px;background:#fff;border:1px solid ${BORDER};border-radius:15px;box-shadow:0 2px 8px rgba(0,0,0,.035)}
    .mid{position:absolute;left:0;right:0;display:flex;justify-content:center;align-items:center;transform:translateY(-50%);line-height:1}
    .row{display:flex}
    .title{font-size:26px;font-weight:700;color:#111;letter-spacing:.2px}
    .kpi{font-size:104px;font-weight:700;letter-spacing:-1px}
    .bullets{list-style:none}
    .bullets li{position:relative;padding-left:13px;font-size:17.5px;line-height:31.5px;color:#111;white-space:nowrap}
    .bullets li::before{content:"";position:absolute;left:1px;top:14px;width:4.5px;height:4.5px;border-radius:50%;background:#111}
    .legend{list-style:none}
    .legend li{display:flex;align-items:center;gap:12px;height:35px;font-size:17.5px;font-weight:700;color:#111}
    .legend li i{width:17px;height:17px;border-radius:50%;flex:none}
    .legend li span{flex:1;min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.15}
    .legend li b{font-size:17px;flex:none}
    .legend li.none{color:#77716E;font-weight:400}
    .drow{position:absolute;left:33px;right:30px;height:30px;display:flex;align-items:center;transform:translateY(-50%)}
    .dn{width:22px;font-size:22px;font-weight:700}
    .dstar{width:32px;display:flex;justify-content:center}
    .drow em{width:322px;height:17px;border-radius:99px;background:#E9E9E7;overflow:hidden;margin-left:8px}
    .drow em i{display:block;height:100%;border-radius:99px;background:${RED}}
    .drow b{margin-left:28px;font-size:22px;font-weight:500;white-space:nowrap;color:#111}
    .sec{position:absolute;display:flex;align-items:center;gap:14px;height:30px;top:562px}
    .sec h3{font-size:25px;line-height:1;font-weight:700;color:#111;white-space:nowrap;letter-spacing:.2px}
    .sec i{flex:1;height:1.3px;background:#B9B9B7}
    .legendrow{left:1490px;top:567px;width:400px;display:flex;justify-content:space-between;font-size:15px;color:#222}
    .legendrow span{display:flex;align-items:center;gap:9px;white-space:nowrap}
    .weeks{position:absolute;left:26px;top:602px;width:978px;height:308px;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;background:#fff;border:1px solid ${BORDER};border-radius:15px}
    .week{position:relative;text-align:center;border-left:1px solid #E4E4E2}
    .week:first-child{border-left:0}
    .pill{display:block;margin:12px auto 0;width:min(130px,78%);height:27px;line-height:27px;background:${RED};color:#fff;border-radius:6px;font-size:16px;font-weight:700;letter-spacing:.3px}
    .range{margin-top:12px;font-size:15px;line-height:1;font-weight:700;color:#111;white-space:nowrap}
    .wrows{position:absolute;left:24px;right:24px;top:74px}
    .wrow{display:flex;align-items:center;gap:7px;height:27.7px}
    .wrow>span{width:12px;font-size:14.5px;font-weight:700;text-align:right}
    .wrow em{flex:1;height:10px;border-radius:99px;background:#E9E9E7;overflow:hidden;min-width:0}
    .wrow em i{display:block;height:100%;border-radius:99px;background:${RED}}
    .wrow b{min-width:12px;text-align:right;font-size:15px;font-weight:500}
    .wavg{position:absolute;left:22px;right:22px;top:227px;border-top:1px solid #E0E0DE;padding-top:12px;white-space:nowrap}
    .wavg small{display:block;font-size:14px;line-height:1;font-weight:700;color:#111}
    .wavg small.idle{color:#8A8580}
    .wavg strong{display:block;margin-top:7px;font-size:38px;line-height:1.05;font-weight:700}
    .evo{position:absolute;left:1021px;top:602px;width:871px;height:308px;background:#fff;border:1px solid ${BORDER};border-radius:15px;overflow:hidden}
    .axis{font:400 13.5px 'Roboto Condensed',sans-serif;fill:#333}.axis.x{font-size:13.5px;font-weight:700;fill:#111}
    .point{font:700 17.5px 'Roboto Condensed',sans-serif;fill:#111;paint-order:stroke;stroke:#fff;stroke-width:4px;stroke-linejoin:round}
    .idle-label{font:700 13px 'Roboto Condensed',sans-serif;fill:#8A8580;letter-spacing:.3px}
    .strip{position:absolute;left:18px;right:14px;top:239px;height:61px;background:#F6F6F5;border-radius:11px;display:grid;grid-template-columns:1fr 1fr 1fr}
    .strip>div{display:flex;flex-direction:column;align-items:center;justify-content:center;border-left:1px solid #E0E0DE;margin:9px 0}
    .strip>div:first-child{border-left:0}
    .strip small{font-size:13px;line-height:1;font-weight:700;color:#111;letter-spacing:.2px}
    .strip b{margin-top:5px;font-size:26px;line-height:1;font-weight:700}
    .footer{position:absolute;left:25px;top:927px;width:1868px;height:117px;background:${FOOTER};border-radius:16px}
  </style></head><body><div class="canvas" data-report="monthly-image-sb">
    ${header(m, logo, nexo)}
    ${averageCard(m)}${totalCard(m)}${summaryCard(m)}${distributionCard(m)}
    <div class="sec" style="left:35px;width:969px"><h3>DESGLOSE SEMANAL</h3><i></i></div>
    <div class="weeks">${m.weeks.map((week) => weekColumn(week, m)).join("")}</div>
    <div class="sec" style="left:1052px;width:380px"><h3>EVOLUCIÓN DE LA MEDIA SEMANAL</h3></div>
    ${legendRow(m)}
    ${evolutionPanel(m)}
    ${footer(m)}
  </div></body></html>`;
}
