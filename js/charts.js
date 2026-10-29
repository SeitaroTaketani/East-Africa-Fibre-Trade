/* Chart components (D3 v7). Each returns { play(), redraw() }: play() draws with animation, redraw() without.
   Marks: 2px lines, hairline grid, direct labels at line ends, crosshair + tooltip on hover (dataviz rules);
   no dual axes; colours from css tokens (validated ramps). */
(function () {
"use strict";
const SB = window.SB, D = SB.D, F = SB.fmt;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

function frame(el, m) {
  el.innerHTML = "";
  const W = Math.max(280, el.clientWidth), H = Math.max(240, el.clientHeight);
  const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMinYMin meet");
  const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
  return { svg, g, W, H, w: W - m.l - m.r, h: H - m.t - m.b, m };
}
const drawLine = (sel, dur, delay) => {
  if (!dur) return;
  sel.each(function () { const L = this.getTotalLength ? this.getTotalLength() : 0;
    d3.select(this).attr("stroke-dasharray", `${L} ${L}`).attr("stroke-dashoffset", L)
      .transition().delay(delay || 0).duration(dur).ease(d3.easeCubicOut).attr("stroke-dashoffset", 0)
      .on("end", function () { d3.select(this).attr("stroke-dasharray", null); }); });
};
/* number tween: text of `sel` runs from its previous value (or 0) to v, formatted by fmt */
function tweenText(sel, v, fmt, dur, delay) {
  sel.each(function () { const el = d3.select(this), from = this._tv != null ? this._tv : 0; this._tv = v;
    if (!dur) { el.text(fmt(v)); return; }
    el.transition().delay(delay || 0).duration(dur).ease(d3.easeCubicOut).tween("text", () => { const i = d3.interpolateNumber(from, v); return t => el.text(fmt(i(t))); }); });
}
SB.tweenText = tweenText;
/* table view of the plotted values (accessibility; exact numbers) */
function addTable(el, cols, rows) {
  const btn = d3.select(el).append("button").attr("class", "tbtn").text("Data table");
  const view = d3.select(el).append("div").attr("class", "tview hidden");
  view.html(`<table><thead><tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(x => `<td>${x}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
  btn.on("click", () => { const on = view.classed("hidden"); view.classed("hidden", !on); btn.text(on ? "Chart" : "Data table"); });
}
/* push labels apart vertically (min gap) */
function spread(items, gap, lo, hi) {
  items.sort((a, b) => a.y - b.y);
  for (let i = 1; i < items.length; i++) if (items[i].y - items[i - 1].y < gap) items[i].y = items[i - 1].y + gap;
  const over = items.length ? items[items.length - 1].y - hi : 0;
  if (over > 0) { items.forEach(d => { d.y -= over; }); for (let i = items.length - 2; i >= 0; i--) if (items[i + 1].y - items[i].y < gap) items[i].y = items[i + 1].y - gap; }
  items.forEach(d => { d.y = Math.max(lo, d.y); });
  return items;
}

/* ───────────── line chart: series, optional range band, highlight windows, events, marked points ───────────── */
SB.charts.line = function (el, cfg) {
  /* room on the right for the end labels: measured in the page's own type, at least cfg.right, at most 42% of the width */
  function endRoom() {
    const ys = cfg.years, x0 = cfg.x0 || ys[0], x1 = cfg.x1 || ys[ys.length - 1];
    const probe = d3.select(el).append("svg").attr("width", 10).attr("height", 10).style("position", "absolute").style("visibility", "hidden");
    let need = 0;
    cfg.series.forEach(s => { if (s.label === false) return; let last = null;
      s.v.forEach((v, i) => { if (v != null && ys[i] >= x0 && ys[i] <= x1) last = v; });
      if (last == null) return;
      const t = probe.append("text").attr("class", "lab").html(`<tspan style="font-weight:800">●</tspan> ${s.label}`);
      if (cfg.endValue) t.append("tspan").attr("dx", 6).style("font-weight", 500).text(cfg.endValue(last, s));
      need = Math.max(need, t.node().getComputedTextLength()); });
    probe.remove();
    return Math.min(Math.max(cfg.right || 150, Math.ceil(need) + 22), Math.round(el.clientWidth * 0.42));
  }
  function draw(anim) {
    const f = frame(el, { t: 30, r: endRoom(), b: 34, l: 58 });
    const ys = cfg.years, x0 = cfg.x0 || ys[0], x1 = cfg.x1 || ys[ys.length - 1];
    const x = d3.scaleLinear().domain([x0, x1]).range([0, f.w]);
    const vals = [];
    cfg.series.forEach(s => s.v.forEach((v, i) => { if (v != null && ys[i] >= x0 && ys[i] <= x1) vals.push(v); }));
    (cfg.bands || []).forEach(b => [b.lo, b.hi].forEach(a => a.forEach((v, i) => { if (v != null && ys[i] >= x0 && ys[i] <= x1) vals.push(v); })));
    let y;
    if (cfg.log) y = d3.scaleLog().domain([d3.min(vals) * 0.8, d3.max(vals) * 1.25]).range([f.h, 0]);
    else y = d3.scaleLinear().domain([cfg.yMin != null ? cfg.yMin : 0, cfg.yMax != null ? cfg.yMax : d3.max(vals) * 1.08]).nice().range([f.h, 0]);
    const g = f.g, dur = anim ? SB.dur(cfg.dur || 1700) : 0;
    const yt = cfg.log ? y.ticks(5).filter(t => [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100].includes(+t.toPrecision(1))) : y.ticks(5);
    g.append("g").attr("class", "grid").call(d3.axisLeft(y).tickValues(yt).tickSize(-f.w).tickFormat(""));
    g.append("g").attr("class", "axis y").call(d3.axisLeft(y).tickValues(yt).tickFormat(cfg.yFmt || (d => d)).tickSize(0).tickPadding(8));
    g.append("g").attr("class", "axis x").attr("transform", `translate(0,${f.h})`).call(d3.axisBottom(x).ticks(Math.min(10, Math.round(f.w / 70))).tickFormat(d3.format("d")).tickSizeOuter(0));
    if (cfg.yLabel) g.append("text").attr("class", "lab mute").attr("x", -50).attr("y", -14).text(cfg.yLabel);
    /* highlight windows */
    (cfg.highlight || []).forEach(h => {
      const r = g.append("rect").attr("class", "hl-band").attr("x", x(Math.max(h.from, x0))).attr("y", 0).attr("height", f.h)
        .attr("width", anim ? 0 : x(Math.min(h.to, x1)) - x(Math.max(h.from, x0)));
      if (anim) r.transition().delay(dur * 0.5).duration(SB.dur(700)).attr("width", x(Math.min(h.to, x1)) - x(Math.max(h.from, x0)));
      if (h.label) g.append("text").attr("class", "hl-lab").attr("x", x(Math.max(h.from, x0)) + 6).attr("y", 14).text(h.label);
    });
    /* range bands */
    (cfg.bands || []).forEach(b => {
      const pts = ys.map((yy, i) => ({ yy, lo: b.lo[i], hi: b.hi[i] })).filter(d => d.lo != null && d.hi != null && d.yy >= x0 && d.yy <= x1);
      const ar = d3.area().x(d => x(d.yy)).y0(d => y(Math.min(d.lo, d.hi))).y1(d => y(Math.max(d.lo, d.hi))).curve(d3.curveMonotoneX);
      const p = g.append("path").datum(pts).attr("d", ar).attr("fill", b.color).attr("opacity", 0.18);
      if (anim) p.attr("opacity", 0).transition().delay(dur * 0.4).duration(SB.dur(800)).attr("opacity", 0.18);
    });
    /* lines */
    const line = d3.line().defined(d => d.v != null).x(d => x(d.y)).y(d => y(d.v)).curve(d3.curveMonotoneX);
    const ends = [];
    cfg.series.forEach((s, k) => {
      const pts = ys.map((yy, i) => ({ y: yy, v: s.v[i] })).filter(d => d.y >= x0 && d.y <= x1);
      const p = g.append("path").datum(pts).attr("d", line).attr("fill", "none").attr("stroke", s.color).attr("stroke-width", s.width || 2.2)
        .attr("stroke-linejoin", "round").attr("stroke-linecap", "round").attr("opacity", s.opacity || 1);
      if (s.dash) p.attr("stroke-dasharray", s.dash); else { drawLine(p, dur, k * 150);
        if (dur) { const node = p.node(), L = node.getTotalLength ? node.getTotalLength() : 0;
          if (L > 0) { const cm = g.append("circle").attr("class", "comet").attr("r", 4.5).attr("fill", s.color).attr("stroke", "#fff").attr("stroke-width", 2);
            cm.transition().delay(k * 150).duration(dur).ease(d3.easeCubicOut)
              .attrTween("transform", () => t => { const q = node.getPointAtLength(t * L); return `translate(${q.x},${q.y})`; })
              .transition().duration(SB.dur(400)).attr("r", 0).remove(); } } }
      const last = [...pts].reverse().find(d => d.v != null);
      if (last && s.label !== false) ends.push({ s, x: x(last.y), y: y(last.v), v: last.v, yr: last.y });
    });
    spread(ends, 15, -10, f.h).forEach(e => {
      const t = g.append("text").attr("class", "lab").attr("x", e.x + 8).attr("y", e.y + 4).style("fill", "#231f20")
        .html(`<tspan style="fill:${e.s.color};font-weight:800">●</tspan> ${e.s.label}`);
      if (cfg.endValue) t.append("tspan").attr("class", "mute").attr("dx", 6).style("fill", "#6e6259").style("font-weight", 500).text(cfg.endValue(e.v, e.s));
      if (anim) t.attr("opacity", 0).transition().delay(dur).duration(SB.dur(400)).attr("opacity", 1);
    });
    /* events: markers on the baseline, labels for the selected ones */
    const ev = (cfg.events || []).filter(e => e.y >= x0 && e.y <= x1);
    const eg = g.append("g");
    ev.forEach((e, i) => {
      const xx = x(e.y);
      if (e.label && f.w >= 560) {
        eg.append("line").attr("x1", xx).attr("x2", xx).attr("y1", f.h).attr("y2", e.top != null ? e.top : 26 + (i % 3) * 16).attr("stroke", "#cfc9c4").attr("stroke-width", 1);
        eg.append("text").attr("class", "ev-lab").attr("x", xx + 4).attr("y", (e.top != null ? e.top : 26 + (i % 3) * 16) + 3).text(e.label);
      }
      eg.append("path").attr("class", "ev-mark" + (e.pol ? " pol" : "")).attr("d", d3.symbol(d3.symbolDiamond, 46)()).attr("transform", `translate(${xx},${f.h - 1})`)
        .on("mousemove", m => SB.tip.show(m, `<div class="t">${e.y} · ${e.scope || ""}</div>${e.text}<div class="s">${e.src || ""}</div>`))
        .on("mouseleave", SB.tip.hide);
    });
    if (anim) eg.attr("opacity", 0).transition().delay(dur * 0.6).duration(SB.dur(600)).attr("opacity", 1);
    /* marked points */
    (cfg.marks || []).forEach((mk, i) => {
      const s = cfg.series.find(q => q.id === mk.id) || cfg.series[0]; const v = SB.at(s.v, mk.y, ys); if (v == null) return;
      const gg = g.append("g").attr("class", "ann").attr("transform", `translate(${x(mk.y)},${y(v)})`);
      gg.append("circle").attr("r", 5).attr("fill", s.color).attr("stroke", "#fff").attr("stroke-width", 2);
      const dx = mk.dx != null ? mk.dx : 10, dy = mk.dy != null ? mk.dy : -14;
      gg.append("text").attr("x", dx).attr("y", dy).attr("text-anchor", mk.anchor || "start").style("font-weight", 700).text(mk.text);
      if (mk.sub) gg.append("text").attr("x", dx).attr("y", dy + 14).attr("text-anchor", mk.anchor || "start").style("fill", "#6e6259").text(mk.sub);
      const fx = Math.max(0, Math.min(1, x(mk.y) / f.w)), reach = 1 - Math.pow(1 - fx, 1 / 3);
      if (anim) gg.attr("opacity", 0).attr("transform", `translate(${x(mk.y)},${y(v) + 6})`).transition().delay(dur * reach).duration(SB.dur(450)).ease(d3.easeBackOut)
        .attr("opacity", 1).attr("transform", `translate(${x(mk.y)},${y(v)})`);
    });
    /* hover: crosshair + tooltip */
    const xh = g.append("line").attr("class", "xhair").attr("y1", 0).attr("y2", f.h).attr("opacity", 0);
    const dots = cfg.series.map(s => g.append("circle").attr("class", "dot-hover").attr("r", 4.5).attr("fill", s.color).attr("opacity", 0));
    g.append("rect").attr("width", f.w).attr("height", f.h).attr("fill", "transparent")
      .on("mousemove", m => {
        const [mx] = d3.pointer(m), yr = Math.max(x0, Math.min(x1, Math.round(x.invert(mx))));
        xh.attr("x1", x(yr)).attr("x2", x(yr)).attr("opacity", 1);
        let rows = "";
        cfg.series.forEach((s, k) => { const v = SB.at(s.v, yr, ys);
          dots[k].attr("cx", x(yr)).attr("cy", v != null ? y(v) : -99).attr("opacity", v != null ? 1 : 0);
          rows += SB.row(s.color, s.label, v != null ? (cfg.tipFmt || cfg.yFmt || F.num)(v) : "–"); });
        (cfg.bands || []).forEach(b => { const lo = SB.at(b.lo, yr, ys), hi = SB.at(b.hi, yr, ys);
          if (lo != null && hi != null) rows += SB.row(null, b.label, `${(cfg.tipFmt || cfg.yFmt)(Math.min(lo, hi))} – ${(cfg.tipFmt || cfg.yFmt)(Math.max(lo, hi))}`); });
        const extra = cfg.tipExtra ? cfg.tipExtra(yr) : "";
        SB.tip.show(m, `<div class="t">${yr}</div>${rows}${extra}<div class="s">${cfg.src || ""}</div>`);
      })
      .on("mouseleave", () => { xh.attr("opacity", 0); dots.forEach(d => d.attr("opacity", 0)); SB.tip.hide(); });
    const tf = cfg.tipFmt || cfg.yFmt || F.num, shown = cfg.series.filter(s => s.id !== "one");   // the dashed 1x reference line is not data
    addTable(el, ["Year", ...shown.map(s => s.label)], ys.filter(yy => yy >= x0 && yy <= x1).reverse()
      .map(yy => [yy, ...shown.map(s => { const q = SB.at(s.v, yy, ys); return q == null ? "–" : tf(q); })]).filter(r => r.slice(1).some(c => c !== "–")));
  }
  return { play: () => draw(true), redraw: () => draw(false) };
};

/* ───────────── stacked areas: the "rope" (absolute, twisted texture) and shares (100%) ───────────── */
SB.charts.stack = function (el, cfg) {
  let hiYear = cfg.year;
  function draw(anim) {
    const f = frame(el, { t: 30, r: cfg.right || 170, b: 34, l: 58 });
    const ys = cfg.years, keys = cfg.layers.map(l => l.id);
    const rows = ys.map((yy, i) => { const o = { year: yy }; cfg.layers.forEach(l => { o[l.id] = Math.max(0, l.v[i] || 0); }); return o; })
      .filter(r => keys.some(k => r[k] > 0) && (cfg.x1 == null || r.year <= cfg.x1));
    const st = d3.stack().keys(keys).offset(cfg.percent ? d3.stackOffsetExpand : d3.stackOffsetNone)(rows);
    const x = d3.scaleLinear().domain(d3.extent(rows, r => r.year)).range([0, f.w]);
    const y = d3.scaleLinear().domain([0, cfg.percent ? 1 : d3.max(st[st.length - 1], d => d[1]) * 1.05]).nice().range([f.h, 0]);
    const g = f.g, dur = anim ? SB.dur(cfg.dur || 2300) : 0;
    const defs = f.svg.append("defs");
    const cid = "clip-" + Math.random().toString(36).slice(2);
    const clip = defs.append("clipPath").attr("id", cid).append("rect").attr("x", -2).attr("y", -10).attr("height", f.h + 20).attr("width", anim ? 0 : f.w + 4);
    if (anim) clip.transition().duration(dur).ease(d3.easeCubicInOut).attr("width", f.w + 4);
    if (cfg.texture) {                                  // twisted strands: fine diagonal lines over each band
      const pt = defs.append("pattern").attr("id", cid + "-tw").attr("width", 7).attr("height", 7).attr("patternUnits", "userSpaceOnUse").attr("patternTransform", "rotate(58)");
      pt.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 7).attr("stroke", "#fff").attr("stroke-width", 1.1).attr("opacity", 0.38);
    }
    g.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(5).tickSize(-f.w).tickFormat(""));
    g.append("g").attr("class", "axis y").call(d3.axisLeft(y).ticks(5).tickFormat(cfg.percent ? d3.format(".0%") : cfg.yFmt).tickSize(0).tickPadding(8));
    g.append("g").attr("class", "axis x").attr("transform", `translate(0,${f.h})`).call(d3.axisBottom(x).ticks(Math.min(10, Math.round(f.w / 70))).tickFormat(d3.format("d")).tickSizeOuter(0));
    if (cfg.yLabel) g.append("text").attr("class", "lab mute").attr("x", -50).attr("y", -14).text(cfg.yLabel);
    const area = d3.area().x(d => x(d.data.year)).y0(d => y(d[0])).y1(d => y(d[1])).curve(d3.curveMonotoneX);
    const lay = g.append("g").attr("clip-path", `url(#${cid})`);
    const color = id => cfg.layers.find(l => l.id === id).color;
    const paths = lay.selectAll("path.ly").data(st).join("path").attr("class", "ly").attr("d", area).attr("fill", d => color(d.key))
      .attr("stroke", "#fff").attr("stroke-width", 1);
    if (cfg.texture) lay.selectAll("path.tw").data(st).join("path").attr("class", "tw").attr("d", area).attr("fill", `url(#${cid}-tw)`).style("pointer-events", "none");
    /* direct labels at the right edge, inside bands that are tall enough */
    const lastR = rows[rows.length - 1], labs = [];
    st.forEach(s => { const d = s[s.length - 1]; const hgt = y(d[0]) - y(d[1]);
      const L = cfg.layers.find(l => l.id === s.key);
      if (hgt > 3 || L.always) labs.push({ L, y: (y(d[0]) + y(d[1])) / 2, v: lastR[s.key], tot: d3.sum(keys, k => lastR[k]) }); });
    spread(labs, 15, 0, f.h).forEach(o => {
      const t = g.append("text").attr("class", "lab").attr("x", f.w + 10).attr("y", o.y + 4)
        .html(`<tspan style="fill:${o.L.color};font-weight:800">■</tspan> ${o.L.label}`);
      if (cfg.labelValue) t.append("tspan").attr("dx", 6).style("fill", "#6e6259").style("font-weight", 500).text(cfg.labelValue(o.v, o.tot));
      if (anim) t.attr("opacity", 0).transition().delay(dur * 0.85).duration(SB.dur(400)).attr("opacity", 1);
    });
    /* highlighted year: hairline and a call-out */
    const hg = g.append("g");
    function mark(yr) {
      hg.selectAll("*").remove(); if (yr == null) return;
      const r = rows.find(q => q.year === yr); if (!r) return;
      hg.append("line").attr("x1", x(yr)).attr("x2", x(yr)).attr("y1", 0).attr("y2", f.h).attr("stroke", "#231f20").attr("stroke-width", 1);
      hg.append("text").attr("class", "lab big halo").attr("x", x(yr) + (x(yr) > f.w * 0.7 ? -8 : 8)).attr("y", 18)
        .attr("text-anchor", x(yr) > f.w * 0.7 ? "end" : "start").text(cfg.markText ? cfg.markText(yr, r) : yr);
    }
    if (hiYear != null) { if (anim) setTimeout(() => mark(hiYear), dur * 0.9); else mark(hiYear); }
    /* hover */
    const xh = g.append("line").attr("class", "xhair").attr("y1", 0).attr("y2", f.h).attr("opacity", 0);
    g.append("rect").attr("width", f.w).attr("height", f.h).attr("fill", "transparent")
      .on("mousemove", m => {
        const [mx, my] = d3.pointer(m), yr = Math.round(x.invert(mx)), r = rows.find(q => q.year === yr); if (!r) return;
        xh.attr("x1", x(yr)).attr("x2", x(yr)).attr("opacity", 1);
        const tot = d3.sum(keys, k => r[k]); const yv = y.invert(my);
        let on = null; st.forEach(s => { const d = s.find(q => q.data.year === yr); if (d && yv >= d[0] && yv <= d[1]) on = s.key; });
        paths.attr("opacity", d => (on && d.key !== on ? 0.45 : 1));
        const list = [...cfg.layers].reverse().map(l => SB.row(l.color, (l.id === on ? "<b>" + l.label + "</b>" : l.label),
          cfg.percent ? F.pct0(r[l.id] / tot * 100) : `${cfg.tipFmt(r[l.id])} · ${F.pct0(r[l.id] / tot * 100)}`)).join("");
        SB.tip.show(m, `<div class="t">${yr}${cfg.percent ? "" : " · total " + cfg.tipFmt(tot)}</div>${list}<div class="s">${cfg.src || ""}</div>`);
      })
      .on("mouseleave", () => { xh.attr("opacity", 0); paths.attr("opacity", 1); SB.tip.hide(); });
    addTable(el, ["Year", ...cfg.layers.map(l => l.label)], [...rows].reverse().map(r => { const tot = d3.sum(keys, k => r[k]);
      return [r.year, ...cfg.layers.map(l => (cfg.percent ? F.pct0(r[l.id] / tot * 100) : cfg.tipFmt(r[l.id])))]; }));
  }
  return { play: () => draw(true), redraw: () => draw(false) };
};

/* ───────────── bars that change between two years (shares by category) ───────────── */
SB.charts.bars = function (el, cfg) {
  let yr = cfg.years[0], timer = null;
  function draw(anim) {
    clearTimeout(timer);
    const host = el; host.innerHTML = "";
    const ctl = d3.select(host).append("div").attr("class", "ctrl");
    ctl.append("span").attr("class", "cap").text("Year");
    const btns = cfg.years.map(yy => ctl.append("button").text(yy).on("click", () => { yr = yy; update(true); }));
    const box = d3.select(host).append("div").style("position", "relative").style("height", "calc(100% - 34px)").node();
    const f = frame(box, { t: 10, r: 70, b: 24, l: 190 });
    const cats = cfg.cats, n = cats.length;
    const yb = d3.scaleBand().domain(cats.map(c => c.id)).range([0, f.h]).padding(0.28);
    const x = d3.scaleLinear().domain([0, cfg.max || 100]).range([0, f.w]);
    const g = f.g;
    g.append("g").attr("class", "grid").attr("transform", `translate(0,${f.h})`).call(d3.axisBottom(x).ticks(5).tickSize(-f.h).tickFormat(""));
    g.append("g").attr("class", "axis x").attr("transform", `translate(0,${f.h})`).call(d3.axisBottom(x).ticks(5).tickFormat(d => d + "%").tickSizeOuter(0));
    const big = g.append("text").attr("class", "big-year").attr("x", f.w).attr("y", f.h - 10).attr("text-anchor", "end");
    const rowsG = g.selectAll("g.r").data(cats).join("g").attr("class", "r");
    rowsG.append("text").attr("class", "lab").attr("x", -10).attr("text-anchor", "end").attr("dy", "0.35em").text(c => c.label);
    const bar = rowsG.append("rect").attr("rx", 2).attr("height", yb.bandwidth()).attr("fill", c => c.color).attr("width", 0);
    const val = rowsG.append("text").attr("class", "lab").attr("dy", "0.35em");
    rowsG.on("mousemove", (m, c) => SB.tip.show(m, `<div class="t">${c.label}</div>${cfg.years.map(yy => SB.row(null, yy, F.pct(cfg.value(c.id, yy)))).join("")}<div class="s">${cfg.src || ""}</div>`))
      .on("mouseleave", SB.tip.hide);
    function update(a) {
      const d = a ? SB.dur(900) : 0;
      btns.forEach((b, i) => b.classed("on", cfg.years[i] === yr));
      big.text(yr);
      const order = [...cats].sort((p, q) => (cfg.value(q.id, yr) || 0) - (cfg.value(p.id, yr) || 0)).map(c => c.id);
      yb.domain(order);
      rowsG.transition().duration(d).ease(d3.easeCubicInOut).attr("transform", c => `translate(0,${yb(c.id)})`);
      rowsG.select("text.lab").attr("y", yb.bandwidth() / 2);
      bar.transition().duration(d).ease(d3.easeCubicInOut).attr("width", c => x(cfg.value(c.id, yr) || 0));
      val.transition().duration(d).ease(d3.easeCubicInOut).attr("x", c => x(cfg.value(c.id, yr) || 0) + 6).attr("y", yb.bandwidth() / 2)
        .tween("text", function (c) { const i = d3.interpolateNumber(+(this._v || 0), cfg.value(c.id, yr) || 0); this._v = cfg.value(c.id, yr) || 0;
          return t => { this.textContent = F.pct(i(t)); }; });
    }
    rowsG.attr("transform", c => `translate(0,${yb(c.id)})`);
    update(false);
    if (anim && cfg.years.length > 1) { yr = cfg.years[0]; update(false); bar.attr("width", 0); bar.transition().duration(SB.dur(800)).attr("width", c => x(cfg.value(c.id, yr) || 0));
      timer = setTimeout(() => { yr = cfg.years[cfg.years.length - 1]; update(true); }, SB.reduced ? 0 : 2200); }
  }
  return { play: () => draw(true), redraw: () => draw(false) };
};

/* ───────────── UN map of East Africa: plastic-bag bans by year of the act ───────────── */
SB.charts.bans = function (el, cfg) {
  let timer = null;
  const topo = window.UN_TOPO;
  const rewind = f => { const g = f.geometry; if (!g) return f;
    const fix = poly => (d3.geoArea({ type: "Polygon", coordinates: poly }) > 2 * Math.PI ? poly.map(r => r.slice().reverse()) : poly);
    if (g.type === "Polygon") g.coordinates = fix(g.coordinates); else if (g.type === "MultiPolygon") g.coordinates = g.coordinates.map(fix); return f; };
  const feats = topojson.feature(topo, topo.objects.economies).features.map(rewind);
  const borders = [["plain-borders", ""], ["dashed-borders", "border-dashed"], ["dotted-borders", "border-dotted"], ["dash-dotted-borders", "border-dashdot"]]
    .map(([k, c]) => ({ c, geo: topojson.feature(topo, topo.objects[k]) }));
  const byM49 = {}; cfg.bans.forEach(b => { if (b.m49 != null) byM49[String(b.m49).padStart(3, "0")] = b; });
  const eaCodes = new Set(D.meta.ea20.map(i => String(D.meta.m49[i]).padStart(3, "0")));
  /* three levels (user decision 2026-10-28, QA Q35): national law · national ban announced, law not found · state orders only */
  const yOf = b => (b ? (b.level === "national_law" ? b.year : b.level_year) : null);
  const LEVEL = { national_law: "national law", national_announced: "national ban announced, law not found", subnational_only: "state orders only" };
  const short = iso => SB.name(iso).replace("United Republic of ", "").replace("Democratic Republic of the Congo", "DR Congo");
  function draw(anim) {
    clearTimeout(timer);
    el.innerHTML = "";
    const ctl = d3.select(el).append("div").attr("class", "ctrl");
    ctl.append("button").attr("class", "on").text("▶ Replay the years").on("click", () => run(true));
    ctl.append("span").text("Year of the legal act (or announcement, state order); hover a country for the measure and its source");
    const box = d3.select(el).append("div").style("position", "relative").style("height", "calc(100% - 96px)").node();
    if (el.clientWidth < 560) box.style.height = Math.round(window.innerHeight * 0.55) + "px";   // phones: the map gets its own height
    /* legend and list of laws under the map are laid out first, with the longest list (the last year); the map gets the height left */
    const legend = d3.select(el).append("div").attr("class", "maplegend").html(`<span><i class="sw law"></i>national law</span><span><i class="sw ann"></i>${LEVEL.national_announced}</span><span><i class="sw sub"></i>${LEVEL.subnational_only}</span><span><i class="sw none"></i>none found</span>`);
    const chips = d3.select(el).append("div").attr("class", "chips");
    const yrs = cfg.bans.map(yOf).filter(Boolean), y0 = d3.min(yrs) - 1, y1 = Math.max(d3.max(yrs), cfg.until || 2026);
    const chipsHtml = yy => {
      const on = cfg.bans.filter(b => b.level === "national_law" && b.year && b.year <= yy).sort((p, q) => p.year - q.year);
      const other = cfg.bans.filter(b => b.level !== "national_law" && yOf(b) && yOf(b) <= yy);
      return `<span><b>${on.length}</b> of ${D.meta.ea20.length} countries with a national law by ${yy}:</span>` + on.map(b => `<span>${b.year} ${short(b.iso3)}</span>`).join("")
        + other.map(b => `<span class="other">${short(b.iso3)}: ${LEVEL[b.level]} (${yOf(b)})</span>`).join("");
    };
    if (el.clientWidth >= 560 && !SB.stacked()) { chips.html(chipsHtml(y1));
      box.style.height = Math.max(240, el.clientHeight - ctl.node().offsetHeight - legend.node().offsetHeight - chips.node().offsetHeight - 24) + "px"; }
    const W = box.clientWidth, H = box.clientHeight;
    const svg = d3.select(box).append("svg").attr("class", "map").attr("viewBox", `0 0 ${W} ${H}`);
    const pat = svg.append("defs").append("pattern").attr("id", "hatch-sub").attr("width", 6).attr("height", 6)
      .attr("patternUnits", "userSpaceOnUse").attr("patternTransform", "rotate(45)");
    pat.append("rect").attr("width", 6).attr("height", 6).attr("fill", "#efece9");
    pat.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 6).attr("stroke", css("--natural")).attr("stroke-width", 2.4);
    const yearLab = d3.select(box).append("div").attr("class", "mapyear");
    const ea = feats.filter(f => eaCodes.has(f.properties.code));
    const proj = d3.geoEqualEarth().fitExtent([[8, 8], [W - 8, H - 8]], { type: "FeatureCollection", features: ea });
    const path = d3.geoPath(proj);
    const lands = svg.append("g").selectAll("path").data(feats).join("path")
      .attr("class", d => "land" + (eaCodes.has(d.properties.code) ? " ea" : "")).attr("d", path)
      .on("mousemove", (m, d) => { const b = byM49[d.properties.code]; if (!eaCodes.has(d.properties.code)) return;
        d3.select(m.currentTarget).classed("hover", true);
        const iso = Object.keys(D.meta.m49).find(k => String(D.meta.m49[k]).padStart(3, "0") === d.properties.code);
        SB.tip.show(m, `<div class="t">${SB.name(iso)}${yOf(b) ? " · " + yOf(b) : ""}${b ? " · " + LEVEL[b.level] : ""}</div>${b ? (b.measure.length > 260 ? b.measure.slice(0, 257) + "…" : b.measure) : "no measure recorded"}${b && b.level_note ? `<div class="s">${b.level_note}.</div>` : ""}${b ? `<div class="s">Confidence: ${b.conf}. Checked against the source text (UNCTAD citation audit, Oct 2026).</div>` : ""}`); })
      .on("mouseleave", m => { d3.select(m.currentTarget).classed("hover", false); SB.tip.hide(); });
    const gb = svg.append("g"); borders.forEach(b => gb.append("path").attr("class", "border " + b.c).attr("d", path(b.geo)));
    const lab = svg.append("g");
    ea.forEach(fe => { const b = byM49[fe.properties.code]; const c = path.centroid(fe); if (!isFinite(c[0])) return;
      const a = path.area(fe); if (a < 260) return;
      const iso = Object.keys(D.meta.m49).find(k => String(D.meta.m49[k]).padStart(3, "0") === fe.properties.code);
      lab.append("text").attr("class", "cname").attr("x", c[0]).attr("y", c[1] - 3).attr("text-anchor", "middle").text(short(iso));
      if (yOf(b)) lab.append("text").attr("class", "cyear" + (b.level === "national_law" ? "" : " dark")).attr("data-y", yOf(b)).attr("x", c[0]).attr("y", c[1] + 11)
        .attr("text-anchor", "middle").text(yOf(b) + (b.level === "national_announced" ? " announced" : b.level === "subnational_only" ? " state" : "")).attr("opacity", 0); });
    const isOn = (d, lv, yy) => { const b = byM49[d.properties.code]; return !!(b && b.level === lv && yOf(b) && yOf(b) <= yy && eaCodes.has(d.properties.code)); };
    function set(yy) {
      yearLab.text(yy);
      const was = new Set(); lands.each(function (d) { if (this.classList.contains("ban") || this.classList.contains("ban-ann") || this.classList.contains("ban-sub")) was.add(d.properties.code); });
      lands.classed("ban", d => isOn(d, "national_law", yy)).classed("ban-ann", d => isOn(d, "national_announced", yy)).classed("ban-sub", d => isOn(d, "subnational_only", yy));
      if (!SB.reduced) lands.filter(d => !was.has(d.properties.code) && (isOn(d, "national_law", yy) || isOn(d, "national_announced", yy) || isOn(d, "subnational_only", yy)))
        .classed("flash", false).each(function () { void this.getBoundingClientRect(); }).classed("flash", true);
      lab.selectAll("text.cyear").attr("opacity", function () { return +this.dataset.y <= yy ? 1 : 0; });
      chips.html(chipsHtml(yy));
    }
    function run(a) { clearTimeout(timer); if (!a || SB.reduced) { set(y1); return; } let yy = y0; const step = () => { set(yy); if (yy < y1) { yy++; timer = setTimeout(step, 340); } }; step(); }
    run(anim);
  }
  return { play: () => draw(true), redraw: () => draw(false) };
};

