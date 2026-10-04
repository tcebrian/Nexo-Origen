import "server-only";

import type { MonthlyImageModel, MonthlyImageWeek } from "./model";
import { calendarCheck, dataUri, esc, fmt2, nexoLogoHtml, ratingStars, STAR_PATH, MONTHLY_IMAGE_HEIGHT, MONTHLY_IMAGE_WIDTH } from "./shared";

/**
 * Plantilla dedicada de Ribs (1920×1080). Diseño fijo: solo cambian los datos
 * del modelo. Cada bloque es una función independiente (cabecera, KPIs, resumen,
 * distribución, semanas, evolución, pie) para retocar una sección sin tocar el resto.
 */

const GARNET = "#650000";
const GARNET_MID = "#7A0606";
const GOLD = "#BD7200";
const GOLD_LIGHT = "#D09318";
const GREEN = "#087B43";
const ORANGE = "#F25A16";
const BG = "#FFF9F0";
const CARD = "#FFF9F1";
const BORDER = "rgba(170,100,40,0.45)";
const PANEL_BORDER = "#D7AA7E";
const REASON_COLORS = [GARNET_MID, "#B45124", GOLD_LIGHT];

const pctInt = (count: number, total: number) => `${total ? Math.round((count / total) * 100) : 0}%`;
const comma = (value: number) => value.toFixed(2).replace(".", ",");
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/* ---------- iconos (SVG) ---------- */

const goldStar = (size: number, color = GOLD) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><path d="${STAR_PATH}" fill="${color}"/></svg>`;

const heart = (size: number) =>
  `<svg width="${size}" height="${size * 0.84}" viewBox="0 0 24 21" fill="none" stroke="${GOLD_LIGHT}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d="M12 20.2 3.9 12.4A5.6 5.6 0 0 1 3.5 4.3a5.4 5.4 0 0 1 8.1.2l.4.5.4-.5a5.4 5.4 0 0 1 8.1-.2 5.6 5.6 0 0 1-.4 8.1z"/></svg>`;

const shieldStar = () =>
  `<svg width="80" height="96" viewBox="0 0 76 88" fill="none"><path d="M38 4L8 16v24c0 22 13 38 30 44 17-6 30-22 30-44V16L38 4z" stroke="${GARNET}" stroke-width="4" stroke-linejoin="round" fill="${CARD}"/><g transform="translate(18 20) scale(1.7)"><path d="${STAR_PATH}" fill="${GARNET}"/></g></svg>`;

function reviewBubbles(): string {
  return `<svg width="170" height="124" viewBox="0 0 190 124"><path d="M112 20h46a22 22 0 0 1 22 22v28a22 22 0 0 1-22 22h-4l2 18-20-18h-24a22 22 0 0 1-22-22V42a22 22 0 0 1 22-22z" fill="#DAD6CF"/><path d="M32 8h62a28 28 0 0 1 28 28v28a28 28 0 0 1-28 28H62L36 116l4-24h-8A28 28 0 0 1 4 64V36A28 28 0 0 1 32 8z" fill="${GARNET}"/><g fill="#fff"><circle cx="35" cy="50" r="8"/><circle cx="63" cy="50" r="8"/><circle cx="91" cy="50" r="8"/></g></svg>`;
}

/* ---------- bloques ---------- */

const center = (top: number, html: string, extra = "") => `<div class="mid" style="top:${top}px;${extra}">${html}</div>`;

