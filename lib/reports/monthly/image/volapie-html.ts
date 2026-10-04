import "server-only";

import type { MonthlyImageModel, MonthlyImageWeek } from "./model";
import { calendarCheck, dataUri, esc, nexoLogoHtml, ratingStars, star, MONTHLY_IMAGE_HEIGHT, MONTHLY_IMAGE_WIDTH } from "./shared";

/**
 * Plantilla dedicada de Taberna Volapié (1920×1080), sin ilustración en la
 * cabecera. Diseño fijo: solo cambian los datos del modelo. Cada bloque es una
 * función independiente para retocar una sección sin tocar el resto.
 *
 * Reglas de Volapié: positivas = 4–5★, neutras = 3★ (no son incidencia),
 * incidencias negativas = 1–2★. Formato español (coma decimal).
 */

const GREEN = "#004739";
const GREEN_MID = "#08744F";
const FOOTER = "#00382E";
const GOLD = "#B77912";
const GOLD_LINE = "#C99752";
const GOLD_LIGHT = "#D3A65E";
const RED = "#C41018";
const BG = "#FFFAF2";
const CARD = "#FFFCF7";
const BORDER = "#DFCCB6";
/** Color por estrellas, de 5★ a 1★. */
const STAR_COLORS = [GREEN, GREEN_MID, "#B77912", "#E4481D", "#C30D18"];
const REASON_COLORS = [RED, "#E4481D", GOLD];
/** Por debajo (o igual) de este nº de reseñas la actividad se considera reducida. */
const LOW_VOLUME_THRESHOLD = 6;

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);
const es = (value: number, decimals: number) => value.toFixed(decimals).replace(".", ",");
const pctEs = (count: number, total: number) => `${es(total ? (count / total) * 100 : 0, 1)}%`;

/** "Gta. de Quevedo, 5" -> "QUEVEDO"; si no se reconoce una vía, la ciudad. */
function placeLabel(m: MonthlyImageModel): string {
  const match = m.address.match(/(?:gta\.?|glorieta|plaza|pza\.?|calle|c\/|avda\.?|avenida|paseo|pº|camino)\s+(?:de\s+(?:la\s+|los\s+|las\s+|el\s+)?|del\s+)?([^,\d]+)/i);
  const street = match?.[1]?.trim();
  return (street && street.length >= 3 ? street : m.city).toUpperCase();
}

/* ---------- iconos (SVG) ---------- */

