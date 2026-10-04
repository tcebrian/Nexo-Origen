import "server-only";

import type { MonthlyImageModel, MonthlyImageWeek } from "./model";
import { calendarCheck, dataUri, esc, fmt2, nexoLogoHtml, pct1, ratingStars, star, MONTHLY_IMAGE_HEIGHT, MONTHLY_IMAGE_WIDTH } from "./shared";

/**
 * Plantilla dedicada de Santa Gloria Coffee & Bakery (1920×1080).
 * Diseño fijo: solo cambian los datos del modelo. Cada bloque es una función
 * independiente (cabecera, KPIs, resumen, distribución, semanas, evolución,
 * pie) para poder retocar una sección sin tocar las demás.
 */

const BROWN = "#301005";
const BROWN_DARK = "#351206";
const ORANGE = "#E76B00";
const CORAL = "#F04A17";
const GREEN = "#078B54";
/** Color por estrellas, de 5★ a 1★. */
const STAR_COLORS = [GREEN, ORANGE, "#E99B00", "#D76500", "#8C2210"];
const REASON_COLORS = [BROWN_DARK, ORANGE, "#F3A340"];
const BORDER = "#E7D8CE";

/* ---------- iconos (SVG propios) ---------- */

const coffeeCup = (size: number) =>
  `<svg width="${size}" height="${size * 0.72}" viewBox="0 0 100 72" fill="none" stroke="${ORANGE}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22h60c0 20-8 34-30 34S12 42 12 22z"/><path d="M72 28h6a9 9 0 0 1 0 18h-8"/><path d="M4 62c10 6 26 8 42 8s32-2 44-8"/><path d="M26 14c-4-4 4-6 0-10M42 14c-4-4 4-6 0-10"/></svg>`;