/* ───────────── before/after dots (Hormuz 2026, preliminary) ───────────── */
SB.charts.dumbbell = function (el, cfg) {
  let mode = "uv";
  function draw(anim) {
    el.innerHTML = "";
    const ctl = d3.select(el).append("div").attr("class", "ctrl");
    ctl.append("span").attr("class", "cap").text("Change on a year earlier");
    const bU = ctl.append("button").text("Price per kg").on("click", () => { mode = "uv"; draw(true); });
    const bK = ctl.append("button").text("Tonnes").on("click", () => { mode = "kg"; draw(true); });
    bU.classed("on", mode === "uv"); bK.classed("on", mode === "kg");
    const box = d3.select(el).append("div").style("position", "relative").style("height", "calc(100% - 40px)").node();
    const narrow = box.clientWidth < 560;
    const f = frame(box, { t: 34, r: narrow ? 30 : 40, b: 30, l: narrow ? 112 : 230 });
    const gs = cfg.groups, pre = mode === "uv" ? "pre_uv" : "pre_kg", post = mode === "uv" ? "post_uv" : "post_kg";
    const lim = Math.min(100, d3.max(gs, d => Math.max(Math.abs(d[pre]), Math.abs(d[post]))) * 1.1);
    const x = d3.scaleLinear().domain([-lim, lim]).range([0, f.w]).clamp(true);
    const y = d3.scaleBand().domain(gs.map(d => d.id)).range([0, f.h]).padding(0.45);
    const g = f.g, dur = anim ? SB.dur(900) : 0;
    g.append("g").attr("class", "grid").attr("transform", `translate(0,${f.h})`).call(d3.axisBottom(x).ticks(6).tickSize(-f.h).tickFormat(""));
    g.append("g").attr("class", "axis x").attr("transform", `translate(0,${f.h})`).call(d3.axisBottom(x).ticks(6).tickFormat(d => SB.fmt.pp(d)).tickSizeOuter(0));
    g.append("line").attr("class", "zero").attr("x1", x(0)).attr("x2", x(0)).attr("y1", -6).attr("y2", f.h);
    if (narrow) g.append("text").attr("class", "lab mute").attr("x", -f.m.l + 4).attr("y", -14).text("○ before (Dec–Feb)   ● after (Mar–May)");
    else { g.append("text").attr("class", "lab mute").attr("x", x(0) - 6).attr("y", -14).attr("text-anchor", "end").text("before (Dec–Feb) ○");
      g.append("text").attr("class", "lab mute").attr("x", x(0) + 6).attr("y", -14).text("● after the shock (Mar–May)"); }
    const col = k => (k === "synthetic" ? css("--synthetic") : k === "natural" ? css("--natural") : css("--context"));
    const r = g.selectAll("g.r").data(gs).join("g").attr("transform", d => `translate(0,${y(d.id) + y.bandwidth() / 2})`)
      .on("mousemove", (m, d) => SB.tip.show(m, `<div class="t">${d.label}</div>${SB.row(null, "Price per kg, before → after", SB.fmt.pp(d.pre_uv) + " → " + SB.fmt.pp(d.post_uv))}${SB.row(null, "Tonnes, before → after", SB.fmt.pp(d.pre_kg) + " → " + SB.fmt.pp(d.post_kg))}<div class="s">${d.n} partner reporters; weight reported for ${Math.round(d.cov * 100)}% of value. Preliminary.</div>`))
      .on("mouseleave", SB.tip.hide);
    r.append("text").attr("class", "lab").attr("x", -12).attr("dy", "0.35em").attr("text-anchor", "end").text(d => { const s = d.label.replace(/\(.*\)/, "").trim(); return narrow ? s.replace(/^natural-fibre /, "natural ").replace(/^synthetic /, "synth. ").replace(/, film & woven PP/, "") : s; });
    r.append("line").attr("x1", d => x(d[pre])).attr("x2", d => x(dur ? d[pre] : d[post])).attr("stroke", d => col(d.kind)).attr("stroke-width", 2).attr("opacity", 0.55)
      .transition().duration(dur).attr("x2", d => x(d[post]));
    r.append("circle").attr("r", 6).attr("cx", d => x(d[pre])).attr("fill", "#fff").attr("stroke", d => col(d.kind)).attr("stroke-width", 2);
    r.append("circle").attr("r", 7).attr("cx", d => x(d[pre])).attr("fill", d => col(d.kind)).transition().duration(dur).attr("cx", d => x(d[post]));
    r.append("text").attr("class", "lab").attr("dy", "0.35em").attr("x", d => x(d[post]) + (d[post] >= d[pre] ? 12 : -12)).attr("text-anchor", d => (d[post] >= d[pre] ? "start" : "end"))
      .text(d => SB.fmt.pp(d[post])).attr("opacity", 0).transition().delay(dur).duration(SB.dur(300)).attr("opacity", 1);
  }
  return { play: () => draw(true), redraw: () => draw(false) };
};

