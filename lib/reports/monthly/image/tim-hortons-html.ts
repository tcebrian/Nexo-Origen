import "server-only";

import type { MonthlyImageModel, MonthlyImageWeek } from "./model";
import { dataUri, esc, fmt2, nexoLogoHtml, pct1, ratingStars, star, MONTHLY_IMAGE_HEIGHT, MONTHLY_IMAGE_WIDTH } from "./shared";

/**
 * Plantilla dedicada de Tim Hortons (1920×1080). Diseño fijo: solo cambian los
 * datos del modelo. Cada bloque es una función independiente (cabecera, KPIs,
 * resumen, distribución, semanas, evolución, pie) para retocar una sección sin
 * tocar las demás.
 */

const RED = "#C60018";
const RED_DARK = "#B80012";
const GREEN = "#087C43";
const ORANGE = "#EA8500";
const FOOTER = "#CA0014";
const BORDER = "#E5D8CE";
const BG = "#FFFDF9";
const CARD = "#FFFDFB";
const REASON_COLORS = ["#CB0016", "#E2616B", "#7E0A14"];
/** Color de barra por estrellas, de 5★ a 1★. */
const BAR_COLORS = ["#078443", "#19864E", ORANGE, "#D71920", "#BD1020"];
/** Color de la estrella del desglose semanal, de 5★ a 1★. */
const WEEK_STAR_COLORS = [GREEN, GREEN, ORANGE, "#D71920", "#D71920"];

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

const SUMMARY_TITLE = {
  positive: "Resultado positivo, por encima del objetivo.",
  watch: "Resultado en vigilancia, por debajo del objetivo.",
  critical: "Resultado por debajo del objetivo, requiere atención.",
  empty: "Sin reseñas este mes.",
} as const;

/* ---------- iconos (SVG) ---------- */

