# Natural fibres and plastics in East Africa, 1961–2025 — interactive data story

For the 2nd East Africa Regional Sustainable Natural Fibres Symposium (Kampala, 30–31 October 2026). UNCTAD style
(after `GitHub/Non-plastic`). Plain HTML + CSS + JS (D3 v7, topojson-client vendored); no build step.

## Open and present
- **Open:** double-click `index.html` (works from `file://` in Chrome/Edge/Firefox). Fonts come from Google Fonts when online;
  without internet the page falls back to Helvetica/Arial and still works.
- **Move:** scroll, or keys → ↓ PageDown Space (next) / ← ↑ PageUp (back), Home / End; chapter words in the header; theme tabs under the title (below).
- **Present:** "Present" (or key **F**) = full screen; the header hides until the mouse goes to the top.
- **Explore:** hover any chart for values, sources and events (◆); the export chart switches Tonnes / Value, the comeback chart Since 2000 / Since 1962; the market chart
  switches 1964 / 2024; the map replays the bans year by year; the Uganda board is a calculator (sliders for the share of
  banana stems on offer and the bunch weight recompute the fibre and the comparisons).
- A link to one board: `index.html#lost`, `#buyers`, `#bans`, … (the address follows the board on screen).
- **Themes = talks (tabs under the title, added 2026-10-29):** "Full story" shows all 25 boards; each other tab opens one
  talk at its cover: five-minute talks with different focus - A Overview, B Exports and buyers, C Plastics and policy,
  D Uganda (and the fibre reserve), E Business case (prices) - and L Long overview, ten minutes (`index.html?talk=B`;
  `talks.html` opens the menu, `talk-5min.html` talk A). The cover then names the talk; a click on the open tab goes back
  to the cover. In Present (F) the tabs hide with the header until the mouse goes to the top. Speaker notes for all of them
  in `TALK_5MIN.md`: which talk when, scripts with timings, short versions, a one-minute version, answers to likely
  questions, what to do if something goes wrong. The talks and their tab names are listed once, in `js/talks.js`.
- **Menu (key M or "Menu"):** switch talks, or call up any of the 25 boards; in a talk, a board that is not part of it is
  added after the current one and → carries on with the talk. Any set of boards: `index.html?boards=cover,lost,bans`.
- **Screens checked for the venue** (`qa/venue.cjs`, without internet, i.e. with the fallback font): 1280×720, 1024×768 (4:3
  projector: two columns are kept on landscape screens with a mouse), 1280×800, 1536×864 and 1536×740 (1080p laptop at 125 %,
  full screen and in a window). Use Present (F) on the projector.

## The story (25 boards)
Cover · At a glance (added 2026-10-29: which plant fibres East Africa exports - sisal, flax and hemp, banana
fibre with no trade code, cotton for scale; 5-year averages 1996–2000 and 2020–24) · 1 Built (world output, buyers in 1964) · 2 Lost (exports and events, prices, plastic vs sacks) · 3 At home (synthetic
sacks, fabrics and used clothing) · 4 Coming back (exports since 2000 with a 5-year average; switch to 1962, new buyers, raw vs processed) · 5 Policy (plastic-bag
bans map, EAC tariff stays on twine, 2026 Hormuz shock — preliminary) · 6 Potential (added 2026-10-28: fibre in crop
residues by source, Uganda banana calculator, value per kg and Madagascar's basketwork, the plastic market at home,
price race against oil and per kilo, a growing market to 2030 (calculator), product space: closeness × complexity, RCA then/now
and moving closer for six countries) ·
7 What it means (UNCTAD research: plastic substitution in developing countries, 2025; six lessons) · Methods (seven harmonisation steps, robustness table, sources).