/* ───────────── tariff stays: applied duty as ad-valorem equivalent vs the CET rate ───────────── */
SB.charts.stays = function (el, cfg) {
  function draw(anim) {
    const rows = cfg.rows, narrow = el.clientWidth < 560;
    const f = frame(el, { t: 30, r: narrow ? 44 : 60, b: 30, l: narrow ? 118 : 250 });
    const y = d3.scaleBand().domain(rows.map((r, i) => i)).range([0, f.h]).padding(0.35);
    const x = d3.scaleLinear().domain([0, Math.max(150, d3.max(rows, r => r.ave) * 1.08)]).range([0, f.w]);
    const g = f.g, dur = anim ? SB.dur(900) : 0;
    g.append("g").attr("class", "grid").attr("transform", `translate(0,${f.h})`).call(d3.axisBottom(x).ticks(6).tickSize(-f.h).tickFormat(""));
    g.append("g").attr("class", "axis x").attr("transform", `translate(0,${f.h})`).call(d3.axisBottom(x).ticks(6).tickFormat(d => d + "%").tickSizeOuter(0));
    const cet = rows[0].cet;
    g.append("line").attr("x1", x(cet)).attr("x2", x(cet)).attr("y1", -8).attr("y2", f.h).attr("stroke", "#231f20").attr("stroke-width", 1.2);
    g.append("text").attr("class", "lab").attr("x", narrow ? 0 : x(cet) + 6).attr("y", -12).text(`${narrow ? "EAC CET" : "EAC common external tariff"} ${cet}%`);
    const r = g.selectAll("g.r").data(rows).join("g").attr("transform", (d, i) => `translate(0,${y(i)})`)
      .on("mousemove", (m, d) => SB.tip.show(m, `<div class="t">${SB.name(d.iso3)} · HS ${d.hs6.slice(0, 4)}.${d.hs6.slice(4)}</div>${d.notice}<br>Applied: ${d.applied}${SB.row(null, "Ad-valorem equivalent", d.ave + "%")}<div class="s">AVE at the world import unit value of ${d.uv_year} (US$${d.uv}/kg). Gazette checked against its text.</div>`))
      .on("mouseleave", SB.tip.hide);
    r.append("text").attr("class", "lab").attr("x", -10).attr("y", y.bandwidth() / 2).attr("dy", "0.35em").attr("text-anchor", "end")
      .text(d => (narrow ? `${d.iso3} · ${d.hs6 === "560721" ? "binder" : "other"} · ${d.start.slice(2, 7)}` : `${SB.name(d.iso3)} · ${d.hs6 === "560721" ? "binder twine" : "other sisal twine"} · ${d.start.slice(0, 7)}`));
    r.append("rect").attr("rx", 2).attr("height", y.bandwidth()).attr("fill", d => (d.ave > cet + 1 ? css("--natural") : css("--context"))).attr("width", dur ? 0 : d => x(d.ave))
      .transition().duration(dur).delay((d, i) => i * 60).attr("width", d => x(d.ave));
    r.append("text").attr("class", "lab").attr("x", d => x(d.ave) + 6).attr("y", y.bandwidth() / 2).attr("dy", "0.35em").text(d => d.ave + "%");
  }
  return { play: () => draw(true), redraw: () => draw(false) };
};

