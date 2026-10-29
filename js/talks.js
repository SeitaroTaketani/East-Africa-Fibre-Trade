/* Talks, the theme tabs and the menu (key M, or "Menu" in the header).
   SB_TALKS is the one list of talks: index.html?talk=B opens talk B. The theme tabs under the title, the menu, talks.html
   and qa/talk.cjs read this list; "tab" is the short name on the tab. The speaker notes are in TALK_5MIN.md, and qa/talk.cjs
   checks that the notes list the same boards in the same order.
   A tab opens its talk at the cover. The menu switches talks and calls up any board: in a talk, a board that is not part of
   it is added after the current one. */
(function () {
"use strict";
window.SB_TALKS = [
  { id: "A", name: "Overview", tab: "Overview", focus: "The whole story in brief: lost, coming back, policy, Uganda, the market", time: "4:35",
    boards: ["cover", "lost", "comeback", "bans", "uganda", "demand-2030", "meaning"] },
  { id: "B", name: "Exports and buyers", tab: "Exports and buyers", focus: "Which fibres sell; exports lost and coming back, prices, new buyers in Africa, value in products", time: "4:50",
    boards: ["cover", "fibres", "lost", "prices", "comeback", "buyers", "raw", "value", "space"] },
  { id: "C", name: "Plastics and policy", tab: "Plastics and policy", focus: "How plastics won the sacks; bans, tariffs, the 2026 oil shock, standards", time: "4:10",
    boards: ["cover", "home", "bans", "tariffs", "hormuz", "demand-2030", "unctad"] },
  { id: "D", name: "Uganda and the fibre reserve", tab: "Uganda", focus: "Banana fibre not traded yet, in the fields, skills already there, products, a market at home", time: "4:55",
    boards: ["cover", "fibres", "fields", "uganda", "space", "value", "demand-2030", "unctad"] },
  { id: "E", name: "Prices and the business case", tab: "Business case", focus: "Price against oil and plastic, the market at home and to 2030, buyers, value", time: "4:05",
    boards: ["cover", "price-race", "hormuz", "market", "demand-2030", "buyers", "value"] },
  { id: "L", name: "Ten minutes", tab: "Long overview", focus: "Talk A with which fibres sell, the history, the sacks at home, buyers, fibre and prices", time: "9:40",
    boards: ["cover", "fibres", "built", "europe", "lost", "plastic-in", "home", "comeback", "buyers", "bans", "fields", "uganda", "price-race", "demand-2030", "space", "meaning"] },
  { id: "F", name: "In brief for farmers", tab: "Farmers", focus: "Simple slides after the forum's fact sheets: plastic and sisal since 2000, the fibre in Uganda's banana stems (tariffs to come)", time: "2:10",
    boards: ["f-trend", "f-potential"] },
];

const SB = window.SB;
let box = null, back = null;
const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ids = () => SB.boards.map(b => b.id);
const curId = () => { const h = (location.hash || "").slice(1); return ids().includes(h) ? h : ids()[0]; };
const href = (q, hash) => { const s = new URLSearchParams(q).toString(); return "index.html" + (s ? "?" + s : "") + (hash ? "#" + hash : ""); };

function build() {
  const all = SB.all || SB.boards, now = ids(), cur = curId(), t = SB.talk;
  const added = t ? now.filter(id => !t.boards.includes(id)).length : 0;
  const label = t ? `Talk ${t.id} · ${t.name} · ${now.length} boards${added ? ` (${added} added)` : ""}`
    : now.length < all.length ? `${now.length} chosen boards` : `Full story · ${all.length} boards`;
  const talks = window.SB_TALKS.map(k => `<a class="tk${t && t.id === k.id ? " on" : ""}" href="${href({ talk: k.id })}" data-talk="${k.id}">
      <span class="L">${k.id}</span><span class="tx"><b>${esc(k.name)}</b><small>${esc(k.focus)}</small></span><span class="tm">${k.boards.length} boards · ${k.time}</span></a>`).join("");
  const list = all.map((b, i) => { const at = now.indexOf(b.id);
    return `<li><button type="button" data-go="${b.id}" class="${at >= 0 && now.length < all.length ? "in" : ""}${b.id === cur ? " cur" : ""}">
      <span class="no">${i + 1}</span><span class="t">${esc(b.title || b.id)} <i>${b.id}</i></span><span class="pos">${at >= 0 && now.length < all.length ? at + 1 : ""}</span></button></li>`; }).join("");
  box.innerHTML = `<div class="mpanel" role="dialog" aria-modal="true" aria-labelledby="menu-h">
    <div class="mhead"><h3 id="menu-h">Talks and boards</h3><span class="mnow">Now: ${esc(label)}</span><button type="button" class="btn-line" data-close>Close · Esc</button></div>
    <div class="mcols">
      <section><h4>Talks</h4>${talks}
        <a class="tk full" href="${href({}, cur)}"><span class="L">∗</span><span class="tx"><b>Full story</b><small>All ${all.length} boards, at the board now on screen</small></span><span class="tm"></span></a>
        <p class="mnote">Speaker notes for every talk: TALK_5MIN.md.</p></section>
      <section><h4>Go to a board</h4>
        <p class="mnote">${now.length < all.length ? "Blue numbers: the board's place in this talk. A board that is not in the talk is added after the current one; → then carries on with the talk." : "Click a board to go to it."}</p>
        <ol class="bl">${list}</ol></section>
    </div></div>`;
}
function show() {
  if (!box) { box = document.createElement("div"); box.id = "menu"; box.hidden = true; document.body.appendChild(box);
    box.addEventListener("click", ev => {
      if (ev.target === box || ev.target.closest("[data-close]")) { close(); return; }
      const g = ev.target.closest("[data-go]"); if (g) jump(g.dataset.go); }); }
  back = document.activeElement; SB.tip && SB.tip.hide();
  build(); box.hidden = false;
  const f = box.querySelector(".tk.on") || box.querySelector("[data-close]"); f && f.focus();
}
function close() { if (!box || box.hidden) return; box.hidden = true; if (back && back.focus) back.focus(); }
function jump(id) {
  close();
  const now = ids();
  if (now.includes(id)) { SB.goId(id); return; }
  now.splice(now.indexOf(curId()) + 1, 0, id);
  const q = { boards: now.join(",") }; if (SB.talk) q.talk = SB.talk.id;
  location.href = href(q, id);
}
SB.menu = { show, close, jump };

/* theme tabs under the title: the full story, then one tab per talk (the open talk is marked). A tab opens its talk at the
   cover; the tab already open goes back to the cover without reloading. */
function tabs() {
  const nav = document.getElementById("themes"); if (!nav) return;
  const t = SB.talk, all = (SB.all || SB.boards).length, full = !t && SB.boards.length === all;
  const on = yes => (yes ? ' class="on" aria-current="page"' : "");
  nav.innerHTML = `<span class="cap">Themes</span>` +
    `<a href="${href({})}" data-talk=""${on(full)} title="${esc(`The full story: all ${all} boards`)}">Full story</a><span class="gap" aria-hidden="true"></span>` +
    window.SB_TALKS.map(k => `<a href="${href({ talk: k.id })}" data-talk="${k.id}"${on(t && t.id === k.id)}
      title="${esc(`Talk ${k.id} · ${k.name}: ${k.focus} · ${k.boards.length} boards, about ${k.time}`)}"><span class="L">${k.id}</span>${esc(k.tab || k.name)}</a>`).join("");
  nav.addEventListener("click", ev => { const a = ev.target.closest("a.on"); if (a) { ev.preventDefault(); SB.go(0); } });
  const cur = nav.querySelector("a.on");
  if (cur && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = Math.max(0, cur.offsetLeft - 16);   /* phones: the open tab in view */
}

document.addEventListener("keydown", ev => {
  if (ev.target && /INPUT|SELECT|TEXTAREA/.test(ev.target.tagName)) return;
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const open = box && !box.hidden;
  if (ev.key === "m" || ev.key === "M") { ev.preventDefault(); ev.stopImmediatePropagation(); open ? close() : show(); return; }
  if (!open) return;
  if (ev.key === "Escape") { ev.preventDefault(); ev.stopImmediatePropagation(); close(); return; }
  /* while the menu is open the story stays where it is; Tab, Enter and Space (on a button) still work in the menu */
  if (["ArrowDown", "ArrowRight", "PageDown", "ArrowUp", "ArrowLeft", "PageUp", "Home", "End"].includes(ev.key)) { ev.preventDefault(); ev.stopImmediatePropagation(); }
  else if (ev.key === " ") { if (!(ev.target && ev.target.tagName === "BUTTON")) ev.preventDefault(); ev.stopImmediatePropagation(); }
  else if (ev.key === "f" || ev.key === "F") ev.stopImmediatePropagation();
}, true);
/* the wheel scrolls the menu (when it is taller than the screen), never the story behind it */
document.addEventListener("wheel", ev => {
  if (!box || box.hidden || !box.contains(ev.target)) return;
  const p = box.querySelector(".mpanel");
  if (!p || p.scrollHeight <= p.clientHeight + 1 || !p.contains(ev.target)) ev.preventDefault();
}, { passive: false });

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("menu-btn"); if (btn) btn.onclick = () => (box && !box.hidden ? close() : show());
  if (SB.talk) document.title = `Talk ${SB.talk.id} · ${SB.talk.name} — ${document.title}`;
  tabs();
  const q = new URLSearchParams(location.search);
  if (q.has("menu")) { q.delete("menu"); history.replaceState && history.replaceState(null, "", href(Object.fromEntries(q), (location.hash || "").slice(1))); show(); }
});
})();