function statusShield(positive: boolean, empty: boolean): string {
  const color = empty ? "#8A8580" : positive ? GREEN : CORAL;
  const mark = positive && !empty
    ? `<path d="M23 44l10 10 20-22" stroke="${color}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
    : `<path d="M38 28v24" stroke="${color}" stroke-width="5.5" stroke-linecap="round"/><circle cx="38" cy="62" r="3.6" fill="${color}"/>`;
  return `<svg width="76" height="92" viewBox="0 0 76 88" fill="none"><path d="M38 4L8 16v24c0 22 13 38 30 44 17-6 30-22 30-44V16L38 4z" stroke="${color}" stroke-width="4" stroke-linejoin="round" fill="#fff"/>${mark}</svg>`;
}

function reviewBubbles(): string {
  return `<svg width="176" height="124" viewBox="0 0 176 124"><path d="M104 20h40a22 22 0 0 1 22 22v26a22 22 0 0 1-22 22h-2l5 20-24-20h-19a22 22 0 0 1-22-22V42a22 22 0 0 1 22-22z" fill="#EDE5DC"/><g fill="#fff"><circle cx="140" cy="56" r="4.5"/><circle cx="154" cy="56" r="0"/></g><path d="M30 8h66a26 26 0 0 1 26 26v26a26 26 0 0 1-26 26H62l-30 24 4-24h-6A26 26 0 0 1 4 60V34A26 26 0 0 1 30 8z" fill="${BROWN}"/><g fill="#fff"><circle cx="34" cy="47" r="7"/><circle cx="63" cy="47" r="7"/><circle cx="92" cy="47" r="7"/></g></svg>`;
}

/* ---------- bloques ---------- */

function header(m: MonthlyImageModel, logo: string, nexo: string): string {
  const locality = m.restaurantTitle.replace(/^SANTA GLORIA\s+/, "");
  const title = `SANTA GLORIA COFFEE &amp; BAKERY – ${esc(locality)}`;
  const size = Math.max(16, Math.min(27, Math.floor(690 / (`SANTA GLORIA COFFEE & BAKERY – ${locality}`.length * 0.5))));
  return `
    <img class="abs" src="${logo}" alt="Santa Gloria" style="left:50px;top:25px;width:225px;height:125px;object-fit:contain"/>
    <div class="abs" style="left:330px;top:24px;width:1.5px;height:125px;background:#7A4A35"></div>
    <div class="abs" style="left:365px;top:25px;width:700px">
      <h1 class="cond" style="font-size:58px;line-height:.96;font-weight:700;letter-spacing:-1px;color:#17100D">INFORME MENSUAL</h1>
      <h2 class="cond" style="margin-top:9px;font-size:31px;line-height:1;font-weight:700;color:${ORANGE}">REPUTACIÓN ONLINE</h2>
      <h3 class="cond" style="margin-top:12px;font-size:${size}px;line-height:1;font-weight:700;color:#231711;white-space:nowrap">${title}</h3>
    </div>
    <div class="abs" style="left:1060px;top:22px;width:395px;height:130px;display:flex;align-items:center;justify-content:center">${nexo}</div>
    <div class="abs" style="left:1480px;top:24px;width:1px;height:125px;background:#7A4A35"></div>
    <div class="abs" style="left:1520px;top:46px">${calendarCheck(BROWN, 74, 3.6)}</div>
    <div class="abs" style="left:1638px;top:48px">
      <small class="cond" style="display:block;font-size:23px;line-height:1;font-weight:700;color:#22130E">FECHA DEL INFORME</small>
      <b class="cond" style="display:block;margin-top:14px;font-size:${m.monthName.length > 8 ? 31 : 35}px;line-height:1;font-weight:700;color:${ORANGE};white-space:nowrap">${esc(m.monthName)} ${m.year}</b>
    </div>
    <div class="abs" style="left:25px;top:169px;width:1870px;height:4px;border-radius:99px;background:${BROWN_DARK}"></div>`;
}

const center = (top: number, html: string, extra = "") => `<div class="mid" style="top:${top}px;${extra}">${html}</div>`;

function averageCard(m: MonthlyImageModel): string {
  const progress = m.average === null ? 0 : Math.min(100, (m.average / 5) * 100);
  return `<section class="card" style="left:27px;top:188px;width:405px">
    ${center(34, '<span class="cond title">MEDIA MENSUAL</span>')}
    ${center(118, `<span class="serif big" style="font-size:108px">${m.average === null ? "—" : fmt2(m.average)}</span>`)}
    ${center(204, `<span class="row">${ratingStars(m.average, "#EA6800", "#D7D4CF", 50, true)}</span>`, "gap:8px")}
    ${center(287, '<span class="cond" style="font-size:24px;font-weight:400;color:#2A140C">Sobre 5.0</span>')}
    <div class="abs" style="left:78px;top:337px;width:250px;height:6px;border-radius:99px;background:#DEDAD4;overflow:hidden"><i style="display:block;height:100%;width:${progress}%;background:${ORANGE}"></i></div>
  </section>`;
}

function totalCard(m: MonthlyImageModel): string {
  return `<section class="card" style="left:446px;top:188px;width:350px">
    ${center(34, '<span class="cond title">TOTAL RESEÑAS</span>')}
    ${center(118, `<span class="serif big" style="font-size:108px">${m.total}</span>`)}
    ${center(190, `<span class="cond" style="font-size:24px;font-weight:400;color:#2A140C">en el mes de ${esc(m.monthLower)}</span>`)}
    <div class="abs" style="left:0;right:0;top:218px;display:flex;justify-content:center">${reviewBubbles()}</div>
    ${center(364, `<span class="cond" style="font-size:19px;font-weight:400;color:#2A140C">${m.positive} (4–5★) · ${m.belowPositive} (1–3★)</span>`)}
  </section>`;
}

function reasonsBlock(m: MonthlyImageModel): string {
  const R = 57;
  const C = 2 * Math.PI * R;
  const shown = m.reasons.reduce((sum, r) => sum + r.count, 0);
  const slices = [...m.reasons.map((r, i) => ({ count: r.count, color: REASON_COLORS[i] })),
    ...(m.critical > shown ? [{ count: m.critical - shown, color: "#D9D3CF" }] : [])];
  const base = shown || m.critical;
  let offset = 0;
  const arcs = m.critical
    ? slices.map((slice) => {
        const length = (slice.count / Math.max(base, m.critical)) * C;
        const arc = `<circle cx="69" cy="69" r="${R}" fill="none" stroke="${slice.color}" stroke-width="24" stroke-dasharray="${Math.max(length - (slices.length > 1 ? 1.5 : 0), 0)} ${C}" stroke-dashoffset="${-offset}" transform="rotate(-90 69 69)"/>`;
        offset += length;
        return arc;
      }).join("")
    : `<circle cx="69" cy="69" r="${R}" fill="none" stroke="#F1ECE6" stroke-width="24"/>`;
  const legend = m.critical
    ? m.reasons.map((r, i) => `<li><i style="background:${REASON_COLORS[i]}"></i><span>${esc(r.name)}</span><b>${r.percent.toFixed(1)}%</b></li>`).join("")
    : `<li class="none"><span>Sin reseñas críticas este mes</span></li>`;
  return `
    <div class="cond abs" style="left:21px;top:197px;font-size:21px;line-height:1;font-weight:700;color:#1B0F0A">MOTIVOS DE RESEÑAS CRÍTICAS (1–${m.criticalMaxStars}★)</div>
    <div class="abs" style="left:22px;top:222px;width:138px;height:138px">
      <svg width="138" height="138" viewBox="0 0 138 138">${arcs}</svg>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
        <b class="serif" style="font-size:38px;line-height:1;color:${BROWN}">${m.critical}</b>
        <small class="cond" style="margin-top:4px;font-size:11px;line-height:1.15;font-weight:700;text-align:center;color:#3A2418">INCIDENCIAS<br/><span style="font-weight:400;font-size:10.5px">EN TOTAL</span></small>
      </div>
    </div>
    <ul class="legend" style="left:178px;top:236px;width:274px">${legend}</ul>`;
}

function summaryCard(m: MonthlyImageModel): string {
  const positive = m.status === "positive";
  const color = m.status === "empty" ? "#8A8580" : positive ? GREEN : CORAL;
  const lines = m.status === "empty"
    ? `<p>No hay reseñas registradas en este periodo.</p>`
    : positive
      ? `<p>${m.positivePct.toFixed(1)}% de valoraciones 4–5★.</p><p>${m.weeksOnTarget} de ${m.weeks.length} semanas en objetivo.</p>`
      : `<p>${m.positivePct.toFixed(1)}% de valoraciones 4–5★.</p><p>${m.critical} incidencias a revisar.</p>`;
  return `<section class="card" style="left:812px;top:188px;width:480px">
    ${center(34, '<span class="cond title">RESUMEN DEL MES</span>')}
    <div class="abs" style="left:18px;top:58px;width:444px;height:120px;border:1px solid #E6D3C5;border-radius:15px;display:flex;align-items:center;gap:22px;padding:0 20px 0 22px">
      ${statusShield(positive, m.status === "empty")}
      <div class="cond" style="color:#2A140C"><p style="font-size:21px;line-height:1.1;font-weight:700;color:${color};margin-bottom:9px;white-space:nowrap">${esc(m.statusTitle)}</p><div class="sumlines">${lines}</div></div>
    </div>
    ${reasonsBlock(m)}
  </section>`;
}

function distributionCard(m: MonthlyImageModel): string {
  const BAR = 278;
  const rows = m.ratings.map((count, i) => {
    const width = count > 0 ? Math.max(12, (count / m.total) * BAR) : 0;
    return `<div class="drow" style="top:${83 + i * 52.5}px">
      <span class="cond dn">${5 - i}</span><span class="dstar">${star(21, STAR_COLORS[i])}</span>
      <em><i style="width:${width}px;background:${STAR_COLORS[i]}"></i></em>
      <b class="cond">${count} (${pct1(count, m.total)})</b></div>`;
  }).join("");
  return `<section class="card" style="left:1308px;top:188px;width:585px">
    ${center(34, '<span class="cond title">DISTRIBUCIÓN GENERAL</span>')}
    ${rows}
    <div class="cond abs" style="left:39px;top:336px;font-size:27px;line-height:1;font-weight:700;color:#1B0F0A">Total: ${m.total} reseñas</div>
    <div class="cond abs" style="left:39px;top:370px;font-size:16px;line-height:1;color:#3A2418">Media exacta: ${m.average === null ? "—" : m.average.toFixed(6)} · Objetivo: ${fmt2(m.objective)}</div>
  </section>`;
}

function weekCard(week: MonthlyImageWeek, m: MonthlyImageModel): string {
  const max = Math.max(1, ...week.ratings);
  const rows = week.ratings.map((count, i) =>
    `<div class="wrow"><span class="cond">${5 - i}</span>${star(13, STAR_COLORS[i])}<em><i style="width:${count > 0 ? Math.max(10, (count / max) * 100) : 0}%;background:${STAR_COLORS[i]}"></i></em><b class="cond">${count}</b></div>`).join("");
  const value = week.average === null
    ? `<small class="cond idle">SIN ACTIVIDAD</small><strong class="serif" style="color:#B9B4AF">—</strong>`
    : `<small class="cond">MEDIA SEMANAL</small><strong class="serif" style="color:${week.average >= m.objective ? GREEN : CORAL}">${fmt2(week.average)}</strong>`;
  return `<div class="week"><span class="pill cond">SEMANA ${week.index}</span><p class="range cond">${esc(week.label)}</p><div class="wrows">${rows}</div><div class="wavg">${value}</div></div>`;
}

function evolutionPanel(m: MonthlyImageModel): string {
  const left = 52, right = 802, top = 74, bottom = 238;
  const scale = (bottom - top) / 5;
  const y = (v: number) => bottom - v * scale;
  const n = Math.max(1, m.weeks.length);
  const colW = (right - left) / n;
  const x = (i: number) => left + colW * (i + 0.5);
  const grid = [0, 1, 2, 3, 4, 5].map((v) =>
    `<line x1="${left - 10}" x2="${right + 8}" y1="${y(v)}" y2="${y(v)}" stroke="#DEDAD5" stroke-opacity=".7" stroke-width="1.3"/><text x="${left - 22}" y="${y(v) + 5}" text-anchor="end" class="axis">${v}</text>`).join("");
  const labels = m.weeks.map((week, i) => {
    const [from, rest] = week.label.split(" – ");
    const [to, month] = rest.split(" ");
    return `<text x="${x(i)}" y="262" text-anchor="middle" class="axis x">${from}–${to} ${month.slice(0, 3)}</text>`;
  }).join("");
  const segments: string[][] = [[]];
  m.weeks.forEach((week, i) => {
    if (week.average === null) { if (segments[segments.length - 1].length) segments.push([]); return; }
    segments[segments.length - 1].push(`${x(i)},${y(week.average)}`);
  });
  const lines = segments.filter((s) => s.length > 1).map((s) =>
    `<polyline points="${s.join(" ")}" fill="none" stroke="${BROWN_DARK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`).join("");
  const points = m.weeks.map((week, i) => week.average === null
    ? `<text x="${x(i)}" y="${y(2.9)}" text-anchor="middle" class="idle-label">SIN ACTIVIDAD</text>`
    : `<circle cx="${x(i)}" cy="${y(week.average)}" r="6.5" fill="${BROWN_DARK}" stroke="#fff" stroke-width="1.5"/><text x="${x(i)}" y="${y(week.average) - 15}" text-anchor="middle" class="point">${fmt2(week.average)}</text>`).join("");
  const target = `<line x1="${left - 10}" x2="${right + 8}" y1="${y(m.objective)}" y2="${y(m.objective)}" stroke="#F06714" stroke-width="2" stroke-dasharray="12 8"/>`;
  const legend = `<g><line x1="224" x2="262" y1="27" y2="27" stroke="${BROWN_DARK}" stroke-width="3"/><circle cx="243" cy="27" r="5" fill="${BROWN_DARK}"/><text x="274" y="32" class="legend-text">Media semanal</text>
    <line x1="530" x2="578" y1="27" y2="27" stroke="${ORANGE}" stroke-width="2.4" stroke-dasharray="9 6"/><text x="590" y="32" class="legend-text">Objetivo de marca (${fmt2(m.objective)})</text></g>`;
  return `<div class="evo"><svg width="817" height="338" viewBox="0 0 817 338" style="position:absolute;left:0;top:0">${legend}${grid}${target}${lines}${points}${labels}</svg>
    <div class="strip">
      <div><small class="cond">SEMANAS EN OBJETIVO</small><b class="serif" style="color:${GREEN}">${m.weeksOnTarget} / ${m.weeks.length}</b></div>
      <div><small class="cond">SEMANAS SIN ACTIVIDAD</small><b class="serif" style="color:${ORANGE}">${m.weeksWithoutActivity} / ${m.weeks.length}</b></div>
      <div><small class="cond">SEMANAS BAJO OBJETIVO</small><b class="serif" style="color:${CORAL}">${m.weeksBelowTarget} / ${m.weeks.length}</b></div>
    </div></div>`;
}