/* ───────────── potential: horizontal ranges (low–high bar, central dot) against a reference line ───────────── */
SB.charts.ranges = function (el, cfg) {
  function draw(anim) {
    const narrow = el.clientWidth < 560;
    const f = frame(el, { t: 46, r: narrow ? 18 : 40, b: 34, l: narrow ? 128 : 270 });
    const rows = cfg.rows, fmt = cfg.fmt || F.kt;
    const x = d3.scaleLinear().domain([0, d3.max([...rows.map(r => r.hi), cfg.ref ? cfg.ref.v : 0]) * 1.06]).nice().range([0, f.w]);
    const y = d3.scaleBand().domain(rows.map(r => r.id)).range([0, f.h]).padding(0.42);
    const g = f.g, dur = anim ? SB.dur(1100) : 0;
    g.append("g").attr("class", "grid").attr("transform", `translate(0,${f.h})`).call(d3.axisBottom(x).ticks(narrow ? 4 : 6).tickSize(-f.h).tickFormat(""));
    g.append("g").attr("class", "axis x").attr("transform", `translate(0,${f.h})`).call(d3.axisBottom(x).ticks(narrow ? 4 : 6).tickFormat(d => d3.format(",")(d / 1e3)).tickSizeOuter(0));
    g.append("text").attr("class", "lab mute").attr("x", -f.m.l + 4).attr("y", -28).text(cfg.xLabel || "thousand tonnes of dry fibre a year");
    if (!narrow) g.append("text").attr("class", "lab mute").attr("x", -f.m.l + 4).attr("y", -12).text("● central estimate   ━ range");
    const col = css("--natural");
    const r = g.selectAll("g.r").data(rows).join("g").attr("class", "r").attr("transform", d => `translate(0,${y(d.id) + y.bandwidth() / 2})`)
      .on("mousemove", (m, d) => SB.tip.show(m, `<div class="t">${d.label}</div>${SB.row(null, "central", fmt(d.c))}${SB.row(null, "range", fmt(d.lo) + " – " + fmt(d.hi))}<div class="s">${d.status === "verified parameters" ? "Parameters checked against the text of their sources." : "Includes an assumption: " + (d.note || d.status.replace("includes assumption: ", "")) + "."} ${cfg.src || ""}</div>`))
      .on("mouseleave", SB.tip.hide);
    r.append("rect").attr("class", "hit").attr("x", -f.m.l).attr("y", -y.bandwidth()).attr("width", f.w + f.m.l).attr("height", y.bandwidth() * 2).attr("fill", "transparent");
    r.append("text").attr("class", "lab").attr("x", -12).attr("dy", "0.35em").attr("text-anchor", "end")
      .text(d => (narrow ? d.short || d.label : d.label) + (d.status && d.status !== "verified parameters" ? " †" : ""));
    r.append("line").attr("x1", d => x(d.lo)).attr("x2", d => x(dur ? d.lo : d.hi)).attr("stroke", col).attr("stroke-width", 10).attr("stroke-linecap", "round").attr("opacity", 0.28)
      .transition().duration(dur).ease(d3.easeCubicOut).attr("x2", d => x(d.hi));
    r.append("circle").attr("r", 7).attr("cx", d => x(d.c)).attr("fill", col).attr("stroke", "#fff").attr("stroke-width", 2)
      .attr("opacity", dur ? 0 : 1).transition().delay(dur * 0.7).duration(SB.dur(300)).attr("opacity", 1);
    r.append("text").attr("class", "lab halo").attr("dy", "0.35em").attr("x", d => Math.min(x(d.hi) + 12, f.w - 2)).attr("text-anchor", d => (x(d.hi) + 12 > f.w - 90 ? "end" : "start"))
      .attr("y", d => (x(d.hi) + 12 > f.w - 90 ? -16 : 0)).each(function (d) { tweenText(d3.select(this), d.c, fmt, dur ? SB.dur(900) : 0, dur * 0.3); });
    if (cfg.ref) {
      const rx = x(cfg.ref.v);
      g.append("line").attr("x1", rx).attr("x2", rx).attr("y1", -6).attr("y2", f.h).attr("stroke", "#231f20").attr("stroke-width", 1.2).attr("stroke-dasharray", "4 3");
      g.append("text").attr("class", "lab halo").attr("x", rx + 6).attr("y", f.h - 8).text(`${cfg.ref.label}: ${fmt(cfg.ref.v)}`);
    }
    addTable(el, ["Source of fibre", "Low", "Central", "High"], rows.map(d => [d.label + (d.status !== "verified parameters" ? " †" : ""), fmt(d.lo), fmt(d.c), fmt(d.hi)]));
  }
  return { play: () => draw(true), redraw: () => draw(false) };
};