const mapleLeaf = (size: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${RED}"><path d="M12 1.5l2 4.2 2.6-1-.8 4.9 3.4-2.6-.5 3.5 2.6-.5-1.6 3.6 1.7 1.2-5.6 3.6.7 2.4-3.4-.3V22.5h-2.2v-3.6l-3.4.3.7-2.4-5.6-3.6 1.7-1.2-1.6-3.6 2.6.5-.5-3.5 3.4 2.6-.8-4.9 2.6 1z"/></svg>`;

const coffeeCup = (size: number) =>
  `<svg width="${size}" height="${size * 0.92}" viewBox="0 0 100 92" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="50" cy="46" r="43"/><path d="M26 42h42c0 17-7 28-21 28S26 59 26 42z"/><path d="M68 47h4a7 7 0 0 1 0 14h-6"/><path d="M20 76c9 4 20 5 30 5s21-1 30-5"/><path d="M40 33c-4-4 4-6 0-11M52 33c-4-4 4-6 0-11"/></svg>`;

const heart = (size: number) =>
  `<svg width="${size}" height="${size * 0.84}" viewBox="0 0 24 21" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d="M12 20.2 3.9 12.4A5.6 5.6 0 0 1 3.5 4.3a5.4 5.4 0 0 1 8.1.2l.4.5.4-.5a5.4 5.4 0 0 1 8.1-.2 5.6 5.6 0 0 1-.4 8.1z"/></svg>`;

function statusShield(positive: boolean): string {
  const mark = positive
    ? `<path d="M23 44l10 10 20-22" stroke="${RED}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
    : `<path d="M38 28v24" stroke="${RED}" stroke-width="5.5" stroke-linecap="round"/><circle cx="38" cy="62" r="3.6" fill="${RED}"/>`;
  return `<svg width="82" height="98" viewBox="0 0 76 88" fill="none"><path d="M38 4L8 16v24c0 22 13 38 30 44 17-6 30-22 30-44V16L38 4z" stroke="${RED}" stroke-width="4" stroke-linejoin="round" fill="#fff"/>${mark}</svg>`;
}

function reviewBubbles(): string {
  return `<svg width="190" height="124" viewBox="0 0 190 124"><path d="M112 20h46a22 22 0 0 1 22 22v28a22 22 0 0 1-22 22h-4l2 18-20-18h-24a22 22 0 0 1-22-22V42a22 22 0 0 1 22-22z" fill="#E4DFDA"/><path d="M32 8h62a28 28 0 0 1 28 28v28a28 28 0 0 1-28 28H62L36 116l4-24h-8A28 28 0 0 1 4 64V36A28 28 0 0 1 32 8z" fill="${RED}"/><g fill="#fff"><circle cx="35" cy="50" r="8"/><circle cx="63" cy="50" r="8"/><circle cx="91" cy="50" r="8"/></g></svg>`;
}

/* ---------- bloques ---------- */

const center = (top: number, html: string, extra = "") => `<div class="mid" style="top:${top}px;${extra}">${html}</div>`;

function header(m: MonthlyImageModel, logo: string, photo: string, nexo: string): string {
  const titleSize = Math.max(16, Math.min(27, Math.floor(470 / (m.restaurantTitle.length * 0.5))));
  const locSize = Math.max(16, Math.min(30, Math.floor(260 / (m.locality.length * 0.5))));
  const sub = m.city && m.city !== m.locality ? esc(m.city) : "";
  return `
    <img class="abs" src="${logo}" alt="Tim Hortons" style="left:150px;top:10px;width:200px;height:112px;object-fit:contain"/>
    <div class="abs" style="left:27px;top:132px;width:445px;display:flex;align-items:center;justify-content:center;gap:34px">
      ${mapleLeaf(21)}<b class="cond" style="font-size:${locSize}px;line-height:1;font-weight:500;color:#111;white-space:nowrap;max-width:300px;overflow:hidden;text-overflow:ellipsis">${esc(m.locality)}</b>${mapleLeaf(21)}
    </div>
    ${sub ? `<div class="abs cond" style="left:27px;top:168px;width:445px;text-align:center;font-size:15px;line-height:1;color:#555;letter-spacing:.3px">${sub}</div>` : ""}
    <div class="abs" style="left:500px;top:25px;width:1px;height:158px;background:${RED}"></div>
    <div class="abs" style="left:535px;top:26px;width:480px">
      <h1 class="cond" style="font-size:56px;line-height:1;font-weight:700;letter-spacing:-1px;color:#080808">INFORME MENSUAL</h1>
      <h2 class="cond" style="margin-top:4px;font-size:47px;line-height:1;font-weight:700;color:${RED}">REPUTACIÓN ONLINE</h2>
      <h3 class="cond" style="margin-top:24px;font-size:${titleSize}px;line-height:1;font-weight:700;color:#111;white-space:nowrap">${esc(m.restaurantTitle)}</h3>
    </div>
    <img class="abs" src="${photo}" alt="" style="left:1018px;top:0;width:655px;height:204px;object-fit:contain;object-position:right center"/>
    <div class="abs" style="left:1676px;top:20px;width:215px;height:84px;display:flex;align-items:center;justify-content:center">${nexo}</div>
    <div class="abs" style="left:1668px;top:112px;width:209px;height:2px;background:${RED}"></div>
    <div class="abs cond" style="left:1668px;top:124px;width:209px;text-align:center;font-size:20px;line-height:1;font-weight:700;color:#111">FECHA DEL INFORME</div>
    <div class="abs cond" style="left:1676px;top:153px;width:199px;height:41px;border-radius:7px;background:${RED_DARK};display:flex;align-items:center;justify-content:center;font-size:${m.monthName.length > 8 ? 23 : 26}px;font-weight:700;color:#fff;white-space:nowrap">${esc(m.monthName)} ${m.year}</div>`;
}

function averageCard(m: MonthlyImageModel): string {
  return `<section class="card" style="left:19px;width:371px">
    ${center(31, '<span class="title">MEDIA MENSUAL</span>')}
    ${center(113, `<span class="kpi">${m.average === null ? "—" : fmt2(m.average)}</span>`)}
    ${center(202, `<span class="row" style="gap:12px">${ratingStars(m.average, RED, "#D7D3CE", 52)}</span>`)}
    ${center(263, '<span class="cond" style="font-size:25px;font-weight:400;color:#111">Sobre 5.0</span>')}
  </section>`;
}

function totalCard(m: MonthlyImageModel): string {
  return `<section class="card" style="left:404px;width:354px">
    ${center(31, '<span class="title">TOTAL RESEÑAS</span>')}
    ${center(113, `<span class="kpi">${m.total}</span>`)}
    ${center(183, `<span class="cond" style="font-size:24px;font-weight:700;color:#111">en el mes de ${esc(m.monthLower)}</span>`)}
    <div class="abs" style="left:0;right:0;top:211px;display:flex;justify-content:center">${reviewBubbles()}</div>
    ${center(353, `<span class="cond" style="font-size:17.5px;font-weight:400;color:#68615E">${m.positive} ${plural(m.positive, "positiva", "positivas")} · ${m.critical} ${plural(m.critical, "incidencia", "incidencias")}</span>`)}
  </section>`;
}

function reasonsBlock(m: MonthlyImageModel): string {
  const R = 54;
  const C = 2 * Math.PI * R;
  const causalTotal = m.causalReasons.reduce((sum, r) => sum + r.count, 0);
  let offset = 0;
  const arcs = causalTotal
    ? m.causalReasons.map((r, i) => {
        const length = (r.count / causalTotal) * C;
        const arc = `<circle cx="67" cy="67" r="${R}" fill="none" stroke="${REASON_COLORS[i]}" stroke-width="22" stroke-dasharray="${Math.max(length - (m.causalReasons.length > 1 ? 1.5 : 0), 0)} ${C}" stroke-dashoffset="${-offset}" transform="rotate(-90 67 67)"/>`;
        offset += length;
        return arc;
      }).join("")
    : `<circle cx="67" cy="67" r="${R}" fill="none" stroke="#F1ECE6" stroke-width="22"/>`;
  const legend = causalTotal
    ? m.causalReasons.map((r, i) => `<li><i style="background:${REASON_COLORS[i]}"></i><span>${esc(r.name)}</span><b>${Math.round(r.percent * 10) / 10 === Math.round(r.percent) ? Math.round(r.percent) : r.percent.toFixed(1)}%</b></li>`).join("")
    : `<li class="none"><span>${m.critical ? "Sin causa clasificada" : "Sin reseñas críticas este mes"}</span></li>`;
  const note = causalTotal ? `<p class="abs cond" style="left:197px;top:327px;font-size:13.5px;line-height:1;color:#6F6865">Motivo atribuido desde el comentario original.</p>` : "";
  return `
    <div class="abs" style="left:26px;top:201px;width:464px;height:1px;background:#E5D7CF"></div>
    <div class="abs cond" style="left:26px;top:220px;font-size:21px;line-height:1;font-weight:700;color:#111">MOTIVOS DE RESEÑAS NEGATIVAS</div>
    <div class="abs" style="left:32px;top:243px;width:124px;height:124px">
      <svg width="124" height="124" viewBox="0 0 134 134">${arcs}</svg>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
        <b class="cond" style="font-size:36px;line-height:1;font-weight:700;color:${RED}">${m.critical}</b>
        <small class="cond" style="margin-top:4px;font-size:11px;line-height:1.15;font-weight:700;text-align:center;color:#222">${plural(m.critical, "INCIDENCIA", "INCIDENCIAS")}<br/><span style="font-weight:400;font-size:10.5px">EN TOTAL</span></small>
      </div>
    </div>
    <ul class="legend" style="left:190px;top:264px;width:285px">${legend}</ul>${note}`;
}

function summaryCard(m: MonthlyImageModel): string {
  const positive = m.status === "positive";
  const title = SUMMARY_TITLE[m.status];
  const titleSize = Math.max(14, Math.min(20, Math.floor(350 / (title.length * 0.4))));
  const bullets = m.status === "empty"
    ? `<li>No hay reseñas registradas en este periodo.</li>`
    : `<li>${m.positivePct.toFixed(1)}% de valoraciones de 4 y 5 estrellas.</li>
       <li>${m.critical} ${plural(m.critical, "incidencia crítica detectada", "incidencias críticas detectadas")}.</li>
       <li>${m.weeksOnTarget} de ${m.weeks.length} semanas en objetivo.</li>`;
  return `<section class="card" style="left:773px;width:514px">
    ${center(31, '<span class="title">RESUMEN DEL MES</span>')}
    <div class="abs" style="left:31px;top:49px">${statusShield(positive)}</div>
    <p class="abs cond" style="left:149px;top:49px;font-size:${titleSize}px;line-height:20px;font-weight:700;color:#111;white-space:nowrap">${esc(title)}</p>
    <ul class="bullets abs" style="left:149px;top:79px">${bullets}</ul>
    ${reasonsBlock(m)}
  </section>`;
}

function distributionCard(m: MonthlyImageModel): string {
  const BAR = 304;
  const rows = m.ratings.map((count, i) => {
    const width = count > 0 ? Math.max(12, (count / m.total) * BAR) : 0;
    return `<div class="drow" style="top:${74 + i * 50}px"><span class="cond dn">${5 - i}</span><span class="dstar">${star(21, RED)}</span>
      <em><i style="width:${width}px;background:${BAR_COLORS[i]}"></i></em><b class="cond">${count} (${pct1(count, m.total)})</b></div>`;
  }).join("");
  return `<section class="card" style="left:1302px;width:594px">
    ${center(31, '<span class="title">DISTRIBUCIÓN GENERAL</span>')}
    ${rows}
    <div class="abs cond" style="left:32px;top:321px;font-size:27px;line-height:1;font-weight:700;color:#111">Total: ${m.total} reseñas</div>
  </section>`;
}

function weekColumn(week: MonthlyImageWeek, m: MonthlyImageModel): string {
  const max = Math.max(1, ...week.ratings);
  const rows = week.ratings.map((count, i) =>
    `<div class="wrow"><span class="cond">${5 - i}</span>${star(14, WEEK_STAR_COLORS[i])}<em><i style="width:${count > 0 ? Math.max(10, (count / max) * 100) : 0}%;background:${BAR_COLORS[i]}"></i></em><b class="cond">${count}</b></div>`).join("");
  const value = week.average === null
    ? `<small class="idle">SIN ACTIVIDAD</small><strong style="color:#B9B4AF">—</strong>`
    : `<small>MEDIA SEMANAL</small><strong style="color:${week.average >= m.objective ? GREEN : RED}">${fmt2(week.average)}</strong>`;
  return `<div class="week"><span class="pill cond">SEMANA ${week.index}</span><p class="range cond">${esc(week.label)}</p><div class="wrows">${rows}</div><div class="wavg cond">${value}</div></div>`;
}

function evolutionPanel(m: MonthlyImageModel): string {
  const left = 37, right = 781, top = 60, bottom = 212;
  const scale = (bottom - top) / 5;
  const y = (v: number) => bottom - v * scale;
  const n = m.weeks.length;
  const x = (i: number) => (n === 1 ? 402 : 87 + (i * 630) / (n - 1));
  const grid = [0, 1, 2, 3, 4, 5].map((v) =>
    `<line x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}" stroke="#E8E4E0" stroke-width="1.3"/><text x="${left - 12}" y="${y(v) + 5}" text-anchor="end" class="axis">${v}</text>`).join("");
  const labels = m.weeks.map((week, i) => {
    const [from, rest] = week.label.split(" – ");
    const [to, month] = rest.split(" ");
    return `<text x="${x(i)}" y="237" text-anchor="middle" class="axis x">${from}-${to} ${month.slice(0, 3)}</text>`;
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
  const target = `<line x1="${left}" x2="${right}" y1="${y(m.objective)}" y2="${y(m.objective)}" stroke="${RED}" stroke-width="2" stroke-dasharray="11 8"/>`;
  const legend = `<g><line x1="311" x2="354" y1="24" y2="24" stroke="${RED}" stroke-width="3"/><circle cx="332" cy="24" r="5.5" fill="${RED}"/><text x="366" y="29" class="legend-text">Media semanal</text>
    <line x1="534" x2="577" y1="24" y2="24" stroke="${RED}" stroke-width="2.2" stroke-dasharray="8 6"/><text x="588" y="29" class="legend-text">Objetivo (${fmt2(m.objective)})</text></g>`;
  return `<div class="evo"><svg width="815" height="326" viewBox="0 0 815 326" style="position:absolute;left:0;top:0">${legend}${grid}${target}${lines}${points}${labels}</svg>
    <div class="strip">
      <div><small>SEMANAS<br/>EN OBJETIVO</small><b style="color:${GREEN}">${m.weeksOnTarget} / ${m.weeks.length}</b></div>
      <div><small>SEMANAS<br/>SIN ACTIVIDAD</small><b style="color:${ORANGE}">${m.weeksWithoutActivity} / ${m.weeks.length}</b></div>
      <div><small>SEMANAS<br/>BAJO OBJETIVO</small><b style="color:${RED}">${m.weeksBelowTarget} / ${m.weeks.length}</b></div>
    </div></div>`;
}

function footer(nexoWhiteBox: string): string {
  return `<footer class="footer">
    <div class="abs" style="left:62px;top:11px">${coffeeCup(88)}</div>
    <p class="abs cond" style="left:185px;top:24px;font-size:26px;line-height:37px;font-weight:400;color:#fff">Cada café, cada donut<br/>y cada experiencia cuentan.</p>
    <div class="abs" style="left:621px;top:20px;width:1px;height:70px;background:rgba(255,255,255,.7)"></div>
    <div class="abs" style="left:722px;top:22px">${heart(86)}</div>
    <p class="abs cond" style="left:845px;top:24px;font-size:26px;line-height:37px;font-weight:400;color:#fff">Gracias por ayudarnos<br/>a mejorar cada día.</p>
    <div class="abs" style="left:1303px;top:20px;width:1px;height:70px;background:rgba(255,255,255,.7)"></div>
    <div class="abs" style="left:1500px;top:15px;width:360px;height:78px;border-radius:14px;background:#fff;display:flex;align-items:center;justify-content:center">${nexoWhiteBox}</div>
  </footer>`;
}

/* ---------- documento ---------- */

export async function buildTimHortonsImageHtml(m: MonthlyImageModel): Promise<string> {
  const [condensed, logo, photo, headerNexo, footerNexo] = await Promise.all([
    dataUri("fonts/roboto-condensed-variable.woff2"), dataUri("design/tim-hortons/th-logo.png"),
    dataUri("design/tim-hortons/th-network-header.png"), nexoLogoHtml(66, 138), nexoLogoHtml(58, 232),
  ]);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>Informe mensual ${esc(m.restaurantTitle)}</title><style>
    @font-face{font-family:'Roboto Condensed';src:url('${condensed}') format('woff2');font-weight:100 900}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:${MONTHLY_IMAGE_WIDTH}px;height:${MONTHLY_IMAGE_HEIGHT}px;overflow:hidden;background:${BG}}
    .canvas{position:relative;width:${MONTHLY_IMAGE_WIDTH}px;height:${MONTHLY_IMAGE_HEIGHT}px;overflow:hidden;background:${BG};color:#111;font-family:'Roboto Condensed','Barlow Condensed','Arial Narrow',sans-serif}
    .cond{font-family:'Roboto Condensed','Barlow Condensed','Arial Narrow',sans-serif}
    .abs{position:absolute}
    .nexo{display:flex;align-items:center}.nexo img{display:block;object-fit:contain}
    .card{position:absolute;top:210px;height:373px;background:${CARD};border:1px solid ${BORDER};border-radius:15px;box-shadow:0 2px 8px rgba(70,30,20,.025)}
    .mid{position:absolute;left:0;right:0;display:flex;justify-content:center;align-items:center;transform:translateY(-50%);line-height:1}
    .row{display:flex}
    .title{font-size:25px;font-weight:700;color:#111;letter-spacing:.2px}
    .kpi{font-size:104px;font-weight:700;color:${RED};letter-spacing:-1px}
    .bullets{list-style:none}
    .bullets li{position:relative;padding-left:14px;font-size:17.5px;line-height:30px;color:#222;white-space:nowrap}
    .bullets li::before{content:"";position:absolute;left:1px;top:13px;width:4.5px;height:4.5px;border-radius:50%;background:#222}
    .legend{position:absolute;list-style:none}
    .legend li{display:flex;align-items:center;gap:11px;min-height:46px;font-size:17px;line-height:1.2;color:#111}
    .legend li i{width:19px;height:19px;border-radius:50%;flex:none}
    .legend li span{flex:1;min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .legend li b{font-size:17px;font-weight:700;flex:none}
    .legend li.none{color:#6b6460}
    .drow{position:absolute;left:32px;right:30px;height:30px;display:flex;align-items:center;transform:translateY(-50%)}
    .dn{width:22px;font-size:22px;font-weight:700}
    .dstar{width:34px;display:flex;justify-content:center}
    .drow em{width:304px;height:16px;border-radius:99px;background:#EDEAE6;overflow:hidden;margin-left:12px}
    .drow em i{display:block;height:100%;border-radius:99px}
    .drow b{margin-left:38px;font-size:22px;font-weight:700;white-space:nowrap;color:#111}
    .sec{position:absolute;display:flex;align-items:center;gap:6px;height:30px;top:598px}
    .sec h3{font-size:26px;line-height:1;font-weight:700;color:${RED};white-space:nowrap;letter-spacing:.2px}
    .sec i{flex:1;height:1.5px;background:#E3B9BE}
    .weeks{position:absolute;left:19px;top:630px;width:1049px;height:326px;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;background:${CARD};border:1px solid ${BORDER};border-radius:15px;box-shadow:0 2px 8px rgba(70,30,20,.025)}
    .week{position:relative;text-align:center;border-left:1px solid #EADFD7}
    .week:first-child{border-left:0}
    .pill{display:block;margin:9px auto 0;width:min(146px,78%);height:30px;line-height:30px;background:${RED};color:#fff;border-radius:6px;font-size:17px;font-weight:700;letter-spacing:.3px;box-shadow:0 1px 3px rgba(120,0,10,.25)}
    .range{margin-top:16px;font-size:15.5px;line-height:1;font-weight:700;color:#111;white-space:nowrap}
    .wrows{position:absolute;left:24px;right:24px;top:77px}
    .wrow{display:flex;align-items:center;gap:7px;height:27.7px}
    .wrow>span{width:12px;font-size:14.5px;font-weight:700;text-align:right}
    .wrow em{flex:1;height:10px;border-radius:99px;background:#ECEAE7;overflow:hidden;min-width:0}
    .wrow em i{display:block;height:100%;border-radius:99px}
    .wrow b{min-width:14px;text-align:right;font-size:15px;font-weight:500}
    .wavg{position:absolute;left:20px;right:20px;top:238px;border-top:1px solid #E5DAD2;padding-top:13px;white-space:nowrap}
    .wavg small{display:block;font-size:14.5px;line-height:1;font-weight:700;color:#111}
    .wavg small.idle{color:#8A8580}
    .wavg strong{display:block;margin-top:9px;font-size:41px;line-height:1.05;font-weight:700}
    .evo{position:absolute;left:1081px;top:630px;width:815px;height:326px;background:${CARD};border:1px solid ${BORDER};border-radius:15px;box-shadow:0 2px 8px rgba(70,30,20,.025);overflow:hidden}
    .axis{font:400 14px 'Roboto Condensed',sans-serif;fill:#333}.axis.x{font-size:13.5px;font-weight:700;fill:#111}
    .point{font:700 17.5px 'Roboto Condensed',sans-serif;fill:#111;paint-order:stroke;stroke:${CARD};stroke-width:4px;stroke-linejoin:round}
    .idle-label{font:700 13px 'Roboto Condensed',sans-serif;fill:#8A8580;letter-spacing:.3px}
    .legend-text{font:400 15px 'Roboto Condensed',sans-serif;fill:#111}
    .strip{position:absolute;left:12px;right:12px;top:252px;height:61px;background:#F7F3EF;border-radius:11px;display:grid;grid-template-columns:1fr 1fr 1fr}
    .strip>div{display:flex;flex-direction:column;align-items:center;justify-content:center;border-left:1px solid #E5D6CC;margin:9px 0}
    .strip>div:first-child{border-left:0}
    .strip small{font-size:12.5px;line-height:1.1;font-weight:700;color:#111;text-align:center}
    .strip b{margin-top:3px;font-size:26px;line-height:1;font-weight:700}
    .footer{position:absolute;left:0;top:973px;width:${MONTHLY_IMAGE_WIDTH}px;height:107px;background:${FOOTER}}
  </style></head><body><div class="canvas" data-report="monthly-image-th">
    ${header(m, logo, photo, headerNexo)}
    ${averageCard(m)}${totalCard(m)}${summaryCard(m)}${distributionCard(m)}
    <div class="sec" style="left:49px;width:1019px"><h3>DESGLOSE SEMANAL</h3><i></i></div>
    <div class="weeks">${m.weeks.map((week) => weekColumn(week, m)).join("")}</div>
    <div class="sec" style="left:1200px;width:696px"><h3>EVOLUCIÓN DE LA MEDIA SEMANAL</h3><i></i></div>
    ${evolutionPanel(m)}
    ${footer(footerNexo)}
  </div></body></html>`;
}
