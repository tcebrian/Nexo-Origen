import "server-only";

import type { MonthlyImageModel, MonthlyImageWeek } from "./model";
import { calendarCheck, dataUri, esc, fmt2, nexoLogoHtml, pct1, ratingStars, star, MONTHLY_IMAGE_HEIGHT, MONTHLY_IMAGE_WIDTH } from "./shared";

/**
 * Plantilla dedicada de Popeyes (1920×1080). Diseño fijo: solo cambian los datos
 * del modelo. Cada bloque es una función independiente (cabecera, KPIs, resumen,
 * distribución, semanas, evolución, pie) para retocar una sección sin tocar el resto.
 */

const ORANGE = "#F04416";
const ORANGE_2 = "#FF6518";
const RED = "#EB171D";
const GREEN = "#087C43";
const FOOTER = "#FF5419";
const BORDER = "#EAD8CE";
const REASON_COLORS = ["#E9181E", "#EA6514", "#FF821B"];
/** Colores semanales por estrellas, de 5★ a 1★. */
const WEEK_STAR_COLORS = [GREEN, "#54B950", "#E4A20A", "#EA6A15", "#E31A20"];
const STATUS_COLOR = { positive: GREEN, watch: ORANGE_2, critical: RED, empty: "#8A8580" } as const;
const STATUS_TITLE = {
  positive: "Reputación sólida y en objetivo.",
  watch: "Reputación en vigilancia.",
  critical: "Reputación por debajo del objetivo.",
  empty: "Sin reseñas este mes.",
} as const;

/* ---------- iconos (SVG) ---------- */

const heart = (size: number) =>
  `<svg width="${size}" height="${size * 0.84}" viewBox="0 0 24 21" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d="M12 20.2 3.9 12.4A5.6 5.6 0 0 1 3.5 4.3a5.4 5.4 0 0 1 8.1.2l.4.5.4-.5a5.4 5.4 0 0 1 8.1-.2 5.6 5.6 0 0 1-.4 8.1z"/></svg>`;