## Where the numbers come from
Every number on the page is computed at run time from `data/story_data.js` and, for the 'At a glance' board,
`data/fibre_mix.js` (cotton, flax and hemp from CEPII BACI; built by `scripts/sb_02_fibre_mix.py`, kept apart from
story_data.js while the dashboard session runs, SB-D10); nothing is typed into the page.
`data/story_data.js` is built by `scripts/sb_01_data.py` from the harmonised panel (`data/processed/harmonized/`, see
`workstreams/history_harmonization/METHODS.md`), the citation-checked tables in `config/`, the Hormuz table T11b and, for chapter 6, `data/processed/fibre_potential/`
(workstream `workstreams/fibre_potential/`; parameters `config/fp_parameters.csv`, checked by `hz_audit_citations.py fp_parameters`)
and `data/processed/product_space/` (scripts `ps_01`–`ps_04`, QC `ps_qc.py`).
Story tables behind it: `data/processed/storyboard/story_table.csv` (phases), `turning_points.csv`, `robustness.csv`.

## Rebuild after a data change
```
cd scripts
python fp_01_potential.py; python fp_02_markets.py   # chapter 6 inputs (after hz_audit_citations.py fp_parameters)
python ps_02_metrics.py; python ps_03_opportunities.py   # product-space board inputs (after ps_01_baci_hs4.py)
python sb_01_data.py        # data file + story tables
python sb_02_fibre_mix.py    # 'At a glance' board: cotton, flax and hemp, Uganda HS 5305 (CEPII BACI; checked against H7/H7b)
python sb_qc_data.py        # data QC: second code path, forum numbers, source tables (0 mismatches expected)
node ../outputs/storyboard/qa/render.cjs 1440 1920 1366 phone   # stills in qa/shots, console errors, layout flags
node ../outputs/storyboard/qa/interact.cjs                       # keys, toggles, tooltips, map hover
node ../outputs/storyboard/qa/venue.cjs                          # projector and laptop sizes, offline font (qa/venue_report.json)
node ../outputs/storyboard/qa/talk.cjs                           # all talks: notes = js/talks.js, numbers in bold on their board, keys, menu, theme tabs
python sb_qc_text.py 1440   # numbers on the rendered page = numbers computed in Python
```
`render.cjs` and `interact.cjs` need Playwright core (installed outside OneDrive in `C:\Users\seitaro.taketani\EAFF_tools`;
set `PW_PATH` elsewhere) and the installed Chrome.

## Caveats shown on the page
- Before 1995 twine and sacks cannot be split by material (SITC); 2025 trade is incomplete, so trade charts end in 2024.
- The synthetic share of imported sacks is a range of two sources (UN Comtrade, CEPII BACI).
- Kenya 2024 sisal production: FAOSTAT estimate 20.9 kt vs 30.9 kt from Kenya's Agriculture and Food Authority (both shown).
- 2026 Hormuz shock: preliminary, partners with complete monthly data only.
- Prices are per kilo, not per use; the 2030 market extends the 2010–2024 import trend (imports only; same spending assumed).
- Plastic-bag bans: the map counts national laws (18 of 20); South Sudan announced a national ban in 2018 but no legal text was
  found; Sudan has state orders only (Red Sea State 2007; El Gedaref) - QA Q35, decision SB-D05.
- Chapter 6: potentials, not supply; banana-stem fibre is not abaca (size reference only); the 40%/70% are shares of farmers
  in one Ugandan survey; pineapple fruit and coconut nut weights are assumptions (†); Uganda's FAOSTAT banana series has
  statistical breaks (◆); EA20 banana totals assume matooke bunch weights for dessert bananas (†). Product space: HS headings
  mix materials (sacks and twine include polypropylene); closeness shows similar capabilities, not buyers or prices.
- Map: the boundaries and names shown and the designations used on this map do not imply official endorsement or acceptance
  by the United Nations.

## Files
`index.html` · `css/story.css` · `js/app.js` (navigation, formats, tooltip) · `js/charts.js` (chart components) ·
`js/boards.js` (the story: text and charts per board) · `js/talks.js` (talks, theme tabs and the menu) · `talks.html`, `talk-5min.html` · `js/vendor/` (D3 v7.8.5, topojson-client) · `assets/` (UNCTAD icon,
UN map as JS) · `data/story_data.js`, `data/fibre_mix.js` (+ `.csv`) (generated) · `qa/` (QC scripts, stills, reports).