/* ───────────── potential: what-if calculator for Uganda's banana stems (sliders recompute every number) ───────────── */
SB.charts.whatif = function (el, cfg) {
  let share = cfg.share_now, bunch = cfg.bunch.c;
  const fibre = (sh, bu) => cfg.prod_t * 1000 / bu * cfg.g_stem / 1e6 * sh / 100;
  const stems = (sh, bu) => cfg.prod_t * 1000 / bu * sh / 100;
  function draw(anim) {
    el.innerHTML = "";
    const host = d3.select(el).append("div").attr("class", "wi");
    const ctl = host.append("div").attr("class", "wi-ctl");
    const s1 = ctl.append("label").attr("class", "wi-s");
    s1.append("span").html(`Stems on offer <b class="wi-sv"></b>`);
    const in1 = s1.append("input").attr("type", "range").attr("min", 0).attr("max", 100).attr("step", 5).attr("value", share).attr("aria-label", "Share of banana stems on offer, percent").attr("id", "wi-share");
    const pre = ctl.append("div").attr("class", "wi-pre");
    [[cfg.share_now, `Ready now (${cfg.share_now}%)`], [cfg.share_price, `At a higher price (${cfg.share_price}%)`], [100, "All stems"]]
      .forEach(([v_, t]) => pre.append("button").attr("data-v", v_).text(t).on("click", () => { share = v_; in1.property("value", v_); update(true); }));
    const s2 = ctl.append("label").attr("class", "wi-s");
    s2.append("span").html(`Bunch weight <b class="wi-bv"></b>`);
    const in2 = s2.append("input").attr("type", "range").attr("min", cfg.bunch.lo).attr("max", cfg.bunch.hi).attr("step", 0.1).attr("value", bunch).attr("aria-label", "Average bunch weight, kg").attr("id", "wi-bunch");
    const out = host.append("div").attr("class", "wi-out");
    const big = out.append("div").attr("class", "v c-n").attr("aria-live", "polite").attr("id", "wi-result");
    const sub = out.append("div").attr("class", "l");
    const box = host.append("div").attr("class", "wi-bars").node();
    const ser = host.append("div").attr("class", "wi-ser").node();
    host.append("p").attr("class", "wi-cap").text(`Uganda's output of cooking bananas and plantains, FAOSTAT ${cfg.series.years[0]}–${cfg.series.years[cfg.series.years.length - 1]}; ◆ = statistical breaks (survey and census revisions) - read levels, not trends.`);
    /* comparison bars */
    const W = box.clientWidth || 600, rowsN = cfg.comps.length + 1, H = rowsN * 30 + 26;
    const narrow = W < 520, L = narrow ? 150 : 270;
    const svg = d3.select(box).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("height", H);
    const g = svg.append("g").attr("transform", `translate(${L},6)`);
    const maxV = d3.max([fibre(100, cfg.bunch.lo), ...cfg.comps.map(c => c.t)]) * 1.04;
    const x = d3.scaleLinear().domain([0, maxV]).range([0, W - L - 70]);
    const items = [{ id: "you", label: "Fibre in this scenario", color: css("--natural") }, ...cfg.comps];
    const yb = d3.scaleBand().domain(items.map(d => d.id)).range([0, rowsN * 30]).padding(0.3);
    const rg = g.selectAll("g.r").data(items).join("g").attr("transform", d => `translate(0,${yb(d.id)})`);
    rg.append("text").attr("class", "lab").attr("x", -10).attr("y", yb.bandwidth() / 2).attr("dy", "0.35em").attr("text-anchor", "end").text(d => (narrow ? d.short || d.label : d.label));
    const bars = rg.append("rect").attr("rx", 2).attr("height", yb.bandwidth()).attr("fill", d => d.color).attr("width", 0);
    const vals = rg.append("text").attr("class", "lab").attr("y", yb.bandwidth() / 2).attr("dy", "0.35em");
    rg.on("mousemove", (m, d) => SB.tip.show(m, `<div class="t">${d.label}</div>${SB.row(null, "tonnes a year", F.kt(d.id === "you" ? fibre(share, bunch) : d.t))}<div class="s">${d.src || "UNCTAD calculation from FAOSTAT and the checked parameters"}</div>`)).on("mouseleave", SB.tip.hide);
    /* small series with break markers */
    const sw = ser.clientWidth || 600, sh = 92, sm = { l: 44, r: 10, t: 8, b: 20 };
    const s2v = d3.select(ser).append("svg").attr("viewBox", `0 0 ${sw} ${sh}`).attr("height", sh);
    const pts = SB.pts(cfg.series.years, cfg.series.prod);
    const sx = d3.scaleLinear().domain(d3.extent(pts, d => d.y)).range([sm.l, sw - sm.r]), sy = d3.scaleLinear().domain([0, d3.max(pts, d => d.v) * 1.1]).range([sh - sm.b, sm.t]);
    s2v.append("g").attr("class", "axis x").attr("transform", `translate(0,${sh - sm.b})`).call(d3.axisBottom(sx).ticks(narrow ? 4 : 8).tickFormat(d3.format("d")).tickSizeOuter(0));
    s2v.append("g").attr("class", "axis y").attr("transform", `translate(${sm.l},0)`).call(d3.axisLeft(sy).ticks(2).tickFormat(d => d3.format(",")(d / 1e6) + " Mt").tickSize(0).tickPadding(6));
    const sp = s2v.append("path").datum(pts).attr("d", d3.line().x(d => sx(d.y)).y(d => sy(d.v)).curve(d3.curveMonotoneX)).attr("fill", "none").attr("stroke", css("--natural")).attr("stroke-width", 2);
    drawLine(sp, anim ? SB.dur(1400) : 0, 300);
    cfg.series.breaks.forEach(yy => { const d = pts.find(q => q.y === yy); if (!d) return;
      s2v.append("path").attr("class", "ev-mark").attr("d", d3.symbol(d3.symbolDiamond, 40)()).attr("transform", `translate(${sx(yy)},${sy(d.v)})`)
        .on("mousemove", m => SB.tip.show(m, `<div class="t">${yy}</div>${SB.row(null, "output", F.kt(d.v))}<div class="s">Statistical break in the official series (FAOSTAT; QA note Q34)</div>`)).on("mouseleave", SB.tip.hide); });
    function update(a) {
      const d = a ? SB.dur(350) : 0, v = fibre(share, bunch);
      host.select(".wi-sv").text(`${share}%`); host.select(".wi-bv").text(`${d3.format(".1f")(bunch)} kg`);
      pre.selectAll("button").classed("on", function () { return +this.dataset.v === share; });
      tweenText(big, v, F.kt, a ? SB.dur(500) : SB.dur(220));
      sub.text(`of dry banana fibre a year · ${d3.format(",.0f")(stems(share, bunch) / 1e6)} million stems · ${cfg.stems_per_kg} stems per kg`);
      const val = it => (it.id === "you" ? v : it.t);
      bars.transition().duration(d).attr("width", it => x(val(it)));
      vals.transition().duration(d).attr("x", it => x(val(it)) + 6);
      vals.each(function (it) { tweenText(d3.select(this), val(it), F.kt, d); });
    }
    in1.on("input", function () { share = +this.value; update(false); });
    in2.on("input", function () { bunch = +this.value; update(false); });
    update(false);
    if (anim) { bars.attr("width", 0); update(true); }
    addTable(el, ["Parameter or result", "Value", "Source"], [
      ["Cooking bananas and plantains, Uganda, " + cfg.years, d3.format(",.0f")(cfg.prod_t) + " t", "FAOSTAT"],
      ["Dry fibre per stem", cfg.g_stem + " g", "Kamusingize et al. 2026"],
      ["Bunch weight (matooke genotypes)", `${cfg.bunch.c} kg (${cfg.bunch.lo}–${cfg.bunch.hi})`, "African Journal of Plant Science 2016"],
      ["Farmers ready to sell stems / at a higher price", `${cfg.share_now}% / over ${cfg.share_price}%`, "Kamusingize et al. 2025"],
      ...cfg.comps.map(c => [c.label, F.kt(c.t), c.src || ""]),
      ["Fibre, stems on offer now (central, range)", `${F.kt(cfg.now.c)} (${F.kt(cfg.now.lo)} – ${F.kt(cfg.now.hi)})`, "UNCTAD calculation"]]);
  }
  return { play: () => draw(true), redraw: () => draw(false) };
};

/* ───────────── paired bars: earlier period (light) over recent period (solid) for each row; a row with `none` gets a dashed
   box and a note instead of bars (a fibre with no trade record) ───────────── */
SB.charts.pairs = function (el, cfg) {
  function draw(anim) {
    const narrow = el.clientWidth < 560;
    const f = frame(el, { t: 42, r: narrow ? 16 : 40, b: 30, l: narrow ? 96 : 150 });
    const rows = cfg.rows, fmt = cfg.fmt, [l0, l1] = cfg.periods, natural = css("--natural");
    const x = d3.scaleLinear().domain([0, d3.max(rows, d => Math.max(d.v0 || 0, d.v1 || 0))]).nice().range([0, f.w]);
    const y = d3.scaleBand().domain(rows.map(d => d.id)).range([0, f.h]).paddingInner(0.3).paddingOuter(0.05);
    const bh = Math.min(24, (y.bandwidth() - 4) / 2), top = (y.bandwidth() - 2 * bh - 4) / 2;
    const g = f.g, dur = anim ? SB.dur(1000) : 0, ticks = narrow ? 3 : 5;
    g.append("g").attr("class", "grid").attr("transform", `translate(0,${f.h})`).call(d3.axisBottom(x).ticks(ticks).tickSize(-f.h).tickFormat(""));
    g.append("g").attr("class", "axis x").attr("transform", `translate(0,${f.h})`).call(d3.axisBottom(x).ticks(ticks).tickFormat(cfg.axisFmt || fmt).tickSizeOuter(0));
    g.append("text").attr("class", "lab mute").attr("x", -f.m.l + 4).attr("y", -26)
      .html(`<tspan style="fill:${natural};fill-opacity:.32;font-weight:800">■</tspan> ${l0}   <tspan style="fill:${natural};font-weight:800">■</tspan> ${l1}`);
    if (cfg.xLabel) g.append("text").attr("class", "lab mute").attr("x", -f.m.l + 4).attr("y", -9).text(cfg.xLabel);
    const col = d => (d.kind === "context" ? css("--context") : natural);
    const w = v => Math.max(2, x(v || 0));
    const r = g.selectAll("g.r").data(rows).join("g").attr("class", "r").attr("transform", d => `translate(0,${y(d.id) + top})`)
      .on("mousemove", (m, d) => SB.tip.show(m, `<div class="t">${d.label}</div>${d.none ? `<div>${d.none}</div>`
        : SB.row(null, l0, fmt(d.v0)) + SB.row(null, l1, fmt(d.v1)) + SB.row(null, "change", cfg.chg(d.v0, d.v1))}${d.extra || ""}<div class="s">${d.src || cfg.src || ""}</div>`))
      .on("mouseleave", SB.tip.hide);
    r.append("text").attr("class", "lab").attr("x", -12).attr("y", bh + 2).attr("dy", d => (d.sub ? "-0.25em" : "0.35em")).attr("text-anchor", "end")
      .style("font-weight", 700).text(d => (narrow ? d.short || d.label : d.label));
    r.filter(d => d.sub).append("text").attr("class", "lab mute").attr("x", -12).attr("y", bh + 2).attr("dy", "1.05em").attr("text-anchor", "end").text(d => d.sub);
    const bars = r.filter(d => !d.none);
    bars.append("rect").attr("rx", 2).attr("height", bh).attr("fill", col).attr("opacity", 0.32).attr("width", dur ? 0 : d => w(d.v0))
      .transition().duration(dur).attr("width", d => w(d.v0));
    bars.append("rect").attr("rx", 2).attr("y", bh + 4).attr("height", bh).attr("fill", col).attr("width", dur ? 0 : d => w(d.v1))
      .transition().delay(dur * 0.5).duration(dur).attr("width", d => w(d.v1));
    /* values: right of the bar, or inside it when the bar runs to the edge */
    const inside = v => w(v) > f.w - (narrow ? 96 : 120);
    bars.append("text").attr("class", "lab mute").attr("y", bh / 2).attr("dy", "0.35em")
      .attr("x", d => (inside(d.v0) ? w(d.v0) - 6 : w(d.v0) + 6)).attr("text-anchor", d => (inside(d.v0) ? "end" : "start"))
      .style("fill", d => (inside(d.v0) ? "#231f20" : null))
      .text(d => fmt(d.v0)).attr("opacity", 0).transition().delay(dur).duration(SB.dur(300)).attr("opacity", 1);
    bars.append("text").attr("class", "lab").attr("y", bh + 4 + bh / 2).attr("dy", "0.35em")
      .attr("x", d => (inside(d.v1) ? w(d.v1) - 6 : w(d.v1) + 6)).attr("text-anchor", d => (inside(d.v1) ? "end" : "start"))
      .style("fill", d => (inside(d.v1) ? "#fff" : null)).style("font-weight", 700)
      .html(d => `${fmt(d.v1)}<tspan dx="8" style="fill:${inside(d.v1) ? "#fff" : d.v1 >= d.v0 ? natural : "#6e6259"}">${cfg.chg(d.v0, d.v1)}</tspan>`)
      .attr("opacity", 0).transition().delay(dur * 1.5).duration(SB.dur(300)).attr("opacity", 1);
    const none = r.filter(d => d.none);
    none.append("rect").attr("rx", 3).attr("height", 2 * bh + 4).attr("width", narrow ? f.w : Math.min(f.w, 420)).attr("fill", "none")
      .attr("stroke", col).attr("stroke-width", 1.5).attr("stroke-dasharray", "5 4");
    none.append("text").attr("class", "lab").attr("x", 10).attr("y", bh + 2).attr("dy", "0.35em").style("fill", "#6e6259").text(d => (narrow ? d.noneShort || d.none : d.none));
    addTable(el, ["Fibre", l0, l1, "Change"], rows.map(d => [d.label, d.none ? "–" : fmt(d.v0), d.none ? "–" : fmt(d.v1), d.none ? d.none : cfg.chg(d.v0, d.v1)]));
  }
  return { play: () => draw(true), redraw: () => draw(false) };
};