function footer(m: MonthlyImageModel): string {
  return `<footer class="footer">
    <div class="abs" style="left:97px;top:14px;width:66px;height:66px;border:2px solid #6B3E29;border-radius:50%;display:flex;align-items:center;justify-content:center"><span class="italic" style="font-size:27px;color:#3B1A0F">SG</span></div>
    <div class="abs" style="left:196px;top:14px"><b class="cond" style="display:block;font-size:17px;line-height:1;font-weight:700;color:#1B0F0A">NUESTRO ORIGEN</b><p class="cond" style="margin-top:9px;font-size:14px;line-height:1.3;color:#3A2418">PASIÓN POR LO ARTESANO.<br/>AMOR POR LOS DETALLES.</p></div>
    <div class="abs" style="left:496px;top:16px;width:1.5px;height:62px;background:#7A4A35"></div>
    <div class="abs" style="left:603px;top:13px">${coffeeCup(100)}</div>
    <p class="abs italic" style="left:754px;top:8px;font-size:26px;line-height:1.3;color:#3B1A0F">Convertimos momentos<br/>en recuerdos inolvidables.</p>
    <div class="abs" style="left:1267px;top:16px;width:1.5px;height:62px;background:#7A4A35"></div>
    <div class="abs" style="left:1346px;top:14px">${calendarCheck(BROWN, 62, 3.6)}</div>
    <div class="abs" style="left:1458px;top:18px"><small class="cond" style="display:block;font-size:17px;line-height:1;color:#2A140C">Informe generado el</small><b class="cond" style="display:block;margin-top:10px;font-size:23px;line-height:1;font-weight:700;color:${ORANGE}">${esc(m.generatedDate)}</b></div>
  </footer>`;
}