function statusShield(status: MonthlyImageModel["status"]): string {
  const color = STATUS_COLOR[status];
  const mark = status === "positive"
    ? `<path d="M23 44l10 10 20-22" stroke="${color}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
    : `<path d="M38 28v24" stroke="${color}" stroke-width="5.5" stroke-linecap="round"/><circle cx="38" cy="62" r="3.6" fill="${color}"/>`;
  return `<svg width="78" height="94" viewBox="0 0 76 88" fill="none"><path d="M38 4L8 16v24c0 22 13 38 30 44 17-6 30-22 30-44V16L38 4z" stroke="${color}" stroke-width="4" stroke-linejoin="round" fill="#fff"/>${mark}</svg>`;
}

function reviewBubbles(): string {
  return `<svg width="190" height="124" viewBox="0 0 190 124"><path d="M112 20h46a22 22 0 0 1 22 22v28a22 22 0 0 1-22 22h-4l2 18-20-18h-24a22 22 0 0 1-22-22V42a22 22 0 0 1 22-22z" fill="#DDD9D5"/><path d="M32 8h62a28 28 0 0 1 28 28v28a28 28 0 0 1-28 28H62L36 116l4-24h-8A28 28 0 0 1 4 64V36A28 28 0 0 1 32 8z" fill="${ORANGE}"/><g fill="#fff"><circle cx="35" cy="50" r="8"/><circle cx="63" cy="50" r="8"/><circle cx="91" cy="50" r="8"/></g></svg>`;
}

/* ---------- bloques ---------- */

const center = (top: number, html: string, extra = "") => `<div class="mid" style="top:${top}px;${extra}">${html}</div>`;

function header(m: MonthlyImageModel, logo: string, nexo: string): string {
  const size = Math.max(16, Math.min(28, Math.floor(700 / (m.restaurantTitle.length * 0.5))));
  return `
    <img class="abs" src="${logo}" alt="Popeyes" style="left:40px;top:14px;width:322px;height:auto"/>
    <div class="abs" style="left:413px;top:22px;width:1px;height:125px;background:#D47851"></div>
    <div class="abs" style="left:444px;top:14px;width:560px">
      <h1 style="font-size:58px;line-height:.96;font-weight:700;letter-spacing:-1px;color:#080808">INFORME MENSUAL</h1>
      <h2 style="margin-top:9px;font-size:33px;line-height:1;font-weight:700;color:${ORANGE}">REPUTACIÓN ONLINE</h2>
      <h3 style="margin-top:10px;font-size:${size}px;line-height:1;font-weight:700;color:#111;white-space:nowrap">${esc(m.restaurantTitle)}</h3>
    </div>
    <div class="abs" style="left:1030px;top:24px;width:345px;height:125px;display:flex;align-items:center;justify-content:center">${nexo}</div>
    <div class="abs" style="left:1423px;top:23px;width:1px;height:125px;background:#847B76"></div>
    <div class="abs" style="left:1470px;top:40px">${calendarCheck(ORANGE, 78, 3.6)}</div>
    <div class="abs" style="left:1586px;top:50px">
      <small style="display:block;font-size:24px;line-height:1;font-weight:700;color:#111">FECHA DEL INFORME</small>
      <b style="display:block;margin-top:13px;font-size:${m.monthName.length > 8 ? 33 : 37}px;line-height:1;font-weight:700;color:${ORANGE};white-space:nowrap">${esc(m.monthName)} ${m.year}</b>
    </div>
    <div class="abs" style="left:26px;top:160px;width:1868px;height:5px;border-radius:99px;background:${ORANGE}"></div>`;
}

function averageCard(m: MonthlyImageModel): string {
  const progress = m.average === null ? 0 : Math.min(100, (m.average / 5) * 100);
  return `<section class="card" style="left:27px;width:406px">
    ${center(29, '<span class="title">MEDIA MENSUAL</span>')}
    ${center(119, `<span class="kpi">${m.average === null ? "—" : fmt2(m.average)}</span>`)}
    ${center(207, `<span class="row" style="gap:10px">${ratingStars(m.average, ORANGE, "#E8E6E3", 52)}</span>`)}
    ${center(280, '<span style="font-size:25px;font-weight:400;color:#111">Sobre 5.0</span>')}
    <div class="abs" style="left:74px;top:337px;width:259px;height:6px;border-radius:99px;background:#E8E6E3;overflow:hidden"><i style="display:block;height:100%;width:${progress}%;background:${ORANGE};border-radius:99px"></i></div>
  </section>`;
}

function totalCard(m: MonthlyImageModel): string {
  return `<section class="card" style="left:448px;width:334px">
    ${center(29, '<span class="title">TOTAL RESEÑAS</span>')}
    ${center(119, `<span class="kpi">${m.total}</span>`)}
    ${center(194, `<span style="font-size:25px;font-weight:400;color:#111">en el mes de ${esc(m.monthLower)}</span>`)}
    <div class="abs" style="left:0;right:0;top:242px;display:flex;justify-content:center">${reviewBubbles()}</div>
    ${center(376, `<span style="font-size:18px;font-weight:400;color:#66615E">${m.positive} positivas · ${m.critical} incidencias</span>`)}
  </section>`;
}

function reasonsBlock(m: MonthlyImageModel): string {
  const R = 57;
  const C = 2 * Math.PI * R;
  const causalTotal = m.causalReasons.reduce((sum, r) => sum + r.count, 0);
  let offset = 0;
  const arcs = causalTotal
    ? m.causalReasons.map((r, i) => {
        const length = (r.count / causalTotal) * C;
        const arc = `<circle cx="69.5" cy="69.5" r="${R}" fill="none" stroke="${REASON_COLORS[i]}" stroke-width="25" stroke-dasharray="${Math.max(length - (m.causalReasons.length > 1 ? 1.5 : 0), 0)} ${C}" stroke-dashoffset="${-offset}" transform="rotate(-90 69.5 69.5)"/>`;
        offset += length;
        return arc;
      }).join("")
    : `<circle cx="69.5" cy="69.5" r="${R}" fill="none" stroke="#F1ECE6" stroke-width="25"/>`;
  const legend = causalTotal
    ? m.causalReasons.map((r, i) => `<li><i style="background:${REASON_COLORS[i]}"></i><span>${esc(r.name)}</span><b>${r.percent.toFixed(1)}%</b></li>`).join("")
    : `<li class="none"><span>${m.critical ? "Sin causa clasificada" : "Sin reseñas críticas este mes"}</span></li>`;
  const note = m.unclassifiedCritical > 0
    ? `<p class="abs" style="left:190px;top:366px;font-size:12.5px;line-height:1;color:#77716D">${m.unclassifiedCritical} sin causa crítica (excluidas del reparto)</p>`
    : "";
  return `
    <div class="abs" style="left:19px;top:193px;font-size:21px;line-height:1;font-weight:700;color:#111">MOTIVOS DE RESEÑAS CRÍTICAS (1–${m.criticalMaxStars}★)</div>
    <div class="abs" style="left:28px;top:222px;width:139px;height:139px">
      <svg width="139" height="139" viewBox="0 0 139 139">${arcs}</svg>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
        <b style="font-size:35px;line-height:1;font-weight:700;color:#111">${m.critical}</b>
        <small style="margin-top:4px;font-size:11px;line-height:1.15;font-weight:700;text-align:center;color:#222">INCIDENCIAS<br/><span style="font-weight:400;font-size:10.5px">EN TOTAL</span></small>
      </div>
    </div>
    <ul class="legend" style="left:190px;top:236px;width:292px">${legend}</ul>${note}`;
}

function summaryCard(m: MonthlyImageModel): string {
  const color = STATUS_COLOR[m.status];
  const lines = m.status === "empty"
    ? `<p>No hay reseñas registradas en este periodo.</p>`
    : `<p>${m.positivePct.toFixed(1)}% de valoraciones 4–5★.</p><p>${m.critical} incidencias críticas detectadas.</p>`;
  return `<section class="card" style="left:799px;width:509px">
    ${center(29, '<span class="title">RESUMEN DEL MES</span>')}
    <div class="abs" style="left:19px;top:54px;width:471px;height:124px;border:1px solid #E6D3C7;border-radius:15px;display:flex;align-items:center;gap:24px;padding:0 20px 0 22px">
      ${statusShield(m.status)}
      <div style="color:#222"><p style="font-size:22px;line-height:1.1;font-weight:700;color:${color};margin-bottom:9px;white-space:nowrap">${STATUS_TITLE[m.status]}</p><div class="sumlines">${lines}</div></div>
    </div>
    ${reasonsBlock(m)}
  </section>`;
}

function distributionCard(m: MonthlyImageModel): string {
  const BAR = 260;
  const rows = m.ratings.map((count, i) => {
    const width = count > 0 ? Math.max(12, (count / m.total) * BAR) : 0;
    return `<div class="drow" style="top:${79 + i * 58}px"><span class="dn">${5 - i}</span><span class="dstar">${star(22, ORANGE)}</span>
      <em><i style="width:${width}px"></i></em><b>${count} (${pct1(count, m.total)})</b></div>`;
  }).join("");
  return `<section class="card" style="left:1326px;width:565px">
    ${center(29, '<span class="title">DISTRIBUCIÓN GENERAL</span>')}
    ${rows}
    <div class="abs" style="left:27px;top:341px;font-size:26px;line-height:1;font-weight:700;color:#111">Total: ${m.total} reseñas</div>
  </section>`;
}

function weekCard(week: MonthlyImageWeek, m: MonthlyImageModel): string {
  const max = Math.max(1, ...week.ratings);
  const rows = week.ratings.map((count, i) =>
    `<div class="wrow"><span>${5 - i}</span>${star(14, WEEK_STAR_COLORS[i])}<em><i style="width:${count > 0 ? Math.max(10, (count / max) * 100) : 0}%;background:${WEEK_STAR_COLORS[i]}"></i></em><b>${count}</b></div>`).join("");
  const value = week.average === null
    ? `<small class="idle">SIN ACTIVIDAD</small><strong style="color:#B9B4AF">—</strong>`
    : `<small>MEDIA SEMANAL</small><strong style="color:${week.average >= m.objective ? GREEN : ORANGE}">${fmt2(week.average)}</strong>`;
  return `<div class="week"><span class="pill">SEMANA ${week.index}</span><p class="range">${esc(week.label)}</p><div class="wrows">${rows}</div><div class="wavg">${value}</div></div>`;
}

function evolutionPanel(m: MonthlyImageModel): string {
  const left = 38, right = 782, top = 62, bottom = 235;
  const scale = (bottom - top) / 5;
  const y = (v: number) => bottom - v * scale;
  const n = Math.max(1, m.weeks.length);
  const colW = (right - left) / n;
  const x = (i: number) => left + colW * (i + 0.5);
  const grid = [0, 1, 2, 3, 4, 5].map((v) =>
    `<line x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}" stroke="#E9E6E3" stroke-width="1.3"/><text x="${left - 14}" y="${y(v) + 5}" text-anchor="end" class="axis">${v}</text>`).join("");
  const labels = m.weeks.map((week, i) => {
    const [from, rest] = week.label.split(" – ");
    const [to, month] = rest.split(" ");
    return `<text x="${x(i)}" y="261" text-anchor="middle" class="axis x">${from}–${to} ${month.slice(0, 3)}</text>`;
  }).join("");
  const segments: string[][] = [[]];
  m.weeks.forEach((week, i) => {
    if (week.average === null) { if (segments[segments.length - 1].length) segments.push([]); return; }
    segments[segments.length - 1].push(`${x(i)},${y(week.average)}`);
  });
  const lines = segments.filter((s) => s.length > 1).map((s) =>
    `<polyline points="${s.join(" ")}" fill="none" stroke="${ORANGE}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`).join("");
  const points = m.weeks.map((week, i) => week.average === null
    ? `<text x="${x(i)}" y="${y(2.9)}" text-anchor="middle" class="idle-label">SIN ACTIVIDAD</text>`
    : `<circle cx="${x(i)}" cy="${y(week.average)}" r="6.5" fill="${ORANGE}" stroke="#fff" stroke-width="1.5"/><text x="${x(i)}" y="${y(week.average) - 15}" text-anchor="middle" class="point">${fmt2(week.average)}</text>`).join("");
  const target = `<line x1="${left}" x2="${right}" y1="${y(m.objective)}" y2="${y(m.objective)}" stroke="#EF211C" stroke-width="2" stroke-dasharray="10 8"/>`;
  const legend = `<g><line x1="236" x2="282" y1="25" y2="25" stroke="${ORANGE}" stroke-width="3.5"/><circle cx="259" cy="25" r="5.5" fill="${ORANGE}"/><text x="294" y="30" class="legend-text">Media semanal</text>
    <line x1="548" x2="590" y1="25" y2="25" stroke="#EF211C" stroke-width="2.4" stroke-dasharray="8 6"/><text x="602" y="30" class="legend-text">Objetivo (${fmt2(m.objective)})</text></g>`;
  return `<div class="evo"><svg width="813" height="337" viewBox="0 0 813 337" style="position:absolute;left:0;top:0">${legend}${grid}${target}${lines}${points}${labels}</svg>
    <div class="strip">
      <div><small>SEMANAS EN OBJETIVO</small><b style="color:${GREEN}">${m.weeksOnTarget} / ${m.weeks.length}</b></div>
      <div><small>SEMANAS SIN ACTIVIDAD</small><b style="color:${ORANGE_2}">${m.weeksWithoutActivity} / ${m.weeks.length}</b></div>
      <div><small>SEMANAS BAJO OBJETIVO</small><b style="color:${RED}">${m.weeksBelowTarget} / ${m.weeks.length}</b></div>
    </div></div>`;
}