function header(m: MonthlyImageModel, logo: string, nexo: string): string {
  const titleSize = Math.max(16, Math.min(30, Math.floor(430 / (m.restaurantTitle.length * 0.5))));
  const dateSize = m.monthName.length > 8 ? 31 : 34;
  return `
    <img class="abs" src="${logo}" alt="Ribs" style="left:85px;top:18px;width:260px;height:147px;object-fit:contain"/>
    <div class="abs" style="left:447px;top:16px;width:1.5px;height:146px;background:#758084"></div>
    <div class="abs" style="left:483px;top:22px;width:470px;white-space:nowrap">
      <h1 style="font-size:58px;line-height:1;font-weight:700;letter-spacing:-.5px;color:#080808">INFORME MENSUAL</h1>
      <h2 style="margin-top:8px;font-size:37px;line-height:1;font-weight:700;color:#750808">REPUTACIÓN ONLINE</h2>
      <h3 style="margin-top:13px;font-size:${titleSize}px;line-height:1;font-weight:700;color:#111;white-space:nowrap">${esc(m.restaurantTitle)}</h3>
    </div>
    <div class="abs" style="left:975px;top:20px;width:420px;height:138px;display:flex;align-items:center;justify-content:center">${nexo}</div>
    <div class="abs" style="left:1425px;top:16px;width:1.5px;height:146px;background:#758084"></div>
    <div class="abs" style="left:1468px;top:32px;width:100px;height:100px;border-radius:50%;background:${GARNET};display:flex;align-items:center;justify-content:center">${calendarCheck("#fff", 58, 3.4)}</div>
    <div class="abs" style="left:1590px;top:46px">
      <small style="display:block;font-size:22px;line-height:1;font-weight:700;color:#18100D">FECHA DEL INFORME</small>
      <b style="display:block;margin-top:12px;font-size:${dateSize}px;line-height:1;font-weight:700;color:${GARNET};white-space:nowrap">${esc(m.monthName)} ${m.year}</b>
    </div>
    <div class="abs" style="left:26px;top:182px;width:829px;height:2px;background:${GARNET_MID}"></div>
    <div class="abs" style="left:880px;top:170px">${goldStar(26, "#B36B00")}</div>
    <div class="abs" style="left:931px;top:182px;width:963px;height:2px;background:${GARNET_MID}"></div>`;
}

function averageCard(m: MonthlyImageModel): string {
  const progress = m.average === null ? 0 : Math.min(100, (m.average / 5) * 100);
  return `<section class="card" style="left:24px;width:404px">
    ${center(29, '<span class="title">MEDIA MENSUAL</span>')}
    ${center(129, `<span class="kpi">${m.average === null ? "—" : fmt2(m.average)}</span>`)}
    ${center(218, `<span class="row" style="gap:8px">${ratingStars(m.average, GOLD, "#CAC6BE", 56)}</span>`)}
    ${center(287, '<span style="font-size:25px;font-weight:400;color:#18100D">Sobre 5.0</span>')}
    <div class="abs" style="left:67px;top:336px;width:270px;height:7px;border-radius:99px;background:#DCD9D3;overflow:hidden"><i style="display:block;height:100%;width:${progress}%;background:${GARNET};border-radius:99px"></i></div>
  </section>`;
}

function totalCard(m: MonthlyImageModel): string {
  return `<section class="card" style="left:444px;width:330px">
    ${center(29, '<span class="title">TOTAL RESEÑAS</span>')}
    ${center(129, `<span class="kpi">${m.total}</span>`)}
    ${center(204, `<span style="font-size:24px;font-weight:400;color:#18100D">en el mes de ${esc(m.monthLower)}</span>`)}
    <div class="abs" style="left:0;right:0;top:232px;display:flex;justify-content:center">${reviewBubbles()}</div>
    ${center(366, `<span style="font-size:16px;font-weight:400;color:#746C68">${m.positive} positivas · ${m.critical} incidencias</span>`)}
  </section>`;
}

