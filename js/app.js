/* Core of the storyboard: data helpers, number formats, tooltip, board life cycle and navigation
   (scroll-snap boards, chapter words, progress bar, keys ← → ↑ ↓ PageUp/PageDown/Space/Home/End, F = full screen). */
(function () {
"use strict";
const D = window.EAFF_DATA;
const SB = window.SB = { D, boards: [], charts: {} };
SB.reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
SB.dur = ms => (SB.reduced ? 0 : ms);
/* the stacked page (same query as in css/story.css): narrow, portrait or touch screens; 4:3 projectors keep two columns */
SB.STACKED = "(max-width:899px), (max-width:1050px) and (orientation:portrait), (max-width:1050px) and (pointer:coarse)";
SB.stacked = () => window.matchMedia(SB.STACKED).matches;

/* ── data helpers ── */
SB.at = (arr, y, years) => { const ys = years || D.exp.years, i = ys.indexOf(y); return i < 0 || arr[i] == null ? null : arr[i]; };
SB.pts = (years, arr) => years.map((y, i) => ({ y, v: arr[i] })).filter(d => d.v != null && isFinite(d.v));
SB.lastYear = (years, arr) => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return years[i]; return null; };
SB.name = iso => (D.meta.names && D.meta.names[iso]) || iso;
SB.ind = id => D.ind[id] ? D.ind[id].v : D.exp.years.map(() => null);

/* ── formats (UNCTAD style: US$576 m, 332 kt, 41%, 10.8×; minus sign U+2212) ── */
const minus = s => String(s).replace(/^-/, "−");
const f0 = d3.format(",.0f"), f1 = d3.format(",.1f");
SB.fmt = {
  kt: v => (v == null ? "–" : (Math.abs(v) >= 1e4 ? f0(v / 1e3) : f1(v / 1e3)) + " kt"),
  t: v => (v == null ? "–" : f0(v) + " t"),
  usd: v => { if (v == null) return "–"; const a = Math.abs(v);
    return a >= 1e9 ? "US$" + f1(v / 1e9) + " bn" : a >= 1e7 ? "US$" + f0(v / 1e6) + " m" : a >= 1e6 ? "US$" + f1(v / 1e6) + " m" : "US$" + f0(v / 1e3) + " k"; },
  usdt: v => (v == null ? "–" : "US$" + f0(v) + "/t"),
  pct: v => (v == null ? "–" : (Math.abs(v) < 10 ? f1(v) : f0(v)) + "%"),
  pct0: v => (v == null ? "–" : f0(v) + "%"),
  x: v => (v == null ? "–" : (v < 100 ? f1(v) : f0(v)) + "×"),
  chg: (a, b) => (a == null || b == null || !a ? "–" : minus((b / a - 1 >= 0 ? "+" : "") + f0((b / a - 1) * 100)) + "%"),
  pp: v => (v == null ? "–" : minus((v >= 0 ? "+" : "") + f0(v)) + "%"),
  num: v => (v == null ? "–" : f0(v)),
  minus,
};

/* ── tooltip ── */
const tip = document.getElementById("tip");
SB.tip = {
  show(ev, html) { tip.innerHTML = html; tip.classList.add("on"); SB.tip.move(ev); },
  move(ev) { const w = tip.offsetWidth, h = tip.offsetHeight; let x = ev.clientX + 16, y = ev.clientY + 14;
    if (x + w > window.innerWidth - 8) x = ev.clientX - w - 16; if (y + h > window.innerHeight - 8) y = ev.clientY - h - 14;
    tip.style.left = x + "px"; tip.style.top = y + "px"; },
  hide() { tip.classList.remove("on"); },
};
SB.row = (color, label, value) => `<div class="r"><span>${color ? `<i style="background:${color}"></i>` : ""}${label}</span><b>${value}</b></div>`;

/* ── boards ── */
let sections = [], current = -1;
const story = document.getElementById("story");
function mount() {
  story.innerHTML = "";
  /* talk mode: index.html?talk=B shows the boards of talk B (js/talks.js); index.html?boards=cover,lost,... shows only these
     boards, in this order (it wins over the talk's list, which keeps the talk's name when the menu adds a board) */
  const q = new URLSearchParams(location.search), talk = (window.SB_TALKS || []).find(t => t.id === q.get("talk"));
  SB.all = SB.boards.slice(); SB.talk = talk || null;
  const pick = q.get("boards") || (talk ? talk.boards.join(",") : null);
  if (pick) { const keep = pick.split(",").map(id => SB.boards.find(b => b.id === id.trim())).filter(Boolean); if (keep.length) SB.boards = keep; }
  SB.boards.forEach((b, i) => {
    const s = document.createElement("section");
    s.className = "board" + (b.cls ? " " + b.cls : ""); s.id = "b-" + b.id; s.dataset.i = i;
    s.setAttribute("aria-label", b.title || b.id);
    s.innerHTML = `<div class="txt">${b.text()}</div><div class="viz" id="v-${b.id}"><div class="plot"></div></div>`;
    story.appendChild(s); b.el = s; b.viz = s.querySelector(".viz");
  });
  sections = [...story.querySelectorAll(".board")];
  if (!document.getElementById("count")) { const c = document.createElement("div"); c.id = "count"; c.setAttribute("aria-hidden", "true"); document.body.appendChild(c); }
  /* chapter words */
  const nav = document.getElementById("chapters"); const seen = new Set(); nav.innerHTML = "";
  SB.boards.forEach((b, i) => { if (!b.chapter || seen.has(b.chapter)) return; seen.add(b.chapter);
    const btn = document.createElement("button"); btn.dataset.ch = b.chapter;
    btn.innerHTML = b.chapterNo ? `<span class="n">${b.chapterNo}</span>${b.chapter}` : b.chapter; btn.onclick = () => go(i); nav.appendChild(btn); });
  /* a board becomes active when half of it is visible - or, for boards taller than two screens (phones), when it fills half the screen */
  const io = new IntersectionObserver(es => es.forEach(e => {
    const i = +e.target.dataset.i;
    if (e.isIntersecting && (e.intersectionRatio >= 0.5 || e.intersectionRect.height >= window.innerHeight * 0.5)) activate(i);
    else if (!e.isIntersecting) { e.target.classList.remove("on"); }
  }), { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.75, 1] });
  sections.forEach(s => io.observe(s));
}
/* count-up: the big numbers of a board run from zero to their value when it becomes active ("of 20" stays put) */
function countUp(root) {
  if (SB.reduced) return;
  root.querySelectorAll(".kpi .v, .take .v").forEach(el => {
    if (!el.dataset.final) el.dataset.final = el.textContent;
    const txt = el.dataset.final, parts = [], re = /\d[\d,]*(\.\d+)?/g; let m;
    while ((m = re.exec(txt))) { if (/of\s$/.test(txt.slice(0, m.index))) continue;
      parts.push({ i: m.index, s: m[0], v: +m[0].replace(/,/g, ""), dec: m[1] ? m[1].length - 1 : 0, comma: m[0].includes(",") }); }
    if (!parts.length) return;
    const t0 = performance.now(), dur = 1200;
    const fmt = (p, x) => (p.comma ? x.toLocaleString("en-US", { minimumFractionDigits: p.dec, maximumFractionDigits: p.dec }) : x.toFixed(p.dec));
    const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); let out = "", last = 0;
      parts.forEach(p => { out += txt.slice(last, p.i) + fmt(p, p.v * e); last = p.i + p.s.length; });
      el.textContent = k < 1 ? out + txt.slice(last) : txt; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
function activate(i) {
  const b = SB.boards[i]; if (!b) return;
  if (!b.el.classList.contains("on")) countUp(b.el);
  b.el.classList.add("on");
  if (!b.chart && b.viz) { try { b.chart = b.draw(b.viz.querySelector(".plot"), b) || null; } catch (err) { console.error("board " + b.id, err); } }
  if (b.chart && b.chart.play && (b._played !== true || current !== i)) { try { b.chart.play(); b._played = true; } catch (err) { console.error("play " + b.id, err); } }
  b.viz && b.viz.querySelectorAll("svg:not([aria-label])").forEach(s => { s.setAttribute("role", "img"); s.setAttribute("aria-label", (b.title || b.id) + " — chart; use the Data table button for the values"); });
  if (current === i) return;
  current = i;
  document.getElementById("progress").style.width = (sections.length > 1 ? (i / (sections.length - 1)) * 100 : 0) + "%";
  const cnt = document.getElementById("count"); if (cnt) cnt.textContent = `${i + 1} / ${sections.length}`;
  document.querySelectorAll("#chapters button").forEach(btn => btn.classList.toggle("on", btn.dataset.ch === b.chapter));
  if (history.replaceState) history.replaceState(null, "", "#" + b.id);
}
function go(i) { i = Math.max(0, Math.min(sections.length - 1, i)); sections[i].scrollIntoView({ behavior: SB.reduced ? "auto" : "smooth", block: "start" }); }
SB.go = go;
SB.goId = id => { const i = SB.boards.findIndex(b => b.id === id); if (i >= 0) go(i); };
function idxNow() { const y = window.scrollY + window.innerHeight * 0.4; let k = 0; sections.forEach((s, i) => { if (s.offsetTop <= y) k = i; }); return k; }
document.addEventListener("keydown", ev => {
  if (ev.target && /INPUT|SELECT|TEXTAREA/.test(ev.target.tagName)) return;
  const k = ev.key, i = idxNow();
  if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(k)) { ev.preventDefault(); go(i + 1); }
  else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(k)) { ev.preventDefault(); go(i - 1); }
  else if (k === "Home") { ev.preventDefault(); go(0); }
  else if (k === "End") { ev.preventDefault(); go(sections.length - 1); }
  else if (k === "f" || k === "F") present();
  else if (k === "Escape") SB.tip.hide();
});
function present() {
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
  else if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
}
document.addEventListener("fullscreenchange", () => document.documentElement.classList.toggle("present", !!document.fullscreenElement));
document.getElementById("present").onclick = present;
document.getElementById("home").onclick = () => go(0);
let rz = null;
window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => SB.boards.forEach(b => { if (b.chart && b.chart.redraw) { try { b.chart.redraw(); } catch (e) { console.error(e); } } }), 220); });
SB.start = function () {
  mount();
  const h = (location.hash || "").slice(1), i = SB.boards.findIndex(b => b.id === h);
  if (i > 0) setTimeout(() => sections[i].scrollIntoView({ behavior: "auto" }), 50);
};
})();