function footer(m: MonthlyImageModel, wordmark: string): string {
  return `<footer class="footer">
    <div class="abs" style="left:53px;top:26px;width:155px;height:50px;border-radius:30px;background:#fff;display:flex;align-items:center;justify-content:center">
      <div style="width:132px;height:25px;overflow:hidden"><img src="${wordmark}" alt="Popeyes" style="display:block;width:132px;margin-top:-6px"/></div>
    </div>
    <p class="abs" style="left:230px;top:14px;font-size:23px;line-height:33px;font-weight:700;color:#fff;letter-spacing:.2px">NUESTRO ORGULLO,<br/>VUESTRA CONFIANZA.</p>
    <div class="abs" style="left:487px;top:18px;width:1px;height:66px;background:rgba(255,255,255,.45)"></div>
    <div class="abs" style="left:607px;top:14px">${heart(94)}</div>
    <p class="abs" style="left:740px;top:15px;width:464px;text-align:center;font-size:25px;line-height:33px;color:#fff"><span style="font-weight:400">Cada reseña nos hace mejores.</span><br/><b style="font-weight:700">¡Gracias por ser parte de Popeyes!</b></p>
    <div class="abs" style="left:1292px;top:18px;width:1px;height:66px;background:rgba(255,255,255,.45)"></div>
    <div class="abs" style="left:1382px;top:18px">${calendarCheck("#fff", 66, 3.4)}</div>
    <div class="abs" style="left:1496px;top:20px"><small style="display:block;font-size:17px;line-height:1;font-weight:400;color:#fff">Informe generado el</small><b style="display:block;margin-top:13px;font-size:23px;line-height:1;font-weight:700;color:#fff">${esc(m.generatedDate)}</b></div>
  </footer>`;
}