/* ───────────── grouped bars for the 'In brief' boards: large type, rows in groups, one scale for all groups (cfg.shared)
   or one per group; negative values go left of zero; r.lo/r.hi = range (whisker), r.range = light bar from lo to hi ───────────── */
SB.charts.groups = function (el, cfg) {
  function draw(anim) {
    const narrow = el.clientWidth < 560;
    const f = frame(el, { t: 6, r: narrow ? 64 : 96, b: 6, l: narrow ? 150 : (cfg.left || 300) });
    f.svg.classed("fg", true);
    const G = cfg.groups, n = d3.sum(G, q => q.rows.length), head = 36, gap = 20;
    const rowH = Math.min(cfg.rowMax || 66, (f.h - G.length * head - (G.length - 1) * gap) / n), bh = Math.min(26, rowH * 0.44);
    const ext = rows => d3.extent([0].concat(...rows.map(r => [r.v, r.lo, r.hi].filter(x => x != null))));
    const scale = d => { const x = d3.scaleLinear().domain(d).range([0, f.w]); return d[0] < 0 ? x : x.nice(); };
    const shared = cfg.shared ? scale(ext([].concat(...G.map(q => q.rows)))) : null;
    const g = f.g, dur = anim ? SB.dur(1000) : 0, grey = css("--grey-border");
    let y0 = 0, k = 0;
    G.forEach(q => {
      const x = shared || scale(ext(q.rows)), zx = x(0), gg = g.append("g").attr("transform", `translate(0,${y0})`);
      gg.append("text").attr("class", "gt").attr("x", -f.m.l + 4).attr("y", 16).text(q.title);
      if (q.unit) gg.append("text").attr("class", "gs").attr("x", f.w + f.m.r - 4).attr("y", 16).attr("text-anchor", "end").text(narrow && q.unitShort ? q.unitShort : q.unit);
      gg.append("line").attr("x1", -f.m.l + 4).attr("x2", f.w + f.m.r - 4).attr("y1", 26).attr("y2", 26).attr("stroke", grey);
      if (x.domain()[0] < 0) gg.append("line").attr("class", "zero").attr("x1", zx).attr("x2", zx).attr("y1", head - 4).attr("y2", head + q.rows.length * rowH);
      q.rows.forEach((r, i) => {
        const cy = head + i * rowH + rowH / 2, delay = (k++) * 110, fmt = q.fmt || cfg.fmt;
        const rg = gg.append("g").attr("class", "r")
          .on("mousemove", m => SB.tip.show(m, `<div class="t">${r.label}</div>${r.tip || SB.row(null, q.unit || "value", r.text || fmt(r.v))}<div class="s">${r.src || q.src || cfg.src || ""}</div>`))
          .on("mouseleave", SB.tip.hide);
        rg.append("rect").attr("x", -f.m.l).attr("y", cy - rowH / 2).attr("width", f.W).attr("height", rowH).attr("fill", "transparent");
        rg.append("text").attr("class", "gl").attr("x", -14).attr("y", cy).attr("dy", r.sub ? "-0.15em" : "0.35em").attr("text-anchor", "end").text(narrow ? r.short || r.label : r.label);
        if (r.sub) rg.append("text").attr("class", "gs").attr("x", -14).attr("y", cy).attr("dy", "1.15em").attr("text-anchor", "end").text(narrow ? r.subShort || r.sub : r.sub);
        const a = r.range ? r.lo : r.v, bar = rg.append("rect").attr("rx", 2).attr("y", cy - bh / 2).attr("height", bh).attr("fill", r.color);
        bar.attr("x", zx).attr("width", 0).transition().delay(delay).duration(dur).attr("x", Math.min(zx, x(a))).attr("width", Math.max(2, Math.abs(x(a) - zx)));
        if (r.range) rg.append("rect").attr("rx", 2).attr("y", cy - bh / 2).attr("height", bh).attr("fill", r.color).attr("opacity", 0.35)
          .attr("x", x(r.lo)).attr("width", 0).transition().delay(delay + dur).duration(dur * 0.6).attr("width", x(r.hi) - x(r.lo));
        else if (r.lo != null && r.hi != null) {
          const w = rg.append("g").attr("stroke", "#231f20").attr("stroke-width", 1.3).attr("opacity", 0);
          w.append("line").attr("x1", x(r.lo)).attr("x2", x(r.hi)).attr("y1", cy).attr("y2", cy);
          [r.lo, r.hi].forEach(e => w.append("line").attr("x1", x(e)).attr("x2", x(e)).attr("y1", cy - 6).attr("y2", cy + 6));
          w.transition().delay(delay + dur).duration(SB.dur(400)).attr("opacity", 1);
        }
        const end = Math.max(x(r.v), r.hi != null ? x(r.hi) : -Infinity), neg = r.v < 0;
        rg.append("text").attr("class", "gv").attr("x", neg ? x(r.v) - 8 : end + 8).attr("y", cy).attr("dy", "0.35em").attr("text-anchor", neg ? "end" : "start")
          .style("fill", r.valueColor || null).text(r.text || fmt(r.v)).attr("opacity", 0).transition().delay(delay + dur * (r.range ? 1.6 : 1)).duration(SB.dur(300)).attr("opacity", 1);
      });
      y0 += head + q.rows.length * rowH + gap;
    });
    addTable(el, ["Group", "Item", "Value"], [].concat(...G.map(q => q.rows.map(r => [q.title, r.label + (r.sub ? ` (${r.sub})` : ""), (r.text || (q.fmt || cfg.fmt)(r.v)) + (q.unit ? ` ${q.unit}` : "")]))));
  }
  return { play: () => draw(true), redraw: () => draw(false) };
};

/* ───────────── horizontal bars (one value per row), e.g. unit values ───────────── */
SB.charts.hbars = function (el, cfg) {
  function draw(anim) {
    const narrow = el.clientWidth < 560;
    const f = frame(el, { t: 28, r: narrow ? 64 : 90, b: 30, l: narrow ? 140 : 300 });
    const rows = cfg.rows, fmt = cfg.fmt;
    const x = d3.scaleLinear().domain([0, d3.max(rows, r => r.v) * 1.05]).nice().range([0, f.w]);
    const y = d3.scaleBand().domain(rows.map(r => r.id)).range([0, f.h]).padding(0.3);
    const g = f.g, dur = anim ? SB.dur(900) : 0;
    g.append("g").attr("class", "grid").attr("transform", `translate(0,${f.h})`).call(d3.axisBottom(x).ticks(5).tickSize(-f.h).tickFormat(""));
    g.append("g").attr("class", "axis x").attr("transform", `translate(0,${f.h})`).call(d3.axisBottom(x).ticks(5).tickFormat(cfg.axisFmt || fmt).tickSizeOuter(0));
    if (cfg.xLabel) g.append("text").attr("class", "lab mute").attr("x", -f.m.l + 4).attr("y", -12).text(narrow && cfg.xLabelShort ? cfg.xLabelShort : cfg.xLabel);
    const r = g.selectAll("g.r").data(rows).join("g").attr("transform", d => `translate(0,${y(d.id)})`)
      .on("mousemove", (m, d) => SB.tip.show(m, `<div class="t">${d.label}</div>${SB.row(null, cfg.tipLabel || "value", fmt(d.v))}${d.extra || ""}<div class="s">${cfg.src || ""}</div>`))
      .on("mouseleave", SB.tip.hide);
    r.append("text").attr("class", "lab").attr("x", -10).attr("y", y.bandwidth() / 2).attr("dy", "0.35em").attr("text-anchor", "end").text(d => (narrow ? d.short || d.label : d.label));
    r.append("rect").attr("rx", 2).attr("height", y.bandwidth()).attr("fill", d => d.color).attr("width", dur ? 0 : d => x(d.v))
      .transition().duration(dur).delay((d, i) => i * 70).attr("width", d => x(d.v));
    const vt = r.append("text").attr("class", "lab").attr("x", d => (dur ? 6 : x(d.v) + 6)).attr("y", y.bandwidth() / 2).attr("dy", "0.35em");
    vt.transition().duration(dur).delay((d, i) => i * 70).attr("x", d => x(d.v) + 6);
    vt.each(function (d, i) { tweenText(d3.select(this), d.v, fmt, dur, i * 70); });
    addTable(el, ["Product", cfg.tipLabel || "Value"], rows.map(d => [d.label, fmt(d.v)]));
  }
  return { play: () => draw(true), redraw: () => draw(false) };
};