function reasonsBlock(m: MonthlyImageModel): string {
  const R = 52;
  const C = 2 * Math.PI * R;
  const total = m.classifiedIncidents;
  let offset = 0;
  const arcs = total
    ? m.causalReasons.map((r, i) => {
        const length = (r.count / total) * C;
        const arc = `<circle cx="65.5" cy="65.5" r="${R}" fill="none" stroke="${REASON_COLORS[i]}" stroke-width="24" stroke-dasharray="${Math.max(length - (m.causalReasons.length > 1 ? 1.5 : 0), 0)} ${C}" stroke-dashoffset="${-offset}" transform="rotate(-90 65.5 65.5)"/>`;
        offset += length;
        return arc;
      }).join("")
    : `<circle cx="65.5" cy="65.5" r="${R}" fill="none" stroke="#F1E7DA" stroke-width="24"/>`;
  const legend = total
    ? m.causalReasons.map((r, i) => `<li><i style="background:${REASON_COLORS[i]}"></i><span>${esc(r.name)}</span><b>${pctInt(r.count, total)}</b></li>`).join("")
    : `<li class="none"><span>${m.critical ? "Sin causa clasificada" : "Sin reseñas críticas este mes"}</span></li>`;
  return `
    <div class="abs" style="left:20px;top:212px;width:478px;border-top:1.5px dotted #D9B89A"></div>
    <div class="abs" style="left:22px;top:230px;font-size:21px;line-height:1;font-weight:700;color:#18100D">MOTIVOS DE RESEÑAS NEGATIVAS</div>
    <div class="abs" style="left:30px;top:252px;width:131px;height:131px">
      <svg width="131" height="131" viewBox="0 0 131 131">${arcs}</svg>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
        <b style="font-size:34px;line-height:1;font-weight:700;color:#18100D">${total}</b>
        <small style="margin-top:4px;font-size:10.5px;line-height:1.15;font-weight:700;text-align:center;color:#222">INCIDENCIAS<br/><span style="font-weight:400;font-size:10px">EN TOTAL</span></small>
      </div>
    </div>
    <ul class="legend" style="left:185px;top:276px;width:312px">${legend}</ul>`;
}

function summaryCard(m: MonthlyImageModel): string {
  const objective = comma(m.objective);
  const title = m.status === "positive" ? `Mes por encima del objetivo (${objective}).`
    : m.status === "watch" ? `Mes en vigilancia, por debajo del objetivo (${objective}).`
    : m.status === "critical" ? "Mes por debajo del objetivo, requiere atención." : "Sin actividad durante el periodo.";
  const color = m.status === "positive" ? GREEN : m.status === "watch" ? ORANGE : m.status === "critical" ? GARNET_MID : "#8A8580";
  const names = m.causalReasons.slice(0, 2).map((r) => lowerFirst(r.name));
  const concentrated = names.length === 2 ? `Las incidencias se concentran en ${names[0]}<br/>y ${names[1]}.`
    : names.length === 1 ? `Las incidencias se concentran en ${names[0]}.` : "";
  const lines = m.status === "empty" ? "" : `<p>El ${Math.round(m.positivePct)}% de las reseñas son positivas.</p>${concentrated ? `<p>${concentrated}</p>` : ""}`;
  const titleSize = Math.max(14, Math.min(20, Math.floor(370 / (title.length * 0.42))));
  return `<section class="card" style="left:788px;width:519px">
    ${center(29, '<span class="title">RESUMEN DEL MES</span>')}
    <div class="abs" style="left:26px;top:49px">${shieldStar()}</div>
    <p class="abs" style="left:127px;top:52px;font-size:${titleSize}px;line-height:24px;font-weight:700;color:${color};white-space:nowrap">${esc(title)}</p>
    <div class="sumlines abs" style="left:127px;top:80px">${lines}</div>
    ${reasonsBlock(m)}
  </section>`;
}

function distributionCard(m: MonthlyImageModel): string {
  const BAR = 307;
  const rows = m.ratings.map((count, i) => {
    const width = count > 0 ? Math.max(12, (count / m.total) * BAR) : 0;
    return `<div class="drow" style="top:${81 + i * 51.3}px"><span class="dn">${5 - i}</span><span class="dstar">${goldStar(21)}</span>
      <em><i style="width:${width}px"></i></em><b>${count} (${pctInt(count, m.total)})</b></div>`;
  }).join("");
  return `<section class="card" style="left:1323px;width:573px">
    ${center(29, '<span class="title">DISTRIBUCIÓN GENERAL</span>')}
    ${rows}
    <div class="abs" style="left:26px;top:331px;font-size:27px;line-height:1;font-weight:700;color:#18100D">Total: ${m.total} reseñas</div>
  </section>`;
}