/* ---------- documento ---------- */

export async function buildPopeyesImageHtml(m: MonthlyImageModel): Promise<string> {
  const [condensed, logo, wordmark, nexo] = await Promise.all([
    dataUri("fonts/roboto-condensed-variable.woff2"), dataUri("design/popeyes/pp-wordmark-2.png"),
    dataUri("design/popeyes/pp-wordmark-2.png"), nexoLogoHtml(112, 190),
  ]);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>Informe mensual ${esc(m.restaurantTitle)}</title><style>
    @font-face{font-family:'Roboto Condensed';src:url('${condensed}') format('woff2');font-weight:100 900}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:${MONTHLY_IMAGE_WIDTH}px;height:${MONTHLY_IMAGE_HEIGHT}px;overflow:hidden;background:#fff}
    .canvas{position:relative;width:${MONTHLY_IMAGE_WIDTH}px;height:${MONTHLY_IMAGE_HEIGHT}px;overflow:hidden;background:#fff;color:#090909;font-family:'Roboto Condensed','Barlow Condensed','Arial Narrow',sans-serif}
    .abs{position:absolute}
    .nexo{display:flex;align-items:center}.nexo img{display:block;object-fit:contain}
    .card{position:absolute;top:187px;height:402px;background:#fff;border:1px solid ${BORDER};border-radius:16px;box-shadow:0 2px 7px rgba(80,30,10,.025)}
    .mid{position:absolute;left:0;right:0;display:flex;justify-content:center;align-items:center;transform:translateY(-50%);line-height:1}
    .row{display:flex}
    .title{font-size:25px;font-weight:700;color:#111;letter-spacing:.2px}
    .kpi{font-size:112px;font-weight:700;color:${ORANGE};letter-spacing:-1px}
    .legend{position:absolute;list-style:none}
    .legend li{display:flex;align-items:center;gap:10px;height:28px;font-size:16px;color:#222}
    .legend li i{width:12px;height:12px;border-radius:50%;flex:none}
    .legend li span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .legend li b{font-size:15px;font-weight:700;flex:none}
    .legend li.none{color:#6b6460}
    .sumlines p{font-size:18.5px;line-height:1.5;color:#222}
    .drow{position:absolute;left:32px;right:34px;height:30px;display:flex;align-items:center;transform:translateY(-50%)}
    .dn{width:26px;font-size:26px;font-weight:700}
    .dstar{width:40px;display:flex;justify-content:center}
    .drow em{width:260px;height:18px;border-radius:99px;background:#EFEEEC;overflow:hidden;margin-left:8px}
    .drow em i{display:block;height:100%;border-radius:99px;background:${ORANGE}}
    .drow b{margin-left:30px;font-size:22px;font-weight:400;white-space:nowrap;color:#111}
    .sec{position:absolute;display:flex;align-items:center;gap:6px;height:30px;top:593px}
    .sec h3{font-size:26px;line-height:1;font-weight:700;color:${ORANGE};white-space:nowrap;letter-spacing:.2px}
    .sec i{flex:1;height:1.5px;background:${ORANGE}}
    .weeks{position:absolute;left:27px;top:628px;width:1027px;height:337px;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:${m.weeks.length > 5 ? 9 : 13}px}
    .week{position:relative;background:#fff;border:1px solid #E7D6CD;border-radius:14px;box-shadow:0 2px 7px rgba(80,30,10,.025);text-align:center}
    .pill{display:block;margin:14px auto 0;width:min(120px,78%);height:32px;line-height:32px;background:${ORANGE};color:#fff;border-radius:6px;font-size:17px;font-weight:700;letter-spacing:.3px}
    .range{margin-top:16px;font-size:15.5px;line-height:1;font-weight:700;color:#111;white-space:nowrap}
    .wrows{position:absolute;left:17px;right:17px;top:83px}
    .wrow{display:flex;align-items:center;gap:7px;height:30px}
    .wrow>span{width:12px;font-size:14px;font-weight:700;text-align:right}
    .wrow em{flex:1;height:10px;border-radius:99px;background:#EEEDEA;overflow:hidden;min-width:0}
    .wrow em i{display:block;height:100%;border-radius:99px}
    .wrow b{min-width:14px;text-align:right;font-size:15px;font-weight:400}
    .wavg{position:absolute;left:30px;right:30px;top:251px;border-top:1px solid #E9DDD5;padding-top:12px;white-space:nowrap}
    .wavg small{display:block;font-size:15px;line-height:1;font-weight:700;color:#111}
    .wavg small.idle{color:#8A8580}
    .wavg strong{display:block;margin-top:8px;font-size:43px;line-height:1.05;font-weight:700}
    .evo{position:absolute;left:1080px;top:628px;width:813px;height:337px;background:#fff;border:1px solid #E7D6CD;border-radius:14px;box-shadow:0 2px 7px rgba(80,30,10,.025);overflow:hidden}
    .axis{font:400 13.5px 'Roboto Condensed',sans-serif;fill:#444}.axis.x{font-size:14px;font-weight:700;fill:#111}
    .point{font:700 17px 'Roboto Condensed',sans-serif;fill:#111;paint-order:stroke;stroke:#fff;stroke-width:4px;stroke-linejoin:round}
    .idle-label{font:700 13px 'Roboto Condensed',sans-serif;fill:#8A8580;letter-spacing:.3px}
    .legend-text{font:400 15px 'Roboto Condensed',sans-serif;fill:#222}
    .strip{position:absolute;left:17px;right:18px;top:278px;height:49px;background:#FFF5F0;border-radius:11px;display:grid;grid-template-columns:1fr 1fr 1fr}
    .strip>div{display:flex;flex-direction:column;align-items:center;justify-content:center;border-left:1px solid #EBD9CF;margin:8px 0}
    .strip>div:first-child{border-left:0}
    .strip small{font-size:13px;line-height:1;font-weight:700;color:#111;letter-spacing:.2px}
    .strip b{margin-top:4px;font-size:25px;line-height:1;font-weight:700}
    .footer{position:absolute;left:0;top:978px;width:${MONTHLY_IMAGE_WIDTH}px;height:102px;background:${FOOTER}}
  </style></head><body><div class="canvas" data-report="monthly-image-pp">
    ${header(m, logo, nexo)}
    ${averageCard(m)}${totalCard(m)}${summaryCard(m)}${distributionCard(m)}
    <div class="sec" style="left:53px;width:1001px"><h3>DESGLOSE SEMANAL</h3><i></i></div>
    <div class="weeks">${m.weeks.map((week) => weekCard(week, m)).join("")}</div>
    <div class="sec" style="left:1182px;width:695px"><h3>EVOLUCIÓN DE LA MEDIA SEMANAL</h3><i></i></div>
    ${evolutionPanel(m)}
    ${footer(m, wordmark)}
  </div></body></html>`;
}