/* ---------- documento ---------- */

export async function buildSantaGloriaImageHtml(m: MonthlyImageModel): Promise<string> {
  const [condensed, playfair700, playfair800, playfairItalic, logo, inter400] = await Promise.all([
    dataUri("fonts/roboto-condensed-variable.woff2"), dataUri("fonts/playfair-display-700-normal.woff2"),
    dataUri("fonts/playfair-display-800-normal.woff2"), dataUri("fonts/playfair-display-400-italic.woff2"),
    dataUri(m.theme.logo), dataUri("fonts/inter-400-normal.woff2"),
  ]);
  const [headerNexo] = await Promise.all([nexoLogoHtml(126, 244)]);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>Informe mensual ${esc(m.restaurantTitle)}</title><style>
    @font-face{font-family:'Roboto Condensed';src:url('${condensed}') format('woff2');font-weight:100 900}
    @font-face{font-family:'Playfair Display';src:url('${playfair700}') format('woff2');font-weight:700}
    @font-face{font-family:'Playfair Display';src:url('${playfair800}') format('woff2');font-weight:800}
    @font-face{font-family:'Playfair Display';src:url('${playfairItalic}') format('woff2');font-weight:400;font-style:italic}
    @font-face{font-family:Inter;src:url('${inter400}') format('woff2');font-weight:400}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:${MONTHLY_IMAGE_WIDTH}px;height:${MONTHLY_IMAGE_HEIGHT}px;overflow:hidden;background:#fff}
    .canvas{position:relative;width:${MONTHLY_IMAGE_WIDTH}px;height:${MONTHLY_IMAGE_HEIGHT}px;overflow:hidden;background:#fff;color:#171311;font-family:'Roboto Condensed',Roboto,Arial,sans-serif}
    .cond{font-family:'Roboto Condensed','Barlow Condensed','Arial Narrow',sans-serif}
    .serif{font-family:'Playfair Display',Georgia,serif;font-weight:800;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1}
    .italic{font-family:'Playfair Display',Georgia,serif;font-style:italic;font-weight:400}
    .abs{position:absolute}
    .nexo{display:flex;align-items:center}.nexo img{display:block;object-fit:contain}
    .card{position:absolute;height:396px;background:#fff;border:1px solid ${BORDER};border-radius:15px;box-shadow:0 2px 8px rgba(50,20,5,.03)}
    .mid{position:absolute;left:0;right:0;display:flex;justify-content:center;align-items:center;transform:translateY(-50%);line-height:1}
    .row{display:flex;gap:8px}
    .title{font-size:25px;font-weight:700;color:#24130D;letter-spacing:.2px}
    .big{font-weight:800;color:${BROWN};letter-spacing:-1px}
    .legend{position:absolute;list-style:none}
    .legend li{display:flex;align-items:center;gap:10px;height:35px;font-size:16.5px;color:#2A140C}
    .legend li i{width:12px;height:12px;border-radius:50%;flex:none}
    .legend li span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .legend li b{font-size:15px;font-weight:700;flex:none}
    .legend li.none{color:#6b5a50}
    .sumlines p{font-size:17px;line-height:1.5;color:#2A140C}
    .drow{position:absolute;left:39px;right:34px;height:30px;display:flex;align-items:center;transform:translateY(-50%)}
    .dn{width:22px;font-size:23px;font-weight:700}
    .dstar{width:34px;display:flex;justify-content:center}
    .drow em{width:278px;height:18px;border-radius:99px;background:#EFECE7;overflow:hidden;margin-left:10px}
    .drow em i{display:block;height:100%;border-radius:99px}
    .drow b{margin-left:30px;font-size:21px;font-weight:400;white-space:nowrap;color:#2A140C}
    .sec{position:absolute;display:flex;align-items:center;gap:6px;height:30px;top:603px}
    .sec h3{font-size:26px;line-height:1;font-weight:700;color:#1B0F0A;white-space:nowrap;letter-spacing:.2px}
    .sec i{flex:1;height:1.5px;background:#B8825F}
    .weeks{position:absolute;left:29px;top:637px;width:1016px;height:338px;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:${m.weeks.length > 5 ? 8 : 10}px}
    .week{position:relative;background:#fff;border:1px solid #E4D4C8;border-radius:14px;box-shadow:0 2px 8px rgba(50,20,5,.03);text-align:center}
    .pill{display:block;margin:14px auto 0;width:min(120px,78%);height:32px;line-height:32px;background:${BROWN_DARK};color:#fff;border-radius:6px;font-size:16px;font-weight:700;letter-spacing:.3px}
    .range{margin-top:16px;font-size:15.5px;line-height:1;font-weight:700;color:#1B0F0A;white-space:nowrap}
    .wrows{position:absolute;left:16px;right:16px;top:86px}
    .wrow{display:flex;align-items:center;gap:6px;height:29.7px}
    .wrow>span{width:12px;font-size:14px;font-weight:700;text-align:right}
    .wrow em{flex:1;height:10px;border-radius:99px;background:#EEEAE5;overflow:hidden;min-width:0}
    .wrow em i{display:block;height:100%;border-radius:99px}
    .wrow b{min-width:14px;text-align:right;font-size:15px;font-weight:400}
    .wavg{position:absolute;left:14px;right:14px;white-space:nowrap;top:249px;border-top:1px solid #E4DAD3;padding-top:13px}
    .wavg small{display:block;font-size:15px;line-height:1;font-weight:700;color:#1B0F0A}
    .wavg small.idle{color:#8A8580}
    .wavg strong{display:block;margin-top:9px;font-size:44px;line-height:1.05;font-weight:800}
    .evo{position:absolute;left:1075px;top:637px;width:817px;height:338px;background:#fff;border:1px solid #E4D4C8;border-radius:14px;box-shadow:0 2px 8px rgba(50,20,5,.03);overflow:hidden}
    .axis{font:400 13.5px 'Roboto Condensed',sans-serif;fill:#3A2418}.axis.x{font-size:14px;font-weight:700;fill:#1B0F0A}
    .point{font:700 17px 'Roboto Condensed',sans-serif;fill:#1B0F0A;paint-order:stroke;stroke:#fff;stroke-width:4px;stroke-linejoin:round}
    .idle-label{font:700 13px 'Roboto Condensed',sans-serif;fill:#8A8580;letter-spacing:.3px}
    .legend-text{font:400 15px 'Roboto Condensed',sans-serif;fill:#2A140C}
    .strip{position:absolute;left:21px;right:15px;top:279px;height:50px;background:#F7F4EF;border-radius:12px;display:grid;grid-template-columns:1fr 1fr 1fr}
    .strip>div{display:flex;flex-direction:column;align-items:center;justify-content:center;border-left:1px solid #E4DAD3;margin:8px 0}
    .strip>div:first-child{border-left:0}
    .strip small{font-size:13px;line-height:1;font-weight:700;color:#1B0F0A;letter-spacing:.2px}
    .strip b{margin-top:4px;font-size:25px;line-height:1;font-weight:800}
    .footer{position:absolute;left:0;top:990px;width:${MONTHLY_IMAGE_WIDTH}px;height:90px;background:#fff;border-top:1px solid #E5D5CA}
  </style></head><body><div class="canvas" data-report="monthly-image-sg">
    ${header(m, logo, headerNexo)}
    ${averageCard(m)}${totalCard(m)}${summaryCard(m)}${distributionCard(m)}
    <div class="sec" style="left:53px;width:992px"><h3 class="cond">DESGLOSE SEMANAL</h3><i></i></div>
    <div class="weeks">${m.weeks.map((week) => weekCard(week, m)).join("")}</div>
    <div class="sec" style="left:1190px;width:702px"><h3 class="cond">EVOLUCIÓN DE LA MEDIA SEMANAL</h3><i></i></div>
    ${evolutionPanel(m)}
    ${footer(m)}
  </div></body></html>`;
}