function weekColumn(week: MonthlyImageWeek, m: MonthlyImageModel): string {
  const max = Math.max(1, ...week.ratings);
  const rows = week.ratings.map((count, i) =>
    `<div class="wrow"><span>${5 - i}</span>${goldStar(14)}<em><i style="width:${count > 0 ? Math.max(10, (count / max) * 100) : 0}%"></i></em><b>${count}</b></div>`).join("");
  const value = week.average === null
    ? `<small class="idle">SIN ACTIVIDAD</small><strong style="color:#B9B4AF">—</strong>`
    : `<small>MEDIA SEMANAL</small><strong style="color:${week.average >= m.objective ? GREEN : GARNET}">${fmt2(week.average)}</strong>`;
  return `<div class="week"><span class="pill">SEMANA ${week.index}</span><p class="range">${esc(week.label.replace(" – ", " - "))}</p><div class="wrows">${rows}</div><div class="wavg">${value}</div></div>`;
}

function evolutionPanel(m: MonthlyImageModel): string {
  const left = 47, right = 748, top = 58, bottom = 203;
  const scale = (bottom - top) / 5;
  const y = (v: number) => bottom - v * scale;
  const n = m.weeks.length;
  const x = (i: number) => (n === 1 ? 402 : 94 + (i * 621) / (n - 1));
  const grid = [0, 1, 2, 3, 4, 5].map((v) =>
    `<line x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}" stroke="#DDD8D1" stroke-width="1.2"/><text x="${left - 14}" y="${y(v) + 5}" text-anchor="end" class="axis">${v}</text>`).join("");
  const labels = m.weeks.map((week, i) => {
    const [from, rest] = week.label.split(" – ");
    const [to, month] = rest.split(" ");
    return `<text x="${x(i)}" y="226" text-anchor="middle" class="axis x">${from}-${to} ${month.slice(0, 3)}</text>`;
  }).join("");
  const segments: string[][] = [[]];
  m.weeks.forEach((week, i) => {
    if (week.average === null) { if (segments[segments.length - 1].length) segments.push([]); return; }
    segments[segments.length - 1].push(`${x(i)},${y(week.average)}`);
  });
  const lines = segments.filter((s) => s.length > 1).map((s) =>
    `<polyline points="${s.join(" ")}" fill="none" stroke="${GARNET}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`).join("");
  const points = m.weeks.map((week, i) => week.average === null
    ? `<text x="${x(i)}" y="${y(2.9)}" text-anchor="middle" class="idle-label">SIN ACTIVIDAD</text>`
    : `<circle cx="${x(i)}" cy="${y(week.average)}" r="6" fill="${GARNET}"/><text x="${x(i)}" y="${y(week.average) - 14}" text-anchor="middle" class="point">${fmt2(week.average)}</text>`).join("");
  const target = `<line x1="${left}" x2="${right}" y1="${y(m.objective)}" y2="${y(m.objective)}" stroke="${GARNET}" stroke-width="2" stroke-dasharray="10 8"/>`;
  const legend = `<g><line x1="342" x2="388" y1="22" y2="22" stroke="${GARNET}" stroke-width="3"/><circle cx="365" cy="22" r="5.5" fill="${GARNET}"/><text x="400" y="27" class="legend-text">Media semanal</text>
    <line x1="570" x2="612" y1="22" y2="22" stroke="${GARNET}" stroke-width="2.2" stroke-dasharray="8 6"/><text x="624" y="27" class="legend-text">Objetivo (${fmt2(m.objective)})</text></g>`;
  return `<div class="evo"><svg width="786" height="317" viewBox="0 0 786 317" style="position:absolute;left:0;top:0">${legend}${grid}${target}${lines}${points}${labels}</svg>
    <div class="strip">
      <div><small>SEMANAS EN OBJETIVO</small><b style="color:${GREEN}">${m.weeksOnTarget} / ${m.weeks.length}</b></div>
      <div><small>SEMANAS SIN ACTIVIDAD</small><b style="color:${ORANGE}">${m.weeksWithoutActivity} / ${m.weeks.length}</b></div>
      <div><small>SEMANAS BAJO OBJETIVO</small><b style="color:${GARNET}">${m.weeksBelowTarget} / ${m.weeks.length}</b></div>
    </div></div>`;
}

