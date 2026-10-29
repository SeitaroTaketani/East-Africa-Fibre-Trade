/* The story: one object per board. text() returns the words, with every number computed from window.EAFF_DATA
   (nothing typed by hand, as in the reference story.js); draw() builds the board's chart. */
(function () {
"use strict";
const SB = window.SB, D = SB.D, F = SB.fmt, C = SB.charts;
const ys = D.exp.years, py = D.prod.years;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const v = (arr, y) => SB.at(arr, y, ys);
const pv = (arr, y) => SB.at(arr, y, py);
const b = s => `<b>${s}</b>`;
const kpi = (val, lab, cls, d) => `<div class="kpi reveal" style="--d:${d}"><div class="v ${cls || ""}">${val}</div><div class="l">${lab}</div></div>`;
const head = (eyebrow, title, d0) => `<p class="eyebrow reveal" style="--d:${d0 || 0}">${eyebrow}</p><h2 class="reveal" style="--d:${(d0 || 0) + 1}">${title}</h2>`;
const lead = (html, d) => `<p class="lead reveal" style="--d:${d}">${html}</p>`;
const src = (html, d) => `<p class="src reveal" style="--d:${d}">${html}</p>`;
const range = (a, c) => (a == null || c == null ? "–" : Math.round(Math.min(a, c)) + "–" + Math.round(Math.max(a, c)) + "%");

/* ── shared quantities ── */
const strand = id => D.prod.strands.find(s => s.id === id).v;
const share = D.ind["I01_HF.SIS.RAW"].v;
const T = D.exp.t, R = D.exp.real_muv, PH = D.phases;
/* 5-year average of sisal exports (the year and the four before; years are consecutive) */
const T5 = T.map((_, i) => i >= 4 && T.slice(i - 4, i + 1).every(x => x != null) ? d3.mean(T.slice(i - 4, i + 1)) : null);
const ph = name => PH.find(p => p.phase === name);
const evById = id => D.events.find(e => e.id === id) || {};
const num = (id, re) => { const m = (evById(id).text || "").match(re); return m ? m[1] : null; };
const bansOn = D.bans.filter(b => b.level === "national_law" && b.year);   /* national laws only (QA Q35) */
const bansOther = D.bans.filter(b => b.level !== "national_law" && b.level_short);   /* announced national ban; state orders only */
const robust = (head_, year) => D.robust.find(r => r.headline.startsWith(head_) && r.year === year);
const lastProdYear = SB.lastYear(py, D.prod.world);
const ind = id => SB.ind(id);
/* destination groups: four regions with their own colour, the rest grey (validated palette) */
const GROUPS = [
  { id: "EUNA", label: "Europe & N. America", color: "#1c6aad", m: ["WEUR", "EEUR", "NAM"] },
  { id: "MENA", label: "Middle East & N. Africa", color: "#c9a227", m: ["MENA"] },
  { id: "ASIA", label: "Asia & Pacific", color: "#7b4fa8", m: ["CHN", "EAP", "SAS"] },
  { id: "SSA", label: "Sub-Saharan Africa", color: "#e3820b", m: ["SSA"] },
  { id: "OTH", label: "Other", color: "#b9aea6", m: ["LAC", "OTH"] },
];
const gshare = (g, y) => { let s = 0, any = false; g.m.forEach(r => { const a = D.dest.share[r]; const x = a ? v(a, y) : null; if (x != null) { s += x; any = true; } }); return any ? s : (v(D.dest.share.WEUR, y) != null ? 0 : null); };
const rshare = (r, y) => (D.dest.share[r] ? v(D.dest.share[r], y) : null);

/* tonnes of the strands for the rope; China folded into the rest of the world (four grey steps) */
const ropeLayers = () => {
  const row = strand("ROW").map((x, i) => (x == null && strand("CHN")[i] == null ? null : (x || 0) + (strand("CHN")[i] || 0)));
  return [
    { id: "TZA", label: SB.name("TZA"), color: css("--g1"), v: strand("TZA") },
    { id: "KEN", label: SB.name("KEN"), color: css("--g2"), v: strand("KEN") },
    { id: "MDG", label: SB.name("MDG"), color: css("--g3"), v: strand("MDG") },
    { id: "MOZ", label: SB.name("MOZ"), color: css("--g4"), v: strand("MOZ"), always: true },
    { id: "EA_OTH", label: "Other East Africa", color: css("--g5"), v: strand("EA_OTH"), always: true },
    { id: "AGO", label: SB.name("AGO"), color: css("--w1"), v: strand("AGO") },
    { id: "BRA", label: SB.name("BRA"), color: css("--w2"), v: strand("BRA") },
    { id: "MEX", label: SB.name("MEX"), color: css("--w3"), v: strand("MEX") },
    { id: "ROW", label: "Rest of the world", color: css("--w4"), v: row },
  ];
};
const ropeChart = (el, year, mark) => C.stack(el, {
  years: py, layers: ropeLayers(), texture: true, year, yFmt: d => d3.format(",")(d / 1e3), yLabel: "World sisal output, thousand tonnes",
  tipFmt: F.kt, labelValue: (x, tot) => F.kt(x), markText: mark, src: "FAOSTAT production (sisal and agave fibres n.e.s.)", dur: 2600,
});
/* is Tanzania the largest single producer in a year? (every other country strand and the whole rest of the world are smaller) */
const tzaLargest = y => { const t = pv(strand("TZA"), y); const others = ["KEN", "MDG", "MOZ", "AGO", "BRA", "MEX", "CHN", "ROW"].map(k => pv(strand(k), y) || 0);
  return t != null && others.every(o => o < t); };
const firstAbove = (arr, thr) => { for (let i = 0; i < arr.length; i++) if (arr[i] != null && arr[i] >= thr) return ys[i]; return null; };
const minmax = arr => { const a = arr.filter(x => x != null); return a.length ? [Math.min(...a), Math.max(...a)] : [null, null]; };
/* charts with a measure switch above the plot */
function switcher(el, opts, make) {
  let cur = 0, chart = null; const host = el;
  function render(anim) { host.innerHTML = ""; const c = d3.select(host).append("div").attr("class", "ctrl");
    c.append("span").attr("class", "cap").text("Show");
    opts.forEach((o, i) => c.append("button").text(o).classed("on", i === cur).on("click", () => { cur = i; render(true); }));
    const p = d3.select(host).append("div").style("position", "relative").style("height", "calc(100% - 34px)").node();
    chart = make(p, cur); if (anim) chart.play(); else chart.redraw(); }
  return { play: () => render(true), redraw: () => render(false) };
}

/* ───────────── the boards ───────────── */
const Y64 = 1964, Y94 = 1994, YL = 2024, Y00 = ph("Partial comeback").start;
const B = [];

B.push({ id: "cover", cls: "cover", title: "Natural fibres and plastics in East Africa",
  text: () => {
    const w64 = pv(D.prod.world, Y64), wl = pv(D.prod.world, lastProdYear), tk = SB.talk;   /* theme tab open: its name on top */
    return `<p class="eyebrow reveal">${tk ? `${tk.id} · ${tk.name} <span class="ch">· ${SB.boards.length} boards</span>` : "East Africa (EA20) · 1961–2025 · UNCTAD data story"}</p>
    <h1 class="reveal" style="--d:1"><span class="c-n">Natural fibres</span> and <span class="c-s">plastics</span> in East Africa<span class="yr">A market built, lost, partly won back — and what could come next</span></h1>
    ${lead(`In ${Y64} East Africa grew ${b(F.pct0(v(share, Y64)))} of the world's sisal, the fibre of harvest twine, rope and sacks. Synthetics took most of that market within a generation. In ${lastProdYear} the region again grew ${b(F.pct0(v(share, lastProdYear)))} — of a world output ${b(F.chg(w64, wl).replace("−", "") + " smaller")} than in ${Y64} — and sells to new buyers in Africa and Asia.`, 2)}
    <div class="kpis">${kpi(`${F.pct0(v(share, Y64))} → ${F.pct0(v(share, YL))}`, `East Africa's share of world sisal output, ${Y64} → ${YL}`, "n", 3)}
    ${kpi(`${F.kt(v(T, Y64)).replace(" kt", "")} → ${F.kt(v(T, YL))}`, `sisal fibre exports, ${Y64} → ${YL}`, "", 4)}
    ${kpi(F.x(v(ind("I05_plastic_vs_sacks"), YL)), `plastic articles imported per dollar of textile sacks, ${YL} (${F.x(v(ind("I05_plastic_vs_sacks"), Y64))} in ${Y64})`, "s", 5)}</div>
    <div class="cta reveal" style="--d:6"><button class="btn-solid" onclick="SB.go(1)">Start the story <span aria-hidden="true">→</span></button><button class="btn-line" onclick="document.getElementById('present').click()">Present full screen</button></div>
    ${src(`<b>Source:</b> UNCTAD calculations on harmonised 1961–2025 data from FAOSTAT, UN Comtrade (SITC and HS, own and partner reports) and CEPII BACI; values in ${D.meta.base_year} US$ with the World Bank MUV index. EA20 = 20 countries of Eastern and Southern Africa at current borders.`, 7)}
    <div class="hint">Scroll or press → <i></i></div>`; },
  draw: el => ropeChart(el, null) });

/* ───────────── entry board (S12): which plant fibres East Africa exports. Cotton, flax and hemp from data/fibre_mix.js
   (scripts/sb_02_fibre_mix.py, CEPII BACI); sisal from D.exp.t, 5-year averages = the comeback board's thick line ───────────── */
const FM = window.EAFF_FIBRES || null;
if (FM) {
  const [Q0, Q1] = FM.periods, fr = id => FM.rows.find(r => r.id === id), cot = fr("cotton"), fh = fr("flaxhemp");
  const s0 = v(T5, Q0[1]), s1 = v(T5, Q1[1]), pl = p => `${p[0]}–${String(p[0]).slice(0, 2) === String(p[1]).slice(0, 2) ? String(p[1]).slice(2) : p[1]}`, fhTop = FM.flaxhemp_top;
  const ugMax = d3.max(FM.uga_5305_t.t), chgX = (a, z) => (a && z / a >= 3 ? "×" + d3.format(".0f")(z / a) : F.chg(a, z));
  B.push({ id: "fibres", title: "Which plant fibres East Africa exports",
    text: () => head(`At a glance · plant-fibre exports, ${pl(Q0)} and ${pl(Q1)}`, `Besides cotton, East Africa sells <span class="c-n">sisal</span>; banana fibre is not traded yet`) +
      lead(`In ${pl(Q1)} East Africa exported ${b(F.kt(s1))} of sisal a year, ${b(F.chg(s0, s1))} on ${pl(Q0)}. Flax and hemp: ${b(F.kt(fh.t1))}, mostly flax tow from ${SB.name(fhTop.exporter)}. ` +
        `Banana fibre has no trade code of its own, and ${SB.name("UGA")}, home of the banana belt, exported under 1 tonne a year of other plant fibres: the fibre is still in the fields. ` +
        `For scale, cotton lint: ${b(F.kt(cot.t1))} a year (${b(F.chg(cot.t0, cot.t1))}).`, 2) +
      `<div class="kpis">${kpi(F.chg(s0, s1), `sisal fibre exports, ${pl(Q0)} → ${pl(Q1)}`, "n", 3)}${kpi(F.kt(s1), `sisal a year, ${pl(Q1)}`, "", 4)}</div>` +
      src(`<b>Chart:</b> 5-year averages, tonnes a year. <b>Source:</b> sisal: harmonised panel (UN Comtrade HS, as in chapter 4; includes the sisal that Kenya and Tanzania book as jute or other plant fibres, QA Q25). ` +
        `Cotton lint (HS 5201), flax and hemp (HS 5301–5302), Uganda's other plant fibres (HS 5305): CEPII BACI HS92, EA20 exporters, all partners.`, 5),
    draw: el => C.pairs(el, { periods: [`${pl(Q0)} average`, `${pl(Q1)} average`], fmt: F.kt, axisFmt: d => d3.format(",")(d / 1e3), xLabel: "thousand tonnes a year", chg: chgX,
      rows: [{ id: "sisal", label: "Sisal", v0: s0, v1: s1, src: "Harmonised panel (UN Comtrade HS), EA20" },
             { id: "flaxhemp", label: "Flax and hemp", v0: fh.t0, v1: fh.t1, src: "CEPII BACI HS92 5301, 5302, EA20 exporters",
               extra: SB.row(null, `from ${SB.name(fhTop.exporter)}, ${pl(Q1)}`, F.pct0(fhTop.exporter_share * 100)) + SB.row(null, `flax tow (HS ${fhTop.hs6})`, F.pct0(fhTop.hs6_share * 100)) },
             { id: "banana", label: "Banana fibre", none: "no trade code of its own · none on record", noneShort: "no trade code · none on record",
               src: `Uganda's exports of other plant fibres (HS 5305), ${pl(Q1)}: at most ${d3.format(".1f")(ugMax)} t a year (CEPII BACI HS92)` },
             { id: "cotton", label: "Cotton lint", sub: "for scale", kind: "context", v0: cot.t0, v1: cot.t1, src: "CEPII BACI HS92 520100, EA20 exporters" }] }) });
}

B.push({ id: "built", chapter: "Built", chapterNo: 1, title: "A world market built in East Africa",
  text: () => {
    const t = pv(strand("TZA"), Y64), k = pv(strand("KEN"), Y64), mz = pv(strand("MOZ"), Y64), md = pv(strand("MDG"), Y64);
    return head(`Chapter 1 · Built · ${D.prod.years[0]}–1974`, `East Africa grew <span class="c-n">${F.pct0(v(share, Y64))}</span> of the world's sisal in ${Y64}`) +
      lead(`Tanzania alone produced ${b(F.kt(t))}${tzaLargest(Y64) ? " — more than any other country" : ""}. Kenya added ${b(F.kt(k))}, Mozambique ${b(F.kt(mz))} and Madagascar ${b(F.kt(md))}. Each band of the rope is one producer; East Africa is green.`, 2) +
      `<div class="kpis">${kpi(F.kt(pv(D.prod.ea20, Y64)), `East Africa's output, ${Y64}`, "n", 3)}${kpi(F.kt(pv(D.prod.world, Y64)), `world output, ${Y64}`, "", 4)}${kpi(F.kt(pv(D.prod.world, lastProdYear)), `world output, ${lastProdYear}`, "", 5)}</div>` +
      src(`<b>Source:</b> FAOSTAT production, sisal and agave fibres n.e.s. Hover the rope for any producer and year.`, 6); },
  draw: el => ropeChart(el, Y64, yr => `${yr}: East Africa ${F.pct0(v(share, yr))} of world output`) });

B.push({ id: "europe", chapter: "Built", chapterNo: 1, title: "Most of it went to Europe",
  text: () => head(`Chapter 1 · Built`, `<span class="c-s">${F.pct0(rshare("WEUR", Y64))}</span> of it went to Western Europe`) +
      lead(`In ${Y64} Western Europe bought ${b(F.pct0(rshare("WEUR", Y64)))} of East Africa's sisal fibre exports and North America ${b(F.pct0(rshare("NAM", Y64)))}, much of it for harvest twine. The exports were worth ${b(F.usd(v(R, Y64)))} in ${D.meta.base_year} prices, for ${b(F.kt(v(T, Y64)))} of fibre.`, 2) +
      `<div class="kpis">${kpi(F.usd(v(R, Y64)), `sisal fibre exports, ${Y64}, in ${D.meta.base_year} US$`, "n", 3)}${kpi(F.pct0(gshare(GROUPS[0], Y64)), `to Europe and North America, ${Y64}`, "s", 4)}</div>` +
      src(`<b>Source:</b> UN Comtrade SITC partner records to 1994 (partners' imports, CIF ÷ 1.10), HS from 1995. Shares of export value by partner region.`, 5),
  draw: el => C.stack(el, { years: ys, x1: 2024, percent: true, year: Y64, layers: GROUPS.map(g => ({ id: g.id, label: g.label, color: g.color, v: ys.map(y => gshare(g, y)) })),
    labelValue: (x, tot) => F.pct0(x / tot * 100), markText: yr => `${yr}`, src: "Share of EA20 sisal fibre export value by partner region (I09); Sub-Saharan Africa = outside EA20", dur: 2200 }) });

B.push({ id: "lost", chapter: "Lost", chapterNo: 2, title: "Then plastics took the twine",
  text: () => { const pp = num("E007", /about (\d+)%/), d = Y94 - Y64;
    return head(`Chapter 2 · Lost · ${ph("Lost to synthetics").start}–${ph("Lost to synthetics").end}`, `Exports fell by <span class="c-s">${F.chg(v(T, Y64), v(T, Y94)).replace("−", "")}</span> in ${d} years`) +
      lead(`Polypropylene harvest twine arrived in the early 1960s; by 1978/79 it held ${b((pp || "–") + "%")} of the world harvest-twine market. East Africa's sisal exports fell from ${b(F.kt(v(T, Y64)))} in ${Y64} to ${b(F.kt(v(T, Y94)))} in ${Y94} — in ${D.meta.base_year} prices from ${b(F.usd(v(R, Y64)))} to ${b(F.usd(v(R, Y94)))}.`, 2) +
      `<div class="kpis">${kpi(F.chg(v(R, Y64), v(R, Y94)), `real export value, ${Y64}–${Y94}`, "s", 3)}${kpi(F.kt(v(T, ph("Lost to synthetics").end)), `exports at the low point, ${ph("Lost to synthetics").end}`, "", 4)}</div>` +
      src(`<b>Source:</b> harmonised panel: FAO commodity balances (tonnes) to 1994, UN Comtrade from 1995; events checked against their sources. ◆ = event, hover for details.`, 5); },
  draw: el => switcher(el, ["Tonnes", `Value (${D.meta.base_year} US$)`], (p, i) => C.line(p, {
    years: ys, x0: 1962, x1: 2024, series: [i === 0 ? { id: "t", label: "Sisal fibre exports", color: css("--natural"), v: T } : { id: "r", label: "Sisal fibre exports", color: css("--natural"), v: R }],
    yFmt: i === 0 ? (d => d3.format(",")(d / 1e3)) : (d => d3.format(",")(d / 1e6)), yLabel: i === 0 ? "thousand tonnes" : `US$ million, ${D.meta.base_year} prices (MUV)`,
    tipFmt: i === 0 ? F.kt : F.usd, endValue: i === 0 ? F.kt : F.usd,
    highlight: [{ from: ph("Lost to synthetics").start, to: ph("Lost to synthetics").end, label: "Lost to synthetics" }],
    events: [
      { y: evById("E001").y, label: "Polypropylene twine arrives", text: evById("E001").text, src: evById("E001").src, scope: evById("E001").scope },
      { y: evById("E003").y, label: "Tanzania nationalises estates", pol: 1, text: evById("E003").text, src: evById("E003").src, scope: evById("E003").scope },
      { y: evById("E005").y, text: evById("E005").text, src: evById("E005").src, scope: evById("E005").scope },
      { y: evById("E007").y, label: `PP: ${num("E007", /about (\d+)%/)}% of harvest twine`, text: evById("E007").text, src: evById("E007").src, scope: evById("E007").scope },
      { y: evById("E010").y, text: evById("E010").text, src: evById("E010").src, scope: evById("E010").scope },
      { y: evById("E011").y, label: "Tanzania Sisal Industry Act", pol: 1, text: evById("E011").text, src: evById("E011").src, scope: evById("E011").scope },
      { y: evById("E012").y, text: evById("E012").text, src: evById("E012").src, scope: evById("E012").scope },
    ],
    marks: [{ y: Y64, id: i === 0 ? "t" : "r", text: i === 0 ? F.kt(v(T, Y64)) : F.usd(v(R, Y64)), sub: String(Y64) },
            { y: Y94, id: i === 0 ? "t" : "r", text: i === 0 ? F.kt(v(T, Y94)) : F.usd(v(R, Y94)), sub: String(Y94), dy: -26 }],
    src: "EA20, linked series (SITC/FAO to 1994, HS from 1995)" })) });

B.push({ id: "prices", chapter: "Lost", chapterNo: 2, title: "Prices fell with volumes",
  text: () => { const u = D.price.uv_real, fs = D.price.ken_farm_share.filter(x => x != null).sort((p, q) => p - q), lo = d3.quantile(fs, 0.25), hi = d3.quantile(fs, 0.75);
    return head(`Chapter 2 · Lost`, `A tonne of sisal earned <span class="c-s">${F.chg(v(u, Y64), v(u, Y94)).replace("−", "")}</span> less in ${Y94} than in ${Y64}`) +
      lead(`In ${D.meta.base_year} dollars a tonne of East African sisal fibre was worth ${b(F.usdt(v(u, Y64)))} in ${Y64} and ${b(F.usdt(v(u, Y94)))} in ${Y94}. It recovered to ${b(F.usdt(v(u, YL)))} in ${YL}. Kenya's producer price for sisal fibre (grey) has broadly followed the export price: in half of the years it was between ${b(Math.round(lo) + "%")} and ${b(Math.round(hi) + "%")} of Kenya's export unit value.`, 2) +
      src(`<b>Source:</b> export unit value = EA20 sisal fibre exports in ${D.meta.base_year} US$ (MUV) ÷ tonnes; Kenya producer price: FAOSTAT (archive 1970–1990, from 1991 current series) × MUV.`, 3); },
  draw: el => C.line(el, { years: ys, x0: 1962, x1: 2024, right: 215,
    series: [{ id: "uv", label: "Export unit value, EA20", color: css("--natural"), v: D.price.uv_real },
             { id: "fg", label: "Producer price, Kenya", color: css("--context"), v: D.price.ken_farm_real, width: 1.8 }],
    yFmt: d => d3.format(",")(d), yLabel: `US$ per tonne, ${D.meta.base_year} prices`, tipFmt: F.usdt, endValue: F.usdt,
    marks: [{ y: Y64, id: "uv", text: F.usdt(v(D.price.uv_real, Y64)), sub: String(Y64) }, { y: Y94, id: "uv", text: F.usdt(v(D.price.uv_real, Y94)), sub: String(Y94), dy: 22 }],
    src: "Unit values from the harmonised panel; FAOSTAT producer prices" }) });

B.push({ id: "plastic-in", chapter: "Lost", chapterNo: 2, title: "Plastic in, sacks out",
  text: () => { const r = ind("I05_plastic_vs_sacks"), y1 = firstAbove(r, 1);
    return head(`Chapter 2 · Lost`, `Plastic articles: from <span class="c-s">${F.x(v(r, Y64))}</span> to <span class="c-s">${F.x(v(r, YL))}</span> the value of textile sacks imported`) +
      lead(`In ${Y64} East Africa spent less on imported plastic articles than on textile sacks (${b(F.x(v(r, Y64)))}). Plastics overtook sacks in ${b(y1)} and were worth ${b(F.x(v(r, Y94)))} as much in ${Y94} and ${b(F.x(v(r, YL)))} in ${YL}.`, 2) +
      src(`<b>Source:</b> imports of plastic articles ÷ imports of textile sacks (value), EA20; SITC to 1994, HS from 1995. A broad proxy: plastic articles include more than packaging.`, 3); },
  draw: el => C.line(el, { years: ys, x0: 1962, x1: 2024, log: true,
    series: [{ id: "r", label: "Plastic articles ÷ textile sacks", color: css("--synthetic"), v: ind("I05_plastic_vs_sacks") },
             { id: "one", label: "equal value", color: "#9c8f86", v: ys.map(() => 1), dash: "4 4", width: 1 }],
    yFmt: d => d3.format("")(d) + "×", tipFmt: F.x, endValue: (x, s) => (s.id === "one" ? "" : F.x(x)), yLabel: "ratio of import values (log scale)",
    marks: [{ y: Y64, id: "r", text: F.x(v(ind("I05_plastic_vs_sacks"), Y64)), sub: String(Y64), dy: -16 }, { y: Y94, id: "r", text: F.x(v(ind("I05_plastic_vs_sacks"), Y94)), sub: String(Y94), dy: -16 },
            { y: YL, id: "r", text: F.x(v(ind("I05_plastic_vs_sacks"), YL)), sub: String(YL), anchor: "end", dx: -10 }],
    src: "I05, EA20 imports" }) });

B.push({ id: "home", chapter: "At home", chapterNo: 3, title: "Synthetic sacks won the home market",
  text: () => { const a = ind("I03_sacks"), c = ind("I03b_sacks_baci"), ta = ind("I04_twine"), tc = ind("I04b_twine_baci"), y0 = 1995;
    return head(`Chapter 3 · At home · ${y0}–${YL}`, `Synthetic sacks: <span class="c-s">${range(v(a, y0), v(c, y0))}</span> of imports in ${y0}, <span class="c-s">${range(v(a, YL), v(c, YL))}</span> in ${YL}`) +
      lead(`By weight, polypropylene and polyethylene sacks rose from ${b(range(v(a, y0), v(c, y0)))} of East Africa's sack imports in ${y0} to ${b(range(v(a, YL), v(c, YL)))} in ${YL}. Twine and rope were already mostly synthetic in ${y0} (${b(range(v(ta, y0), v(tc, y0)))}); in ${YL}: ${b(range(v(ta, YL), v(tc, YL)))}.`, 2) +
      `<p class="note reveal" style="--d:3">Ranges show two sources: UN Comtrade (best of own and partner reports) and CEPII BACI (reconciled). They differ most in the 1990s.</p>` +
      src(`<b>Source:</b> I03/I03b (sacks), I04/I04b (twine and rope), tonnes; EA20 imports, HS 1995–2025.`, 4); },
  draw: el => C.line(el, { years: ys, x0: 1995, x1: 2024, yMax: 100,
    series: [{ id: "a", label: "Comtrade", color: css("--synthetic"), v: ind("I03_sacks") }, { id: "c", label: "BACI", color: css("--synthetic"), v: ind("I03b_sacks_baci"), dash: "5 4", width: 1.8 }],
    bands: [{ lo: ind("I03_sacks"), hi: ind("I03b_sacks_baci"), color: css("--synthetic"), label: "range" }],
    yFmt: d => d + "%", tipFmt: F.pct0, endValue: F.pct0, yLabel: "synthetic share of imported sacks, % of tonnes",
    tipExtra: yr => SB.row(null, "Twine and rope (Comtrade – BACI)", range(v(ind("I04_twine"), yr), v(ind("I04b_twine_baci"), yr))),
    src: "I03 (UN Comtrade) and I03b (CEPII BACI)" }) });

B.push({ id: "clothes", chapter: "At home", chapterNo: 3, title: "Fabrics and clothes went synthetic too",
  text: () => { const m = ind("I06_mmf_fabric"), u = ind("I07_used");
    return head(`Chapter 3 · At home`, `Man-made fibres: <span class="c-s">${F.pct0(v(m, Y64))}</span> of woven fabric imports in ${Y64}, <span class="c-s">${F.pct0(v(m, YL))}</span> in ${YL}`) +
      lead(`The same shift ran through textiles. Man-made fibres made ${b(F.pct0(v(m, Y64)))} of East Africa's woven fabric imports in ${Y64}, ${b(F.pct0(v(m, Y94)))} in ${Y94} and ${b(F.pct0(v(m, YL)))} in ${YL}. Second-hand clothing rose from ${b(F.pct0(v(u, Y64)))} to ${b(F.pct0(v(u, YL)))} of imports of apparel and used textiles.`, 2) +
      src(`<b>Source:</b> I06 (man-made fibre share of woven fabric imports, value), I07 (used clothing and rags in apparel + used textile imports, value); EA20.`, 3); },
  draw: el => C.line(el, { years: ys, x0: 1962, x1: 2024, yMax: 100,
    series: [{ id: "m", label: "Man-made fibre fabrics", color: css("--synthetic"), v: ind("I06_mmf_fabric") }, { id: "u", label: "Second-hand clothing", color: css("--context"), v: ind("I07_used") }],
    yFmt: d => d + "%", tipFmt: F.pct0, endValue: F.pct0, yLabel: "% of import value",
    src: "I06, I07 (EA20 imports)" }) });

B.push({ id: "comeback", chapter: "Coming back", chapterNo: 4, title: "A partial comeback",
  text: () => { const r = robust("EA20 share of world sisal production", lastProdYear), bra = strand("BRA");
    return head(`Chapter 4 · Coming back · ${Y00}–${YL}`, `Since ${Y00}, sisal exports are up <span class="c-n">${F.chg(v(T, Y00), v(T, YL)).replace("+", "")}</span>`) +
      lead(`From ${b(F.kt(v(T, Y00)))} in ${Y00} to ${b(F.kt(v(T, YL)))} in ${YL}, worth ${b(F.usd(v(R, YL)))}. East Africa's share of world output is back to ${b(F.pct0(v(share, lastProdYear)))}${r ? ` (${b(F.pct0(r.alt_value))} with Kenya's ${lastProdYear} output from its Agriculture and Food Authority instead of FAO's estimate)` : ""}, while Brazil's output changed by ${b(F.chg(pv(bra, Y00), pv(bra, lastProdYear)))}. Exports are still ${b(F.chg(v(T, Y64), v(T, YL)).replace("−", ""))} below ${Y64}.`, 2) +
      `<div class="kpis">${kpi(F.kt(v(T, YL)), `sisal fibre exports, ${YL}`, "n", 3)}${kpi(F.pct0(v(share, lastProdYear)), `of world output, ${lastProdYear}`, "n", 4)}</div>` +
      src(`<b>Chart:</b> thin line = each year (single years swing); thick line = 5-year average (the year and the four before): ${F.kt(v(T5, Y00))} in ${Y00}, ${F.kt(v(T5, YL))} in ${YL} (${F.chg(v(T5, Y00), v(T5, YL))}). ` +
        `<b>Source:</b> harmonised panel (UN Comtrade HS); FAOSTAT; Kenya AFA via Business Daily (checked against the source text).`, 5); },
  /* opens on 2000-2024 so the rise is clear; "Since 1962" shows how far below the 1960s it still is */
  draw: el => switcher(el, [`Since ${Y00}`, "Since 1962"], (p, i) => C.line(p, { years: ys, x0: i === 0 ? Y00 : 1962, x1: YL,
    series: i === 0 ? [{ id: "t", label: "Sisal fibre exports", color: css("--natural"), v: T, width: 1.6, opacity: 0.55 },
                       { id: "a", label: "5-year average", color: css("--natural"), v: T5, width: 3.6 }]
                    : [{ id: "t", label: "Sisal fibre exports", color: css("--natural"), v: T }],
    yFmt: d => d3.format(",")(d / 1e3), yLabel: "thousand tonnes", tipFmt: F.kt, endValue: F.kt,
    highlight: i === 0 ? [] : [{ from: Y00, to: YL, label: "Partial comeback" }],
    marks: [{ y: Y00, id: "t", text: F.kt(v(T, Y00)), sub: String(Y00), dy: i === 0 ? 34 : -22 }, { y: YL, id: "t", text: F.kt(v(T, YL)), sub: String(YL), anchor: "end", dx: -10, dy: -18 }],
    tipExtra: yr => SB.row(null, "share of world output", F.pct0(v(share, yr))),
    src: i === 0 ? "EA20, UN Comtrade HS (harmonised panel); 5-year average = the year and the four before" : "EA20, linked series" })) });

B.push({ id: "buyers", chapter: "Coming back", chapterNo: 4, title: "New buyers, far from Europe",
  text: () => { const top = D.dest.buyers["2024"], top14 = D.dest.buyers["2014"]; const ng = (lst, n) => (lst.find(x => x.name === n) || {}).share;
    return head(`Chapter 4 · Coming back`, `${top[0].name} is now the largest buyer`) +
      lead(`Western Europe's share fell from ${b(F.pct0(rshare("WEUR", Y64)))} (${Y64}) to ${b(F.pct0(rshare("WEUR", YL)))} (${YL}). In ${YL} other Sub-Saharan African countries took ${b(F.pct0(rshare("SSA", YL)))} of East Africa's sisal exports, China ${b(F.pct0(rshare("CHN", YL)))} and the Middle East and North Africa ${b(F.pct0(rshare("MENA", YL)))}. ${top[0].name} alone bought ${b(F.pct0(top[0].share))}, up from ${b(F.pct0(ng(top14, top[0].name)))} in 2014, when ${top14[0].name} (${F.pct0(top14[0].share)}) led.`, 2) +
      `<p class="note reveal" style="--d:3">Largest buyers ${YL}: ${top.map(x => `${x.name} ${F.pct0(x.share)}`).join(" · ")}</p>` +
      src(`<b>Source:</b> regions: I09 (harmonised panel); countries: core tables, HS 530500 plus sisal booked as jute (5303) by Kenya, Tanzania and Madagascar, best of own and partner reports.`, 4); },
  draw: el => C.bars(el, { years: [Y64, YL], max: 100, cats: GROUPS.map(g => ({ id: g.id, label: g.label, color: g.color })),
    value: (id, y) => gshare(GROUPS.find(g => g.id === id), y), src: "Share of EA20 sisal fibre export value (I09)" }) });

B.push({ id: "raw", chapter: "Coming back", chapterNo: 4, title: "The comeback is in raw fibre",
  text: () => { const n = ind("I02b_HF_natural");
    return head(`Chapter 4 · Coming back`, `Less of it is processed at home`) +
      lead(`Twine, rope, sacks and other natural hard-fibre products made ${b(F.pct0(v(n, 2015)))} of East Africa's natural hard-fibre exports in 2015, but ${b(F.pct0(v(n, YL)))} in ${YL}: the new demand is for raw fibre.`, 2) +
      src(`<b>Source:</b> I02b, natural-fibre processed products ÷ (raw fibre + those products), export value, EA20, HS from 1995. Before 1995 twine and sacks cannot be split by material.`, 3); },
  draw: el => C.line(el, { years: ys, x0: 1995, x1: 2024, yMax: 100,
    series: [{ id: "n", label: "Processed share", color: css("--natural"), v: ind("I02b_HF_natural") }],
    yFmt: d => d + "%", tipFmt: F.pct0, endValue: F.pct0, yLabel: "% of natural hard-fibre export value",
    marks: [{ y: 2015, id: "n", text: F.pct0(v(ind("I02b_HF_natural"), 2015)), sub: "2015" }, { y: YL, id: "n", text: F.pct0(v(ind("I02b_HF_natural"), YL)), sub: String(YL), anchor: "end", dx: -10 }],
    src: "I02b" }) });

B.push({ id: "bans", chapter: "Policy", chapterNo: 5, title: "A wave of plastic-bag bans",
  text: () => { const ys_ = bansOn.map(x => x.year), mid = bansOn.filter(x => x.year >= 2015 && x.year <= 2019).length;
    const first = bansOn.slice().sort((p, q) => p.year - q.year)[0], last = bansOn.slice().sort((p, q) => q.year - p.year)[0];
    return head(`Chapter 5 · Policy · ${Math.min(...ys_)}–${Math.max(...ys_)}`, `<span class="c-n">${bansOn.length}</span> of ${D.meta.ea20.length} East African countries ban plastic bags by law`) +
      lead(`From ${SB.name(first.iso3)} (${b(first.year)}) to ${SB.name(last.iso3)} (${b(last.year)}): ${b(mid)} of the laws date from 2015–2019. Scope and enforcement differ — some cover only thin bags. ${bansOther.map(x => `${SB.name(x.iso3)} ${x.level_short}`).join("; ")}. Every row was checked against the text of its legal or official source.`, 2) +
      src(`<b>Source:</b> UNCTAD table of national measures (config/policy_plastic_bans_EA.csv), year of the legal act (South Sudan: announcement; Sudan: first state order found). <b>Map:</b> The boundaries and names shown and the designations used on this map do not imply official endorsement or acceptance by the United Nations. Dotted and dashed lines represent approximate borders for which the final status has not yet been agreed.`, 3); },
  draw: el => C.bans(el, { bans: D.bans, until: 2026 }) });

B.push({ id: "tariffs", chapter: "Policy", chapterNo: 5, title: "Tariffs that favour local twine",
  text: () => { const ug = D.stays.filter(x => x.iso3 === "UGA" && /USD/.test(x.applied)), ke = D.stays.filter(x => x.iso3 === "KEN");
    const [ul, uh] = minmax(ug.map(x => x.ave)), [kl, kh] = minmax(ke.map(x => x.ave));
    return head(`Chapter 5 · Policy`, `Duties on imported twine above the <span class="c-s">${D.stays[0].cet}%</span> common tariff`) +
      lead(`Under "stays" of the EAC common external tariff, Uganda applied ${b(ug[0].applied.replace(" whichever is higher", ""))} to imported binder and other twine in ${ug[0].start.slice(0, 4)} — ${b(Math.round(ul) + "–" + Math.round(uh) + "%")} at the world import unit value. Kenya applied ${b(ke[0].applied.replace(" whichever is higher", ""))} from ${ke[0].start.slice(0, 7)} to ${ke[0].end.slice(0, 7)} (${b(Math.round(kl) + "–" + Math.round(kh) + "%")}). The same notices list sisal twine (HS 5607.21/29) and polypropylene binder twine (5607.41) alike.`, 2) +
      src(`<b>Source:</b> East African Community Gazette legal notices (checked against the gazette text); ad-valorem equivalent at the world import unit value of the year.`, 3); },
  draw: el => C.stays(el, { rows: D.stays }) });

B.push({ id: "hormuz", chapter: "Policy", chapterNo: 5, title: "2026: an oil shock",
  text: () => { const g = id => D.hormuz.groups.find(x => x.id === id) || {};
    return head(`Chapter 5 · Policy · 2026`, `An oil shock made plastic packaging dearer — no switch to natural fibre yet`) +
      lead(`Shipping through the Strait of Hormuz was ${(D.hormuz.shock.split(";")[1] || "").includes("largely halted") ? "largely halted" : "disrupted"} from ${D.hormuz.shock.slice(0, 10).replace(/^(\d{4})-(\d{2})-(\d{2})$/, (m, y, mo, d) => `${+d} ${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][+mo - 1]} ${y}`)}. In March–May the unit price of synthetic sacks imported by East Africa was ${b(F.pp(g("B").post_uv))} on a year earlier (${b(F.pp(g("B").pre_uv))} before the shock), synthetic twine ${b(F.pp(g("D").post_uv))}. Imports of natural-fibre sacks fell ${b(F.pp(g("E").post_kg))} by weight.`, 2) +
      `<p class="note reveal caveat" style="--d:3">Preliminary: partners with complete monthly data in both years only; several large suppliers publish no monthly data yet.</p>` +
      src(`<b>Source:</b> UN Comtrade monthly partner data, ${D.hormuz.windows}; QA note Q27.`, 4); },
  draw: el => C.dumbbell(el, { groups: D.hormuz.groups.filter(x => "ABDEF".includes(x.id)) }) });

/* ───────────── Chapter 6 · Potential (workstream fibre_potential; numbers from D.pot) ───────────── */
const P = D.pot, U = P.uga, CP = P.comps;
const prow = id => P.rows.find(r => r.id === id);
const ktr = r => F.kt(r.lo).replace(" kt", "") + "–" + F.kt(r.hi);
const mt = v => d3.format(".1f")(v / 1e6) + " million tonnes";
const usdkg = v => "US$" + d3.format(".2f")(v) + "/kg";
const T24 = v(T, YL);
const lad = hs => P.ladder.find(r => r.hs6 === hs);
const mdgAt = (key, y) => SB.at(P.mdg[key], y, P.mdg.years);

B.push({ id: "fields", chapter: "Potential", chapterNo: 6, title: "Fibre already growing in the fields",
  text: () => { const bn = prow("banana");
    return head(`Chapter 6 · Potential · ${P.years}`, `Banana stems left after harvest could give <span class="c-n">${ktr(bn)}</span> of fibre a year`) +
      lead(`East Africa grows ${b(F.pct0(P.ea20_share_cooking))} of the world's cooking bananas and plantains. Each bunch grows on its own stem, which becomes residue after the harvest; a Ugandan field study measured ${b(U.g_stem + " g")} of dry fibre per stem. Across East Africa that is ${b(F.kt(bn.c))} a year (range ${ktr(bn)}), ${b(F.x(bn.c / T24))} the sisal fibre the region exported in ${YL} (${F.kt(T24)}). Coconut husks could add ${b(F.kt(prow("coir").c))} of coir, pineapple leaves ${b(F.kt(prow("pine_mech").c))} by machine, and the short sisal fibre lost at decortication (flume tow) ${b(F.kt(prow("tow").c))}.`, 2) +
      `<div class="kpis">${kpi(F.pct0(P.ea20_share_cooking), `of world cooking bananas and plantains grown in East Africa, ${P.years}`, "n", 3)}${kpi(U.g_stem + " g", "dry fibre per banana stem, Uganda field study", "", 4)}</div>` +
      `<p class="note reveal caveat" style="--d:6">A potential, not a supply: collection, extraction and buyers decide how much becomes real. † = includes an assumed weight (dessert-banana bunches, pineapple fruit, coconuts).</p>` +
      src(`<b>Source:</b> FAOSTAT crop output, ${P.years} average, × fibre yields checked against their sources (Kamusingize et al. 2026; AJPS 2016; Ortiz et al. 2025; FAO; UNIDO). Ranges: heaviest to lightest bunch, fruit or nut; coir 80–150 g per husk; flume tow 10–20% of fibre.`, 7); },
  draw: el => C.ranges(el, { rows: P.rows.map(r => ({ ...r, note: /dessert/.test(r.status) ? "dessert-banana bunches assumed as heavy as matooke bunches" : /PIN_FRUIT/.test(r.status) ? "pineapple fruit weight assumed (1.2–2.0 kg)" : /COC_NUT/.test(r.status) ? "coconut weight assumed (0.8–1.5 kg)" : "", short: { banana: "Banana stems", coir: "Coconut coir", pine_mech: "Pineapple, machine", pine_hand: "Pineapple, by hand", tow: "Sisal flume tow" }[r.id] })),
    ref: { v: T24, label: `Sisal fibre exports, ${YL}` }, fmt: F.kt, src: `FAOSTAT ${P.years} × checked parameters (EAFF_fibre_potential.xlsx).` }) });

B.push({ id: "uganda", chapter: "Potential", chapterNo: 6, title: "Uganda's banana belt",
  text: () => head(`Chapter 6 · Potential · Uganda`, `Uganda grows <span class="c-n">${F.pct0(U.share_world)}</span> of the world's cooking bananas — and sells almost none of their fibre`) +
      lead(`Uganda harvested ${b(mt(U.prod_t))} of cooking bananas and plantains a year in ${P.years}. At ${b(U.g_stem + " g")} of fibre per stem and ${b(U.bunch.c + " kg")} per bunch, the stems of the ${b(F.pct0(U.share_now))} of farmers found ready to sell them would give ${b(F.kt(U.now.c))} of fibre a year (${ktr(U.now)}). That is ${b(F.x(U.now.c / CP.uga_pack_t))} Uganda's imports of plastic sacks, bags and synthetic twine (${F.kt(CP.uga_pack_t)}) and ${b(F.pct0(U.now.c / CP.abaca_t * 100))} of world abaca output. Uganda's recorded exports under HS 5305, the code for such fibres: ${b(d3.format(",.0f")(U.exports_530500_t) + " t")} in 2015–2024.`, 2) +
      `<p class="note reveal caveat" style="--d:3">Move the sliders — the result is a potential, not a forecast. Banana-stem fibre is not abaca (a banana relative grown for fibre); abaca output is a size reference.</p>` +
      src(`<b>Source:</b> FAOSTAT (Uganda, plantains and cooking bananas, ${P.years} average); ${U.g_stem} g of fibre per stem and "seven pseudo-stems yield 1 kg" (Kamusingize et al. 2026); bunch ${U.bunch.c} kg, ${U.bunch.lo}–${U.bunch.hi} kg across matooke genotypes (AJPS 2016); ${F.pct0(U.share_now)} of 102 farmers ready to sell stems, over ${F.pct0(U.share_price)} at a substantially higher price (Kamusingize et al. 2025); imports: UN Comtrade, ${P.years} average; abaca: FAOSTAT.`, 4),
  draw: el => C.whatif(el, { prod_t: U.prod_t, g_stem: U.g_stem, bunch: U.bunch, share_now: U.share_now, share_price: U.share_price, stems_per_kg: U.stems_per_kg,
    years: P.years, now: U.now, series: P.uga_series,
    comps: [{ id: "abaca", label: "World abaca output", short: "World abaca", t: CP.abaca_t, color: css("--context"), src: `FAOSTAT, ${P.years} average` },
            { id: "resin", label: "Uganda imports: PE and PP resin", short: "UG resin imports", t: CP.uga_resin_t, color: css("--synthetic"), src: `UN Comtrade, ${P.years} average (HS 390110/20, 390210)` },
            { id: "pack", label: "Uganda imports: plastic sacks, bags, twine", short: "UG plastic packaging", t: CP.uga_pack_t, color: css("--synthetic"), src: `UN Comtrade, ${P.years} average (HS 630532/33/39, 392321/29, 560741/49/50)` }] }) });

B.push({ id: "value", chapter: "Potential", chapterNo: 6, title: "Where the value is",
  text: () => { const raw = lad("530500"), bask = lad("460219"), rope = lad("560729"), fab = lad("531100");
    return head(`Chapter 6 · Potential · Value`, `A kilo of basketwork sells for <span class="c-a">${F.x(bask.uv / raw.uv)}</span> a kilo of raw plant fibre`) +
      lead(`On world markets in 2021–2024 raw plant fibre such as coir, abaca and sisal sold for ${b(usdkg(raw.uv))}, sisal twine and rope for ${b(usdkg(rope.uv))}, woven fabric of plant fibres for ${b(usdkg(fab.uv))} and basketwork for ${b(usdkg(bask.uv))} — a ${b(F.usd(bask.usd))} a year market. Madagascar's basketwork shows the way: exports rose from ${b(F.usd(mdgAt("baci", 1995)))} in 1995 to ${b(F.usd(mdgAt("baci", 2024)))} in 2024, lifting East Africa's share of world basketwork exports from ${b(F.pct(mdgAt("ea20_share", 1995)))} to ${b(F.pct(mdgAt("ea20_share", 2024)))}.`, 2) +
      `<p class="note reveal" style="--d:3">Madagascar's own report (UN Comtrade, HS 460219) shows ${F.usd(mdgAt("ct", 2024))} for 2024; CEPII BACI reconciles it with importers' records.</p>` +
      src(`<b>Source:</b> unit values: UN Comtrade world exports 2021–2024 (HS 530500, 560721, 560729, 530890, 531100, 460194, 460219; plastic sacks and bags for comparison). Madagascar: CEPII BACI (HS92 4602) and UN Comtrade (HS 460219).`, 4); },
  draw: el => switcher(el, ["Value per kg", "Madagascar's baskets"], (p, i) => (i === 0
    ? C.hbars(p, { rows: [...P.ladder].sort((p_, q) => p_.uv - q.uv).map(r => ({ id: r.hs6, label: r.label, short: r.label.replace("Plant fibre, raw (coir, abaca, sisal...)", "Raw plant fibre").replace(" of other plant fibres", "").replace(" of other plant materials", "").replace("PP/PE woven sacks", "PP sacks"), v: r.uv,
        color: r.kind === "synthetic" ? css("--synthetic") : css("--natural"), extra: SB.row(null, "world exports a year", F.usd(r.usd)) + SB.row(null, "tonnes a year", F.kt(r.t)) })),
        fmt: usdkg, axisFmt: d => "$" + d, tipLabel: "US$ per kg", xLabel: "US$ per kg, world exports 2021–2024 (green = natural fibre, blue = plastic for comparison)", xLabelShort: "US$ per kg (green natural, blue plastic)", src: "UN Comtrade world reporters (T5)" })
    : C.line(p, { years: P.mdg.years, x0: 1995, x1: 2024,
        series: [{ id: "b", label: "Madagascar, BACI", color: css("--natural"), v: P.mdg.baci }, { id: "c", label: "own report", color: css("--natural"), v: P.mdg.ct, dash: "5 4", width: 1.8 }],
        yFmt: d => d3.format(",")(d / 1e6), yLabel: "basketwork exports, US$ million (current)", tipFmt: F.usd, endValue: F.usd,
        tipExtra: yr => SB.row(null, "East Africa's share of world basketwork exports", F.pct(SB.at(P.mdg.ea20_share, yr, P.mdg.years))),
        marks: [{ y: 1995, id: "b", text: F.usd(mdgAt("baci", 1995)), sub: "1995", dy: -16 }], src: "CEPII BACI HS92 4602; UN Comtrade HS 460219" }))) });

B.push({ id: "market", chapter: "Potential", chapterNo: 6, title: "A market opened by bans",
  text: () => { const A = P.subst_avg, tot = A.sacks + A.bags + A.twine;
    return head(`Chapter 6 · Potential · Markets at home`, `East Africa imports <span class="c-s">${F.kt(tot)}</span> of plastic sacks, bags and synthetic twine a year`) +
      lead(`In ${P.years} the region imported, each year, ${b(F.kt(A.sacks))} of woven polypropylene and polyethylene sacks, ${b(F.kt(A.bags))} of plastic sacks and bags and ${b(F.kt(A.twine))} of synthetic twine and rope — against ${b(F.kt(A.jute))} of jute sacks — plus ${b(mt(A.resin))} of polyethylene and polypropylene resin from which local firms make their own. With ${b(bansOn.length + " of " + D.meta.ea20.length)} countries banning plastic bags by law, part of this could become a market for natural fibre. A 2025 study of Uganda's banana-fibre sector still found a "nascent status of readiness" in markets, partnerships, public awareness, skills, technology, infrastructure and sustainability.`, 2) +
      `<div class="kpis">${kpi(F.kt(tot), `plastic sacks, bags and synthetic twine imported a year, ${P.years}`, "s", 3)}${kpi(mt(A.resin).replace(" million tonnes", " Mt"), `PE and PP resin imported a year, ${P.years}`, "s", 4)}</div>` +
      src(`<b>Source:</b> UN Comtrade, core reconciled table (own report, else partners' records), EA20 imports: HS 630532/33/39, 392321/29, 560741/49/50 (plastic); 630510 (jute sacks); 390110/20, 390210 (resin). Readiness: ${P.readiness.source}.`, 5); },
  draw: el => { const S_ = P.subst, plast = S_.years.map((y, i) => (S_.sacks[i] == null ? null : S_.sacks[i] + (S_.bags[i] || 0) + (S_.twine[i] || 0)));
    return C.line(el, { years: S_.years, x0: 2010, x1: 2024, right: 250,
      series: [{ id: "p", label: "Plastic sacks, bags, twine", color: css("--synthetic"), v: plast }, { id: "j", label: "Jute sacks", color: css("--natural"), v: S_.jute }],
      yFmt: d => d3.format(",")(d / 1e3), yLabel: "EA20 imports, thousand tonnes", tipFmt: F.kt, endValue: F.kt,
      tipExtra: yr => { const i = S_.years.indexOf(yr); return i < 0 ? "" : SB.row(null, "of which woven PP/PE sacks", F.kt(S_.sacks[i])) + SB.row(null, "of which plastic sacks and bags", F.kt(S_.bags[i])) + SB.row(null, "of which synthetic twine", F.kt(S_.twine[i])) + SB.row(null, "PE and PP resin", F.kt(S_.resin[i])); },
      src: "UN Comtrade, EA20 imports (core reconciled table)" }); } });

/* ───────────── Chapter 6 · dynamics (workstream forum_dynamics, FD-D01): prices and the market to 2030 ───────────── */
const DY = D.dyn;
const nf = (f, x) => (x == null ? "–" : f(x));
const dynCheap = () => { const Z = DY.prices, k = Z.kg_years, both = k.filter((y, i) => Z.sisal_kg[i] != null && Z.pp_resin_kg[i] != null);
  return { n: both.length, cheap: both.filter(y => { const i = k.indexOf(y); return Z.sisal_kg[i] < Z.pp_resin_kg[i]; }).length, first: k[0], last: k[k.length - 1],
    s: Z.sisal_kg[k.length - 1], r: Z.pp_resin_kg[k.length - 1] }; };
const dyn2030 = () => { const M = DY.demand, g = M.paces.find(q => q.id === "trend_2014_2024").g / 100, m30 = M.base_t * Math.pow(1 + g, M.year1 - M.year0), v30 = m30 * M.uv * 1000;
  return { m30, v30, v10: v30 * 0.1, f10: v30 * 0.1 / M.uv_nat / 1000 }; };

B.push({ id: "price-race", chapter: "Potential", chapterNo: 6, title: "The price race",
  text: () => { const Z = DY.prices, at = y => SB.at(Z.barrels, y, Z.years), y0 = 1964, yl = SB.lastYear(Z.years, Z.barrels);
    const sh = Z.years.filter(y => y >= 1974 && y <= 1980).map(at).filter(x => x != null), lo = Math.min(...sh), hi = Math.max(...sh), c = dynCheap();
    return head(`Chapter 6 · Potential · Prices ${Z.years[0]}–${yl}`, `A tonne of sisal: <span class="c-n">${Math.round(at(y0))}</span> barrels of oil in ${y0}, <span class="c-n">${Math.round(at(yl))}</span> in ${yl}`) +
      lead(`When polypropylene took the twine market, oil was cheap: in ${y0} a tonne of East African sisal fibre was worth ${b(Math.round(at(y0)) + " barrels")} of Brent crude. After the oil shocks of 1974–1980 it was worth ${b(Math.round(lo) + "–" + Math.round(hi))} barrels, and ${b(Math.round(at(yl)))} in ${yl}. Per kilo, sisal fibre now competes with the raw material of plastic sacks: it cost less than polypropylene resin in ${b(c.cheap + " of the " + c.n + " years")} since ${c.first} (${c.last}: ${b(usdkg(c.s))} against ${b(usdkg(c.r))}).`, 2) +
      `<div class="kpis">${kpi(`${Math.round(at(y0))} → ${Math.round(at(yl))}`, `barrels of oil per tonne of sisal fibre, ${y0} → ${yl}`, "n", 3)}${kpi(`${c.cheap} of ${c.n}`, `years since ${c.first} with sisal fibre cheaper per kilo than polypropylene resin`, "n", 4)}</div>` +
      `<p class="note reveal" style="--d:5">Prices per kilo: the amount of material in a sack or a metre of twine differs between materials, so these are not costs per use.</p>` +
      src(`<b>Source:</b> Brent crude: World Bank Pink Sheet (annual); sisal fibre: East Africa's export unit value (harmonised panel); per kilo: UN Comtrade world export unit values (HS 390210 polypropylene; 560729 sisal twine and rope; 560749 polypropylene twine; 630510 jute sacks; 630533 woven PP/PE sacks).`, 6); },
  draw: el => switcher(el, ["Against oil", "Per kilo since 2010"], (p, i) => { const Z = DY.prices;
    return i === 0 ? C.line(p, { years: Z.years, x0: Z.years[0], x1: 2024, log: true, right: 190,
        series: [{ id: "b", label: "Barrels per tonne", color: css("--natural"), v: Z.barrels }],
        yFmt: d => d3.format(",")(d), tipFmt: x => d3.format(",.0f")(x) + " barrels", endValue: x => d3.format(",.0f")(x), yLabel: "barrels of Brent crude per tonne of sisal fibre (log scale)",
        highlight: [{ from: 1974, to: 1980, label: "Oil shocks" }],
        marks: [{ y: 1964, id: "b", text: d3.format(",.0f")(SB.at(Z.barrels, 1964, Z.years)) + " barrels", sub: "1964", dy: -10 }],
        tipExtra: yr => SB.row(null, "sisal fibre, US$ per tonne", nf(d3.format(",.0f"), SB.at(Z.sisal_usd_t, yr, Z.years))) + SB.row(null, "Brent, US$ per barrel", nf(d3.format(".1f"), SB.at(Z.brent, yr, Z.years))),
        src: "World Bank Pink Sheet; harmonised panel" })
      : C.line(p, { years: Z.kg_years, x0: 2010, x1: 2024, right: 230, yMin: 0,
        series: [{ id: "s", label: "Sisal fibre, East Africa", color: css("--natural"), v: Z.sisal_kg }, { id: "r", label: "Polypropylene resin", color: css("--synthetic"), v: Z.pp_resin_kg }],
        yFmt: d => "$" + d3.format(".1f")(d), tipFmt: usdkg, endValue: usdkg, yLabel: "US$ per kilo, current prices",
        tipExtra: yr => { const i = Z.kg_years.indexOf(yr); return i < 0 ? "" : SB.row(null, "sisal twine and rope (world)", nf(usdkg, Z.sisal_twine_kg[i])) + SB.row(null, "polypropylene twine (world)", nf(usdkg, Z.pp_twine_kg[i])) + SB.row(null, "jute sacks (world)", nf(usdkg, Z.jute_sack_kg[i])) + SB.row(null, "woven PP/PE sacks (world)", nf(usdkg, Z.pp_sack_kg[i])); },
        src: "Sisal fibre: harmonised panel; others: UN Comtrade world unit values" }); }) });

B.push({ id: "demand-2030", chapter: "Potential", chapterNo: 6, title: "A growing market to win",
  text: () => { const M = DY.demand, ty = y => SB.at(M.t, y, M.years), d = dyn2030(), sx = v(D.exp.usd, YL), ug = M.compare.find(c => /Uganda/.test(c.item));
    return head(`Chapter 6 · Potential · Markets to ${M.year1}`, `A tenth of a growing market: <span class="c-n">${F.usd(d.v10)}</span> a year by ${M.year1}`) +
      lead(`East Africa's imports of plastic sacks, bags and synthetic twine grew from ${b(F.kt(ty(2010)))} in 2010 to ${b(F.kt(ty(2024)))} in 2024 — ${b(d3.format(".1f")(M.t_cagr) + "%")} a year, faster than the economy (${d3.format(".1f")(M.gdp_cagr)}%). On the 2014–24 trend they reach ${b(F.kt(d.m30))} by ${M.year1}, worth ${b(F.usd(d.v30))} in 2024 prices. Every tenth of that spending won by natural-fibre products is ${b(F.usd(d.v10))} a year — ${b(F.pct0(d.v10 / sx * 100))} of today's sisal fibre exports — and about ${b(F.kt(d.f10))} of fibre, less than the banana fibre Ugandan farmers are ready to sell (${F.kt(ug.t)}).`, 2) +
      `<p class="note reveal" style="--d:3">Imports only: plastic packaging made locally from imported resin is not counted, so the market is larger. Natural-fibre products are assumed to replace plastic ones for the same spending, at the world price of sisal twine and jute sacks (${usdkg(M.uv_nat)}).</p>` +
      src(`<b>Source:</b> UN Comtrade (EA20 imports, core reconciled table; HS 630532/33/39, 392321/29, 560741/49/50); World Bank WDI (GDP, population); MUV (2024 prices); UN Comtrade world unit values (HS 560729, 560721, 630510); chapter 6 fibre potential.`, 4); },
  draw: el => C.demand(el, DY.demand) });

const P_MAT = p => (D.ps.products.find(q => q.p === p) || {}).material;
B.push({ id: "space", chapter: "Potential", chapterNo: 6, title: "Where can East Africa jump next?",
  text: () => { const S = D.ps, u = p => S.data.UGA.find(r => r.p === p), m = p => S.data.MDG.find(r => r.p === p), R = F.rca;
    const nm = { "4602": "baskets", "6305": "sacks", "5607": "twine" }, has = ["4602", "6305", "5607"].filter(p => u(p).m).map(p => nm[p]);
    const pc = v => Math.round(v) + "%";
    const mv = S.countries.map(c => { const rs = S.data[c.iso3].filter(r => r.dp_then != null && r.dp_now_fixed != null && P_MAT(r.p) !== "synthetic");
      return { name: SB.name(c.iso3).replace("United Republic of ", ""), n: rs.filter(r => r.dp_now_fixed > r.dp_then).length, tot: rs.length }; }).sort((x, y) => y.n - x.n);
    return head(`Chapter 6 · Potential · Product space ${S.window}`, has.length ? `Uganda already sells ${has.length > 1 ? has.slice(0, -1).join(", ") + " and " + has[has.length - 1] : has[0]} competitively — raw plant fibre is a short step` : `Where Uganda could go next`) +
      lead(`A country's exports show what it can make. Uganda already sells basketwork (RCA ${b(R(u("4602").rca))}), sacks and bags (${b(R(u("6305").rca))}), twine and rope (${b(R(u("5607").rca))}) and raw cotton (${b(R(u("5201").rca))}) above its weight in world trade (RCA above 1), and raw plant fibre — where banana fibre is counted — is closer to its exports than ${b(pc(u("530X").dp))} of all ${d3.format(",")(S.n_products)} products. Since the 1990s ${mv[0].name} has moved closer to ${b(mv[0].n + " of " + mv[0].tot)} fibre-related products, ${mv[1].name} to ${b(mv[1].n)} and ${mv[2].name} to ${b(mv[2].n)}; Madagascar's RCA in basketwork rose from ${b(R(m("4602").r95))} in 1995–97 to ${b(R(m("4602").rca))}.`, 2) +
      `<p class="note reveal" style="--d:3">How close a product is: the share of the goods usually exported together with it that the country already sells competitively — a sign of similar skills and inputs, not of buyers or prices. RCA ≥ 1: the country exports more of it than its weight in world trade. Sacks and twine include polypropylene in the trade codes.</p>` +
      src(`<b>Source:</b> UNCTAD calculations on CEPII BACI (HS 1992, 4-digit), ${S.window} averages; ${S.n_countries} countries with exports over US$1 bn; method of Hidalgo et al. (2007) and the Atlas of Economic Complexity. Tables: <a href="../EAFF_product_space.xlsx">EAFF_product_space.xlsx</a>.`, 4); },
  draw: el => C.space(el, D.ps) });

/* ───────────── UNCTAD research (user 2026-10-28): verbatim points from UNCTAD/TCS/DITC/INF/2025/10, checked against the PDF ───────────── */
const UN = D.unctad, upt = id => UN.points.find(q => q.id === id);
const uq = id => `<p class="q">“${upt(id).quote.replace(/- /g, "-").replace(/ $/, "")}” <span>(p. ${upt(id).page})</span></p>`;
B.push({ id: "unctad", chapter: "What it means", chapterNo: 7, title: "What UNCTAD research adds",
  text: () => { const u = p => D.ps.data.UGA.find(r => r.p === p), R = F.rca, ng = (D.dest.buyers["2024"].find(x => x.name === "Nigeria") || {}).share;
    return head(`Chapter 7 · What it means · UNCTAD research`, `Natural fibres are among the plastic substitutes UNCTAD sees as an opportunity`) +
      lead(`UNCTAD's ${UN.year} study of plastic substitution in developing countries looks at alternatives "from natural fibres to biobased polymers". Its findings meet the East African data: a large market for substitutes, a test that Uganda already passes for baskets (RCA ${b(R(u("4602").rca))}), sacks (${b(R(u("6305").rca))}) and twine (${b(R(u("5607").rca))}), Ugandan research that turns crop residues into products, and standards as the gap to close.${ng != null ? ` Natural-fibre sacks remain the norm for raw cocoa: ${b(upt("U6").value)} ${upt("U6").label} — and Nigeria bought ${b(F.pct0(ng))} of East Africa's sisal fibre in 2024.` : ""}`, 2) +
      src(`<b>Source:</b> UNCTAD (${UN.year}), <i>${UN.title}</i>, ${UN.symbol} (<a href="${UN.file}">PDF</a>); every quotation checked against the PDF text. Uganda's RCA: product-space board, CEPII BACI. Nigeria's share: harmonised panel.`, 3); },
  draw: el => { el.innerHTML = `<div class="take un" id="take-un"></div>`; const host = el.querySelector("#take-un"), u = p => D.ps.data.UGA.find(r => r.p === p), R = F.rca;
    const items = [
      { v: upt("U1").value, c: "n", h: "A large market", p: upt("U1").label + ".", q: uq("U1") },
      { v: upt("U2").value, c: "n", h: "A test East Africa can pass", p: `${upt("U2").label}. Uganda passes it for basketwork (${R(u("4602").rca)}), sacks (${R(u("6305").rca)}) and twine (${R(u("5607").rca)}).`, q: uq("U2") },
      { v: upt("U3").value, c: "n", h: "Residues into products", p: `${upt("U3").label}; farmers could sell their residues for processing.`, q: uq("U4") },
      { v: upt("U5").value, c: "a", h: "The gap to close", p: upt("U5").label + ".", q: uq("U5") },
    ];
    host.innerHTML = items.map((it, k) => `<div class="it reveal" style="--d:${k + 2}"><div class="v ${it.c === "n" ? "c-n" : "c-a"}">${it.v}</div><h3>${it.h}</h3><p>${it.p}</p>${it.q}</div>`).join("");
    return { play() {}, redraw() {} }; } });

B.push({ id: "meaning", chapter: "What it means", chapterNo: 7, title: "What it means",
  text: () => head(`Chapter 7 · What it means`, `Six lessons from sixty years of data`) +
      lead(`The data show a market lost product by product to synthetics — abroad first, then at home — a comeback that is mostly raw fibre, sold to new buyers, and a reserve of fibre in crop residues that is hardly used — with prices and a growing market on its side.`, 2) +
      src(`All figures on this page are computed from the harmonised data; see Methods for how they were built and how much they depend on the choices made.`, 3),
  draw: el => { el.innerHTML = `<div class="take" id="take"></div>`; const host = el.querySelector("#take");
    const items = [
      { v: F.chg(v(T, ph("Lost to synthetics").start), v(T, ph("Lost to synthetics").end)), c: "s", h: "Lost abroad", p: `Sisal fibre exports ${ph("Lost to synthetics").start}–${ph("Lost to synthetics").end}, as polypropylene took the harvest-twine and rope markets.`, s: T, col: css("--natural"), hi: [ph("Lost to synthetics").start, ph("Lost to synthetics").end] },
      { v: range(v(ind("I03_sacks"), YL), v(ind("I03b_sacks_baci"), YL)), c: "s", h: "Lost at home", p: `Synthetic share of the sacks East Africa imports (${YL}, by weight); plastic articles are worth ${F.x(v(ind("I05_plastic_vs_sacks"), YL))} textile sacks.`, s: ind("I03b_sacks_baci"), col: css("--synthetic"), hi: [1995, YL] },
      { v: F.pct0(rshare("SSA", YL)), c: "a", h: "New buyers in Africa", p: `of sisal exports went to other Sub-Saharan countries in ${YL} (${D.dest.buyers["2024"][0].name} ${F.pct0(D.dest.buyers["2024"][0].share)}); Western Europe ${F.pct0(rshare("WEUR", YL))}.`, s: D.dest.share.SSA, col: "#e3820b", hi: [YL] },
      { v: `${bansOn.length} of ${D.meta.ea20.length}`, c: "n", h: "A policy window", p: `countries ban plastic bags by law (${bansOther.map(x => SB.name(x.iso3) + ": " + (x.level === "national_announced" ? "announced" : "state orders")).join(", ")}); per kilo, sisal fibre cost less than polypropylene resin in ${dynCheap().cheap} of the ${dynCheap().n} years since ${dynCheap().first}.`, s: null },
      { v: F.kt(U.now.c), c: "n", h: "A fibre reserve", p: `of banana fibre a year from the stems Ugandan farmers are ready to sell (${ktr(U.now)}); East Africa's banana stems could give ${ktr(prow("banana"))} (assuming matooke bunch weights). Uganda's exports under HS 5305: ${d3.format(",.0f")(U.exports_530500_t)} t in ten years.`, s: null },
      { v: F.usd(dyn2030().v10), c: "n", h: "A growing market", p: `a year in ${DY.demand.year1} from a tenth of East Africa's market for plastic sacks, bags and twine (2024 prices) — about ${F.kt(dyn2030().f10)} of fibre.`, s: null },
    ];
    host.innerHTML = items.map((it, k) => `<div class="it reveal" style="--d:${k + 2}"><div class="v ${it.c === "s" ? "c-s" : it.c === "n" ? "c-n" : "c-a"}">${it.v}</div><h3>${it.h}</h3><p>${it.p}</p>${it.s ? `<svg data-k="${k}"></svg>` : ""}</div>`).join("");
    return { play() { items.forEach((it, k) => { const s = host.querySelector(`svg[data-k="${k}"]`); if (s) C.spark(s, it.years || ys, it.s, it.col, it.hi); }); }, redraw() { this.play(); } }; } });

/* ───────────── In brief (S14, SB-D12): simple boards for a farmers' audience, after the fact sheets of the 2nd EAAFF
   (talk F). World and East Africa from data/farmers.js (scripts/sb_03_farmers.py); sisal exports from D.exp; Uganda's
   banana stems from chapter 6 (D.pot); prices from the forum's price fact sheet (checked against the PDF text by the
   script). Averages of five years: single years swing. ───────────── */
const FA = window.EAFF_FARMERS || null;
if (FA) {
  const per = p => `${p[0]}–${String(p[1]).slice(2)}`, th = t => d3.format(",.0f")(t / 1e3);
  const avgT = p => d3.mean(d3.range(p[0], p[1] + 1), y => v(T, y));
  const R = id => FA.rows.find(r => r.id === id), sis = { v0: avgT(FA.p0), v1: avgT(FA.p1) };
  const up = (a, z) => F.chg(a, z).replace(/^[+−]/, ""), times = r => d3.format(".1f")(r.v1 / r.v0);
  const chgTxt = r => (r.v1 / r.v0 >= 2 ? "×" + times(r) : F.chg(r.v0, r.v1)), pct = r => (r.v1 / r.v0 - 1) * 100;
  const two = (a, z, unit) => `${a} → ${z} ${unit}`;
  B.push({ id: "f-trend", cls: "simple", title: "Since 2000: plastic grew fastest",
    text: () => { const wp = R("w-plastic"), wn = R("w-natural"), ws = R("w-sisal"), ep = R("ea-plastic");
      return head(`In brief · 1 of 3 · ${per(FA.p0)} → ${per(FA.p1)}`, `Since 2000, <span class="c-s">plastic</span> grew fastest — and East Africa's <span class="c-n">sisal</span> grew too`) +
        lead(`Across the world, plastic production grew ${b(up(wp.v0, wp.v1))} and natural fibres ${b(up(wn.v0, wn.v1))}, while sisal fell ${b(up(ws.v0, ws.v1))}. ` +
          `In East Africa, imports of plastic sacks, bags and twine grew ${b(times(ep) + " times")} — but sisal exports grew too, by ${b(up(sis.v0, sis.v1))}.`, 2) +
        `<div class="kpis">${kpi("×" + times(ep), `East Africa's imports of plastic sacks, bags and twine, ${per(FA.p0)} → ${per(FA.p1)}`, "s", 3)}` +
        `${kpi(F.chg(sis.v0, sis.v1), `East Africa's sisal exports, ${per(FA.p0)} → ${per(FA.p1)}`, "n", 4)}</div>` +
        `<p class="note reveal" style="--d:5">Averages of five years, ${per(FA.p0)} and ${per(FA.p1)} (world plastics ${per(FA.plastics_last)}, the latest data): one good or bad year can mislead.</p>` +
        src(`<b>Source:</b> world plastics production: Geyer et al. 2017 and OECD 2022, via Our World in Data; natural fibres (cotton, jute, coir, sisal and other fibre crops) and sisal: FAOSTAT. ` +
          `East Africa (EA20): imports of plastic sacks, bags, twine and rope: CEPII BACI (including trade within the region); sisal exports: harmonised panel (UN Comtrade, FAOSTAT).`, 6); },
    draw: el => { const wp = R("w-plastic"), wn = R("w-natural"), ws = R("w-sisal"), ep = R("ea-plastic"), s = { v0: sis.v0, v1: sis.v1 };
      const row = (r, label, sub, color, srcTxt) => ({ label, sub, v: pct(r), text: chgTxt(r), color, valueColor: color, src: srcTxt,
        tip: SB.row(null, `${per(r.p0 || FA.p0)} average`, r.fmt(r.v0)) + SB.row(null, `${per(r.p1 || FA.p1)} average`, r.fmt(r.v1)) + SB.row(null, "change", F.chg(r.v0, r.v1)) });
      const mt_ = x => d3.format(",.0f")(x) + " million t", kt_ = x => d3.format(",.0f")(x) + " thousand t", t_ = x => th(x) + " thousand t";
      wp.fmt = mt_; wn.fmt = x => d3.format(",.1f")(x / 1e3) + " million t"; ws.fmt = kt_; ep.fmt = t_; s.fmt = t_;
      return C.groups(el, { shared: true, fmt: d => d3.format("+.0f")(d) + "%",
        groups: [{ title: "World", unit: `change, ${per(FA.p0)} → ${per(FA.p1)}`, unitShort: "change", rows: [
          row(wp, "Plastic production", two(d3.format(",.0f")(wp.v0), d3.format(",.0f")(wp.v1), `million t · to ${per(FA.plastics_last)}`), css("--synthetic"), FA.source.world_plastics),
          row(wn, "Natural fibres", two(d3.format(".1f")(wn.v0 / 1e3), d3.format(".1f")(wn.v1 / 1e3), "million t · cotton, jute, sisal…"), css("--g4"), FA.source.world_fibres),
          row(ws, "Sisal", two(d3.format(",.0f")(ws.v0), d3.format(",.0f")(ws.v1), "thousand t"), css("--natural"), FA.source.world_fibres)] },
        { title: "East Africa", rows: [
          row(ep, "Plastic sacks, bags, twine", two(th(ep.v0), th(ep.v1), "thousand t · imports"), css("--synthetic"), FA.source.ea_plastics),
          row(s, "Sisal", two(th(s.v0), th(s.v1), "thousand t · exports"), css("--natural"), "Harmonised panel: EA20 sisal fibre exports (UN Comtrade, FAOSTAT)")] }] }); } });

  const [cLo, cHi] = FA.prices.craft.usd_kg, spin = FA.prices.spin.usd_kg[0];
  const val = p => U.now.c * p / 1e3;   /* tonnes x US$ per kg -> US$ million a year */
  const stems = U.prod_t * 1000 / U.bunch.c, s17 = P.uga_series.prod[P.uga_series.years.indexOf(2017)];
  B.push({ id: "f-potential", cls: "simple", title: "The fibre is already in the fields",
    text: () => head(`In brief · 2 of 3 · Uganda's banana stems`, `The fibre is already in the fields: <span class="c-n">${th(U.now.c)} thousand tonnes</span> a year from Uganda's banana stems`) +
      lead(`${U.stems_per_kg} banana stems give 1 kg of dry fibre, and Uganda cuts about ${b(d3.format(".1~f")(stems / 1e9) + " billion")} stems a year. ` +
        `The stems of the ${b(F.pct0(U.share_now))} of farmers ready to sell them would give ${b(th(U.now.c) + " thousand tonnes")} of fibre a year — about as much as East Africa's sisal exports (${b(th(sis.v1) + " thousand tonnes")} a year in ${per(FA.p1)}).`, 2) +
      `<div class="kpis">${kpi(`US$${Math.round(val(cLo))}–${Math.round(val(cHi))} m`, `a year at today's craft price (US$${cLo}–${cHi} a kg)`, "n", 3)}` +
      `${kpi(`US$${Math.round(val(spin))} m`, `a year as fibre good enough to spin (US$${d3.format(".2f")(spin)} a kg)`, "n", 4)}</div>` +
      `<p class="note reveal caveat" style="--d:5">A potential, not a forecast: the fibre needs machines to take it out of the stems, and buyers. Range ${th(U.now.lo)}–${th(U.now.hi)} thousand tonnes (bunch weight). ` +
        `Uganda's banana harvest in FAOSTAT more than doubled from 2017 to 2020 (being checked); at the 2017 level there would be ${F.pct0((1 - s17 / U.prod_t) * 100)} less fibre.</p>` +
      src(`<b>Source:</b> FAOSTAT (Uganda, cooking bananas and plantains, ${P.years} average); ${U.g_stem} g of fibre per stem, "seven pseudo-stems yield 1 kg" (Kamusingize et al. 2026); bunch ${U.bunch.c} kg (AJPS 2016); ` +
        `${F.pct0(U.share_now)} of 102 farmers ready to sell stems (Kamusingize et al. 2025). Prices: EAAFF fact sheet "What do East African alternative fibres fetch?" (UNCTAD/SMEP, September 2026). ` +
        `Sisal: harmonised panel. Market in ${DY.demand.year1} and Uganda's imports: UN Comtrade (chapter 6).`, 6),
    draw: el => { const d = dyn2030(), fx = x => (x < 10 ? d3.format(".1f")(x) : d3.format(",.0f")(x));
      const priceSrc = FA.prices.source + "; " + FA.prices.check;
      return C.groups(el, { fmt: fx,
        groups: [{ title: "Fibre", unit: "thousand tonnes a year", unitShort: "thousand t a year", rows: [
          { label: "Uganda's banana stems", sub: `that farmers would sell · range ${th(U.now.lo)}–${th(U.now.hi)}`, subShort: `range ${th(U.now.lo)}–${th(U.now.hi)}`,
            v: U.now.c / 1e3, lo: U.now.lo / 1e3, hi: U.now.hi / 1e3, color: css("--natural"), src: `FAOSTAT × chapter 6 parameters, ${P.years} average` },
          { label: "East Africa's sisal exports", sub: `${per(FA.p1)} average`, v: sis.v1 / 1e3, color: css("--g2"), src: "Harmonised panel (UN Comtrade, FAOSTAT)" },
          { label: "Replacing 1 in 10 plastic sacks", short: "1 in 10 plastic sacks", sub: `fibre needed · East Africa, ${DY.demand.year1}`, subShort: `East Africa, ${DY.demand.year1}`,
            v: d.f10 / 1e3, color: css("--g5"), src: "Chapter 6: East Africa's imports of plastic sacks, bags and twine on the 2014–24 trend (UN Comtrade); a tenth at the world price of sisal twine and jute sacks" },
          { label: "Uganda's plastic sack imports", short: "Uganda: plastic sacks", sub: `sacks, bags, twine · ${P.years}`, subShort: P.years,
            v: CP.uga_pack_t / 1e3, color: css("--synthetic"), src: `UN Comtrade, ${P.years} average` }] },
        { title: "Money", unit: "US$ million a year", unitShort: "US$ m a year", rows: [
          { label: "Banana fibre, craft price", short: "Craft price", sub: `US$${cLo}–${cHi} a kg`, v: val(cHi), lo: val(cLo), hi: val(cHi), range: true,
            text: `${Math.round(val(cLo))}–${Math.round(val(cHi))}`, color: css("--natural"), src: priceSrc },
          { label: "Banana fibre, spinning quality", short: "Spinning quality", sub: `US$${d3.format(".2f")(spin)} a kg`, v: val(spin), color: css("--g2"), src: priceSrc },
          { label: "Replacing 1 in 10 plastic sacks", short: "1 in 10 plastic sacks", sub: `East Africa, ${DY.demand.year1} · 2024 prices`, subShort: String(DY.demand.year1),
            v: d.v10 / 1e6, color: css("--g5"), src: "Chapter 6 (UN Comtrade; 2024 prices)" }] }] }); } });
}

B.push({ id: "methods", chapter: "Methods", title: "How the data were made",
  text: () => head(`Methods`, `How the data were made`) +
      lead(`Every number comes from one harmonised panel for ${D.methods.n_ea} East African countries (EA20, current borders), ${D.methods.n_concepts} product groups and 1961–2025. Seven steps make sources from different decades comparable; the table shows how much the headlines depend on the choices. Chapter 6 multiplies FAOSTAT crop output (${P.years}) by per-plant fibre yields; ${P.params.filter(q => q.status === "VERIFIED").length} of its ${P.params.length} parameters were checked against the text of their sources, the other ${P.params.filter(q => q.status !== "VERIFIED").length} (fruit and nut weights) are labelled assumptions. Prices come from the World Bank Pink Sheet and UN Comtrade unit values; the 2030 market extends the 2010–2024 import trend at three paces.`, 2) +
      src(`<b>Sources:</b> ${D.meta.sources.join("; ")}. Data built ${D.meta.built} (settings ${D.meta.settings_hash}). Tables: <a href="../EAFF_history_harmonized.xlsx">EAFF_history_harmonized.xlsx</a>, <a href="../EAFF_data_compendium.xlsx">EAFF_data_compendium.xlsx</a>, <a href="../EAFF_fibre_potential.xlsx">EAFF_fibre_potential.xlsx</a>.`, 3),
  draw: el => { const M = D.methods, ce = M.cif_example, de = M.deflator_example, l1 = M.link_examples[0], l2 = M.link_examples[1];
    const steps = [
      ["1 · Products", "One code list for 60 years", `${M.n_concepts} product groups mapped from SITC (1962–1994), the seven HS editions (HS 1992 to HS 2022; data 1995–2025) and FAO items with official concordances; sisal booked as "jute" by producers is counted as sisal.`],
      ["2 · Countries", "Current borders", `Former states mapped to today's countries (Tanganyika + Zanzibar → Tanzania; Sudan before 2011 under code 736; Ethiopia PDR → Ethiopia).`],
      ["3 · Who reported", "Own report first", `A country's own report where it filed one, otherwise its partners' records (most of the 1960s–1970s).`],
      ["4 · Prices", "Free on board", `Partners' import values include freight and insurance: ÷ ${d3.format(".2f")(ce.ratio)} (e.g. Tanzania ${ce.year}: ${F.usd(ce.cif)} → ${b(F.usd(ce.fob))}).`],
      ["5 · Money", `${de.base} dollars`, `MUV index: US$1 of ${de.year} = ${b("US$" + d3.format(".2f")(de.muv))} of ${de.base} (US GDP deflator: US$${d3.format(".2f")(de.gdp)}).`],
      ["6 · Weights", "Tonnes everywhere", "Missing or implausible net weights re-estimated from value at the product's unit value, and flagged."],
      ["7 · 1994/95 break", "Linking SITC to HS", `Ratios over 1995–1999 per country and product (Tanzania sisal ${d3.format(".3f")(l1.k)} → no change; sacks ${d3.format(".3f")(l2.k)} → applied); ${M.n_breaks} decisions logged.`],
    ];
    const rows = D.robust.filter(r => !/linked to HS/.test(r.main) || r.year === 1974).slice(0, 12);
    el.innerHTML = `<div class="steps">${steps.map((s, i) => `<div class="step" style="transition-delay:${i * 110}ms"><div class="k">${s[0]}</div><h4>${s[1]}</h4><p>${s[2]}</p></div>`).join("")}</div>
      <table class="rob"><thead><tr><th>Headline</th><th>Year</th><th>Main</th><th>Alternative</th><th class="d">Change</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${r.headline}</td><td>${r.year}</td><td>${r.main}: ${d3.format(",.1f")(r.main_value)}</td><td>${r.alternative}: ${d3.format(",.1f")(r.alt_value)}</td><td class="d">${r.unit === "%" ? F.minus((r.alt_value - r.main_value >= 0 ? "+" : "") + d3.format(".1f")(r.alt_value - r.main_value)) + " pts" : F.pp(r.diff_pct)}</td></tr>`).join("")}</tbody></table>
      <p class="disclaimer">Direction of the long-run changes is the same under every alternative shown. Full list: data/processed/storyboard/robustness.csv.</p>`;
    return { play() {}, redraw() {} }; } });

SB.boards = B;
SB.start();
})();