/* ───────────── product space: next steps (ranked closeness), RCA then/now and moving closer (dumbbells), per country ───────────── */
SB.fmt.rca = v => (v == null ? "–" : v >= 100 ? d3.format(",.0f")(v) : v >= 10 ? d3.format(".0f")(v) : v >= 1 ? d3.format(".1f")(v) : d3.format(".2f")(v));
SB.charts.space = function (el, cfg) {
  let iso = cfg.countries[0].iso3, mode = 0;
  const P = Object.fromEntries(cfg.products.map(p => [p.p, p]));
  const col = m => (m === "natural" ? css("--natural") : m === "synthetic" ? css("--synthetic") : m === "paper" ? css("--accent") : css("--context"));
  const MAT = [["natural", "natural fibre"], ["mixed", "mixed materials"], ["paper", "paper"], ["synthetic", "plastic and synthetic"]];
  function tipRow(r) {
    return `<div class="t">${r.label}</div>${SB.row(null, "RCA 1995–97 → " + cfg.window, F.rca(r.r95) + " → " + F.rca(r.rca))}${SB.row(null, "years with RCA ≥ 1 (1995–2024)", r.yrs)}` +
      `${SB.row(null, "closeness (percentile)", r.dp == null ? "–" : Math.round(r.dp))}${SB.row(null, "complexity (PCI)", r.pci == null ? "–" : d3.format("+.2f")(r.pci))}` +
      `${SB.row(null, "world exports a year", F.usd(r.usd))}<div class="s">${cfg.source}</div>`;
  }
  /* next steps: fibre-related products in three groups - already competitive (RCA >= 1), close to current exports (top fifth of all
     products), further away; bar = closeness to the country's current exports (percentile among all products, 100 = closest) */
  function steps(box, rows, anim) {
    const narrow = box.clientWidth < 560, cname = SB.name(iso).replace("United Republic of ", "");
    const keep = rows.filter(r => r.material !== "synthetic" && r.dp != null);
    const grp = r => (r.m ? "a" : r.dp >= 80 ? "b" : "c");
    const G = [{ k: "a", t: "Already competitive (RCA ≥ 1)", c: css("--natural") }, { k: "b", t: "Next steps: close to what it exports", c: css("--g5") },
               { k: "c", t: "Further away", c: "#b9aea6" }];
    const lines = [];
    G.forEach(gr => { const rs = keep.filter(r => grp(r) === gr.k).sort((a, b) => b.dp - a.dp); if (!rs.length) return;
      lines.push({ head: gr, n: rs.length }); rs.forEach(r => lines.push({ r, gr })); });
    const f = frame(box, { t: 34, r: narrow ? 14 : 150, b: 40, l: narrow ? 134 : 210 });
    const x = d3.scaleLinear().domain([0, 100]).range([0, f.w]);
    const yb = d3.scaleBand().domain(lines.map((d, k) => k)).range([0, f.h]).paddingInner(0.2);
    const g = f.g, dur = anim ? SB.dur(900) : 0, bh = Math.min(14, yb.bandwidth() * 0.62);
    g.append("g").attr("class", "grid").attr("transform", `translate(0,${f.h})`).call(d3.axisBottom(x).tickValues([0, 20, 40, 60, 80, 100]).tickSize(-f.h).tickFormat(""));
    g.append("g").attr("class", "axis x").attr("transform", `translate(0,${f.h})`).call(d3.axisBottom(x).tickValues([0, 20, 40, 60, 80, 100]).tickSizeOuter(0));
    g.append("text").attr("class", "lab mute").attr("x", f.w).attr("y", f.h + 32).attr("text-anchor", "end")
      .text(narrow ? "closeness, 100 = closest →" : `how close to what ${cname} already exports (percentile of ${d3.format(",")(cfg.n_products)} products; 100 = closest) →`);
    g.append("line").attr("x1", x(80)).attr("x2", x(80)).attr("y1", -6).attr("y2", f.h).attr("stroke", "#231f20").attr("stroke-width", 1).attr("stroke-dasharray", "3 3");
    g.append("text").attr("class", "lab mute").attr("x", x(80)).attr("y", -12).attr("text-anchor", "middle").text("top fifth");
    if (!narrow) g.append("text").attr("class", "lab mute").attr("x", f.w + 14).attr("y", -12).text("world market, a year");
    const row = g.selectAll("g.line").data(lines).join("g").attr("class", d => (d.head ? "line head" : `line r grp-${d.gr.k}`))
      .attr("transform", (d, k) => `translate(0,${yb(k) + yb.bandwidth() / 2})`);
    const heads = row.filter(d => d.head);
    heads.append("text").attr("class", "lab").attr("x", -f.m.l + 4).attr("dy", "0.35em").style("font-weight", 800)
      .html(d => `<tspan style="fill:${d.head.c}">■</tspan> ${d.head.t} <tspan class="mute" style="font-weight:500;fill:#6e6259">· ${d.n}</tspan>`)
      .attr("opacity", dur ? 0 : 1).transition().duration(SB.dur(400)).attr("opacity", 1);
    const prods = row.filter(d => !d.head).on("mousemove", (m, d) => SB.tip.show(m, tipRow(d.r))).on("mouseleave", SB.tip.hide);
    prods.append("rect").attr("x", -f.m.l).attr("y", -yb.bandwidth() / 2).attr("width", f.w + f.m.l + f.m.r).attr("height", yb.bandwidth()).attr("fill", "transparent");
    prods.append("text").attr("class", "lab").attr("x", -10).attr("dy", "0.35em").attr("text-anchor", "end").style("font-weight", 500).text(d => d.r.short);
    prods.append("rect").attr("x", 0).attr("y", -bh / 2).attr("height", bh).attr("width", f.w).attr("rx", 2).attr("fill", "#f2efec");
    prods.append("rect").attr("x", 0).attr("y", -bh / 2).attr("height", bh).attr("rx", 2).attr("fill", d => d.gr.c).attr("width", dur ? 0 : d => x(d.r.dp))
      .transition().duration(dur).delay((d, k) => k * 35).attr("width", d => x(d.r.dp));
    const inside = d => x(d.r.dp) > f.w - (d.r.m ? (narrow ? 96 : 104) : 40);   /* long bars: value inside the bar, in white */
    const vt = prods.append("text").attr("class", d => "lab" + (inside(d) ? "" : " halo")).attr("dy", "0.35em").style("font-weight", 600)
      .attr("x", d => (inside(d) ? x(d.r.dp) - 6 : x(d.r.dp) + 6)).attr("text-anchor", d => (inside(d) ? "end" : "start")).style("fill", d => (inside(d) ? (d.gr.k === "a" ? "#fff" : "#123f20") : null))
      .text(d => Math.round(d.r.dp) + (d.r.m ? ` · RCA ${F.rca(d.r.rca)}` : "")).attr("opacity", dur ? 0 : 1);
    vt.transition().delay((d, k) => dur + k * 35).duration(SB.dur(250)).attr("opacity", 1);
    if (!narrow) prods.append("text").attr("class", "lab mute").attr("x", f.w + 14).attr("dy", "0.35em").text(d => F.usd(d.r.usd));
  }
  function thenNow(box, rows, anim) {
    const narrow = box.clientWidth < 560;
    const keep = rows.filter(r => r.material !== "synthetic" && r.rca != null && r.r95 != null && Math.max(r.rca, r.r95) >= 0.3)
      .sort((a, b) => b.rca - a.rca).slice(0, 10);
    const f = frame(box, { t: 34, r: narrow ? 40 : 70, b: 34, l: narrow ? 118 : 190 });
    const lo = 0.01, hi = Math.max(10, d3.max(keep, r => Math.max(r.rca, r.r95)) * 1.4);
    const x = d3.scaleLog().domain([lo, hi]).range([0, f.w]).clamp(true);
    const yb = d3.scaleBand().domain(keep.map(r => r.p)).range([0, f.h]).padding(0.45);
    const g = f.g, dur = anim ? SB.dur(900) : 0;
    const ticks = [0.01, 0.1, 1, 10, 100, 1000].filter(t => t <= hi);
    g.append("g").attr("class", "grid").attr("transform", `translate(0,${f.h})`).call(d3.axisBottom(x).tickValues(ticks).tickSize(-f.h).tickFormat(""));
    g.append("g").attr("class", "axis x").attr("transform", `translate(0,${f.h})`).call(d3.axisBottom(x).tickValues(ticks).tickFormat(d => d3.format("~g")(d)).tickSizeOuter(0));
    g.append("line").attr("class", "zero").attr("x1", x(1)).attr("x2", x(1)).attr("y1", -8).attr("y2", f.h);
    g.append("text").attr("class", "lab").attr("x", x(1) + 6).attr("y", -14).text("RCA = 1: world average");
    g.append("text").attr("class", "lab mute").attr("x", -f.m.l + 4).attr("y", -14).text(narrow ? "○ 1995–97  ● now" : `○ 1995–97   ● ${cfg.window} (log scale)`);
    const r = g.selectAll("g.r").data(keep).join("g").attr("transform", d => `translate(0,${yb(d.p) + yb.bandwidth() / 2})`)
      .on("mousemove", (m, d) => SB.tip.show(m, tipRow(d))).on("mouseleave", SB.tip.hide);
    r.append("text").attr("class", "lab").attr("x", -12).attr("dy", "0.35em").attr("text-anchor", "end").text(d => d.short);
    r.append("line").attr("x1", d => x(Math.max(lo, d.r95))).attr("x2", d => x(Math.max(lo, dur ? d.r95 : d.rca))).attr("stroke", d => col(d.material)).attr("stroke-width", 2).attr("opacity", 0.5)
      .transition().duration(dur).attr("x2", d => x(Math.max(lo, d.rca)));
    r.append("circle").attr("r", 6).attr("cx", d => x(Math.max(lo, d.r95))).attr("fill", "#fff").attr("stroke", d => col(d.material)).attr("stroke-width", 2);
    r.append("circle").attr("r", 7).attr("cx", d => x(Math.max(lo, d.r95))).attr("fill", d => col(d.material)).transition().duration(dur).attr("cx", d => x(Math.max(lo, d.rca)));
    r.append("text").attr("class", "lab halo").attr("dy", "0.35em").attr("x", d => x(Math.max(lo, Math.max(d.rca, d.r95))) + 12).text(d => F.rca(d.rca))
      .attr("opacity", dur ? 0 : 1).transition().delay(dur).duration(SB.dur(300)).attr("opacity", 1);
  }
  /* closeness then (exports of 1995-97) and now (2022-24), both placed in today's product space */
  function closer(box, rows, anim) {
    const narrow = box.clientWidth < 560;
    const keep = rows.filter(r => r.material !== "synthetic" && r.dp_then != null && r.dp_now_fixed != null).sort((a, b) => b.dp_now_fixed - a.dp_now_fixed);
    const f = frame(box, { t: 34, r: narrow ? 46 : 70, b: 30, l: narrow ? 118 : 190 });
    const x = d3.scaleLinear().domain([Math.max(0, Math.floor(d3.min(keep, r => Math.min(r.dp_then, r.dp_now_fixed)) / 10) * 10), 100]).range([0, f.w]);
    const yb = d3.scaleBand().domain(keep.map(r => r.p)).range([0, f.h]).padding(0.4);
    const g = f.g, dur = anim ? SB.dur(900) : 0, nUp = keep.filter(r => r.dp_now_fixed > r.dp_then).length;
    g.append("g").attr("class", "grid").attr("transform", `translate(0,${f.h})`).call(d3.axisBottom(x).ticks(5).tickSize(-f.h).tickFormat(""));
    g.append("g").attr("class", "axis x").attr("transform", `translate(0,${f.h})`).call(d3.axisBottom(x).ticks(5).tickSizeOuter(0));
    g.append("text").attr("class", "lab mute").attr("x", -f.m.l + 4).attr("y", -14).text(narrow ? `○ 1995–97 ● 2022–24 · closer: ${nUp} of ${keep.length}` : `closeness percentile, today's product space: ○ 1995–97 exports   ● 2022–24 exports · closer for ${nUp} of ${keep.length} products`);
    const r = g.selectAll("g.r").data(keep).join("g").attr("transform", d => `translate(0,${yb(d.p) + yb.bandwidth() / 2})`)
      .on("mousemove", (m, d) => SB.tip.show(m, tipRow(d) + SB.row(null, "closeness 1995–97 → 2022–24", Math.round(d.dp_then) + " → " + Math.round(d.dp_now_fixed)))).on("mouseleave", SB.tip.hide);
    r.append("text").attr("class", "lab").attr("x", -12).attr("dy", "0.35em").attr("text-anchor", "end").text(d => d.short);
    r.append("line").attr("x1", d => x(d.dp_then)).attr("x2", d => x(dur ? d.dp_then : d.dp_now_fixed)).attr("stroke", d => col(d.material)).attr("stroke-width", 2).attr("opacity", 0.5)
      .transition().duration(dur).attr("x2", d => x(d.dp_now_fixed));
    r.append("circle").attr("r", 5).attr("cx", d => x(d.dp_then)).attr("fill", "#fff").attr("stroke", d => col(d.material)).attr("stroke-width", 2);
    r.append("circle").attr("r", 6).attr("cx", d => x(d.dp_then)).attr("fill", d => col(d.material)).transition().duration(dur).attr("cx", d => x(d.dp_now_fixed));
    r.append("text").attr("class", "lab halo").attr("dy", "0.35em").attr("x", d => x(Math.max(d.dp_then, d.dp_now_fixed)) + 10)
      .text(d => F.minus((d.dp_now_fixed - d.dp_then >= 0 ? "+" : "") + d3.format(".0f")(d.dp_now_fixed - d.dp_then)))
      .attr("opacity", dur ? 0 : 1).transition().delay(dur).duration(SB.dur(300)).attr("opacity", 1);
  }
  function draw(anim) {
    el.innerHTML = "";
    const c1 = d3.select(el).append("div").attr("class", "ctrl wrap");
    c1.append("span").attr("class", "cap").text("Country");
    cfg.countries.forEach(c => c1.append("button").attr("data-iso", c.iso3).text(SB.name(c.iso3).replace("United Republic of ", "")).classed("on", c.iso3 === iso)
      .on("click", () => { iso = c.iso3; draw(true); }));
    const c2 = d3.select(el).append("div").attr("class", "ctrl");
    c2.append("span").attr("class", "cap").text("Show");
    ["Next steps", "RCA then and now", "Moving closer"].forEach((t, i) => c2.append("button").attr("data-mode", i).text(t).classed("on", i === mode).on("click", () => { mode = i; draw(true); }));
    const box = d3.select(el).append("div").attr("class", "spbox").style("position", "relative").style("height", "calc(100% - 84px)").node();
    if (SB.stacked()) box.style.height = Math.round(window.innerHeight * 0.62) + "px";   /* narrow layout: the plot gets its own height */
    const rows = cfg.data[iso].map(d => ({ ...d, ...P[d.p] }));
    if (mode === 0) steps(box, rows, anim); else if (mode === 1) thenNow(box, rows, anim); else closer(box, rows, anim);
    addTable(el, ["Product", "RCA 1995–97", `RCA ${cfg.window}`, "Closeness (percentile)", "Complexity (PCI)", "World exports a year"],
      rows.slice().sort((a, b) => (b.dp || 0) - (a.dp || 0)).map(r => [r.short, F.rca(r.r95), F.rca(r.rca), r.dp == null ? "–" : Math.round(r.dp), r.pci == null ? "–" : d3.format("+.2f")(r.pci), F.usd(r.usd)]));
  }
  return { play: () => draw(true), redraw: () => draw(false) };
};