function footer(m: MonthlyImageModel, logo: string): string {
  return `<footer class="footer">
    <img class="abs" src="${logo}" alt="Ribs" style="left:44px;top:14px;width:132px;height:90px;object-fit:contain"/>
    <p class="abs" style="left:194px;top:25px;font-size:25px;line-height:36px;font-weight:700;color:${GOLD_LIGHT};letter-spacing:.2px">NUESTRO ORGULLO,<br/>NUESTRA CONFIANZA.</p>
    <div class="abs" style="left:550px;top:23px;width:1.5px;height:76px;background:${GOLD_LIGHT}"></div>
    <div class="abs" style="left:606px;top:28px">${heart(98)}</div>
    <p class="abs" style="left:700px;top:25px;width:470px;text-align:center;white-space:nowrap;font-size:27px;line-height:36px;color:${GOLD_LIGHT}"><span style="font-weight:400">Cada reseña nos hace mejores.</span><br/><b style="font-weight:700;font-size:26px">¡Gracias por ser parte de la familia Ribs!</b></p>
    <div class="abs" style="left:1290px;top:23px;width:1.5px;height:76px;background:${GOLD_LIGHT}"></div>
    <div class="abs" style="left:1378px;top:21px">${calendarCheck(GOLD_LIGHT, 80, 3.4)}</div>
    <div class="abs" style="left:1480px;top:24px"><small style="display:block;font-size:18px;line-height:1;font-weight:400;color:${GOLD_LIGHT}">Informe generado el</small><b style="display:block;margin-top:13px;font-size:30px;line-height:1;font-weight:700;color:${GOLD_LIGHT}">${esc(m.generatedDate)}</b></div>
  </footer>`;
}

/* ---------- documento ---------- */