const fleur = (size: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 40 40" fill="${GOLD}"><path d="M20 3c4 4 5 9 0 15-5-6-4-11 0-15z"/><path d="M12 10c-5 1-8 6-5 11 2 3 6 3 9 1-4-2-6-6-4-12z"/><path d="M28 10c5 1 8 6 5 11-2 3-6 3-9 1 4-2 6-6 4-12z"/><rect x="9" y="22" width="22" height="3.2" rx="1.6"/><path d="M20 26c2 3 2 6 0 11-2-5-2-8 0-11z"/></svg>`;

const heart = (size: number) =>
  `<svg width="${size}" height="${size * 0.84}" viewBox="0 0 24 21" fill="none" stroke="${GOLD_LIGHT}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d="M12 20.2 3.9 12.4A5.6 5.6 0 0 1 3.5 4.3a5.4 5.4 0 0 1 8.1.2l.4.5.4-.5a5.4 5.4 0 0 1 8.1-.2 5.6 5.6 0 0 1-.4 8.1z"/></svg>`;

const shieldCheck = () =>
  `<svg width="82" height="98" viewBox="0 0 76 88" fill="none"><path d="M38 4L8 16v24c0 22 13 38 30 44 17-6 30-22 30-44V16L38 4z" stroke="${GREEN}" stroke-width="4" stroke-linejoin="round" fill="#fff"/><path d="M23 44l10 10 20-22" stroke="${GREEN}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

function reviewBubbles(): string {
  return `<svg width="196" height="124" viewBox="0 0 190 124"><path d="M112 20h46a22 22 0 0 1 22 22v28a22 22 0 0 1-22 22h-4l2 18-20-18h-24a22 22 0 0 1-22-22V42a22 22 0 0 1 22-22z" fill="#D9D5CC"/><path d="M32 8h62a28 28 0 0 1 28 28v28a28 28 0 0 1-28 28H62L36 116l4-24h-8A28 28 0 0 1 4 64V36A28 28 0 0 1 32 8z" fill="${GREEN}"/><g fill="#fff"><circle cx="35" cy="50" r="8"/><circle cx="63" cy="50" r="8"/><circle cx="91" cy="50" r="8"/></g></svg>`;
}

/** Sello circular del pie: anillo dorado con la V y "DESDE 2008". */
const seal = (size: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 90 90"><circle cx="45" cy="45" r="42" fill="none" stroke="${GOLD_LINE}" stroke-width="2.4"/><circle cx="45" cy="45" r="36" fill="none" stroke="${GOLD_LINE}" stroke-width="1"/><text x="45" y="56" text-anchor="middle" font-family="'Playfair Display',Georgia,serif" font-size="40" font-weight="700" fill="${GOLD_LIGHT}">V</text><text x="45" y="71" text-anchor="middle" font-family="'Roboto Condensed',sans-serif" font-size="7.5" font-weight="700" letter-spacing="1.2" fill="${GOLD_LIGHT}">DESDE 2008</text></svg>`;

/* ---------- lógica de presentación ---------- */

function summaryStatus(m: MonthlyImageModel): { title: string; color: string } {
  if (m.status === "empty") return { title: "Sin actividad durante el periodo.", color: "#8A8580" };
  const low = m.total <= LOW_VOLUME_THRESHOLD;
  const above = m.average !== null && m.average >= m.objective;
  if (above) return low ? { title: "Resultado positivo, aunque con actividad reducida.", color: GREEN_MID } : { title: "Resultado por encima del objetivo.", color: GREEN_MID };
  return low ? { title: "Resultado bajo el objetivo, con actividad reducida.", color: RED } : { title: "Resultado por debajo del objetivo.", color: RED };
}

/** Tercera viñeta: derivada de los datos de motivos. */
function reasonBullet(m: MonthlyImageModel): string {
  if (m.critical === 0) return "Sin incidencias negativas en el mes.";
  if (m.classifiedIncidents === 0) return plural(m.critical, "La reseña crítica no detalla una causa.", "Las reseñas críticas no detallan una causa.");
  return `Principal causa: ${m.causalReasons[0].name.toLowerCase()}.`;
}

/* ---------- bloques ---------- */

const center = (top: number, html: string, extra = "") => `<div class="mid" style="top:${top}px;${extra}">${html}</div>`;

function header(m: MonthlyImageModel, logo: string, nexo: string): string {
  const place = placeLabel(m);
  const line = `TABERNA VOLAPIÉ · ${place}`;
  const lineSize = Math.max(16, Math.min(29, Math.floor(540 / (line.length * 0.66))));
  const dateSize = Math.max(22, Math.min(36, Math.floor(270 / ((m.monthName.length + 5) * 0.62))));
  return `
    <img class="abs" src="${logo}" alt="Taberna Volapié" style="left:40px;top:20px;width:372px;height:138px;object-fit:contain"/>
    <div class="abs" style="left:492px;top:25px;width:1px;height:130px;background:#CABDAE"></div>
    <div class="abs" style="left:545px;top:20px;white-space:nowrap">
      <h1 class="serif" style="font-size:51px;line-height:1;font-weight:700;color:#003F35;letter-spacing:.5px">INFORME MENSUAL</h1>
      <h2 style="margin-top:13px;font-size:36px;line-height:1;font-weight:700;color:${GOLD};letter-spacing:.3px">REPUTACIÓN ONLINE</h2>
      <h3 class="serif" style="margin-top:14px;font-size:${lineSize}px;line-height:1;font-weight:700;color:${GREEN};letter-spacing:.3px">${esc(line)}</h3>
    </div>
    <div class="abs" style="left:1075px;top:25px;width:390px;height:130px;display:flex;align-items:center;justify-content:center">${nexo}</div>
    <div class="abs" style="left:1482px;top:25px;width:1px;height:130px;background:#C9BDAF"></div>
    <div class="abs" style="left:1520px;top:36px">${calendarCheck(GREEN, 80, 3.4)}</div>
    <div class="abs" style="left:1620px;top:42px;white-space:nowrap">
      <small style="display:block;font-size:22px;line-height:1;font-weight:700;color:#202020;letter-spacing:.3px">FECHA DEL INFORME</small>
      <b class="serif" style="display:block;margin-top:14px;font-size:${dateSize}px;line-height:1;font-weight:700;color:${GREEN}">${esc(m.monthName)} ${m.year}</b>
    </div>
    <div class="abs" style="left:27px;top:179px;width:890px;height:2px;background:${GOLD_LINE}"></div>
    <div class="abs" style="left:930px;top:162px">${fleur(36)}</div>
    <div class="abs" style="left:990px;top:179px;width:903px;height:2px;background:${GOLD_LINE}"></div>`;
}

function averageCard(m: MonthlyImageModel): string {
  const progress = m.average === null ? 0 : Math.min(100, (m.average / 5) * 100);
  return `<section class="card" style="left:27px;width:403px">
    ${center(27, '<span class="title">MEDIA MENSUAL</span>')}
    ${center(117, `<span class="kpi">${m.average === null ? "—" : es(m.average, 2)}</span>`)}
    ${center(215, `<span class="row" style="gap:12px">${ratingStars(m.average, GREEN, "#D4D1CB", 56)}</span>`)}
    ${center(285, '<span style="font-size:25px;font-weight:400;color:#111">Sobre 5,0</span>')}
    <div class="abs" style="left:58px;top:339px;width:285px;height:6px;border-radius:99px;background:#DCD9D2;overflow:hidden"><i style="display:block;height:100%;width:${progress}%;background:${GREEN};border-radius:99px"></i></div>
  </section>`;
}

function totalCard(m: MonthlyImageModel): string {
  return `<section class="card" style="left:444px;width:340px">
    ${center(27, '<span class="title">TOTAL RESEÑAS</span>')}
    ${center(117, `<span class="kpi">${m.total}</span>`)}
    ${center(193, `<span style="font-size:24px;font-weight:400;color:#111">en el mes de ${esc(m.monthLower)}</span>`)}
    <div class="abs" style="left:0;right:0;top:232px;display:flex;justify-content:center">${reviewBubbles()}</div>
    ${center(368, `<span style="font-size:16px;font-weight:400;color:#76706A">${m.positive} ${plural(m.positive, "positiva", "positivas")} · ${m.critical} ${plural(m.critical, "incidencia", "incidencias")}</span>`)}
  </section>`;
}

function reasonsBlock(m: MonthlyImageModel): string {
  const R = 52;
  const C = 2 * Math.PI * R;
  const classified = m.classifiedIncidents;
  let offset = 0;
  const arcs = m.critical === 0
    ? `<circle cx="66" cy="66" r="${R}" fill="none" stroke="#F0ECE4" stroke-width="22"/>`
    : classified === 0
      ? `<circle cx="66" cy="66" r="${R}" fill="none" stroke="${RED}" stroke-width="22"/>`
      : m.causalReasons.map((r, i) => {
          const length = (r.count / classified) * C;
          const arc = `<circle cx="66" cy="66" r="${R}" fill="none" stroke="${REASON_COLORS[i]}" stroke-width="22" stroke-dasharray="${Math.max(length - (m.causalReasons.length > 1 ? 1.5 : 0), 0)} ${C}" stroke-dashoffset="${-offset}" transform="rotate(-90 66 66)"/>`;
          offset += length;
          return arc;
        }).join("");
  const unclassified = m.unclassifiedCritical;
  let legend: string;
  let note = "";
  if (m.critical === 0) {
    legend = `<li class="none"><span>Sin reseñas negativas este mes</span></li>`;
  } else if (classified === 0) {
    legend = `<li><i style="background:${RED}"></i><span>Sin causa operativa identificable</span></li>`;
    note = `<p class="desc">${plural(unclassified, "La reseña no detalla un motivo concreto.", "Las reseñas no detallan un motivo concreto.")}</p>`;
  } else {
    legend = m.causalReasons.map((r, i) => `<li><i style="background:${REASON_COLORS[i]}"></i><span>${esc(r.name)}</span><b>${es(r.percent, 1)}%</b></li>`).join("");
    if (unclassified > 0) note = `<p class="desc">${unclassified} ${plural(unclassified, "valoración sin detalle no incluida", "valoraciones sin detalle no incluidas")} en los porcentajes.</p>`;
  }
  return `
    <div class="abs" style="left:17px;top:212px;width:483px;height:1px;background:#DFCCB6"></div>
    <div class="abs" style="left:18px;top:230px;font-size:21px;line-height:1;font-weight:700;color:#111">MOTIVOS DE RESEÑAS NEGATIVAS</div>
    <div class="abs" style="left:16px;top:247px;width:132px;height:132px">
      <svg width="132" height="132" viewBox="0 0 132 132">${arcs}</svg>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
        <b class="serif" style="font-size:34px;line-height:1;font-weight:700;color:${GREEN}">${m.critical}</b>
        <small style="margin-top:4px;font-size:10.5px;line-height:1.15;font-weight:700;text-align:center;color:#222">${plural(m.critical, "INCIDENCIA", "INCIDENCIAS")}<br/><span style="font-weight:400;font-size:10px">EN TOTAL</span></small>
      </div>
    </div>
    <div class="abs" style="left:180px;top:268px;width:318px"><ul class="legend">${legend}</ul>${note}</div>`;
}

function summaryCard(m: MonthlyImageModel): string {
  const { title, color } = summaryStatus(m);
  const titleSize = Math.max(14, Math.min(20, Math.floor(370 / (title.length * 0.42))));
  const bullets = m.status === "empty"
    ? ""
    : `<li>${es(m.positivePct, 1)}% de valoraciones de 4 y 5 <span style="font-size:15px">★</span>.</li>
       <li>${m.critical} ${plural(m.critical, "incidencia negativa detectada", "incidencias negativas detectadas")}.</li>
       <li>${esc(reasonBullet(m))}</li>`;
  return `<section class="card" style="left:799px;width:519px">
    ${center(27, '<span class="title">RESUMEN DEL MES</span>')}
    <div class="abs" style="left:29px;top:50px">${shieldCheck()}</div>
    <p class="abs" style="left:140px;top:51px;font-size:${titleSize}px;line-height:24px;font-weight:700;color:${color};white-space:nowrap">${esc(title)}</p>
    <ul class="bullets abs" style="left:140px;top:80px">${bullets}</ul>
    ${reasonsBlock(m)}
  </section>`;
}

function distributionCard(m: MonthlyImageModel): string {
  const BAR = 290;
  const rows = m.ratings.map((count, i) => {
    const width = count > 0 ? Math.max(12, (count / m.total) * BAR) : 0;
    return `<div class="drow" style="top:${83 + i * 52}px"><span class="dn">${5 - i}</span><span class="dstar">${star(21, STAR_COLORS[i])}</span>
      <em><i style="width:${width}px;background:${STAR_COLORS[i]}"></i></em><b>${count} (${pctEs(count, m.total)})</b></div>`;
  }).join("");
  return `<section class="card" style="left:1333px;width:560px">
    ${center(27, '<span class="title">DISTRIBUCIÓN GENERAL</span>')}
    ${rows}
    <div class="abs" style="left:31px;top:340px;font-size:27px;line-height:1;font-weight:700;color:#111">Total: ${m.total} reseñas</div>
  </section>`;
}

function weekColumn(week: MonthlyImageWeek, m: MonthlyImageModel): string {
  const max = Math.max(1, ...week.ratings);
  const rows = week.ratings.map((count, i) =>
    `<div class="wrow"><span>${5 - i}</span>${star(14, STAR_COLORS[i])}<em><i style="width:${count > 0 ? Math.max(10, (count / max) * 100) : 0}%;background:${STAR_COLORS[i]}"></i></em><b>${count}</b></div>`).join("");
  const value = week.average === null
    ? `<small>MEDIA SEMANAL</small><strong class="serif" style="color:#8B8883">—</strong>`
    : `<small>MEDIA SEMANAL</small><strong class="serif" style="color:${week.average >= m.objective ? GREEN : RED}">${es(week.average, 2)}</strong>`;
  return `<div class="week"><span class="pill">SEMANA ${week.index}</span><p class="range">${esc(week.label.replace(" – ", " - "))}</p><div class="wrows">${rows}</div><div class="wavg">${value}</div></div>`;
}

function evolutionPanel(m: MonthlyImageModel): string {
  const left = 46, right = 780, top = 54, bottom = 203;
  const scale = (bottom - top) / 5;
  const y = (v: number) => bottom - v * scale;
  const n = m.weeks.length;
  const x = (i: number) => (n === 1 ? 410 : 82 + (i * 656) / (n - 1));
  const grid = [0, 1, 2, 3, 4, 5].map((v) =>
    `<line x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}" stroke="#DFDBD4" stroke-width="1.2"/><text x="${left - 14}" y="${y(v) + 5}" text-anchor="end" class="axis">${v}</text>`).join("");
  const labels = m.weeks.map((week, i) => {
    const [from, rest] = week.label.split(" – ");
    const [to, month] = rest.split(" ");
    return `<text x="${x(i)}" y="226" text-anchor="middle" class="axis x">${from}–${to} ${month.slice(0, 3)}</text>`;
  }).join("");
  const segments: string[][] = [[]];
  m.weeks.forEach((week, i) => {
    if (week.average === null) { if (segments[segments.length - 1].length) segments.push([]); return; }
    segments[segments.length - 1].push(`${x(i)},${y(week.average)}`);
  });
  const lines = segments.filter((s) => s.length > 1).map((s) =>
    `<polyline points="${s.join(" ")}" fill="none" stroke="${GREEN}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`).join("");
  const points = m.weeks.map((week, i) => week.average === null
    ? `<line x1="${x(i) - 14}" x2="${x(i) + 14}" y1="${y(0.55)}" y2="${y(0.55)}" stroke="#B9B4AF" stroke-width="2"/>`
    : `<circle cx="${x(i)}" cy="${y(week.average)}" r="6.5" fill="${GREEN}"/><text x="${x(i)}" y="${y(week.average) - 15}" text-anchor="middle" class="point">${es(week.average, 2)}</text>`).join("");
  const target = `<line x1="${left}" x2="${right}" y1="${y(m.objective)}" y2="${y(m.objective)}" stroke="${GOLD}" stroke-width="2" stroke-dasharray="10 8"/>`;
  const legend = `<g><line x1="322" x2="368" y1="22" y2="22" stroke="${GREEN}" stroke-width="3"/><circle cx="345" cy="22" r="5" fill="${GREEN}"/><text x="380" y="27" class="legend-text">Media semanal</text>
    <line x1="568" x2="614" y1="22" y2="22" stroke="${GOLD}" stroke-width="2.4" stroke-dasharray="8 6"/><text x="626" y="27" class="legend-text">Objetivo (${es(m.objective, 2)})</text></g>`;
  return `<div class="evo"><svg width="811" height="327" viewBox="0 0 811 327" style="position:absolute;left:0;top:0">${legend}${grid}${target}${lines}${points}${labels}</svg>
    <div class="strip">
      <div><small>SEMANAS EN OBJETIVO</small><b class="serif" style="color:${GREEN_MID}">${m.weeksOnTarget} / ${m.weeks.length}</b></div>
      <div><small>SEMANAS SIN ACTIVIDAD</small><b class="serif" style="color:${GREEN}">${m.weeksWithoutActivity} / ${m.weeks.length}</b></div>
      <div><small>SEMANAS BAJO OBJETIVO</small><b class="serif" style="color:${RED}">${m.weeksBelowTarget} / ${m.weeks.length}</b></div>
    </div></div>`;
}

function footer(m: MonthlyImageModel): string {
  return `<footer class="footer">
    <div class="abs" style="left:76px;top:8px">${seal(86)}</div>
    <p class="abs" style="left:197px;top:14px;font-size:21px;line-height:25px;font-weight:700;color:#F4EBDA;letter-spacing:.6px">PASIÓN POR<br/>NUESTROS CLIENTES,<br/>ORGULLO DE LO QUE HACEMOS.</p>
    <div class="abs" style="left:546px;top:16px;width:1.5px;height:68px;background:${GOLD_LINE}"></div>
    <div class="abs" style="left:620px;top:24px">${heart(62)}</div>
    <p class="abs" style="left:700px;top:16px;width:540px;text-align:center;white-space:nowrap;font-size:28px;line-height:36px;color:#F4EBDA">Cada reseña nos hace mejores.<br/>¡Gracias por ser parte de la familia Volapié!</p>
    <div class="abs" style="left:1300px;top:16px;width:1.5px;height:68px;background:${GOLD_LINE}"></div>
    <div class="abs" style="left:1388px;top:15px">${calendarCheck(GOLD_LIGHT, 66, 3.2)}</div>
    <div class="abs" style="left:1482px;top:17px;white-space:nowrap"><small style="display:block;font-size:19px;line-height:1;font-weight:400;color:${GOLD_LIGHT}">Informe generado el</small><b class="serif" style="display:block;margin-top:11px;font-size:27px;line-height:1;font-weight:700;color:${GOLD_LIGHT}">${esc(m.generatedDate)}</b></div>
  </footer>`;
}

/* ---------- documento ---------- */

export async function buildVolapieImageHtml(m: MonthlyImageModel): Promise<string> {
  const [condensed, playfair700, playfair800, logo, nexo] = await Promise.all([
    dataUri("fonts/roboto-condensed-variable.woff2"), dataUri("fonts/playfair-display-700-normal.woff2"),
    dataUri("fonts/playfair-display-800-normal.woff2"), dataUri("design/taberna-volapie/tv-logo.png"), nexoLogoHtml(100, 250),
  ]);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>Informe mensual ${esc(m.restaurantTitle)}</title><style>
    @font-face{font-family:'Roboto Condensed';src:url('${condensed}') format('woff2');font-weight:100 900}
    @font-face{font-family:'Playfair Display';src:url('${playfair700}') format('woff2');font-weight:700}
    @font-face{font-family:'Playfair Display';src:url('${playfair800}') format('woff2');font-weight:800}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:${MONTHLY_IMAGE_WIDTH}px;height:${MONTHLY_IMAGE_HEIGHT}px;overflow:hidden;background:${BG}}
    .canvas{position:relative;width:${MONTHLY_IMAGE_WIDTH}px;height:${MONTHLY_IMAGE_HEIGHT}px;overflow:hidden;background:${BG};color:#111;font-family:'Roboto Condensed','Barlow Condensed','Arial Narrow',sans-serif}
    .serif{font-family:'Playfair Display',Georgia,serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1}
    .abs{position:absolute}
    .nexo{display:flex;align-items:center}.nexo img{display:block;object-fit:contain}
    .card{position:absolute;top:200px;height:394px;background:${CARD};border:1px solid ${BORDER};border-radius:15px;box-shadow:0 2px 8px rgba(60,40,20,.02)}
    .mid{position:absolute;left:0;right:0;display:flex;justify-content:center;align-items:center;transform:translateY(-50%);line-height:1}
    .row{display:flex}
    .title{font-size:26px;font-weight:700;color:#111;letter-spacing:.2px}
    .kpi{font-family:'Playfair Display',Georgia,serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:100px;font-weight:700;color:${GREEN}}
    .bullets{list-style:none}
    .bullets li{position:relative;padding-left:13px;font-size:17.5px;line-height:30px;color:#111;white-space:nowrap}
    .bullets li::before{content:"";position:absolute;left:1px;top:13px;width:4.5px;height:4.5px;border-radius:50%;background:#111}
    .legend{list-style:none}
    .legend li{display:flex;align-items:center;gap:12px;min-height:34px;font-size:18px;font-weight:700;color:#111}
    .legend li i{width:17px;height:17px;border-radius:50%;flex:none}
    .legend li span{flex:1;min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.15}
    .legend li b{font-size:17px;flex:none}
    .legend li.none{color:#76706A;font-weight:400}
    .desc{margin-top:6px;padding-left:29px;font-size:15.5px;line-height:26px;color:#76706A;font-weight:400}
    .drow{position:absolute;left:36px;right:30px;height:30px;display:flex;align-items:center;transform:translateY(-50%)}
    .dn{width:22px;font-size:22px;font-weight:700}
    .dstar{width:34px;display:flex;justify-content:center}
    .drow em{width:290px;height:17px;border-radius:99px;background:#E9E6DF;overflow:hidden;margin-left:12px}
    .drow em i{display:block;height:100%;border-radius:99px}
    .drow b{margin-left:22px;font-size:22px;font-weight:700;white-space:nowrap;color:#111}
    .sec{position:absolute;display:flex;align-items:center;gap:8px;height:30px;top:606px}
    .sec h3{font-size:26px;line-height:1;font-weight:700;color:${GREEN};white-space:nowrap;letter-spacing:.2px}
    .sec i{flex:1;height:1.5px;background:${GOLD_LINE}}
    .weeks{position:absolute;left:27px;top:639px;width:1041px;height:327px;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;background:${CARD};border:1px solid ${BORDER};border-radius:15px}
    .week{position:relative;text-align:center;border-left:1px solid ${BORDER}}
    .week:first-child{border-left:0}
    .pill{display:block;margin:19px auto 0;width:min(148px,78%);height:28px;line-height:28px;background:${GREEN};color:#fff;border-radius:6px;font-size:16.5px;font-weight:700;letter-spacing:.3px}
    .range{margin-top:13px;font-size:15.5px;line-height:1;font-weight:700;color:#111;white-space:nowrap}
    .wrows{position:absolute;left:30px;right:30px;top:84px}
    .wrow{display:flex;align-items:center;gap:7px;height:28px}
    .wrow>span{width:12px;font-size:14.5px;font-weight:700;text-align:right}
    .wrow em{flex:1;height:10px;border-radius:99px;background:#E9E6DF;overflow:hidden;min-width:0}
    .wrow em i{display:block;height:100%;border-radius:99px}
    .wrow b{min-width:12px;text-align:right;font-size:15px;font-weight:500}
    .wavg{position:absolute;left:24px;right:24px;top:239px;border-top:1px solid #E5D8C6;padding-top:13px;white-space:nowrap}
    .wavg small{display:block;font-size:14.5px;line-height:1;font-weight:700;color:#111}
    .wavg strong{display:block;margin-top:8px;font-size:38px;line-height:1.05;font-weight:700}
    .evo{position:absolute;left:1082px;top:639px;width:811px;height:327px;background:${CARD};border:1px solid ${BORDER};border-radius:15px;overflow:hidden}
    .axis{font:400 13.5px 'Roboto Condensed',sans-serif;fill:#3A332D}.axis.x{font-size:13.5px;font-weight:700;fill:#111}
    .point{font:700 17px 'Roboto Condensed',sans-serif;fill:#111;paint-order:stroke;stroke:${CARD};stroke-width:4px;stroke-linejoin:round}
    .legend-text{font:400 15px 'Roboto Condensed',sans-serif;fill:#222}
    .strip{position:absolute;left:18px;right:18px;top:254px;height:61px;background:#F4F1EA;border-radius:11px;display:grid;grid-template-columns:1fr 1fr 1fr}
    .strip>div{display:flex;flex-direction:column;align-items:center;justify-content:center;border-left:1px solid #E3DACB;margin:9px 0}
    .strip>div:first-child{border-left:0}
    .strip small{font-size:13px;line-height:1;font-weight:700;color:#111;letter-spacing:.2px}
    .strip b{margin-top:5px;font-size:25px;line-height:1;font-weight:700}
    .footer{position:absolute;left:0;top:978px;width:${MONTHLY_IMAGE_WIDTH}px;height:102px;background:${FOOTER}}
  </style></head><body><div class="canvas" data-report="monthly-image-tv">
    ${header(m, logo, nexo)}
    ${averageCard(m)}${totalCard(m)}${summaryCard(m)}${distributionCard(m)}
    <div class="sec" style="left:54px;width:1014px"><h3>DESGLOSE SEMANAL</h3><i></i></div>
    <div class="weeks">${m.weeks.map((week) => weekColumn(week, m)).join("")}</div>
    <div class="sec" style="left:1188px;width:705px"><h3>EVOLUCIÓN DE LA MEDIA SEMANAL</h3><i></i></div>
    ${evolutionPanel(m)}
    ${footer(m)}
  </div></body></html>`;
}