/* ───────────── dynamics: market to 2030 and the natural-fibre share (slider + growth pace recompute everything) ───────────── */
SB.charts.demand = function (el, cfg) {
  let share = 10, pace = "trend_2014_2024";
  const LAB = { population: "Population pace", trend_2014_2024: "Trend 2014–24", trend_2010_2024: "Trend 2010–24" };
  const g = id => cfg.paces.find(p => p.id === id).g / 100;
  const mkt = id => cfg.base_t * Math.pow(1 + g(id), cfg.year1 - cfg.year0);
  const val = id => mkt(id) * cfg.uv * 1000;
  const fib = (id, s) => val(id) * s / 100 / cfg.uv_nat / 1000;
  function draw(anim) {
    el.innerHTML = "";
    const host = d3.select(el).append("div").attr("class", "wi dm");
    const ctl = host.append("div").attr("class", "wi-ctl");
    const s1 = ctl.append("label").attr("class", "wi-s");
    s1.append("span").html(`Share of the ${cfg.year1} market won by natural fibre <b class="dm-sv"></b>`);
    const in1 = s1.append("input").attr("type", "range").attr("min", 0).attr("max", 30).attr("step", 1).attr("value", share).attr("id", "dm-share")
      .attr("aria-label", "Share of the plastic sack, bag and twine market won by natural-fibre products, percent");
    const pc = ctl.append("div").attr("class", "wi-s");
    pc.append("span").text("Market growth to " + cfg.year1);
    const pb = pc.append("div").attr("class", "wi-pre dm-pace");
    cfg.paces.forEach(p => pb.append("button").attr("data-pace", p.id).text(`${LAB[p.id]} (${d3.format(".1f")(p.g)}%)`).on("click", () => { pace = p.id; update(true); }));
    const out = host.append("div").attr("class", "wi-out");
    const big = out.append("div").attr("class", "v c-n").attr("aria-live", "polite").attr("id", "dm-result");
    const sub = out.append("div").attr("class", "l");
    const box = host.append("div").attr("class", "wi-bars").node();
    const ser = host.append("div").attr("class", "wi-ser").node();
    host.append("p").attr("class", "wi-cap").text(`EA20 imports of plastic sacks, bags and synthetic twine, thousand tonnes: ${cfg.years[0]}–${cfg.years[cfg.years.length - 1]} (UN Comtrade) and the chosen pace to ${cfg.year1} (dashed, from the ${cfg.base_years} average).`);
    /* bars: fibre needed vs references */
    const W = box.clientWidth || 600, items = [{ id: "you", label: "Fibre needed in this scenario", short: "Fibre needed", color: css("--natural") },
      ...cfg.compare.map((c, i) => ({ id: "c" + i, label: c.item, short: c.item.split(",")[0].replace("EA20 sisal short fibre lost at decortication (central)", "EA20 sisal flume tow").replace("Uganda banana fibre", "Uganda banana fibre"), t: c.t, color: css("--context") }))];
    const narrow = W < 520, L = narrow ? 150 : 330, H = items.length * 30 + 10;
    const svg = d3.select(box).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("height", H);
    const gg = svg.append("g").attr("transform", `translate(${L},4)`);
    const x = d3.scaleLinear().domain([0, d3.max([fib("trend_2010_2024", 30), ...items.filter(d => d.t).map(d => d.t)]) * 1.05]).range([0, W - L - 70]);
    const yb = d3.scaleBand().domain(items.map(d => d.id)).range([0, items.length * 30]).padding(0.3);
    const rg = gg.selectAll("g.r").data(items).join("g").attr("transform", d => `translate(0,${yb(d.id)})`);
    rg.append("text").attr("class", "lab").attr("x", -10).attr("y", yb.bandwidth() / 2).attr("dy", "0.35em").attr("text-anchor", "end").text(d => (narrow ? d.short : d.label));
    const bars = rg.append("rect").attr("rx", 2).attr("height", yb.bandwidth()).attr("fill", d => d.color).attr("width", 0);
    const vals = rg.append("text").attr("class", "lab").attr("y", yb.bandwidth() / 2).attr("dy", "0.35em");
    /* market series: actual + projection */
    const sw = ser.clientWidth || 600, sh = 110, sm = { l: 44, r: 54, t: 10, b: 20 };
    const s2 = d3.select(ser).append("svg").attr("viewBox", `0 0 ${sw} ${sh}`).attr("height", sh);
    const sx = d3.scaleLinear().domain([cfg.years[0], cfg.year1]).range([sm.l, sw - sm.r]);
    const sy = d3.scaleLinear().domain([0, mkt("trend_2010_2024") * 1.1]).range([sh - sm.b, sm.t]);
    s2.append("g").attr("class", "axis x").attr("transform", `translate(0,${sh - sm.b})`).call(d3.axisBottom(sx).ticks(narrow ? 4 : 7).tickFormat(d3.format("d")).tickSizeOuter(0));
    s2.append("g").attr("class", "axis y").attr("transform", `translate(${sm.l},0)`).call(d3.axisLeft(sy).ticks(3).tickFormat(d => d3.format(",")(d / 1e3)).tickSize(0).tickPadding(6));
    const act = SB.pts(cfg.years, cfg.t);
    const la = s2.append("path").datum(act).attr("d", d3.line().x(d => sx(d.y)).y(d => sy(d.v))).attr("fill", "none").attr("stroke", css("--synthetic")).attr("stroke-width", 2);
    drawLine(la, anim ? SB.dur(1200) : 0, 200);
    const proj = s2.append("path").attr("fill", "none").attr("stroke", css("--synthetic")).attr("stroke-width", 2).attr("stroke-dasharray", "5 4");
    const end = s2.append("text").attr("class", "lab").attr("x", sx(cfg.year1) + 6);
    function update(a) {
      const d = a ? SB.dur(350) : 0, f = fib(pace, share), v = val(pace) * share / 100;
      host.select(".dm-sv").text(`${share}%`);
      pb.selectAll("button").classed("on", function () { return this.dataset.pace === pace; });
      tweenText(big, v, q => F.usd(q) + " a year", a ? SB.dur(500) : SB.dur(220));
      sub.text(`of sales in ${cfg.year1} (2024 prices) · ${F.kt(f)} of fibre at US$${d3.format(".2f")(cfg.uv_nat)}/kg · market ${F.kt(mkt(pace))}, ${F.usd(val(pace))}`);
      const tv = it => (it.id === "you" ? f : it.t);
      bars.transition().duration(d).attr("width", it => x(tv(it)));
      vals.transition().duration(d).attr("x", it => x(tv(it)) + 6);
      vals.each(function (it) { tweenText(d3.select(this), tv(it), F.kt, d); });
      const pts = d3.range(cfg.year0, cfg.year1 + 1).map(y => ({ y, v: cfg.base_t * Math.pow(1 + g(pace), y - cfg.year0) }));
      proj.datum(pts).transition().duration(d).attr("d", d3.line().x(q => sx(q.y)).y(q => sy(q.v)));
      end.transition().duration(d).attr("y", sy(mkt(pace)) + 4).text(F.kt(mkt(pace)));
    }
    in1.on("input", function () { share = +this.value; update(false); });
    update(false);
    if (anim) { bars.attr("width", 0); update(true); }
    addTable(el, ["Item", "Value", "Source"], [
      [`Market base (${cfg.base_years} average)`, `${F.kt(cfg.base_t)}, ${F.usd(cfg.base_usd)} (2024 prices)`, "UN Comtrade, EA20 imports"],
      ...cfg.paces.map(p => [`${LAB[p.id]}: market ${cfg.year1}`, `${d3.format(".1f")(p.g)}% a year → ${F.kt(mkt(p.id))}, ${F.usd(val(p.id))}`, p.id === "population" ? "WDI population, 2010–2024" : "market trend (tonnes)"]),
      ["Price of natural-fibre products", `US$${d3.format(".2f")(cfg.uv_nat)}/kg`, "UN Comtrade world unit value, sisal twine and rope, binder twine, jute sacks, 2021–2024"],
      ...cfg.compare.map(c => [c.item, F.kt(c.t), "UNCTAD calculations"])]);
  }
  return { play: () => draw(true), redraw: () => draw(false) };
};

/* small sparkline for the take-aways */
SB.charts.spark = function (svgEl, years, arr, color, hi) {
  const W = svgEl.clientWidth || 260, H = 44, s = d3.select(svgEl).attr("viewBox", `0 0 ${W} ${H}`); s.selectAll("*").remove();
  const pts = SB.pts(years, arr); if (!pts.length) return;
  const x = d3.scaleLinear().domain(d3.extent(pts, d => d.y)).range([2, W - 2]), y = d3.scaleLinear().domain([0, d3.max(pts, d => d.v)]).range([H - 3, 3]);
  const p = s.append("path").datum(pts).attr("d", d3.line().x(d => x(d.y)).y(d => y(d.v)).curve(d3.curveMonotoneX)).attr("fill", "none").attr("stroke", color).attr("stroke-width", 2);
  drawLine(p, SB.dur(1400), 200);
  (hi || []).forEach(yy => { const d = pts.find(q => q.y === yy); if (d) s.append("circle").attr("cx", x(d.y)).attr("cy", y(d.v)).attr("r", 3.5).attr("fill", color); });
};
})();