export async function buildRibsImageHtml(m: MonthlyImageModel): Promise<string> {
  const [condensed, logo, nexo] = await Promise.all([
    dataUri("fonts/roboto-condensed-variable.woff2"), dataUri("design/ribs/rb-logo.png"), nexoLogoHtml(104, 235),
  ]);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>Informe mensual ${esc(m.restaurantTitle)}</title><style>
    @font-face{font-family:'Roboto Condensed';src:url('${condensed}') format('woff2');font-weight:100 900}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:${MONTHLY_IMAGE_WIDTH}px;height:${MONTHLY_IMAGE_HEIGHT}px;overflow:hidden;background:${BG}}
    .canvas{position:relative;width:${MONTHLY_IMAGE_WIDTH}px;height:${MONTHLY_IMAGE_HEIGHT}px;overflow:hidden;background:${BG};color:#18100D;font-family:'Roboto Condensed','Barlow Condensed','Arial Narrow',sans-serif}
    .abs{position:absolute}
    .nexo{display:flex;align-items:center}.nexo img{display:block;object-fit:contain}
    .card{position:absolute;top:200px;height:390px;background:${CARD};border:1px solid ${BORDER};border-radius:15px;box-shadow:0 2px 8px rgba(80,30,0,.02)}
    .mid{position:absolute;left:0;right:0;display:flex;justify-content:center;align-items:center;transform:translateY(-50%);line-height:1}
    .row{display:flex}
    .title{font-size:26px;font-weight:700;color:#18100D;letter-spacing:.2px}
    .kpi{font-size:108px;font-weight:700;color:${GARNET};letter-spacing:-1px}
    .sumlines p{font-size:17.5px;line-height:30px;color:#18100D;white-space:nowrap}
    .legend{position:absolute;list-style:none}
    .legend li{display:flex;align-items:center;gap:11px;height:40px;font-size:17.5px;font-weight:700;color:#18100D}
    .legend li i{width:17px;height:17px;border-radius:50%;flex:none}
    .legend li span{flex:1;min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.15}
    .legend li b{font-size:17.5px;flex:none}
    .legend li.none{color:#746C68;font-weight:400}
    .drow{position:absolute;left:31px;right:30px;height:30px;display:flex;align-items:center;transform:translateY(-50%)}
    .dn{width:20px;font-size:23px;font-weight:700}
    .dstar{width:34px;display:flex;justify-content:center}
    .drow em{width:307px;height:17px;border-radius:99px;background:#E8E5DE;overflow:hidden;margin-left:12px}
    .drow em i{display:block;height:100%;border-radius:99px;background:${GARNET}}
    .drow b{margin-left:28px;font-size:23px;font-weight:500;white-space:nowrap;color:#18100D}
    .sec{position:absolute;display:flex;align-items:center;gap:12px;height:30px;top:598px}
    .sec h3{font-size:26px;line-height:1;font-weight:700;color:${GARNET};white-space:nowrap;letter-spacing:.2px}
    .sec i{flex:1;height:1.5px;background:#C9A27B}
    .weeks{position:absolute;left:24px;top:630px;width:1070px;height:317px;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;background:${CARD};border:1px solid ${PANEL_BORDER};border-radius:15px}
    .week{position:relative;text-align:center;border-left:1px solid #E6CDB2}
    .week:first-child{border-left:0}
    .pill{display:block;margin:22px auto 0;width:min(150px,78%);height:30px;line-height:30px;background:${GARNET};color:#fff;border-radius:6px;font-size:17px;font-weight:700;letter-spacing:.3px}
    .range{margin-top:16px;font-size:15.5px;line-height:1;font-weight:700;color:#18100D;white-space:nowrap}
    .wrows{position:absolute;left:30px;right:30px;top:81px}
    .wrow{display:flex;align-items:center;gap:7px;height:28px}
    .wrow>span{width:12px;font-size:14.5px;font-weight:700;text-align:right}
    .wrow em{flex:1;height:10px;border-radius:99px;background:#E8E5DF;overflow:hidden;min-width:0}
    .wrow em i{display:block;height:100%;border-radius:99px;background:${GARNET}}
    .wrow b{min-width:14px;text-align:right;font-size:15px;font-weight:500}
    .wavg{position:absolute;left:24px;right:24px;top:238px;border-top:1px solid #E5D3BF;padding-top:14px;white-space:nowrap}
    .wavg small{display:block;font-size:14.5px;line-height:1;font-weight:700;color:#18100D}
    .wavg small.idle{color:#8A8580}
    .wavg strong{display:block;margin-top:7px;font-size:40px;line-height:1.05;font-weight:700}
    .evo{position:absolute;left:1110px;top:630px;width:786px;height:317px;background:${CARD};border:1px solid ${PANEL_BORDER};border-radius:15px;overflow:hidden}
    .axis{font:400 13.5px 'Roboto Condensed',sans-serif;fill:#3A2E29}.axis.x{font-size:13.5px;font-weight:700;fill:#18100D}
    .point{font:700 17.5px 'Roboto Condensed',sans-serif;fill:#18100D;paint-order:stroke;stroke:${CARD};stroke-width:4px;stroke-linejoin:round}
    .idle-label{font:700 13px 'Roboto Condensed',sans-serif;fill:#8A8580;letter-spacing:.3px}
    .legend-text{font:400 15px 'Roboto Condensed',sans-serif;fill:#18100D}
    .strip{position:absolute;left:16px;right:15px;top:249px;height:59px;background:#F5EFE5;border-radius:11px;display:grid;grid-template-columns:1fr 1fr 1fr}
    .strip>div{display:flex;flex-direction:column;align-items:center;justify-content:center;border-left:1px solid #E2D2BF;margin:9px 0}
    .strip>div:first-child{border-left:0}
    .strip small{font-size:13px;line-height:1;font-weight:700;color:#18100D;letter-spacing:.2px}
    .strip b{margin-top:5px;font-size:26px;line-height:1;font-weight:700}
    .footer{position:absolute;left:0;top:962px;width:${MONTHLY_IMAGE_WIDTH}px;height:118px;background:${GARNET}}
  </style></head><body><div class="canvas" data-report="monthly-image-rb">
    ${header(m, logo, nexo)}
    ${averageCard(m)}${totalCard(m)}${summaryCard(m)}${distributionCard(m)}
    <div class="sec" style="left:45px;width:1049px"><h3>DESGLOSE SEMANAL</h3>${goldStar(24)}<i></i></div>
    <div class="weeks">${m.weeks.map((week) => weekColumn(week, m)).join("")}</div>
    <div class="sec" style="left:1110px;width:786px"><i style="flex:0 0 70px"></i>${goldStar(24)}<h3>EVOLUCIÓN DE LA MEDIA SEMANAL</h3>${goldStar(24)}<i></i></div>
    ${evolutionPanel(m)}
    ${footer(m, logo)}
  </div></body></html>`;
}
