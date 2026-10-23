/* PixelPanel Studio – Oberfläche */
"use strict";

// ================================================================ Mini-Helfer
const $ = (sel, root = document) => root.querySelector(sel);
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v; // nur für eigene, statische SVGs
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") Object.assign(n.style, v);
    else if (k in n && typeof v !== "string") n[k] = v;
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat(Infinity)) if (k !== null && k !== undefined && k !== false) n.append(k.nodeType ? k : String(k));
  return n;
}
const clone = (o) => JSON.parse(JSON.stringify(o));
// Jede geöffnete Studio-Seite (PC, Handy …) hat eine eigene Kennung – so erkennt sie ihre eigenen Änderungen wieder
const CLIENT_ID = Math.random().toString(36).slice(2, 12);
// Adressen relativ zur Seite (<base href>) – so läuft das Studio auch unter einem Unterpfad (Home-Assistant-App)
const U = (u) => (u.startsWith("/") ? u.slice(1) : u);
const api = async (url, opts = {}) => {
  const r = await fetch(U(url), { headers: { "Content-Type": "application/json", "X-Client": CLIENT_ID }, ...opts });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && data.login) { location.href = U("/login"); return data; }
  if (!r.ok && !data.error) data.error = data.detail ? String(data.detail) : `HTTP ${r.status}`;
  return data;
};
function toast(msg, ms = 2600) {
  const t = el("div", { class: "toast" }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
}

const SVG = {
  grid: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.4"/><rect x="9" y="1.5" width="5.5" height="5.5" rx="1.4"/><rect x="1.5" y="9" width="5.5" height="5.5" rx="1.4"/><rect x="9" y="9" width="5.5" height="5.5" rx="1.4"/></svg>',
  clock: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8" cy="8" r="6.2"/><path d="M8 4.5V8l2.4 1.6"/></svg>',
  weather: '<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="6" cy="6" r="2.6"/><path d="M5 14a3 3 0 0 1-.2-6 3.8 3.8 0 0 1 7.2 1.2A2.4 2.4 0 0 1 12 14z" stroke="#0a84ff" stroke-width="1"/></svg>',
  stack: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="1.5" y="2" width="6" height="12" rx="1.5"/><rect x="8.5" y="2" width="6" height="5.5" rx="1.5"/><rect x="8.5" y="8.5" width="6" height="5.5" rx="1.5"/></svg>',
  home: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.8 1.5 7.3V14a.8.8 0 0 0 .8.8h3.9v-4h3.6v4h3.9a.8.8 0 0 0 .8-.8V7.3z"/></svg>',
  devices: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="2" y="2.5" width="12" height="11" rx="2"/><path d="M5 6h6M5 8.5h6M5 11h3.5"/></svg>',
  upload: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 11V2.5M4.5 6 8 2.5 11.5 6M2.5 13.5h11"/></svg>',
  gear: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M9.3 1.5 9.6 3a5.3 5.3 0 0 1 1.3.75l1.45-.5 1.3 2.25-1.15 1a5 5 0 0 1 0 1.5l1.15 1-1.3 2.25-1.45-.5A5.3 5.3 0 0 1 9.6 13l-.3 1.5H6.7L6.4 13a5.3 5.3 0 0 1-1.3-.75l-1.45.5-1.3-2.25 1.15-1a5 5 0 0 1 0-1.5l-1.15-1 1.3-2.25 1.45.5A5.3 5.3 0 0 1 6.4 3l.3-1.5zM8 5.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z"/></svg>',
  search: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="7" cy="7" r="4.8"/><path d="m10.6 10.6 3.4 3.4"/></svg>',
  up: '<svg viewBox="0 0 12 12" width="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 7.5 6 4.5l3 3"/></svg>',
  down: '<svg viewBox="0 0 12 12" width="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 4.5 6 7.5l3-3"/></svg>',
  x: '<svg viewBox="0 0 12 12" width="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m3 3 6 6M9 3 3 9"/></svg>',
  value: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12.5 6 8l3 2.5L14 4"/><path d="M10.5 4H14v3.5"/></svg>',
  plus: '<svg viewBox="0 0 12 12" width="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 2v8M2 6h8"/></svg>',
  anim: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="6" y="3" width="8" height="10" rx="2" fill="currentColor" stroke="none"/><path d="M2 5.5h2M1.5 8h2.5M2 10.5h2"/></svg>',
  entity: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="4.5" y="1.5" width="7" height="8" rx="1.5"/><path d="M4.5 6.5h7" /><path d="M4 13h8M6 15h4" stroke-width="1.5"/></svg>',
  timer: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 1.8h8M4 14.2h8M5 1.8c0 3.2 6 3.6 6 6.2s-6 3-6 6.2M11 1.8c0 3.2-6 3.6-6 6.2"/><path d="M6.4 12.6h3.2" stroke-width="2.2"/></svg>',
  marquee: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="4" width="13" height="8" rx="2"/><path d="M5 8h6M9 6l2 2-2 2"/></svg>',
  calendar: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="2" y="3" width="12" height="11" rx="2"/><path d="M2 6.5h12M5 1.8v2.4M11 1.8v2.4"/><path d="M5 9.5h2M9 9.5h2M5 12h2" stroke-width="1.5"/></svg>',
  chart: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 2v12h12"/><path d="M4.5 10.5 7 7.5l2.2 2L13 5"/></svg>',
  chev: '<svg viewBox="0 0 8 12" width="7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m2 2 4 4-4 4"/></svg>',
};
const DOMAIN = {
  light: ["Licht", "💡"], switch: ["Schalter", "⏻"], sensor: ["Sensor", "📈"], binary_sensor: ["Binärsensor", "◐"],
  weather: ["Wetter", "⛅"], climate: ["Klima", "🌡"], media_player: ["Medien", "▶"], cover: ["Rollo", "▤"],
  person: ["Person", "👤"], device_tracker: ["Tracker", "📍"], automation: ["Automation", "⚙"], script: ["Skript", "📜"],
  scene: ["Szene", "🎬"], input_boolean: ["Helfer", "☑"], number: ["Zahl", "#"], select: ["Auswahl", "☰"],
  button: ["Taste", "◉"], camera: ["Kamera", "📷"], fan: ["Lüfter", "✣"], lock: ["Schloss", "🔒"],
  sun: ["Sonne", "☀"], calendar: ["Kalender", "📅"], input_text: ["Text", "✎"], zone: ["Zone", "◎"], update: ["Update", "⬆"], vacuum: ["Sauger", "🧹"],
};
const PAGE_META = {
  clock: { title: "Uhr", color: "#ff9f0a", icon: SVG.clock, sub: "Uhrzeit & Datum" },
  weather: { title: "Wetter", color: "#0a84ff", icon: SVG.weather, sub: "Symbol, Temperatur & Luftfeuchte aus einer Wetter-Entität" },
  value: { title: "Wert", color: "#bf5af2", icon: SVG.value, sub: "Ein großer Wert aus einer beliebigen Entität – Sensor, Licht, Kurs, Attribut …" },
  entity: { title: "Entitäten", color: "#64d2ff", icon: SVG.entity, sub: "Eine Entität mit großem Icon darüber oder darunter – z. B. Wassertank 50 % mit Füllstand" },
  list: { title: "Liste", color: "#30d158", icon: SVG.home, sub: "Mehrere Entitäten untereinander – so viele, wie auf die Fläche passen" },
  timer: { title: "Timer", color: "#ff9f0a", icon: SVG.timer, sub: "Restzeit vom Backofen, der Waschmaschine oder einem HA-Timer – erscheint, sobald er läuft" },
  marquee: { title: "Laufschrift", color: "#ffd60a", icon: SVG.marquee, sub: "Text läuft von rechts nach links – fester Text oder z. B. der aktuelle Songtitel" },
  calendar: { title: "Kalender", color: "#ff453a", icon: SVG.calendar, sub: "Nächste Termine aus deinen Kalendern – HEUTE 14:30 Zahnarzt" },
  chart: { title: "Verlauf", color: "#64d2ff", icon: SVG.chart, sub: "Diagramm als Linie oder Balken – z. B. Temperatur der letzten 24 h oder Strompreis-Prognose" },
  stack: { title: "Stapel", color: "#ff375f", icon: SVG.stack, sub: "Mehrere Seiten gleichzeitig – z. B. links Wetter, rechts Uhr" },
};
const pageColor = (p) => PAGE_META[p.type].color;
const pageSvg = (p) => PAGE_META[p.type].icon;

// ================================================================ Zustand
const S = {
  boot: null, saved: null, draft: null, R: null,
  entities: [], byId: {}, haStatus: "…", haError: "", counts: { devices: 0, areas: 0 },
  seen: null, fresh: new Set(),
  view: "overview",
  timers: {}, timerDemo: new Map(), // key -> "run" | "done" (nur Vorschau)
  rotation: { idx: 0, elapsed: 0 },
  deploy: { running: false, total: 0, lines: [], step: 0, ok: null },
};
const states = () => S.byId;
const enabledPages = () => S.draft.pages.filter((p) => p.enabled);
const dirty = () => JSON.stringify(S.draft) !== JSON.stringify(S.saved);

function setPath(obj, path, val) {
  const ks = path.split(".");
  let o = obj;
  ks.slice(0, -1).forEach((k) => (o = o[k]));
  o[ks.at(-1)] = val;
}
function getPath(obj, path) { return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj); }
function change(path, val, rerender = false) {
  setPath(S.draft, path, val);
  updateSavebar();
  renderSidebar();
  if (rerender) render();
}

// ================================================================ Geometrie & Strom
let _geomKey = "", _geom = null;
function geom() {
  const k = JSON.stringify(S.draft.settings.panel || {});
  if (k !== _geomKey) { _geomKey = k; _geom = S.R.geo.Geom(S.draft.settings); }
  return _geom;
}
const power = () => S.R.geo.powerCfg(S.draft.settings, geom());
const fmtA = (a) => a.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " A";
// Bild einer Seitenauswahl rendern + Strom/Helligkeit wie auf dem ESP abschätzen
function frame(items, trans, now) {
  const g = geom();
  const pagesById = Object.fromEntries(S.draft.pages.map((p) => [p.id, p]));
  const { buf, acc, info, scrolled, long } = S.R.renderFrame(g.W, g.H, items, { now: now || new Date(), states: states(), geom: g, pagesById, timers: timerView(), lang: S.draft.settings.panel_lang, time12: S.draft.settings.time_format === "12",
    ms: now ? now.getTime() : Date.now(), history: histFor(items, trans), night: !now && !!S.quiet && S.quiet.mode === 3 }, trans);
  const pw = power();
  const cap = S.R.geo.brightnessCap(acc, pw.i_px, pw.amp, pw.idle);
  const user = S.draft.settings.brightness;
  const eff = S.draft.active ? Math.max(1, Math.min(user, cap)) : 0;
  const amps = S.R.geo.needAmps(acc, pw.i_px) * eff / 255 + pw.idle + S.boot.geo.espReserve;
  return { buf, acc, cap, eff, amps, info, scrolled, long, limited: cap < user, fullNeed: S.R.geo.needAmps(acc, pw.i_px) };
}

// Verlauf-Seiten: Vorschau-Daten aus der HA-Historie (alle 2 Minuten neu)
S.hist = {};
function histFor(items, trans) {
  const out = {};
  const want = (o) => {
    if (!o || o.mode === "list" || !o.entity) return;
    const k = S.R.histKey(o), h = S.hist[k];
    if (h && h.values) out[k] = h.values;
    if (h && (h.pending || Date.now() - h.at < 120000)) return;
    S.hist[k] = Object.assign(h || {}, { pending: true });
    const q = new URLSearchParams({ entity: o.entity, attr: (o.attribute || "").trim(), period: o.period || "24h" });
    fetch(U("/api/history?") + q).then((r) => r.json()).then((d) => { S.hist[k] = { at: Date.now(), values: d.values || null }; renderPanels(); })
      .catch(() => { S.hist[k] = { at: Date.now(), values: null }; });
  };
  const walk = (list) => (list || []).forEach(({ page }) => {
    if (!page) return;
    if (page.type === "chart") want(page.options);
    if (page.type === "stack") (page.options.fields || []).forEach((f) => f && f.type === "chart" && want(f.options));
  });
  walk(items); if (trans) walk(trans.prev);
  return out;
}

// ================================================================ LED-Panel
const LED_RATIO = (p) => (p <= 2.5 ? 0.31 : p <= 3 ? 0.36 : 0.3);
class LedPanel {
  constructor(maxH = 0.55, minCell = 2) {
    this.minCell = minCell;
    this.canvas = el("canvas");
    this.wrap = el("div", { class: "bezel" }, this.canvas);
    this.last = "";
    this.maxH = maxH;
  }
  draw(f, outline) {
    const g = geom();
    const c = this.canvas;
    const avail = Math.max(120, (this.wrap.clientWidth || 380) - 20);
    const cell = Math.max(this.minCell, Math.min(avail / g.W, (window.innerHeight * this.maxH) / g.H));
    const cssW = Math.floor(cell * g.W), cssH = Math.floor(cell * g.H);
    const dpr = window.devicePixelRatio || 1;
    const pxW = Math.round(cssW * dpr), pxH = Math.round(cssH * dpr);
    const key = [pxW, pxH, f.eff, g.pitch, _geomKey, outline && JSON.stringify(outline), f.buf.join(",")].join("|");
    if (key === this.last) return;
    this.last = key;
    c.style.width = cssW + "px"; c.style.height = cssH + "px";
    if (c.width !== pxW || c.height !== pxH) { c.width = pxW; c.height = pxH; }
    const ctx = c.getContext("2d");
    const cs = pxW / g.W;
    ctx.clearRect(0, 0, pxW, pxH);
    // Module als Kacheln (fehlende Module bleiben leer)
    ctx.fillStyle = "#050505";
    for (let r = 0; r < g.rows; r++) for (let cc = 0; cc < g.cols; cc++) {
      if (g.missing.has(r + "," + cc)) continue;
      const pts = [[cc * g.mw, r * g.mh], [(cc + 1) * g.mw - 1, (r + 1) * g.mh - 1]].map(([px, py]) => {
        if (g.rot === 90) return [g.PH - 1 - py, px];
        if (g.rot === 180) return [g.PW - 1 - px, g.PH - 1 - py];
        if (g.rot === 270) return [py, g.PW - 1 - px];
        return [px, py];
      });
      const x0 = Math.min(pts[0][0], pts[1][0]), y0 = Math.min(pts[0][1], pts[1][1]);
      const x1 = Math.max(pts[0][0], pts[1][0]) + 1, y1 = Math.max(pts[0][1], pts[1][1]) + 1;
      ctx.fillRect(x0 * cs + 0.5, y0 * cs + 0.5, (x1 - x0) * cs - 1, (y1 - y0) * cs - 1);
    }
    const k = f.eff ? 0.45 + 0.55 * (f.eff / 255) : 0;
    const r = cs * LED_RATIO(g.pitch);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.beginPath();
    for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) {
      if (!g.present(x, y)) continue;
      const i = (y * g.W + x) * 3;
      if (k && (f.buf[i] | f.buf[i + 1] | f.buf[i + 2])) continue;
      ctx.moveTo((x + 0.5) * cs + r, (y + 0.5) * cs);
      ctx.arc((x + 0.5) * cs, (y + 0.5) * cs, r, 0, Math.PI * 2);
    }
    ctx.fill();
    if (k) {
      for (const pass of [0, 1]) {
        ctx.globalAlpha = pass ? 1 : 0.22;
        for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) {
          const i = (y * g.W + x) * 3;
          const R = f.buf[i], G = f.buf[i + 1], B = f.buf[i + 2];
          if (!(R | G | B) || !g.present(x, y)) continue;
          ctx.fillStyle = `rgb(${Math.round(R * k)},${Math.round(G * k)},${Math.round(B * k)})`;
          ctx.beginPath();
          ctx.arc((x + 0.5) * cs, (y + 0.5) * cs, pass ? r : cs * 0.85, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
    if (outline) {
      ctx.strokeStyle = "rgba(10,132,255,0.9)";
      ctx.lineWidth = Math.max(1.5, dpr * 1.5);
      ctx.setLineDash([6 * dpr, 4 * dpr]);
      ctx.strokeRect(outline.x * cs + 1, outline.y * cs + 1, outline.w * cs - 2, outline.h * cs - 2);
      ctx.setLineDash([]);
    }
  }
}
const panels = new Set(); // {panel, get(), meta}
const SCROLL_SPEEDS = { slow: 50, normal: 35, fast: 22 };
let scrollTimer = null;
function renderPanels() {
  let anyScroll = false;
  for (const p of panels) {
    if (!p.panel.canvas.isConnected) { panels.delete(p); continue; }
    const { items, outline, trans } = p.get();
    const f = frame(items, trans);
    if (f.scrolled) anyScroll = true;
    const Q = p.quiet && S.quiet && S.quiet.cap < 255 ? S.quiet : null;
    if (Q) {
      f.eff = Math.min(f.eff, Q.cap);
      const pw = power();
      f.amps = f.fullNeed * f.eff / 255 + pw.idle + S.boot.geo.espReserve;
    }
    p.panel.draw(f, outline);
    if (p.miniCap) {
      const t = ($("#rot-info") && $("#rot-info").textContent) || ($("#main .view-head h2") || {}).textContent || "";
      if (p.miniCap.textContent !== t) p.miniCap.textContent = t;
    }
    const metaKey = p.meta && [f.amps.toFixed(1), f.limited, f.eff, Q && Q.mode, Q && Q.force, Q && Math.ceil(Q.left / 60), _geomKey].join("|");
    if (p.meta && metaKey !== p.metaKey) {
      p.metaKey = metaKey;
      const g = geom();
      p.meta.replaceChildren(`${g.W} × ${g.H} · P${String(g.pitch).replace(".", ",")} · ≈ ${fmtA(f.amps)}`,
        f.limited && S.draft.active ? el("span", { class: "limit", title: "Das Netzteil-Limit dimmt dieses Bild automatisch" }, ` · ⚡ ${Math.round(f.eff / 2.55)} %`) : "",
        Q ? el("span", { class: "quiet-tag" + (Q.mode === 3 ? " night" : "") }, Q.force ? " · Nachtansicht" : ` · ${Q.mode === 1 ? "Ruhezeit" : Q.mode === 2 ? "Ruhezeit (gedimmt)" : Q.mode === 3 ? "Nachtmodus" : "Abenddimmung"} noch ${fmtLeft(Q.left)}`) : "");
    }
  }
  // Laufschrift sichtbar → weiterzeichnen (ca. 20 Bilder pro Sekunde)
  if (anyScroll && !scrollTimer) scrollTimer = setTimeout(() => { scrollTimer = null; renderPanels(); }, 50);
}
function mountPanel(get, { maxH = 0.55, meta = null, live = false, quiet = false, mini = false } = {}) {
  const panel = new LedPanel(maxH);
  panels.add({ panel, get, meta, live, quiet });
  if (live) setTimeout(animate, 50);
  requestAnimationFrame(renderPanels);
  if (mini) attachMini(panel.wrap, get, quiet);
  return panel.wrap;
}
// ---- Mini-Vorschau: erscheint links oben, sobald die große Vorschau zur Hälfte aus dem Bild gescrollt ist
function destroyMini() {
  const m = S.mini;
  if (!m) return;
  m.obs.disconnect();
  m.box.remove();
  panels.delete(m.entry);
  S.mini = null;
}
function attachMini(target, get, quiet) {
  destroyMini();
  const panel = new LedPanel(0.3, 1);
  const cap = el("div", { class: "mini-cap" });
  const box = el("div", { class: "mini-pv", title: "Zurück nach oben", onclick: () => target.scrollIntoView({ behavior: "smooth", block: "center" }) },
    panel.wrap, cap,
    el("button", { class: "mini-x", title: "Ausblenden", "aria-label": "Ausblenden", onclick: (e) => { e.stopPropagation(); S.miniOff = true; show(false); } }, "✕"));
  const entry = { panel, get, quiet, miniCap: cap };
  const show = (on) => {
    on = on && !S.miniOff;
    box.classList.toggle("show", on);
    if (on) { panels.add(entry); renderPanels(); } else panels.delete(entry);
  };
  const obs = new IntersectionObserver(([e]) => show(e.isIntersecting ? e.intersectionRatio < 0.5 : true), { threshold: [0, 0.5, 1] });
  document.body.append(box);
  requestAnimationFrame(() => obs.observe(target));
  S.mini = { box, entry, obs };
}

// ================================================================ Animationen (Seitenwechsel, spiegelt transition_cpp)
const ANIMS = [
  ["none", "Keine", "Harter Schnitt – wie bisher"],
  ["fade", "Überblenden", "Sanft aus- und wieder einblenden"],
  ["slide_left", "Schieben", "Die neue Seite schiebt die alte nach links hinaus"],
  ["slide_up", "Hochschieben", "Die neue Seite schiebt sich von unten herein"],
  ["wipe", "Wischen", "Die neue Seite läuft von links über die alte"],
  ["curtain", "Vorhang", "Öffnet sich von der Mitte nach außen"],
  ["slide_right", "Schieben →", "Wie Schieben, nur nach rechts"],
  ["glide", "Gleiten", "Gleitet leise hinaus, die neue Seite gleitet herein"],
  ["rollo", "Rollo", "Die neue Seite rollt von oben herunter"],
  ["blinds", "Jalousie", "Öffnet sich in acht Streifen"],
  ["box", "Fenster", "Ein Rahmen wächst aus der Mitte"],
  ["tiles", "Kacheln", "Die neue Seite setzt sich aus 9 Kacheln zusammen"],
  ["scanner", "Scanner", "Ein leuchtender Strich fährt über das Panel"],
  ["bounce", "Federn", "Schwingt mit kleinem Überschwung ein"],
  ["drop", "Fallen", "Fällt von oben herein und hüpft aus"],
  ["blink", "Blinzeln", "Schließt sich wie ein Auge und öffnet sich neu"],
  ["stairs", "Treppe", "Acht Streifen fallen nacheinander herunter"],
  ["split", "Spalt", "Öffnet sich von der Mitte nach oben und unten"],
  ["cross", "Kreuz", "Ein Kreuz wächst aus der Mitte"],
  ["wave", "Welle", "Kacheln laufen diagonal von oben links durch"],
  ["zipper", "Reißverschluss", "Obere Hälfte nach links, untere nach rechts"],
];
// ---- Leistung: läuft das flüssig auf diesem Board mit diesem Panel?
const boardOf = () => S.boot.boards[S.draft.settings.hw_board] || S.boot.boards.devkit;
function perf(style) {
  const g = geom();
  return S.R.geo.hwPlan(boardOf().chip, g.PW * g.PH, style ?? animCfg().style, countEntities(S.draft));
}
const PERF_TXT = { ok: "läuft flüssig", warn: "kann leicht ruckeln", bad: "ruckelt wahrscheinlich" };
// Anzahl verschiedener HA-Entitäten, die das Panel abonniert (Seiten, Listen, Stapel-Felder, Bedingungen)
function countEntities(cfg) {
  const ids = new Set();
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(walk);
    for (const [k, v] of Object.entries(o)) {
      if (k === "entity" && typeof v === "string" && v.includes(".")) ids.add(v + "|" + (o.attribute || ""));
      else if (typeof v === "object") walk(v);
    }
  };
  const special = (type, o) => {
    if (!o) return false;
    if (type === "calendar") {
      if (o.source === "helper") { for (let k = 0; k < Math.max(1, Math.min(12, +o.count || 6)); k++) if (o.helper) ids.add(`${o.helper}|e${k + 1}`); }
      else (o.calendars || []).slice(0, 4).forEach((c) => c && c.entity && ["message", "start_time", "end_time", "all_day"].forEach((a) => ids.add(`${c.entity}|${a}`)));
      return true;
    }
    if (type === "chart" && o.mode === "list") { if (o.entity) { ids.add(`${o.entity}|${o.list_attr || ""}`); ids.add(`${o.entity}|`); } return true; }
    return false;
  };
  (cfg.pages || []).filter((p) => p.enabled !== false).forEach((p) => {
    if (!special(p.type, p.options)) {
      if (p.type === "stack") (p.options.fields || []).forEach((f) => f && !special(f.type, f.options) && walk(f.options));
      else walk(p.options);
    }
    walk(p.condition);
  });
  return ids.size;
}
function perfBanner(style) {
  const g = geom(), b = boardOf(), pl = perf(style);
  const fps = Math.round(1000 / pl.interval);
  const lines = [];
  if (!pl.fits) lines.push(`Selbst mit der kleinsten Farbtiefe ist der Bildspeicher für ${g.PW} × ${g.PH} Pixel zu groß für einen ${b.chip}. Nimm einen ESP32-S3 oder weniger Panels.`);
  if (pl.level === "warn") lines.push(`Bei ${g.PW} × ${g.PH} Pixeln kommt ein ${b.chip} bei diesem Übergang an seine Grenze – das Panel zeichnet dann nur ${fps} statt 30 Bilder pro Sekunde, es kann leicht ruckeln.`);
  if (pl.level === "bad") lines.push(`Für ${g.PW} × ${g.PH} Pixel ist dieser Übergang auf einem ${b.chip} zu aufwendig – er wird sichtbar ruckeln (etwa ${fps} Bilder pro Sekunde). Grün markierte Übergänge laufen flüssig${b.chip !== "ESP32-S3" ? ", oder nimm einen ESP32-S3" : ""}.`);
  if (pl.fits && pl.bits < 8) lines.push(`Damit der Speicher reicht, nutzt das Panel ${pl.bits} statt 8 Bit Farbtiefe – Farbverläufe werden etwas gröber.`);
  if (style !== "none" && !pl.double && pl.fits) lines.push("Für einen zweiten Bildpuffer reicht der Speicher nicht – bei schnellen Übergängen kann es leicht flimmern.");
  // Arbeitsspeicher: Bildspeicher + Home-Assistant-Werte (je Wert ca. 0,75 KB im ESP)
  const nEnt = countEntities(S.draft), entKb = Math.round(nEnt * (S.boot.geo.entKb || 0.75)), used = pl.mem_kb + entKb;
  let memLevel = "ok";
  if (pl.fits && used > pl.ram_kb * 1.15) { memLevel = "bad"; lines.push(`Zusammen mit ${nEnt} Home-Assistant-Werten wird der Arbeitsspeicher zu knapp (ca. ${used} von ${pl.ram_kb} KB). Weniger Werte (z. B. kürzere Listen) oder ein ESP32-S3.`); }
  else if (pl.fits && used > pl.ram_kb) { memLevel = "warn"; lines.push(`Mit ${nEnt} Home-Assistant-Werten wird der Arbeitsspeicher knapp (ca. ${used} von ${pl.ram_kb} KB) – es kann gelegentlich zu Neustarts kommen.`); }
  const lvl = !pl.fits ? "bad" : [pl.level, memLevel].includes("bad") ? "bad" : [pl.level, memLevel].includes("warn") ? "warn" : "ok";
  const head = `${b.chip} · ${g.PW} × ${g.PH} Pixel · Speicher ca. ${used} von ${pl.ram_kb} KB (Bild ${pl.mem_kb} + ${nEnt} HA-Werte ${entKb})`;
  return el("div", { class: "perf-box " + lvl },
    el("div", { class: "perf-head" }, el("span", { class: "perf-dot" }), el("b", {}, !pl.fits ? "passt nicht in den Speicher" : memLevel !== "ok" && (memLevel === "bad" || pl.level === "ok") ? (memLevel === "bad" ? "Speicher zu knapp" : "Speicher knapp") : PERF_TXT[pl.level]), el("span", {}, head)),
    lines.length ? el("ul", {}, lines.map((t) => el("li", {}, t))) : el("div", { class: "perf-ok" }, style === "none" ? "Ohne Animation hat dein ESP genug Reserven." : `Etwa ${fps} Bilder pro Sekunde während des Übergangs${pl.double ? ", mit zweitem Bildpuffer gegen Flimmern" : ""}.`),
    el("small", {}, "Schätzung aus den Speicherangaben von ESPHome (esp-hub75) und der ESP32-HUB75-DMA-Bibliothek sowie der Pixelzahl – Leistung und Speicher hängen auch von WLAN und anderen Komponenten ab."));
}
// ---- Icons: Auswahl mit Vorschaubildern (Palette „C“ = frei wählbare Farbe)
const CUSTOM_ALPH = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const customIcon = (name) => (S.draft.icons || {})[name];
const iconLabel = (n) => (customIcon(n) ? customIcon(n).name || "Eigenes Icon" : S.boot.iconChoices[n] || n);
function iconCanvas(name, color = "#0a84ff", px = 3) {
  const nm = name === "water_auto" ? "water_half" : name;
  const cu = typeof name === "object" ? name : customIcon(nm);
  const rows = cu ? cu.rows : S.boot.icons[nm];
  const c = el("canvas", { class: "icanvas", width: 16 * px, height: 16 * px });
  if (!rows) return c;
  const ctx = c.getContext("2d");
  const y0 = Math.floor((16 - rows.length) / 2), x0 = Math.floor((16 - rows[0].length) / 2);
  rows.forEach((row, y) => [...row].forEach((ch, xx) => {
    const x = xx + x0;
    const col = cu ? (ch === "." ? null : "#" + String(cu.pal[CUSTOM_ALPH.indexOf(ch)] || "").replace("#", "")) : ch === "C" ? color : S.boot.palette[ch];
    if (!col) return;
    ctx.fillStyle = col;
    ctx.fillRect(x * px, (y + y0) * px, px - (px > 2 ? 0.6 : 0), px - (px > 2 ? 0.6 : 0));
  }));
  return c;
}
const iconUsesColor = (name) => !!(name && S.boot.icons[name] && S.boot.icons[name].some((r) => r.includes("C")));
function iconField(base) {
  const o = getPath(S.draft, base);
  const cur = o.icon || "";
  const btn = el("button", { class: "entity-btn icon-btn", onclick: () => {
    const close = () => ov.remove();
    const ov = el("div", { class: "overlay", onclick: (e) => e.target === ov && close() },
      el("div", { class: "sheet" },
        el("div", { class: "sheet-head" }, el("h3", {}, "Icon auswählen"),
          el("div", { style: { color: "var(--text-2)" } }, "Fahrzeuge bekommen danach eine frei wählbare Farbe. „Füllstand automatisch“ wechselt je nach Wert (Prozent) zwischen leer, halb und voll."),
          el("div", { style: { color: "var(--text-2)", marginTop: "4px" } }, "Licht, Farblicht, Ventilator, Waschmaschine, Trockner, Spülmaschine und Sanduhr können sich bewegen – danach „Icon animieren“ einschalten.")),
        el("div", { class: "sheet-body" },
          el("div", { class: "icon-group" }, el("h4", { class: "group-title" }, "Eigene Icons"),
            el("div", { class: "icon-grid" },
              Object.keys(S.draft.icons || {}).map((n) => el("div", { class: "icon-tile-wrap" },
                el("button", { class: "icon-tile" + (n === cur ? " on" : ""), onclick: () => { close(); change(`${base}.icon`, n, true); } },
                  iconCanvas(n), el("small", {}, iconLabel(n))),
                el("button", { class: "icon-edit", title: "Bearbeiten", onclick: () => { close(); openIconEditor(n, (id) => change(`${base}.icon`, id, true)); } }, "✎"))),
              el("button", { class: "icon-tile add", onclick: () => { close(); openIconEditor(null, (id) => change(`${base}.icon`, id, true)); } },
                el("span", { class: "noicon" }, "＋"), el("small", {}, "Eigenes Icon zeichnen oder Bild laden")))),
          communitySection(cur, (id) => { close(); change(`${base}.icon`, id, true); }),
          S.boot.iconGroups.map(([title, names]) => el("div", { class: "icon-group" },
          el("h4", { class: "group-title" }, title),
          el("div", { class: "icon-grid" }, names.map((n) => el("button", { class: "icon-tile" + (n === cur ? " on" : ""), title: S.boot.iconChoices[n] || n,
            onclick: () => { close(); change(`${base}.icon`, n, true); } },
          n ? iconCanvas(n, o.icon_color) : el("span", { class: "noicon" }, "–"), el("small", {}, S.boot.iconChoices[n] || n))))))),
        el("div", { class: "sheet-foot" }, el("button", { class: "btn", onclick: close }, "Abbrechen"))));
    document.body.append(ov);
  } }, cur ? iconCanvas(cur, o.icon_color, 1.5) : null, el("span", { class: "t" }, cur ? iconLabel(cur) : "Kein Icon"), el("span", { class: "chev", html: SVG.chev }));
  return btn;
}
// ---- 3.2: animierte Icons (Licht an/aus, Waschmaschine läuft …) – nur für eingebaute Icons aus S.boot.iconAnim
const ANIM_TXT = {
  bulb: "Leuchtet gelb mit Strahlen, wenn das Licht an ist – sonst grau",
  colorbulb: "Farben wandern, wenn das Licht an ist – sonst grau",
  washer: "Die Wäsche dreht sich in der Trommel, solange sie läuft",
  dryer: "Die Wäsche dreht sich in der Trommel, solange er läuft",
  dishwasher: "Der Sprühstrahl wechselt, solange sie läuft",
  fan: "Die Flügel drehen sich, solange er an ist",
  timer: "Ein Sandkorn fällt, solange es läuft",
};
const canAnim = (icon) => !!(icon && S.boot.iconAnim && S.boot.iconAnim[icon]);
function animRows(base, type) {
  const o = getPath(S.draft, base);
  if (!canAnim(o.icon)) return [];
  const rows = [row("Icon animieren", toggle(`${base}.icon_anim`, () => render()),
    type === "timer" ? "Bewegt sich, solange der Timer läuft – bei Pause und „FERTIG“ steht es still" : ANIM_TXT[o.icon])];
  if (type === "timer" || !o.icon_anim) return rows;
  const raw = o.anim_entity ? haStr(o.anim_entity) : o.entity ? haStr(o.entity, (o.attribute || "").trim() || undefined) : "";
  const on = S.R.isAct(raw, S.R.animThr(o));
  rows.push(
    row("Zustand von", entityButton(`${base}.anim_entity`, null, { optional: true, placeholder: "Angezeigter Wert" }),
      "Leer = der Wert dieser Seite. Sonst z. B. die Steckdose oder der Status der Waschmaschine"),
    row("Läuft ab", el("span", { class: "dur" }, el("input", { class: "field", type: "text", inputmode: "decimal", placeholder: "z. B. 5",
      value: o.anim_above ?? "", autocomplete: "off", spellcheck: false, style: { width: "90px" },
      oninput: (ev) => {
        const v = ev.target.value.replace(/[^0-9.,\-]/g, "").slice(0, 12);
        if (v !== ev.target.value) ev.target.value = v;
        change(`${base}.anim_above`, v); renderPanels(); refreshAnimState();
      } })),
      "Nur für Zahlen, z. B. Leistung in W: läuft, wenn der Wert darüber liegt. Leer = über 0"),
    el("div", { class: "row" }, el("div", { class: "label" }, "Gerade",
      el("small", {}, "„an“ zählt bei: on, open, playing, running, active, washing, drying … oder eine Zahl über der Schwelle")),
    el("span", { class: "state anim-state" + (on ? " on" : ""), "data-anim": base }, raw === "" ? "–" : on ? "an / läuft" : "aus")));
  return rows;
}
// „Gerade an / aus“ neu setzen, ohne das Eingabefeld neu aufzubauen
function refreshAnimState() {
  document.querySelectorAll("[data-anim]").forEach((n) => {
    const o = getPath(S.draft, n.dataset.anim);
    if (!o) return;
    const raw = o.anim_entity ? haStr(o.anim_entity) : o.entity ? haStr(o.entity, (o.attribute || "").trim() || undefined) : "";
    const on = S.R.isAct(raw, S.R.animThr(o));
    n.textContent = raw === "" ? "–" : on ? "an / läuft" : "aus";
    n.classList.toggle("on", on);
  });
}
function iconRows(base) {
  const o = getPath(S.draft, base);
  return [row("Icon", iconField(base)),
    iconUsesColor(o.icon) && row("Farbe des Fahrzeugs", el("input", { type: "color", value: o.icon_color || "#0a84ff",
      oninput: (e) => { setPath(S.draft, `${base}.icon_color`, e.target.value); updateSavebar(); renderPanels(); },
      onchange: () => render() }), "Lack-Farbe – Scheiben, Reifen und Lichter bleiben")];
}
const animCfg = () => Object.assign({ style: "fade", ms: 600, ease: "smooth" }, S.draft.settings.anim || {});
// Übergang für ein Panel: {prev, t0} -> trans-Objekt für renderFrame (oder null, wenn fertig)
function transAt(tr, now = performance.now()) {
  const a = animCfg();
  if (!tr || a.style === "none") return null;
  const el = now - tr.t0;
  if (el >= a.ms) return null;
  return { prev: tr.prev, p: Math.max(0, Math.trunc(el * 1000 / a.ms)), style: a.style, ease: a.ease };
}
let animLoop = 0;
function animate() {
  if (animLoop) return;
  const step = () => {
    renderPanels();
    const busy = (S.trans && transAt(S.trans)) || [...panels].some((p) => p.live && p.panel.canvas.isConnected);
    animLoop = busy ? requestAnimationFrame(step) : 0;
  };
  animLoop = requestAnimationFrame(step);
}

// ================================================================ Bedingungen (spiegelt die C++-Logik)
const OPS = [[">", "größer als"], ["<", "kleiner als"], [">=", "mindestens"], ["<=", "höchstens"], ["==", "ist gleich"], ["!=", "ist nicht"]];
const OP_SYM = { ">": ">", "<": "<", ">=": "≥", "<=": "≤", "==": "=", "!=": "≠" };
const isNumStr = (v) => /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(String(v ?? "").trim());
const validCond = (c) => !!(c && c.entity && OP_SYM[c.op] && String(c.value ?? "").trim() !== "");
const condState = {}; // pageId -> { since, wasOk }
function condTrue(c) {
  const e = S.byId[c.entity];
  return S.R.geo.condTrue(c, e ? e.state : "");
}
function pageOk(p, now) {
  if (!p.enabled) return false;
  const tv = p.type !== "timer" || S.R.geo.timerVisible(S.timers[p.id], p.options, now);
  const c = p.condition;
  if (!validCond(c)) return tv;
  const st = (condState[p.id] ||= { since: 0 });
  if (condTrue(c)) { if (!st.since) st.since = now + 1; } else st.since = 0;
  return tv && !!st.since && now + 1 - st.since >= (c.hold || 0) * 1000;
}
// ---- Timer: Restzeit wie auf dem ESP im 1-s-Takt mitrechnen
function forEachTimer(cb) {
  for (const p of S.draft.pages) {
    if (p.type === "timer") cb(p.id, p.options);
    if (p.type === "stack") (p.options.fields || []).forEach((f, k) => f && f.type === "timer" && cb(`${p.id}#${k}`, f.options || {}));
  }
}
function haStr(eid, attr) {
  const e = S.byId[eid];
  if (!e) return "";
  if (!attr) return e.state == null ? "" : String(e.state);
  const v = (e.attributes || {})[attr];
  return v === undefined || v === null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
}
function tickTimers(now) {
  const ep = Math.floor(now / 1000);
  forEachTimer((key, o) => { S.timers[key] ||= {}; S.R.geo.timerStep(S.timers[key], o, haStr, now, ep); });
}
// Vorschau: echte Timer + „Beispiel zeigen“ (läuft 12:34 herunter)
function timerView() {
  const out = Object.assign({}, S.timers);
  const t = Math.floor(Date.now() / 1000);
  for (const [k, v] of S.timerDemo) out[k] = v === "done" ? { rem: 0, max: 1800, done: (Date.now() - 5000) >>> 0, pz: false } : { rem: 754 - (t % 754), max: 1800, done: 0, pz: false };
  return out;
}
const timerText = (m) => {
  if (!m || m.rem < 0) return m && m.done ? "fertig" : "läuft gerade nicht";
  if (m.rem === 0) return "fertig";
  const r = m.rem, t = r >= 3600 ? `${Math.floor(r / 3600)}:${String(Math.floor(r / 60) % 60).padStart(2, "0")}:${String(r % 60).padStart(2, "0")}` : `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`;
  return (m.pz ? "pausiert · noch " : "läuft · noch ") + t;
};
function condText(c) {
  if (!validCond(c)) return "";
  const e = S.byId[c.entity];
  const opening = e && e.domain === "binary_sensor" && ["door", "window", "opening", "garage_door"].includes((e.attributes || {}).device_class);
  const val = isNumStr(c.value) ? Number(c.value).toLocaleString(LOCALE)
    : opening && c.value === "on" ? "offen" : opening && c.value === "off" ? "zu" : c.value;
  const hold = c.hold ? ` · seit ${fmtDur(c.hold)}` : "";
  return `${e ? e.name : c.entity} ${OP_SYM[c.op]} ${val}${hold}`;
}

// Rotation wie auf dem ESP (1-s-Takt): Seiten, die nebeneinander passen, laufen zusammen,
// feste Seiten bleiben stehen, solange ihr Bereich frei ist.
function resetRotation() { S.rotation = { lead: -2, elapsed: 0, wasOk: [] }; tickRotation(false); }
function tickRotation(advance = true) {
  const pages = S.draft.pages;
  const now = Date.now();
  const g = geom();
  tickTimers(now);
  let ok = pages.map((p) => pageOk(p, now));
  // Ruhezeit wie auf dem ESP (Vorschau)
  const qc = S.R.geo.quietCfg(S.draft.settings, pages);
  // „Nacht ansehen“: nur die Vorschau – wie der Schalter „Nachtmodus“, unabhängig von den Ruhezeit-Uhrzeiten
  S.quiet = Object.assign(S.nightView ? S.R.geo.quietEval(Object.assign({}, qc, { enabled: false }), 0, true)
    : S.R.geo.quietEval(qc, S.R.geo.weekSec(new Date(now)), false), { enabled: qc.enabled });
  ok = S.R.geo.quietPages(ok, qc, S.quiet);
  ok = S.R.geo.timerFocus(ok, pages, S.timers, S.draft.settings, now);
  const areas = pages.map((p) => g.areaOf(p));
  const sticky = pages.map(() => false);
  const interrupt = pages.map((p) => !!(p.condition && p.condition.interrupt && validCond(p.condition))
    || (p.type === "timer" && p.options.only_running !== false && p.options.interrupt !== false));
  const r = S.rotation;
  const before = rotationItems();
  const oldVis = JSON.stringify(r.vis || []);
  const { vis, gdur } = S.R.geo.rotate(r, { ok, sticky, interrupt, durs: pages.map((p) => p.duration), areas, advance });
  Object.assign(r, { vis, ok, gdur, areas });
  if (advance && oldVis !== JSON.stringify(vis) && animCfg().style !== "none") { S.trans = { prev: before, t0: performance.now() }; animate(); }
  updateTimeline();
}
const rotationItems = () => (S.draft.active && S.rotation.vis
  ? S.draft.pages.map((p, i) => S.rotation.vis[i] && { page: p, area: S.rotation.areas[i] }).filter(Boolean) : []);
function updateTimeline() {
  const tl = $("#timeline");
  if (!tl) return;
  const pages = S.draft.pages;
  const r = S.rotation;
  const ok = r.ok || [], vis = r.vis || [];
  [...tl.children].forEach((d) => {
    const i = +d.dataset.i;
    d.classList.toggle("off", !ok[i]);
    d.firstChild.style.width = vis[i] ? `${Math.min(100, ((r.elapsed + 1) / r.gdur) * 100)}%` : "0";
  });
  const info = $("#rot-info");
  if (!info) return;
  const shown = pages.filter((p, i) => vis[i]);
  const hidden = pages.filter((p, i) => p.enabled && !ok[i]).length;
  const moving = ok.filter(Boolean).length;
  if (!shown.length && (r.idx === -2 || ok.some(Boolean))) { info.replaceChildren("…"); return; }
  if (!shown.length) { info.replaceChildren(el("b", {}, "Leer"), " · keine Seite erfüllt gerade ihre Bedingung"); return; }
  info.replaceChildren(el("b", {}, shown.map((p) => p.name).join(" + ")),
    moving > 1 ? ` · Wechsel in ${fmtDur(Math.max(0, r.gdur - r.elapsed))}` : "",
    hidden ? ` · ${hidden} ausgeblendet` : "");
  document.querySelectorAll("[data-cond-page]").forEach((n) => {
    const i = pages.findIndex((p) => p.id === n.dataset.condPage);
    if (i >= 0) n.classList.toggle("met", !!ok[i]);
  });
}

// ================================================================ Bedingung bearbeiten
function openConditionEditor(page) {
  const c = clone(page.condition || {});
  c.op ||= ">"; c.hold ||= 0;
  const close = () => ov.remove();
  const body = el("div");
  const draw = () => {
    const e = S.byId[c.entity];
    const quick = e ? (["binary_sensor", "switch", "light", "input_boolean", "fan"].includes(e.domain) ? ["on", "off"]
      : e.domain === "person" || e.domain === "device_tracker" ? ["home", "not_home"]
        : e.domain === "cover" ? ["open", "closed"] : e.domain === "lock" ? ["locked", "unlocked"] : []) : [];
    const valIn = el("input", { class: "field", style: { width: "140px" }, value: c.value ?? "", placeholder: e && isNumStr(e.state) ? e.state : "Wert",
      oninput: (ev) => { c.value = ev.target.value; status(); } });
    const hm = el("input", { class: "field", type: "number", min: 0, max: 1440, value: Math.floor((c.hold || 0) / 60), style: { width: "54px" } });
    const hs = el("input", { class: "field", type: "number", min: 0, max: 59, value: (c.hold || 0) % 60, style: { width: "54px" } });
    [hm, hs].forEach((x) => (x.oninput = () => { c.hold = (parseInt(hm.value, 10) || 0) * 60 + (parseInt(hs.value, 10) || 0); }));
    const stat = el("div", { class: "group-foot" });
    const status = () => {
      if (!validCond(c)) { stat.replaceChildren("Entität, Vergleich und Wert angeben."); return; }
      const met = condTrue(c);
      stat.replaceChildren(el("span", { class: "dot " + (met ? "ok" : "") , style: { display: "inline-block", marginRight: "6px" } }),
        `Gerade: ${fmtState(e)} → ${met ? "erfüllt" : "nicht erfüllt"}`,
        e && e.domain === "binary_sensor" ? " · Tür-/Fensterkontakt: on = offen, off = zu" : "");
    };
    body.replaceChildren(
      el("div", { class: "card" },
        row("Entität", el("button", { class: "entity-btn" + (c.entity ? "" : " empty"), onclick: () => openPicker({ current: c.entity, onpick: (v) => { c.entity = v; draw(); } }) },
          el("span", { class: "t" }, e ? e.name : c.entity || "Entität wählen …"), el("span", { class: "chev", html: SVG.chev }))),
        row("Vergleich", el("select", { class: "field", onchange: (ev) => { c.op = ev.target.value; status(); } },
          OPS.map(([v, l]) => el("option", { value: v, selected: v === c.op }, `${OP_SYM[v]}  ${l}`)))),
        row("Wert", el("span", { style: { display: "flex", gap: "6px", alignItems: "center" } },
          quick.map((q) => el("button", { class: "chip" + (String(c.value) === q ? " on" : ""), onclick: () => { c.value = q; if (!["==", "!="].includes(c.op)) c.op = "=="; draw(); } }, q)), valIn),
          "Zahl (z. B. 50000) oder Zustand (on, off, home …)"),
        row("Erfüllt seit mindestens", el("span", { class: "dur" }, hm, "min", hs, "s"), "0 = sofort"),
        row("Sofort zeigen", (() => {
          const inp = el("input", { type: "checkbox", checked: !!c.interrupt, onchange: (ev) => (c.interrupt = ev.target.checked) });
          return el("label", { class: "switch" }, inp, el("span"));
        })(), "Springt direkt auf diese Seite, sobald die Bedingung eintritt"),
      ), stat);
    status();
  };
  const ov = el("div", { class: "overlay", onclick: (e) => e.target === ov && close() },
    el("div", { class: "sheet" },
      el("div", { class: "sheet-head" }, el("h3", {}, `„${page.name}“ nur anzeigen, wenn …`),
        el("div", { style: { color: "var(--text-2)" } }, "Das Panel prüft die Bedingung selbst und blendet die Seite live ein und aus.")),
      el("div", { class: "sheet-body" }, body),
      el("div", { class: "sheet-foot" },
        page.condition && validCond(page.condition) && el("button", { class: "btn danger", onclick: () => { delete page.condition; close(); afterCondChange(); } }, "Bedingung entfernen"),
        el("button", { class: "btn", onclick: close }, "Abbrechen"),
        el("button", { class: "btn primary", onclick: () => {
          if (!validCond(c)) { toast("Bitte Entität, Vergleich und Wert angeben"); return; }
          if ([">", "<", ">=", "<="].includes(c.op) && !isNumStr(c.value)) { toast("Für größer/kleiner bitte eine Zahl eingeben"); return; }
          c.value = String(c.value).trim();
          page.condition = c; delete condState[page.id]; close(); afterCondChange();
        } }, "Fertig"))));
  document.body.append(ov);
  draw();
}
function afterCondChange() { updateSavebar(); resetRotation(); render(); }
function condChip(p) {
  const has = validCond(p.condition);
  return el("button", { class: "cond-chip" + (has ? " has" : ""), "data-cond-page": has ? p.id : null, title: has ? "Bedingung bearbeiten" : "Seite nur unter einer Bedingung anzeigen",
    onclick: (e) => { e.stopPropagation(); openConditionEditor(p); } },
  has ? el("span", { class: "dot" }) : null, has ? condText(p.condition) : "＋ Bedingung");
}
const fmtDur = (s) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} min` : `${s} s`);

// ================================================================ Bausteine
// ---- „Einfach erklärt“: ausführliche Erklärungen für Einsteiger (Schalter oben in den Einstellungen)
S.explain = (() => { try { return localStorage.getItem("pp-explain") === "1"; } catch (e) { return false; } })();
const GROUP_EXPLAIN = {
  "Zu langer Text": "Dieser Bereich erscheint nur, wenn auf dieser Seite gerade etwas nicht auf die Fläche passt – z. B. ein langer Titel oder „WOLKIG“ in einem kleinen Feld. Hier entscheidest du, ob der Text durchläuft, abgekürzt wird oder ganz wegfällt.",
  "Angemeldete Geräte": "Alle Handys, Tablets und anderen Computer, die gerade im Studio angemeldet sind. Verlierst du ein Gerät oder willst jemandem den Zugang nehmen, meldest du es hier einzeln ab.",
  "Laufschrift": "Wie die Laufschrift läuft: Geschwindigkeit und ob sie am Anfang kurz anhält oder endlos wie ein Nachrichtenticker durchläuft.",
  "Ansicht": "Wie die Termine auf dem Panel aussehen: als übersichtliche Liste wie im Handy-Kalender oder groß mit Laufschrift.",
  "Zeit": "Alles rund um die Uhrzeit: in welcher Zeitzone das Panel lebt und ob es die Zeit als 14:30 oder 2:30 PM schreibt.",
  "Ruhezeit": "Nachts muss das Panel nicht leuchten. Hier legst du für jeden Wochentag fest, wann es ausgeht oder nur ganz schwach leuchtet. Das Panel macht das selbst – auch wenn der PC aus ist.",
  "Abenddimmung": "Damit das Panel abends nicht blendet: Vor Beginn der Ruhezeit wird es langsam dunkler. So ist der Übergang in die Nacht sanft statt plötzlich.",
  "Seitenwechsel": "Wie das Panel von einer Seite zur nächsten wechselt – zum Beispiel weich überblenden oder zur Seite schieben. Rein optisch, an den Inhalten ändert sich nichts.",
  "Feinschliff": "Kleine Stellschrauben für den Seitenwechsel: wie lange er dauert und ob er sanft oder gleichmäßig läuft.",
  "Läuft das flüssig?": "Ein kleiner ESP32 hat nicht unendlich viel Rechenkraft und Speicher. Hier siehst du, ob deine Auswahl auf deinem Board flüssig läuft und wie viel Speicher noch frei ist.",
  "Seiten & Reihenfolge": "Das Panel zeigt deine Seiten nacheinander, wie eine Diashow. Hier schaltest du Seiten an oder aus, änderst die Reihenfolge und wie lange jede stehen bleibt.",
  "Datenquelle": "Woher die Seite ihre Werte bekommt – meistens eine Entität aus Home Assistant, also ein Sensor, ein Licht, ein Kalender usw.",
  "Darstellung": "Was genau auf dem Panel zu sehen ist – Titel, Icon, Einheit und kleine Extras.",
  "Größe & Platzierung": "Wie groß Schrift und Icons sind und wo der Inhalt auf der Fläche sitzt. Das Panel verkleinert automatisch, damit nie etwas abgeschnitten wird.",
  "Farben": "Die Farben auf dem Panel. Tipp: Kräftige Farben wirken auf LEDs am besten – Pastelltöne sehen schnell blass aus.",
  "Wann erscheint die Seite?": "Ein Timer muss nicht dauernd zu sehen sein. Hier legst du fest, ob er nur auftaucht, solange er läuft, und ob er dann sofort nach vorne springt.",
  "Wenn mehrere Timer laufen": "Laufen zum Beispiel Backofen und Waschmaschine gleichzeitig, entscheidest du hier: immer den, der zuerst fertig wird, oder beide im Wechsel.",
  "Inhalt": "Was als Laufschrift durchläuft: entweder ein Text, den du selbst eintippst, oder ein Wert aus Home Assistant – zum Beispiel der Titel des Liedes, das gerade läuft.",
  "Kalender": "Die Kalender aus Home Assistant (z. B. Google- oder iCloud-Kalender, Müllabfuhr), deren nächste Termine das Panel zeigt.",
  "Helfer-Sensor": "Ein Kalender in Home Assistant verrät von sich aus nur den nächsten Termin. Mit einem kleinen Helfer bekommt das Panel eine Liste mit mehreren kommenden Terminen – die Anleitung führt dich Schritt für Schritt hin.",
  "Icon": "Ein kleines Bild neben dem Wert, zum Beispiel ein Wassertropfen oder ein Auto. Die Farbe kannst du bei manchen Icons selbst wählen.",
  "Einträge": "Die Werte, die in der Liste untereinander stehen. Jede Zeile hat eine kurze Beschriftung links und den Wert rechts.",
  "Zweite Zeile (optional)": "Ein kleiner Zusatzwert unter dem großen Wert – zum Beispiel die Veränderung seit gestern.",
  "Aufteilung": "Ein Stapel teilt das Panel in mehrere Felder – so siehst du mehrere Dinge gleichzeitig, z. B. links die Uhr und rechts das Wetter.",
  "Felder": "Was in jedem Feld des Stapels angezeigt wird. Jedes Feld funktioniert wie eine eigene kleine Seite.",
  "Fortschritt": "Wie weit der Timer schon ist – als Balken, der sich bis zum Ende füllt.",
  "Feedback & Ideen": "Hier kannst du Fehler melden oder Wünsche für neue Funktionen schicken. Technische Infos helfen bei Fehlern sehr – Passwörter und Schlüssel werden dabei nie mitgeschickt.",
  "Home Assistant": "Home Assistant ist die Zentrale deines Smart Homes. Das Studio holt sich von dort alle Werte (Temperaturen, Lichter, Timer …), die später auf dem Panel stehen. Dafür braucht es die Adresse und einen Schlüssel.",
  "Panel": "Hier beschreibst du dein LED-Panel: wie groß es ist, wie viele du aneinander gesteckt hast und wie herum es hängt. Danach richtet sich alles, was auf dem Panel gezeichnet wird.",
  "Stromversorgung": "LEDs brauchen viel Strom – ein ganz weißes 64×64-Panel bis zu 4 Ampere. Ist das Netzteil zu schwach, flackert das Bild oder der ESP startet neu. Darum rechnet das Panel jedes Bild durch und dimmt automatisch, bevor es zu viel wird.",
  "Hardware": "Der ESP32 ist der kleine Mini-Computer, der das Panel steuert. Wähle hier genau das Board, das du hast – dann stimmen die Anschlüsse automatisch. Wie du alles verbindest, zeigt die Anleitung.",
  "Übertragung": "So kommt deine Einstellung als Programm (Firmware) auf den ESP32. Beim allerersten Mal per USB-Kabel, danach automatisch über WLAN.",
  "WLAN": "Damit sich das Panel mit deinem Heimnetz verbindet. Es muss ein 2,4-GHz-WLAN sein – 5 GHz kann der ESP32 nicht.",
  "Sicherheit": "Diese Schlüssel sorgen dafür, dass nur dein Home Assistant mit dem Panel sprechen darf und niemand sonst neue Software aufspielen kann.",
  "Erscheinungsbild": "Nur das Aussehen dieser Oberfläche – auf das Panel hat das keinen Einfluss.",
  "Gerät": "Unter diesen Namen findest du das Panel im Netzwerk und in Home Assistant.",
  "Sprache": "Die Oberfläche und das Panel haben getrennte Sprachen – du kannst z. B. das Studio auf Englisch bedienen und auf dem Panel deutsche Wochentage zeigen.",
  "Zugriff vom Handy & Tablet": "Normalerweise kommt nur dieser PC ins Studio. Wenn du es auch am Handy oder iPad bedienen willst, legst du hier einen Benutzernamen und ein Passwort fest und schaltest „Im WLAN freigeben“ ein. Am PC selbst brauchst du nie ein Passwort.",
};
const EXPLAIN = {
  "Wenn Text nicht passt": "Was passiert, wenn ein Text nicht auf die Fläche passt: „Laufschrift“ – er wird erst kleiner und läuft dann von rechts nach links durch. „Abkürzen“ – er bleibt stehen und wird am Ende abgeschnitten. „Ausblenden“ – Nebenzeilen wie „WOLKIG“, das Datum oder der Titel fallen ganz weg, der Hauptwert bleibt.",
  "Geschwindigkeit": "Wie schnell der Text durchläuft. „Normal“ ist gut lesbar; auf großen Panels darf es auch „Schnell“ sein.",
  "Titel passt nicht ganz": "Der Titel ist zu lang für die Fläche. „Laufschrift“: Er läuft von rechts nach links durch und ist komplett lesbar. „Abkürzen“: Er bleibt stehen und wird am Ende abgeschnitten.",
  "Durchlauf": "„Mit Pause“: Die Laufschrift hält am Anfang kurz an, damit man den Anfang in Ruhe lesen kann. „Endlos“: Sie läuft ohne Halt durch wie ein Nachrichtenticker – zwischen Ende und Anfang steht ein kleiner Punkt.",
  "Darstellung": "„Liste“: wie im Handy-Kalender – eine Zeile pro Tag (HEUTE, MORGEN, DO 15.10.) und darunter die Termine mit farbigem Punkt und Uhrzeit. „Groß“: wenige Termine in großer Schrift, lange Titel laufen durch.",
  "Ausblenden": "Termine, deren Titel eines dieser Wörter enthält, kommen nicht aufs Panel – z. B. „WKT Frei“ oder „Geburtstag“. Mehrere Wörter mit Komma trennen. Groß-/Kleinschreibung ist egal.",
  "Passwort fürs Handy": "Das Passwort, mit dem du dich am Handy oder Tablet anmeldest. Mindestens 8 Zeichen. Es wird nur verschlüsselt gespeichert – nicht einmal das Studio kennt es im Klartext.",
  "Neues Passwort": "Nur ausfüllen, wenn du das Passwort fürs Handy ändern willst. Das alte musst du dafür nicht kennen – am PC bist du ja schon der Besitzer. Danach müssen sich alle Geräte neu anmelden.",
  "Passwort wiederholen": "Das gleiche Passwort noch einmal – so fallen Tippfehler auf.",
  "Uhrzeit-Format": "24 Stunden (14:30) wie in Deutschland üblich oder 12 Stunden mit AM/PM (2:30 PM) wie in den USA. Gilt überall: auf der Uhr, bei Timer-Endzeiten, Terminen und den Ruhezeiten.",
  "Sprache der Oberfläche": "In welcher Sprache dieses Studio angezeigt wird. Ändert nichts am Panel.",
  "Sprache auf dem Panel": "In welcher Sprache das LED-Panel selbst schreibt – Wochentage, HEUTE/TODAY, FERTIG/DONE, AN/AUS. Unabhängig von der Sprache dieser Oberfläche.",
  "Ruhezeit": "Zeiten, in denen das Panel aus ist oder nur ganz schwach leuchtet – zum Beispiel nachts im Schlafzimmer.",
  "Abenddimmung": "Vor der Ruhezeit wird das Panel nach und nach dunkler, damit es abends nicht blendet.",
  "Helligkeit gedimmt": "Wie hell das Panel in der Ruhezeit im Modus „Gedimmt“ noch leuchtet. 5 % reicht nachts meist, um die Uhrzeit zu lesen.",
  "Helligkeit gedimmt & Nacht": "Wie hell das Panel in der Ruhezeit mit „Gedimmt“ oder „Nacht“ noch leuchtet. 3–5 % reicht nachts meist, um die Uhrzeit zu lesen. Ganz unten (1 %) können feine Linien verschwinden.",
  "Nachtmodus": "Nachts blendet rotes Licht viel weniger als weißes oder blaues. Im Nachtmodus wird das Panel gedimmt und zeigt alles in Rot – Uhr, Wetter, Icons. Er kommt entweder zu den Zeiten der Ruhezeit („Nacht“) oder über den Schalter „Nachtmodus“ in Home Assistant.",
  "Nacht ansehen": "Schaltet nur die Vorschau hier in den Nachtmodus, damit du siehst, wie das Panel nachts aussieht. Am Panel ändert sich dadurch nichts.",
  "Helligkeit im Nachtmodus": "Wie hell das Panel leuchtet, wenn du den Nachtmodus in Home Assistant einschaltest.",
  "Helligkeit abends": "Auf wie viel Prozent das Panel bis zum Beginn der Ruhezeit herunterdimmt.",
  "Sanft abdunkeln": "An: Das Panel wird gleichmäßig über die eingestellte Zeit dunkler. Aus: Es springt zur Startzeit direkt auf die Abend-Helligkeit.",
  "Aktive Seiten": "Welche Seiten während der gedimmten Ruhezeit zu sehen sind. Nachts reicht oft die Uhr – alles andere pausiert bis zum Morgen.",
  "Beginn": "Ab wann vor der Ruhezeit das Dimmen anfängt.",
  "Helligkeit (max.)": "Die höchste Helligkeit des Panels. Wirkt sofort – auch auf allen anderen geöffneten Geräten. Wird das Netzteil knapp, dimmt das Panel zusätzlich von selbst.",
  "Panel an": "Schaltet das Panel sofort an oder aus – ohne Speichern und ohne Übertragen. Geht auch in Home Assistant über den Schalter „Anzeige“.",
  "Im WLAN freigeben": "Erlaubt Handys und Tablets in deinem WLAN, das Studio zu öffnen – aber nur mit Benutzername und Passwort. Aus dem Internet ist es nie erreichbar.",
  "Benutzername": "Der Name, mit dem du dich am Handy oder Tablet anmeldest. Frei wählbar.",
  "Dashboard-Passwort": "Nur nötig, wenn dein ESPHome Device Builder ein eigenes Passwort hat. In Home Assistant ist das normalerweise nicht so – dann leer lassen.",
  "Dashboard-Benutzer": "Nur nötig, wenn dein ESPHome Device Builder Benutzername und Passwort verlangt. Sonst leer lassen.",
  "Angemeldet als": "Mit diesem Namen bist du gerade auf diesem Gerät angemeldet. „Abmelden“ beendet die Anmeldung nur hier.",
  "Ersatz-WLAN": "Findet das Panel dein WLAN nicht (z. B. neues Passwort), öffnet es ein eigenes kleines WLAN. Mit diesem Passwort verbindest du dich dann mit dem Handy und trägst das neue WLAN ein. Es wird automatisch erzeugt – du musst es dir nicht merken, es steht immer hier.",
  "Zu lange Texte laufen lassen": "An: Passt ein Text nicht auf das Panel, läuft er als Laufschrift durch. Aus: Er wird verkleinert und notfalls gekürzt.",
  "Immer laufen lassen": "An: Der Text läuft immer, auch wenn er kurz genug wäre. Aus: Kurze Texte stehen still, nur lange laufen.",
  "Quelle": "Woher der Text kommt: ein fester Text, den du eintippst, oder ein Wert aus Home Assistant, der sich von selbst aktualisiert.",
  "Text": "Der Text für die Laufschrift. Ä, Ö, Ü, € und ° zeigt das Panel richtig an; ß wird zu „SS“, Emojis und seltene Sonderzeichen fallen weg.",
  "Davor (optional)": "Ein kurzer Text, der immer vor dem Wert steht – zum Beispiel „Jetzt läuft: “.",
  "Termine aus": "„Kalendern“: Von jedem gewählten Kalender kommt der nächste Termin aufs Panel. „Helfer-Sensor“: Eine Liste mit mehreren kommenden Terminen – dafür legst du einmalig einen Helfer in Home Assistant an.",
  "Termine zeigen": "Wie viele kommende Termine höchstens auf dem Panel stehen. Was nicht passt, lässt das Panel automatisch weg.",
  "Sensor": "Der Helfer-Sensor „PixelPanel Termine“, den du mit der Anleitung in Home Assistant angelegt hast.",
  "Einrichten": "Öffnet die Schritt-für-Schritt-Anleitung samt fertigem Text zum Kopieren für Home Assistant.",
  "Titel der Termine": "Die Farbe für den Namen des Termins. Datum und Uhrzeit stehen in der Farbe des jeweiligen Kalenders darüber.",
  "Werte": "„Panel zeichnet auf“: Das Panel merkt sich den Wert selbst über die gewählte Zeit – auch nach einem Neustart. „Liste aus Attribut“: Home Assistant liefert schon eine fertige Reihe von Werten, z. B. die Strompreise für die nächsten Stunden.",
  "Zeitraum": "Wie weit das Diagramm zurückblickt: 6 Stunden bis 7 Tage. Das Diagramm hat 48 Punkte – jeder Punkt ist der Durchschnitt seines Zeitabschnitts.",
  "Attribut mit Liste": "Das Attribut der Entität, in dem die Werte-Reihe steht. Bei Strompreis-Integrationen heißt es oft „today“, „forecast“ oder „prices“.",
  "Schlüssel (optional)": "Steht in der Liste mehr als nur eine Zahl pro Eintrag (z. B. Uhrzeit und Preis), sagt der Schlüssel, welche Zahl gemeint ist. Leer lassen – meistens findet das Studio sie automatisch.",
  "Art": "Wie die Werte gezeichnet werden: als durchgehende Linie mit leichter Fläche darunter oder als Balken.",
  "Aktueller Wert": "Zeigt oben rechts den Wert von gerade eben.",
  "Min / Max": "Zeigt rechts am Diagramm den höchsten und den niedrigsten Wert im gezeigten Zeitraum.",
  "Diagramm & Wert": "Die Farbe der Linie bzw. Balken und des aktuellen Werts.",
  "Nur diesen Timer zeigen": "Solange dieser Timer läuft, pausieren alle anderen Seiten – das Panel zeigt nur noch den Countdown. Danach geht es normal weiter.",
  "Wechsel alle": "Laufen mehrere Timer im Vordergrund, wechselt das Panel nach so vielen Sekunden zum nächsten.",
  "Nur wenn der Timer läuft": "Die Seite erscheint nur, solange der Timer läuft – sonst wird sie übersprungen.",
  "Sofort zeigen": "Startet der Timer, springt das Panel sofort auf diese Seite, statt zu warten, bis sie in der Reihe dran ist.",
  "„FERTIG“ anzeigen": "Wie lange nach Ablauf noch „FERTIG“ auf dem Panel steht, damit du es auch siehst, wenn du kurz weg warst.",
  "Entität": "Ein einzelnes Ding in Home Assistant: ein Sensor, ein Licht, ein Kalender, ein Timer … Tippe zum Suchen einfach einen Teil des Namens.",
  "Angezeigter Wert": "Normalerweise der Zustand der Entität (z. B. 21,4 °C). Manche Entitäten haben weitere Infos (Attribute) – beim Medien-Player z. B. den Liedtitel.",
  "Titel auf dem Panel": "Ein kurzes Wort über dem Wert, z. B. „STROM“. Leer lassen, wenn du keinen Titel möchtest.",
  "Einheit": "Was hinter der Zahl steht, z. B. °C oder kWh. Leer = so, wie es Home Assistant liefert.",
  "Nachkommastellen": "Wie viele Stellen nach dem Komma angezeigt werden. „Automatisch“ zeigt eine, wenn sie etwas aussagt.",
  "Seite aktiv": "Aus = die Seite bleibt gespeichert, wird aber nicht gezeigt. Praktisch, um sie vorübergehend zu pausieren.",
  "Anzeigedauer": "Wie lange die Seite stehen bleibt, bevor die nächste kommt.",
  "Bedingung": "Die Seite nur zeigen, wenn etwas zutrifft – z. B. nur wenn die Haustür offen ist oder der Strompreis günstig.",
  "Adresse": "Die Internetadresse deines Home Assistant – genau die, die du im Browser eintippst, um Home Assistant zu öffnen. Meist http://homeassistant.local:8123 oder eine Zahlenadresse wie http://192.168.178.50:8123.",
  "Zugriffstoken": "Ein langer Schlüssel, mit dem das Studio Home Assistant lesen darf – wie ein Passwort nur für dieses Programm. So bekommst du ihn: In Home Assistant unten links auf deinen Namen klicken → oben „Sicherheit“ → ganz unten „Token erstellen“ → Namen eingeben → den angezeigten Text kopieren und hier einfügen. Er wird nur einmal angezeigt!",
  "Gerätename": "Ein kurzer Name ohne Leerzeichen, unter dem das Panel im Netzwerk erreichbar ist (z. B. „pixelpanel“). Wenn du mehrere Panels hast, braucht jedes einen eigenen Namen.",
  "Anzeigename": "So heißt das Panel in Home Assistant, z. B. „Küchen-Panel“. Darf Leerzeichen und Umlaute haben.",
  "Zeitzone": "Für die richtige Uhrzeit. In Deutschland, Österreich und der Schweiz bleibt hier „Europe/Berlin“ stehen.",
  "Methode": "Wie die Software aufs Panel kommt. „Lokal“: Dieser PC baut sie und schickt sie zum Panel. „ESPHome-Ordner“: Das Studio legt sie in den ESPHome Device Builder, du klickst dort auf „Installieren“ – der sicherste Weg. „Automatisch“ bzw. „ESPHome in HA“: Ein Klick hier, und der ESPHome Device Builder baut und überträgt alles selbst (dafür muss er im WLAN ohne Anmeldung erreichbar sein).",
  "Gerät": "Beim allerersten Übertragen steckt der ESP32 per USB-Kabel am PC – dann hier den Anschluss eintragen (z. B. COM3; im Windows-Geräte-Manager unter „Anschlüsse“ zu sehen). Danach das Feld einfach leer lassen: Das Panel wird automatisch über WLAN gefunden.",
  "Dashboard-Adresse": "Die Adresse des ESPHome Device Builders, mit :6052 am Ende. In der Home-Assistant-App einfach leer lassen.",
  "Netzwerk (SSID)": "Der Name deines WLANs – genau so, wie er im Handy bei den WLAN-Netzen steht (Groß-/Kleinschreibung beachten).",
  "Passwort": "Das WLAN-Passwort. Es bleibt auf diesem PC und im Panel, es wird nirgendwo hochgeladen.",
  "API-Schlüssel": "Ein geheimer Schlüssel, damit nur dein Home Assistant mit dem Panel spricht. Einfach auf „Neu“ klicken. Hat dein Panel schon einen (aus einer früheren ESPHome-Datei), dann genau den eintragen.",
  "OTA-Passwort": "Schützt das kabellose Aufspielen neuer Software. Optional – aber empfohlen, wenn andere in deinem WLAN sind.",
  "Modul": "Die Auflösung EINES Panels in Pixeln – steht auf dem Aufkleber hinten oder in der Produktbeschreibung (z. B. „64x64“). Zählen geht auch: Leuchtpunkte in einer Reihe.",
  "Pixelabstand": "Der Abstand zwischen zwei Leuchtpunkten in Millimetern – steht als „P2“, „P2.5“, „P3“ … auf dem Panel. Wichtig nur für die Größen- und Leseabstands-Angabe.",
  "Eigene Anordnung": "Wenn du mehrere Panels zu einer großen Fläche zusammensteckst: wie viele nebeneinander und wie viele übereinander.",
  "Ketten-Layout": "Panels werden mit Flachbandkabeln hintereinander verbunden (der Ausgang des einen in den Eingang des nächsten). Hier steht, in welcher Reihenfolge – „Automatisch“ passt fast immer. Ist das Bild vertauscht, probier eine andere Einstellung.",
  "Drehung": "Hängt das Panel quer, hochkant oder auf dem Kopf, drehst du hier das Bild mit.",
  "Netzteil": "Die Angaben vom Aufkleber deines Netzteils: Volt (V) muss 5 sein. Ampere (A) sagt, wie viel Strom es liefern kann – mehr ist besser. Ein Handy-Ladegerät hat oft nur 2–3 A, ein richtiges LED-Netzteil 10 A oder mehr.",
  "Strom pro Modul bei Vollweiß": "Wie viel Strom ein Panel zieht, wenn alle LEDs voll weiß leuchten. Steht im Datenblatt des Panels. Weißt du es nicht, einfach leer lassen – dann wird mit einem sicheren Schätzwert gerechnet.",
  "Treiberchip": "Ein Bauteil auf der Rückseite des Panels. Fast immer passt „Standard“. Zeigt das Panel nach dem Übertragen nichts, falsche Farben oder Geisterbilder, stell hier „FM6126A“ ein und übertrage erneut.",
  "Pin-Belegung": "Welcher Anschluss des ESP32 mit welchem Kontakt am Panel verbunden ist. Bei fertigen Boards stimmt das automatisch – bei eigener Verkabelung musst du genau so verkabeln, wie es hier steht.",
  "Modus": "Hell, dunkel oder automatisch wie bei Windows – nur für diese Oberfläche.",
  "Textgröße": "Wie groß Schrift und Zahlen auf dem Panel sind. Ganz rechts ist das Größte, was auf die Fläche passt, ganz links die kleine Mini-Schrift. Nebenzeilen wie Datum oder „WOLKIG“ passen sich automatisch an: Ist kein Platz, werden nur sie kleiner (bis Mini) und dann kurz geschrieben („DI 13.“ statt „DI 13.10.“). Erst wenn auch das nicht reicht, greift „Zu langer Text“.",
  "Platzierung": "Wo der Inhalt auf seiner Fläche sitzt – oben, Mitte, unten, links oder rechts.",
  "Dauer": "Wie lange ein Übergang zwischen zwei Seiten dauert. 0,5 Sekunden wirkt elegant, länger wirkt verträumt.",
  "Bewegung": "„Sanft“ startet langsam, wird schneller und bremst am Ende ab – wirkt natürlicher. „Gleichmäßig“ läuft mit konstanter Geschwindigkeit.",
};
function setExplain(on) {
  S.explain = on;
  try { localStorage.setItem("pp-explain", on ? "1" : "0"); } catch (e) { /* privat */ }
  render();
}
function group(title, rows, foot) {
  if (Array.isArray(rows) && !rows.flat(Infinity).some(Boolean)) return null;
  return el("section", { class: "group" },
    title && el("h4", { class: "group-title" }, title),
    S.explain && title && GROUP_EXPLAIN[title] && el("div", { class: "explain-intro" }, el("span", { class: "bulb-i" }, "💡"), GROUP_EXPLAIN[title]),
    el("div", { class: "card" }, rows),
    foot && el("p", { class: "group-foot" }, foot));
}
function row(label, control, sub, attrs = {}) {
  const ex = S.explain && typeof label === "string" && EXPLAIN[label];
  return el("div", { class: "row" + (ex ? " has-explain" : ""), ...attrs },
    el("div", { class: "label" }, label, sub && el("small", {}, sub), ex && el("div", { class: "explain" }, ex)), control);
}
function toggle(path, onchange) {
  const inp = el("input", { type: "checkbox", checked: !!getPath(S.draft, path),
    onchange: (e) => { change(path, e.target.checked); onchange && onchange(e.target.checked); } });
  return el("label", { class: "switch" }, inp, el("span"));
}
function textField(path, { placeholder = "", type = "text", wide = true, transform, after } = {}) {
  return el("input", { class: "field" + (wide ? " wide" : ""), type, placeholder, value: getPath(S.draft, path) ?? "",
    autocomplete: "off", spellcheck: false,
    oninput: (e) => { change(path, transform ? transform(e.target.value) : e.target.value); after && after(); } });
}
function seg(path, options) {
  const cur = getPath(S.draft, path);
  return el("div", { class: "seg" }, options.map(([v, l]) =>
    el("button", { class: v === cur ? "on" : "", onclick: () => change(path, v, true) }, l)));
}
function colorField(path) {
  return el("input", { type: "color", value: getPath(S.draft, path) || "#ffffff", oninput: (e) => change(path, e.target.value) });
}
function selectField(path, options) {
  const cur = String(getPath(S.draft, path));
  return el("select", { class: "field", onchange: (e) => change(path, e.target.value) },
    options.map(([v, l]) => el("option", { value: v, selected: String(v) === cur }, l)));
}
function durationField(page) {
  const m = el("input", { class: "field", type: "number", min: 0, max: 60, value: Math.floor(page.duration / 60) });
  const s = el("input", { class: "field", type: "number", min: 0, max: 59, value: page.duration % 60 });
  const upd = () => {
    let v = (parseInt(m.value, 10) || 0) * 60 + (parseInt(s.value, 10) || 0);
    v = Math.max(5, Math.min(3600, v));
    page.duration = v;
    updateSavebar(); updateTimeline(); renderSidebar();
  };
  const norm = () => { m.value = Math.floor(page.duration / 60); s.value = page.duration % 60; };
  [m, s].forEach((i) => { i.oninput = upd; i.onblur = norm; });
  return el("span", { class: "dur", title: "Anzeigedauer in der Rotation (min. 5 s)" }, m, "min", s, "s");
}
function entityButton(path, prefer, { optional = false, placeholder = "Entität wählen …" } = {}) {
  const eid = getPath(S.draft, path);
  const e = eid && S.byId[eid];
  const label = eid ? (e ? e.name : eid) : placeholder;
  return el("button", { class: "entity-btn" + (eid ? "" : " empty"), title: eid || "",
    onclick: () => openPicker({ prefer, optional, current: eid, onpick: (v) => change(path, v, true) }) },
  eid && el("span", {}, (DOMAIN[eid.split(".")[0]] || ["", "•"])[1]),
  el("span", { class: "t" }, label), el("span", { class: "chev", html: SVG.chev }));
}
function pageIcon(p, size = 30) {
  return el("span", { class: "pico", style: { background: pageColor(p), width: size + "px", height: size + "px" }, html: pageSvg(p) });
}

// ================================================================ Entitäten-Auswahl
// Zeigt IMMER alle Entitäten; "prefer" sortiert nur passende nach oben.
function openPicker({ prefer, optional, current, onpick, title = "Entität auswählen" }) {
  let q = "";
  let domain = "";
  const list = el("div", { class: "card" });
  const chips = el("div", { class: "chips" });
  const close = () => ov.remove();
  const draw = () => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    let items = S.entities;
    if (words.length) items = items.filter((e) => words.every((w) =>
      (e.name + " " + e.entity_id + " " + e.device + " " + e.area + " " + e.integration).toLowerCase().includes(w)));
    const counts = {};
    items.forEach((e) => (counts[e.domain] = (counts[e.domain] || 0) + 1));
    chips.replaceChildren(el("button", { class: "chip" + (domain ? "" : " on"), onclick: () => { domain = ""; draw(); } }, "Alle", el("small", {}, items.length)),
      ...Object.entries(counts).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([d, n]) =>
        el("button", { class: "chip" + (domain === d ? " on" : ""), onclick: () => { domain = d; draw(); } }, (DOMAIN[d] || [d])[0], el("small", {}, n))));
    if (domain) items = items.filter((e) => e.domain === domain);
    if (prefer) items = [...items.filter(prefer), ...items.filter((e) => !prefer(e))];
    list.replaceChildren(...(items.length ? items.slice(0, 400).map((e) =>
      el("button", { class: "row pick" + (e.entity_id === current ? " sel" : ""), onclick: () => { onpick(e.entity_id); close(); } },
        el("span", { class: "ent-ico" }, (DOMAIN[e.domain] || ["", "•"])[1]),
        el("div", { class: "label" }, e.name, el("div", { class: "ent-id" }, e.entity_id + (e.device ? "  ·  " + e.device : ""))),
        el("span", { class: "state" }, fmtState(e)))) :
      [el("div", { class: "empty-state" }, el("b", {}, "Nichts gefunden"),
        S.entities.length ? "Andere Suche probieren." : "Noch keine Daten aus Home Assistant.")]));
  };
  const search = el("input", { class: "field", placeholder: `In allen ${S.entities.length} Entitäten suchen – Name, Gerät, Raum, Integration …`,
    style: { width: "100%", padding: "8px 10px" }, oninput: (e) => { q = e.target.value; draw(); } });
  const ov = el("div", { class: "overlay", onclick: (e) => e.target === ov && close() },
    el("div", { class: "sheet" },
      el("div", { class: "sheet-head" }, el("h3", {}, title), search, chips),
      el("div", { class: "sheet-body" }, list),
      el("div", { class: "sheet-foot" },
        optional && el("button", { class: "btn danger", onclick: () => { onpick(""); close(); } }, "Entfernen"),
        el("button", { class: "btn", onclick: close }, "Abbrechen"))));
  document.addEventListener("keydown", function esc(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); } });
  document.body.append(ov);
  draw();
  search.focus();
}
function fmtState(e) {
  if (!e) return "";
  const s = e.state;
  if (s === "unavailable") return "nicht verfügbar";
  if (s === "unknown") return "unbekannt";
  if (s === "on") return "An";
  if (s === "off") return "Aus";
  if (e.domain === "weather" && S.boot.weather[s]) return S.boot.weather[s][1] + (e.attributes && e.attributes.temperature != null ? ` · ${e.attributes.temperature}°` : "");
  return s + (e.unit ? " " + e.unit : "");
}

// ================================================================ Seiten anlegen / löschen
function shortTitle(name) {
  // erstes aussagekräftiges Wort, groß – das Panel kürzt bei Bedarf selbst
  const words = String(name || "").replace(/[^\p{L}\p{N} .,:%+\-]/gu, "").toUpperCase().split(/\s+/).filter(Boolean);
  return (words[0] || "").slice(0, 10);
}
function addPage(type, extra = {}) {
  if (S.draft.pages.length >= S.boot.maxPages) { toast(`Maximal ${S.boot.maxPages} Seiten`); return; }
  const t = clone(S.boot.templates[type]);
  let id, n = 1;
  do { id = `${type}${n++}`; } while (S.draft.pages.some((p) => p.id === id));
  const page = { id, type, name: tr(t.name), enabled: true, duration: t.duration, options: t.options };
  Object.assign(page.options, extra.options || {});
  if (extra.name) page.name = extra.name;
  S.draft.pages.push(page);
  S.rotation = { idx: -2, elapsed: 0 };
  updateSavebar();
  go("page:" + id);
}
function addPageForEntity(eid) {
  const e = S.byId[eid];
  if (!e) return;
  if (e.domain === "weather") return addPage("weather", { name: e.name, options: { entity: eid } });
  if (looksLikeTimer(e)) return addPage("timer", { name: e.name, options: Object.assign({ entity: eid }, timerGuess(e)) });
  const icon = e.domain === "light" ? "bulb" : /temp/i.test(eid + e.attributes.device_class) ? "thermo"
    : /power|energy|strom/i.test(eid + (e.attributes.device_class || "")) ? "bolt" : "";
  addPage("value", { name: e.name, options: { entity: eid, title: shortTitle(e.name), icon } });
}
function choosePageType() {
  document.body.classList.remove("nav-open");
  const close = () => ov.remove();
  const card = (type) => el("button", { class: "row pick", onclick: () => { close(); addPage(type); } },
    el("span", { class: "pico", style: { background: PAGE_META[type].color }, html: PAGE_META[type].icon }),
    el("div", { class: "label" }, PAGE_META[type].title, el("small", {}, PAGE_META[type].sub)), el("span", { class: "chev", html: SVG.chev }));
  const ov = el("div", { class: "overlay", onclick: (e) => e.target === ov && close() },
    el("div", { class: "sheet" },
      el("div", { class: "sheet-head" }, el("h3", {}, "Neue Seite"), el("div", { style: { color: "var(--text-2)" } },
        "Jede Seite kann jede Entität aus Home Assistant nutzen. Tipp: Unter „Geräte & Entitäten“ macht der ＋-Knopf aus jeder Entität direkt eine Seite.")),
      el("div", { class: "sheet-body" }, el("div", { class: "card" }, ["value", "entity", "list", "timer", "weather", "clock", "marquee", "calendar", "chart", "stack"].map(card))),
      el("div", { class: "sheet-foot" }, el("button", { class: "btn", onclick: close }, "Abbrechen"))));
  document.body.append(ov);
}
function deletePage(id) {
  const p = S.draft.pages.find((x) => x.id === id);
  if (!p || !confirm(`Seite „${p.name}“ löschen?`)) return;
  S.draft.pages = S.draft.pages.filter((x) => x.id !== id);
  S.rotation = { idx: -2, elapsed: 0 };
  updateSavebar();
  go("overview");
}

// ---- Version: Studio vs. Firmware auf dem Panel (Sensor „Studio Version“ in HA)
function panelVersion() {
  const e = S.entities.find((x) => /_studio_version$/.test(x.entity_id) && x.state && x.state !== "unavailable" && x.state !== "unknown");
  return e ? e.state : null;
}
// ---- Neue Version auf GitHub (nur PC-Version; die Home-Assistant-App meldet Updates selbst)
const ghUrl = (u) => (typeof u === "string" && /^https:\/\/github\.com\//.test(u) ? u : null);
function updateBanner() {
  const u = S.update;
  if (!u || !u.available || S.boot.app) return null;
  try { if (localStorage.getItem("pp-skip-update") === u.latest) return null; } catch (e) { /* privat */ }
  const notes = (u.notes || "").split("\n").filter((l) => !/^\s*#/.test(l)).map((l) => l.replace(/^\s*[-*•]\s*/, "").replace(/\*\*/g, "").trim()).filter(Boolean).slice(0, 3);
  return el("div", { class: "banner info upd-banner" },
    el("div", { class: "tx" }, el("b", {}, `Version ${u.latest} ist da`), notes.length ? notes.join(" · ").slice(0, 160) : "Neue Funktionen und Fehlerbehebungen."),
    el("button", { class: "btn", onclick: () => { try { localStorage.setItem("pp-skip-update", u.latest); } catch (e) { /* privat */ } render(); } }, "Später"),
    el("button", { class: "btn", onclick: updateSheet }, "Was ist neu?"),
    el("button", { class: "btn primary", onclick: () => { const x = ghUrl(u.zip) || ghUrl(u.page); if (x) window.open(x, "_blank", "noopener"); } }, "Herunterladen"));
}
// Release-Text von GitHub (Markdown) schlicht darstellen: Überschriften fett, Aufzählungen als Punkte – nie als HTML
function relNotes(md) {
  const out = [];
  let list = null;
  for (const raw of String(md || "–").split("\n").slice(0, 80)) {
    const l = raw.replace(/\*\*|__|\x60/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").trimEnd();
    if (!l.trim()) { list = null; continue; }
    const li = /^\s*[-*•]\s+(.*)$/.exec(l);
    if (li) { if (!list) out.push(list = el("ul", {})); list.append(el("li", {}, li[1])); continue; }
    list = null;
    const h = /^\s*#+\s*(.*)$/.exec(l);
    out.push(h ? el("b", {}, h[1]) : el("div", {}, l));
  }
  return out;
}
function updateSheet() {
  const u = S.update || {};
  const close = () => ov.remove();
  const ov = el("div", { class: "overlay", onclick: (e) => e.target === ov && close() },
    el("div", { class: "sheet" },
      el("div", { class: "sheet-head" }, el("h3", {}, `PixelPanel Studio ${u.latest}`), el("div", { style: { color: "var(--text-2)" } }, `Installiert: ${S.boot.version}`)),
      el("div", { class: "sheet-body" },
        el("div", { class: "rel-notes" }, relNotes(u.notes)),
        el("ol", { class: "howto" },
          el("li", {}, `PixelPanelStudio_${u.latest}.zip herunterladen und entpacken`),
          el("li", {}, "Den Ordner „data“ aus der alten Version hineinkopieren (dort stecken alle Einstellungen)"),
          el("li", {}, "Start.bat (Windows) bzw. start.sh (Mac/Linux) starten – der erste Start dauert ein paar Minuten"),
          el("li", {}, "Einmal „Übernehmen & aufs Panel“, damit auch das Panel die neue Version bekommt"))),
      el("div", { class: "sheet-foot" }, el("button", { class: "btn", onclick: close }, "Schließen"),
        ghUrl(u.page) && el("button", { class: "btn", onclick: () => window.open(u.page, "_blank", "noopener") }, "Auf GitHub ansehen"),
        el("button", { class: "btn primary", onclick: () => { const x = ghUrl(u.zip) || ghUrl(u.page); if (x) window.open(x, "_blank", "noopener"); } }, "Herunterladen"))));
  document.body.append(ov);
}
function versionBanner() {
  const pv = panelVersion();
  if (!pv || pv === S.boot.version) return null;
  return el("div", { class: "banner warn" }, el("div", {}, el("b", {}, `Auf dem Panel läuft noch Version ${pv}`),
    `Das Studio ist schon auf ${S.boot.version}. Neue Funktionen und Fehlerbehebungen kommen erst mit „Übernehmen & aufs Panel“ auf den ESP.`));
}

// ================================================================ Sidebar
function renderSidebar() {
  const sb = $("#sidebar");
  const stat = { verbunden: ["ok", "Verbunden mit Home Assistant"], demo: ["warn", "Demo-Daten (HA nicht eingerichtet)"],
    verbinde: ["", "Verbinde …"], fehler: ["err", "HA-Fehler: " + S.haError] }[S.haStatus] || ["", S.haStatus];
  const nav = (id, label, color, icon, extra) => el("button", { class: "nav" + (S.view === id ? " active" : ""), onclick: () => go(id) },
    el("span", { class: "ico", style: { background: color }, html: icon }), el("span", { class: "grow" }, label), extra);
  sb.replaceChildren(
    el("div", { class: "brand" },
      el("div", { class: "brand-logo" }, [1, 0, 0, 2, 0, 1, 2, 0, 0, 2, 1, 0, 2, 0, 0, 1].map((v) => el("i", { class: v === 1 ? "on" : v === 2 ? "on2" : "" }))),
      el("div", {}, el("h1", {}, "PixelPanel Studio"), el("small", { class: "status", title: stat[1] }, el("span", { class: "dot " + stat[0] }),
        S.haStatus === "verbunden" ? `${S.entities.length} Entitäten` : S.haStatus === "demo" ? "Demo-Modus" : S.haStatus),
        el("small", { class: "ver" }, `Version ${S.boot.version}`))),
    el("div", { class: "nav-group" }, nav("overview", "Übersicht", "#5e5ce6", SVG.grid, el("span", { class: "badge" }, S.draft.active ? "" : "aus"))),
    el("div", { class: "nav-group" }, el("div", { class: "nav-label" }, "Seiten"),
      S.draft.pages.map((p) => nav("page:" + p.id, p.name || PAGE_META[p.type].title, pageColor(p), pageSvg(p),
        el("span", { class: "pill-off" }, p.enabled ? fmtDur(p.duration) : "aus"))),
      el("button", { class: "nav", style: { color: "var(--accent)" }, onclick: choosePageType },
        el("span", { class: "ico", style: { background: "var(--fill)", color: "var(--accent)" }, html: SVG.plus }), el("span", { class: "grow" }, "Seite hinzufügen"))),
    el("div", { class: "nav-group" }, el("div", { class: "nav-label" }, "Home Assistant"),
      nav("devices", "Geräte & Entitäten", "#8e8e93", SVG.devices, el("span", { class: "badge" }, S.entities.length || ""))),
    el("div", { class: "nav-group" }, el("div", { class: "nav-label" }, "Panel"),
      nav("deploy", "Übertragen", "#34c759", SVG.upload, S.deploy.running ? el("span", { class: "dot warn" }) : null),
      el("button", { class: "nav" + (isSettingsView(S.view) ? " active-parent" : ""), onclick: () => go("settings") },
        el("span", { class: "ico", style: { background: "#636366" }, html: SVG.gear }), el("span", { class: "grow" }, "Einstellungen")),
      SETTINGS_TABS.map(([id, label, color]) => el("button", { class: "nav sub" + (S.view === id ? " active" : ""), onclick: () => go(id) },
        el("span", { class: "sub-dot", style: { background: color } }), el("span", { class: "grow" }, label),
        id === "animation" ? el("span", { class: "badge" }, (ANIMS.find((x) => x[0] === animCfg().style) || [, ""])[1]) : null))),
    (S.access && !S.access.local) ? el("div", { class: "nav-group nav-foot" },
      el("button", { class: "nav", onclick: async () => { await api("/api/logout", { method: "POST" }); location.href = U("/login"); } },
        el("span", { class: "ico", style: { background: "var(--fill)", color: "var(--text-2)" }, html: SVG.chev }), el("span", { class: "grow" }, `Abmelden (${S.access.user})`))) : "",
  );
}

// ================================================================ Ansichten
function head(title, sub, right) {
  return el("div", { class: "view-head" }, el("div", {}, el("h2", {}, title), sub && el("p", {}, sub)), right);
}

function viewOverview() {
  const pages = S.draft.pages;
  const list = pages.map((p, i) => {
    const move = (d) => { const j = i + d; [pages[i], pages[j]] = [pages[j], pages[i]]; resetRotation(); updateSavebar(); render(); };
    return el("div", { class: "row page-row" + (p.enabled ? "" : " off") },
      el("div", { class: "order" },
        el("button", { class: "iconbtn", disabled: i === 0, title: "Nach oben", html: SVG.up, onclick: () => move(-1) }),
        el("button", { class: "iconbtn", disabled: i === pages.length - 1, title: "Nach unten", html: SVG.down, onclick: () => move(1) })),
      pageIcon(p),
      el("div", { class: "label", style: { cursor: "pointer" }, onclick: () => go("page:" + p.id) }, p.name, el("small", {}, summary(p)), condChip(p)),
      durationField(p),
      toggle(`pages.${i}.enabled`, () => { resetRotation(); render(); }));
  });
  const en = enabledPages();
  let meta;
  return el("div", { class: "view" },
    head("Übersicht", "So läuft dein Panel gerade – Seiten an/aus, Reihenfolge und Anzeigedauer."),
    updateBanner(),
    versionBanner(),
    el("div", { class: "hero" + (geom().W / geom().H >= 1.6 ? " wide" : "") },
      el("div", { class: "panel-wrap" },
        mountPanel(() => ({ items: rotationItems(), trans: transAt(S.trans) }), { meta: (meta = el("span")), quiet: true, mini: true }),
        el("div", { id: "timeline", class: "timeline" }, S.draft.pages.map((p, i) => p.enabled &&
          el("div", { "data-i": i, title: p.name + (validCond(p.condition) ? " · nur wenn " + condText(p.condition) : ""),
            onclick: () => { if ((S.rotation.ok || [])[i]) { S.rotation.lead = i; S.rotation.elapsed = -1; tickRotation(true); renderPanels(); } } }, el("i")))),
        el("div", { class: "panel-meta" }, el("span", { id: "rot-info" }), meta)),
      el("div", {},
        group("Panel", [
          row("Panel an", el("label", { class: "switch" }, el("input", { type: "checkbox", checked: !!S.draft.active,
            onchange: (e) => quickSet({ active: e.target.checked }) }), el("span")), "Wirkt sofort – auf dem Panel und auf allen geöffneten Geräten"),
          row("Helligkeit (max.)", el("input", { type: "range", min: 1, max: 255, value: S.draft.settings.brightness, id: "quick-bright",
            oninput: (e) => quickSet({ brightness: +e.target.value }) })),
          row("Ruhezeit", el("button", { class: "btn", onclick: () => go("settings") }, "Einstellen"), quietSummary()),
        ], "Beides wirkt sofort, ohne Speichern. Du kannst es auch direkt in Home Assistant schalten („Anzeige“, „Helligkeit“, „Nächste Seite“)."),
        group("Seiten & Reihenfolge", [...list, el("button", { class: "row pick", style: { color: "var(--accent)" }, onclick: choosePageType }, "＋ Seite hinzufügen")], en.length > 1
          ? `Rotation: ${en.map((p) => p.name + (validCond(p.condition) ? "*" : "")).join(" → ")} → wieder von vorn · ein Durchlauf dauert ${fmtDur(en.reduce((a, p) => a + p.duration, 0))}.${en.some((p) => validCond(p.condition)) ? " * = nur wenn die Bedingung erfüllt ist." : ""}`
          : en.length === 1 ? "Nur eine Seite aktiv – sie bleibt dauerhaft stehen." : "Aktiviere mindestens eine Seite."))));
}
function summary(p) {
  const o = p.options;
  const name = (eid) => (eid ? (S.byId[eid] ? S.byId[eid].name : eid) : null);
  if (p.type === "clock" && o.style === "analog") return `Analog${o.show_seconds ? " · Sekundenzeiger" : ""}`;
  if (p.type === "clock") return `${S.draft.settings.time_format === "12" ? "12 h" : "24 h"}${o.show_date !== false ? " · Datum" : ""}${o.show_seconds ? " · Sekunden" : ""}`;
  if (p.type === "weather") return name(o.entity) || "⚠︎ Entität fehlt";
  if (p.type === "value") return o.entity ? name(o.entity) + (o.attribute ? ` › ${o.attribute}` : "") : "⚠︎ Entität fehlt";
  if (p.type === "entity") return o.entity ? `${name(o.entity)} · Icon ${o.icon_pos === "bottom" ? "unten" : "oben"}` : "⚠︎ Entität fehlt";
  if (p.type === "timer") return o.entity ? `${name(o.entity)} · ${timerText(S.timers[p.id])}` : "⚠︎ Entität fehlt";
  if (p.type === "marquee") return o.source === "entity" ? (o.entity ? name(o.entity) + (o.attribute ? ` › ${o.attribute}` : "") : "⚠︎ Entität fehlt") : (o.text ? `„${o.text.slice(0, 40)}“` : "⚠︎ Noch kein Text");
  if (p.type === "calendar") {
    if (o.source === "helper") return o.helper ? `${name(o.helper)} · bis ${o.count || 6} Termine` : "⚠︎ Helfer-Sensor fehlt";
    const n = (o.calendars || []).filter((c) => c && c.entity).length;
    return n ? `${n} Kalender` : "⚠︎ Noch kein Kalender";
  }
  if (p.type === "chart") return o.entity ? `${name(o.entity)} · ${o.mode === "list" ? "Werte-Liste" : (o.period || "24h").replace("h", " h").replace("d", " Tage")}` : "⚠︎ Entität fehlt";
  if (p.type === "stack") {
    const names = (o.fields || []).filter((f) => f && f.type).map(fieldLabel);
    return names.length ? names.join(" + ") : "⚠︎ Noch keine Felder belegt";
  }
  const n = (o.items || []).filter((i) => i.entity).length;
  return n ? `${n} Wert${n > 1 ? "e" : ""}` : "⚠︎ Noch keine Werte";
}

const HIDDEN_ATTRS = new Set(["friendly_name", "icon", "unit_of_measurement", "device_class", "state_class", "entity_picture",
  "supported_features", "attribution", "restored", "editable", "id", "options", "supported_color_modes", "effect_list", "hs_color", "rgb_color", "xy_color", "forecast"]);
function attrSelect(path, eid) {
  const e = S.byId[eid];
  const attrs = e ? Object.entries(e.attributes || {}).filter(([k, v]) => !HIDDEN_ATTRS.has(k) && v !== null && typeof v !== "object") : [];
  const cur = getPath(S.draft, path) || "";
  const opts = [["", "Zustand" + (e ? ` (${fmtState(e)})` : "")], ...attrs.map(([k, v]) => [k, `${k} (${String(v).slice(0, 24)})`])];
  if (cur && !attrs.some(([k]) => k === cur)) opts.push([cur, cur]);
  return el("select", { class: "field", style: { maxWidth: "260px" }, onchange: (ev) => change(path, ev.target.value, true) },
    opts.map(([v, l]) => el("option", { value: v, selected: v === cur }, l)));
}
function viewPage(id) {
  const idx = S.draft.pages.findIndex((p) => p.id === id);
  const p = S.draft.pages[idx];
  if (!p) { go("overview"); return null; }
  const meta = PAGE_META[p.type];
  const base = `pages.${idx}.options`;
  let pmeta;
  const left = el("div", { class: "sticky" },
    el("div", { class: "panel-wrap" }, mountPanel(() => ({ items: [{ page: p, area: geom().areaOf(p) }], outline: p.type === "stack" ? fieldRect(p) : null }), { meta: (pmeta = el("span")), mini: true }),
      el("div", { class: "panel-meta" }, el("span", {}, el("b", {}, "Vorschau"), " · exakt wie auf dem Panel"), pmeta)),
    el("div", { style: { height: "18px" } }),
    group(null, [
      row("Name", textField(`pages.${idx}.name`, { wide: false, placeholder: meta.title }), "Nur hier im Studio"),
      row("Seite aktiv", toggle(`pages.${idx}.enabled`, () => { resetRotation(); renderSidebar(); }), "Nimmt an der Rotation teil"),
      row("Anzeigedauer", durationField(p)),
      row("Bedingung", condChip(p), "Seite nur zeigen, wenn …"),
      el("div", { class: "row" }, el("div", { class: "label" }), el("button", { class: "btn danger", onclick: () => deletePage(p.id) }, "Seite löschen")),
    ]));
  const right = p.type === "stack" ? stackEditor(p, idx) : optionGroups(p.type, base, geom().areaOf(p), { key: p.id, isPage: true });
  return el("div", { class: "view" }, head(p.name || meta.title, meta.sub, explainToggle(true)), el("div", { class: "cols" + (geom().W / geom().H >= 1.6 ? " wide" : "") }, left, el("div", {}, right)));
}

// ---------------------------------------------------------------- Einstellungen einer Seite (auch für Stapel-Felder)
const fmtQ = (q) => (q === 3 ? "Mini" : (q / 4).toLocaleString(LOCALE, { maximumFractionDigits: 2 }) + "×");
// Wie groß zeichnet das Panel diese Optionen in dieser Fläche gerade?
function measure(type, o, area, key) {
  const f = frame([{ page: { id: key, type, options: o }, area }]);
  return Object.assign({}, f.info || {}, { long: !!f.long });
}
function rangeCtl({ min, max, value, label, oninput, onchange, disabled }) {
  const out = el("span", { class: "rng-val" }, label(value));
  const inp = el("input", { type: "range", min, max, step: 1, value, disabled: !!disabled,
    oninput: (e) => { const v = +e.target.value; out.textContent = label(v); oninput(v); },
    onchange: (e) => onchange && onchange(+e.target.value) });
  return el("span", { class: "rng" }, el("small", {}, "A"), inp, el("b", {}, "A"), out);
}
// Text- und Icongröße als Regler (Viertel-Schritte). Ganz rechts = so groß wie möglich.
// Der Regler zeigt nur Stufen, die das Bild wirklich verändern – bewirkt er nichts, wird er ausgeblendet.
function frameSig(type, o, area, key, now) {
  const { buf } = frame([{ page: { id: key, type, options: o }, area }], null, now);
  let h = 2166136261;
  for (let i = 0; i < buf.length; i++) h = Math.imul(h ^ buf[i], 16777619);
  return h >>> 0;
}
// Werte durchprobieren und nur die behalten, die ein anderes Bild ergeben als der vorige
function effectiveSteps(type, o, area, key, field, from, to, autoVal) {
  const now = new Date(); now.setMilliseconds(0);
  const steps = [];
  let last = null;
  for (let v = from; v <= to; v++) {
    const sig = frameSig(type, Object.assign({}, o, { [field]: v === autoVal ? 0 : v }), area, key, now);
    if (sig !== last) { steps.push(v); last = sig; }
  }
  return steps;
}
function stepCtl({ steps, value, label, oninput, onchange }) {
  let idx = 0;
  steps.forEach((v, i) => { if (v <= value) idx = i; });
  const out = el("span", { class: "rng-val" }, label(steps[idx]));
  const inp = el("input", { type: "range", min: 0, max: steps.length - 1, step: 1, value: idx,
    oninput: (e) => { const v = steps[+e.target.value]; out.textContent = label(v); oninput(v); },
    onchange: (e) => onchange && onchange(steps[+e.target.value]) });
  return el("span", { class: "rng" }, el("small", {}, "A"), inp, el("b", {}, "A"), out);
}
function sizeRows(type, base, area, { icon = false, key } = {}) {
  const o = getPath(S.draft, base);
  const autoQ = Math.max(4, measure(type, Object.assign({}, o, { scale: 0 }), area, key).sm || 4);
  const cur = S.R.sizeOf(o);
  const val = cur ? Math.min(cur, autoQ) : autoQ;
  const live = () => { updateSavebar(); renderSidebar(); renderPanels(); };
  const rows = [];
  const tSteps = effectiveSteps(type, o, area, key, "scale", 3, autoQ, autoQ);
  if (tSteps.length > 1) rows.push(row("Textgröße",
    stepCtl({ steps: tSteps, value: val,
      label: (v) => (v >= autoQ ? `${fmtQ(autoQ)} · max` : fmtQ(v)),
      oninput: (v) => { setPath(S.draft, `${base}.scale`, v >= autoQ ? 0 : v); live(); },
      onchange: () => render() }),
    "Nach links wird alles kleiner, ganz links ist die Mini-Schrift. Passt eine Nebenzeile (Datum, „WOLKIG“) nicht, wird nur sie automatisch kleiner – bis Mini, dann die Kurzform."));
  if (icon) {
    const m = measure(type, o, area, key);
    const autoI = measure(type, Object.assign({}, o, { icon_scale: 0 }), area, key).ic || 4;
    const maxI = Math.max(3, m.sm || 4);
    const iv = Math.min(S.R.iconOf(o) || autoI, maxI);
    const iSteps = m.ic ? effectiveSteps(type, o, area, key, "icon_scale", 2, maxI, autoI) : [];
    if (iSteps.length > 1) rows.push(row("Icongröße",
      stepCtl({ steps: iSteps, value: iv,
        label: (v) => { const f = (v / 4).toLocaleString(LOCALE, { maximumFractionDigits: 2 }) + "×"; return v === autoI ? `${f} · passend` : f; },
        oninput: (v) => { setPath(S.draft, `${base}.icon_scale`, v === autoI ? 0 : v); live(); },
        onchange: () => render() }),
      "Höchstens so groß wie die Schrift"));
    else if (!m.ic) rows.push(row("Icongröße", el("span", { class: "muted" }, "–"), "Passt gerade nicht neben den Text – wird ausgeblendet"));
  }
  return rows;
}
// Platzierung: 3 × 3 Raster (oben/mitte/unten × links/mitte/rechts); Listen nur senkrecht
function placeRow(base, { vertical = false, type, area, key } = {}) {
  const o = getPath(S.draft, base);
  const va = o.valign ?? 1, ha = o.halign ?? 1;
  const set = (v, h) => { setPath(S.draft, `${base}.valign`, v); if (!vertical) setPath(S.draft, `${base}.halign`, h); change(`${base}.valign`, v, true); };
  // Wirkt die Platzierung überhaupt? Füllt der Inhalt die Fläche schon aus, wird sie ausgeblendet.
  let useV = true, useH = !vertical;
  if (type && area) {
    const now = new Date(); now.setMilliseconds(0);
    const sig = (v, h) => frameSig(type, Object.assign({}, o, { valign: v, halign: h }), area, key, now);
    const g = [0, 1, 2].map((v) => [0, 1, 2].map((h) => (vertical && h !== +ha ? null : sig(v, vertical ? +ha : h))));
    useV = [0, 1, 2].some((h) => g[0][h] !== null && (g[0][h] !== g[1][h] || g[1][h] !== g[2][h]));
    useH = !vertical && [0, 1, 2].some((v) => g[v][0] !== g[v][1] || g[v][1] !== g[v][2]);
    if (!useV && !useH) return null;
  }
  const V = ["oben", "Mitte", "unten"], H = ["links", "Mitte", "rechts"];
  let ctl;
  if (useV && useH) ctl = el("div", { class: "place-grid" }, [0, 1, 2].flatMap((v) => [0, 1, 2].map((h) =>
    el("button", { class: v === +va && h === +ha ? "on" : "", title: v === 1 && h === 1 ? "Mitte" : `${V[v]} ${H[h]}`.replace("Mitte Mitte", "Mitte"), onclick: () => set(v, h) }, el("i")))));
  else if (useV) ctl = el("div", { class: "seg" }, [0, 1, 2].map((v) => el("button", { class: v === +va ? "on" : "", onclick: () => set(v, ha) }, ["Oben", "Mitte", "Unten"][v])));
  else ctl = el("div", { class: "seg" }, [0, 1, 2].map((h) => el("button", { class: h === +ha ? "on" : "", onclick: () => { setPath(S.draft, `${base}.halign`, h); change(`${base}.halign`, h, true); } }, ["Links", "Mitte", "Rechts"][h])));
  const now = useV && useH ? (+va === 1 && +ha === 1 ? "mittig" : `${V[+va]}, ${H[+ha]}`.replace("Mitte, ", "Mitte ").replace(", Mitte", " mittig"))
    : useV ? ["oben", "in der Mitte", "unten"][+va] : ["links", "mittig", "rechts"][+ha];
  return row("Platzierung", ctl, `Wo der Inhalt in der Fläche sitzt – gerade ${now}. Praktisch bei hohen Flächen, z. B. 3 Panels übereinander.`);
}
// Schalter nur zeigen, wenn Umschalten das Bild auf dieser Fläche wirklich verändert
function affects(type, o, area, key, patch) {
  if (!area) return true;
  const now = new Date(); now.setMilliseconds(0);
  return frameSig(type, Object.assign({}, o, patch), area, key, now) !== frameSig(type, o, area, key, now);
}
// ---- Timer: Art des Werts aus der Entität erraten
function looksLikeTimer(e) {
  const dc = (e.attributes || {}).device_class || "";
  return e.domain === "timer" || dc === "timestamp" || dc === "duration"
    || /restzeit|remaining|programmende|finish|timer|endzeit|laufzeit/i.test(e.entity_id + " " + e.name);
}
function timerGuess(e) {
  const dc = (e.attributes || {}).device_class || "";
  const txt = (e.entity_id + " " + e.name).toLowerCase();
  const out = { icon: /ofen|oven|back|herd|mikro/.test(txt) ? "oven" : /wasch|wash|trockn|dryer|spül|spuel|dish/.test(txt) ? "washer" : "timer" };
  // kurze Titel, damit Icon + Titel nebeneinander passen
  out.title = /ofen|oven|back|herd/.test(txt) ? "OFEN" : /mikro/.test(txt) ? "MIKRO" : /trockn|dryer/.test(txt) ? "TROCKNER"
    : /spül|spuel|dish/.test(txt) ? "SPUELER" : /wasch|wash/.test(txt) ? "WAESCHE" : shortTitle(e.name).slice(0, 8);
  if (e.domain === "timer") out.mode = "timer";
  else if (dc === "timestamp" || S.R.geo.isoEpoch(e.state) !== null) out.mode = "end";
  else {
    out.mode = "remaining";
    const u = String(e.unit || (e.attributes || {}).unit_of_measurement || "").toLowerCase();
    out.unit = /^(s|sec|sek)/.test(u) ? "s" : /^(h|std)/.test(u) ? "h" : "min";
  }
  return out;
}
// Kalender-Helfer: Anleitung + YAML für Home Assistant (nächste Termine als Liste)
function calendarHelperYaml(o) {
  let cals = (o.calendars || []).map((c) => c && c.entity).filter(Boolean);
  if (!cals.length) cals = S.entities.filter((e) => e.domain === "calendar").map((e) => e.entity_id);
  if (!cals.length) cals = ["calendar.DEIN_KALENDER"];
  const n = Math.max(1, Math.min(12, +o.count || 6));
  const attrs = Array.from({ length: n }, (_, k) => `          e${k + 1}: >
            {% set ev = (kal.values() | map(attribute='events') | sum(start=[]) | sort(attribute='start')) %}
            {% if ev | count > ${k} %}{% set e = ev[${k}] %}{{ (e.start | as_datetime | as_local).strftime('%Y-%m-%d %H:%M') if 'T' in e.start else e.start }}|{{ (e.end | as_datetime | as_local).strftime('%Y-%m-%d %H:%M') if 'T' in e.end else e.end }}|{{ e.summary }}{% endif %}`).join("\n");
  return `template:
  - triggers:
      - trigger: time_pattern
        minutes: /5
      - trigger: homeassistant
        event: start
    actions:
      - action: calendar.get_events
        target:
          entity_id:
${cals.map((c) => `            - ${c}`).join("\n")}
        data:
          duration:
            days: 14
        response_variable: kal
    sensor:
      - name: PixelPanel Termine
        unique_id: pixelpanel_termine
        icon: mdi:calendar-clock
        state: "{{ kal.values() | map(attribute='events') | sum(start=[]) | count }}"
        attributes:
${attrs}
`;
}
function calendarHelperSheet(o) {
  const close = () => ov.remove();
  const yaml = calendarHelperYaml(o);
  const copy = el("button", { class: "btn primary", onclick: async () => {
    try { await navigator.clipboard.writeText(yaml); copy.textContent = "Kopiert ✓"; }
    catch (e) { const r = document.createRange(); r.selectNodeContents(pre); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast("Text markiert – mit Strg+C kopieren"); }
  } }, "YAML kopieren");
  const pre = el("pre", { class: "yaml" }, yaml);
  const ov = el("div", { class: "overlay", onclick: (e) => e.target === ov && close() },
    el("div", { class: "sheet" },
      el("div", { class: "sheet-head" }, el("h3", {}, "Kalender-Helfer einrichten"), el("div", { style: { color: "var(--text-2)" } },
        "So kommen die nächsten Termine aus mehreren Kalendern als Liste aufs Panel.")),
      el("div", { class: "sheet-body" },
        el("ol", { class: "howto" },
          el("li", {}, "Wähle unter „Kalender“ die Kalender aus – sie landen automatisch in der YAML unten."),
          el("li", {}, "In Home Assistant die Datei ", el("code", {}, "configuration.yaml"), " öffnen (z. B. mit der App „File editor“) und den Text unten ans Ende einfügen. Steht dort schon ", el("code", {}, "template:"), ", nur den Teil ab „- triggers:“ darunter einfügen."),
          el("li", {}, "Entwicklerwerkzeuge → YAML → „Template-Entitäten“ neu laden."),
          el("li", {}, "Hier als Sensor ", el("b", {}, "„PixelPanel Termine“"), " auswählen.")),
        pre),
      el("div", { class: "sheet-foot" }, el("button", { class: "btn", onclick: close }, "Schließen"), copy)));
  document.body.append(ov);
}
function timerGroups(base, area, { key, isPage }) {
  const o = getPath(S.draft, base);
  const e = S.byId[o.entity];
  const pickBtn = el("button", { class: "entity-btn" + (o.entity ? "" : " empty"), title: o.entity || "",
    onclick: () => openPicker({ prefer: looksLikeTimer, current: o.entity, title: "Timer-Entität auswählen", onpick: (v) => {
      if (!v) return;
      const ent = S.byId[v];
      const g = ent ? timerGuess(ent) : {};
      setPath(S.draft, `${base}.entity`, v);
      for (const k of ["mode", "unit", "icon"]) if (g[k]) setPath(S.draft, `${base}.${k}`, g[k]);
      if (!o.title && g.title) setPath(S.draft, `${base}.title`, g.title);
      // neue Seite heißt noch „Timer“ -> Name der Entität übernehmen
      const pm = /^pages\.(\d+)\.options$/.exec(base);
      if (pm && ent) { const pg = S.draft.pages[+pm[1]]; if (pg && (!pg.name || pg.name === S.boot.templates.timer.name)) pg.name = ent.name; }
      change(`${base}.entity`, v, true);
    } }) },
    o.entity && el("span", {}, (DOMAIN[o.entity.split(".")[0]] || ["", "•"])[1]),
    el("span", { class: "t" }, o.entity ? (e ? e.name : o.entity) : "Entität wählen …"), el("span", { class: "chev", html: SVG.chev }));
  const MODE_SUB = {
    remaining: "Zahl (z. B. 47 min) oder „1:05:30“ – das Panel zählt selbst sekundengenau herunter und gleicht sich bei jedem neuen Wert aus HA ab",
    end: "Zeitstempel, wann das Programm fertig ist (z. B. „Programmende“ bei Home Connect / Miele)",
    timer: "Ein Timer-Helfer aus Home Assistant (timer.…) – mit Pause und Gesamtdauer",
  };
  const m = S.timers[key];
  const demo = S.timerDemo.get(key) || "";
  const src = [
    row("Entität", pickBtn, e ? `Gerade: ${fmtState(e)}` : "Restzeit, Endzeit oder Timer-Helfer"),
    row("Art des Werts", seg(`${base}.mode`, [["remaining", "Restzeit"], ["end", "Endzeit"], ["timer", "HA-Timer"]]), MODE_SUB[o.mode] || MODE_SUB.remaining),
    o.mode === "remaining" && row("Einheit der Zahl", seg(`${base}.unit`, [["s", "Sekunden"], ["min", "Minuten"], ["h", "Stunden"]]), "Nur für reine Zahlen; „1:05:30“ wird automatisch erkannt"),
    row("Status", el("span", { class: "tstat" + (m && m.rem > 0 ? " on" : ""), "data-tkey": o.entity ? key : null }, o.entity ? timerText(m) : "–"), "So sieht das Panel den Timer gerade"),
    row("Beispiel in der Vorschau", el("div", { class: "seg" }, [["", "Aus"], ["run", "Läuft"], ["done", "Fertig"]].map(([v, l]) =>
      el("button", { class: v === demo ? "on" : "", onclick: () => { if (v) S.timerDemo.set(key, v); else S.timerDemo.delete(key); resetRotation(); render(); } }, l))),
    "Zeigt einen laufenden oder fertigen Beispiel-Timer, damit du das Aussehen einstellen kannst – wird nicht übertragen"),
  ];
  const groups = [versionBanner(), group("Datenquelle", src, "Tipp: Bei Geräten, die die Restzeit auch im Leerlauf anzeigen, zusätzlich eine Bedingung setzen (z. B. Zustand = run).")];
  if (isPage) {
    const shown = o.only_running !== false;
    groups.push(group("Wann erscheint die Seite?", [
      row("Nur wenn der Timer läuft", toggle(`${base}.only_running`, () => { resetRotation(); render(); }), "Sonst ist die Seite ausgeblendet und stört die Rotation nicht"),
      shown && row("Sofort zeigen", toggle(`${base}.interrupt`, () => resetRotation()), "Springt direkt auf den Timer, sobald er startet"),
      shown && row("„FERTIG“ anzeigen", selectField(`${base}.done_minutes`, [[0, "nein"], [1, "1 min"], [2, "2 min"], [5, "5 min"], [10, "10 min"], [30, "30 min"]]), "Wie lange die Seite nach dem Ablauf noch „FERTIG“ zeigt"),
      shown && row("Nur diesen Timer zeigen", toggle(`${base}.exclusive`, () => { resetRotation(); render(); }), "Solange er läuft, pausieren alle anderen Seiten"),
    ]));
    const anyExcl = S.draft.pages.some((p) => p.type === "timer" && p.options.exclusive && p.options.only_running !== false);
    if (anyExcl) {
      const tm = (S.draft.settings.timers ||= { mode: "shortest", every: 10 });
      const ev = el("span", { class: "rng-val" }, `${tm.every} s`);
      groups.push(group("Wenn mehrere Timer laufen", [
        row("Anzeigen", seg("settings.timers.mode", [["shortest", "Nur den kürzesten"], ["alternate", "Abwechselnd"]]),
          tm.mode === "alternate" ? "Die laufenden Timer wechseln sich ab" : "Der Timer, der als Nächstes fertig wird"),
        tm.mode === "alternate" && row("Wechsel alle", el("span", { class: "rng" }, el("input", { type: "range", min: 5, max: 60, step: 5, value: tm.every,
          oninput: (e) => { ev.textContent = `${e.target.value} s`; setPath(S.draft, "settings.timers.every", +e.target.value); updateSavebar(); } }), ev)),
      ], "Gilt für alle Timer-Seiten mit „Nur diesen Timer zeigen“."));
    }
  }
  return groups;
}
// ---- Zu langer Text (pro Seite / Stapel-Feld): erscheint nur, wenn auf der Fläche wirklich etwas nicht passt
const SPEED_OPTS = [["slow", "Langsam"], ["normal", "Normal"], ["fast", "Schnell"]];
const LOOP_OPTS = [["pause", "Mit Pause"], ["ticker", "Endlos"]];
const loopSub = (v) => (v === "ticker" ? "Läuft ohne Halt durch – zwischen den Durchläufen ein Punkt" : "Hält am Anfang kurz an, damit man den Anfang lesen kann");
function overflowApplyAll(base) {
  const src = getPath(S.draft, base) || {};
  const v = { overflow: src.overflow || "scroll", scroll_speed: src.scroll_speed || "normal", scroll_loop: src.scroll_loop || "pause" };
  for (const p of S.draft.pages) {
    if (p.type === "stack") (p.options.fields || []).forEach((f) => f && f.type && f.type !== "chart" && Object.assign(f.options || (f.options = {}), v));
    else if (p.type !== "chart") Object.assign(p.options, v);
  }
  updateSavebar(); render(); toast("Für alle Seiten und Felder übernommen");
}
function overflowSlot(type, base, area, key) {
  const slot = el("div", { class: "fit-slot" });
  const upd = () => {
    const o = getPath(S.draft, base);
    if (!o || !area || type === "chart" || type === "stack") { slot.replaceChildren(); return; }
    const m = measure(type, o, area, key);
    if (!m.long) { slot.replaceChildren(); return; }
    const ov = o.overflow || "scroll", mq = type === "marquee";
    slot.replaceChildren(group("Zu langer Text", [
      row("Wenn Text nicht passt", seg(`${base}.overflow`, [["scroll", "Laufschrift"], ["cut", "Abkürzen"], ["hide", "Ausblenden"]]),
        ov === "cut" ? "Der Text bleibt stehen und wird am Ende abgeschnitten"
          : ov === "hide" ? "Nebenzeilen (z. B. „WOLKIG“, Datum, Titel) fallen weg – Hauptwerte werden abgekürzt"
            : "Erst wird der Text kleiner, dann läuft er von rechts nach links durch"),
      ov === "scroll" && !mq && row("Geschwindigkeit", seg(`${base}.scroll_speed`, SPEED_OPTS)),
      ov === "scroll" && !mq && row("Durchlauf", seg(`${base}.scroll_loop`, LOOP_OPTS), loopSub(o.scroll_loop)),
      el("div", { class: "row" }, el("div", { class: "label" }, el("small", {}, "Diese Einstellung für alle Seiten und Stapel-Felder übernehmen")),
        el("button", { class: "btn", onclick: () => overflowApplyAll(base) }, "Auf alle Seiten übertragen")),
    ], "Erscheint nur, weil hier gerade etwas nicht ganz auf die Fläche passt."));
  };
  upd();
  return { slot, upd };
}
function optionGroups(type, base, area, ctx = {}) {
  const tf = overflowSlot(type, base, area, ctx.key);
  const g = optionGroupsFor(type, base, area, ctx, tf).filter(Boolean);
  return type === "chart" || type === "stack" ? g : [...g, tf.slot];
}
function optionGroupsFor(type, base, area, ctx, tf) {
  const o = getPath(S.draft, base);
  if (type === "timer") {
    const colors = group("Farben", [row("Hauptfarbe", colorField(`${base}.color`)), row("Akzentfarbe", colorField(`${base}.accent`), "Titel, Balken und „FERTIG“")]);
    return [...timerGroups(base, area, ctx),
      group("Größe & Platzierung", [...sizeRows(type, base, area, { icon: !!o.icon, key: ctx.key }), placeRow(base, { type, area, key: ctx.key })]),
      group("Darstellung", [
        row("Titel auf dem Panel", textField(`${base}.title`, { wide: false, placeholder: "z. B. OFEN", transform: (v) => v.slice(0, 60), after: tf.upd })),
        ...iconRows(base),
        ...animRows(base, "timer"),
        row("Endzeit anzeigen", toggle(`${base}.show_end`, () => renderPanels()), "„ENDE 12:45“ unter der Restzeit"),
        row("Fortschrittsbalken", toggle(`${base}.show_bar`, () => renderPanels()), "Füllt sich vom Start bis zum Ende"),
        row("Rahmen blinkt, wenn fertig", toggle(`${base}.done_blink`, () => render()),
          String(o.done_minutes ?? 2) === "0" ? "Wirkt nur, wenn „FERTIG“ angezeigt wird (oben bei „„FERTIG“ anzeigen“ eine Dauer wählen)"
            : "Solange „FERTIG“ angezeigt wird, blinkt ein Rahmen um die Fläche"),
        o.done_blink && row("Farbe des Rahmens", colorField(`${base}.blink_color`), "Standard: Rot"),
      ]), colors];
  }
  const colors = group("Farben", [row("Hauptfarbe", colorField(`${base}.color`)), row("Akzentfarbe", colorField(`${base}.accent`))]);
  const titleRow = row("Titel auf dem Panel", textField(`${base}.title`, { wide: false, placeholder: "z. B. STROM", transform: (v) => v.slice(0, 60), after: tf.upd }),
    "Ä Ö Ü, € und ° gehen – Emojis und seltene Zeichen fallen weg");
  if (type === "clock") {
    const analog = o.style === "analog";
    const styleRow = row("Uhr", seg(`${base}.style`, [["digital", "Digital"], ["analog", "Analog"]]), analog ? "Zifferblatt mit Zeigern – füllt die Fläche aus" : "Ziffern, Datum und Sekundenbalken");
    if (analog) {
      return [group("Darstellung", [
        styleRow,
        row("Sekundenzeiger", toggle(`${base}.show_seconds`, () => renderPanels()), "Dünner Zeiger in der Akzentfarbe"),
        affects(type, o, area, ctx.key, { ring: !o.ring }) && row("Ring", toggle(`${base}.ring`, () => render()), "Dezenter Kreis ums Zifferblatt"),
        affects(type, o, area, ctx.key, { show_date: o.show_date === false }) && row("Datum", toggle(`${base}.show_date`, () => render()), "Unter dem Zifferblatt"),
        placeRow(base, { type, area, key: ctx.key }),
      ], "Die Uhrzeit holt sich das Panel von Home Assistant – Zeitzone unter Einstellungen → Allgemein."), colors];
    }
    return [group("Darstellung", [
        styleRow,
        row("Datum anzeigen", toggle(`${base}.show_date`, () => render()), "Wochentag und Datum"),
        row("Sekunden anzeigen", toggle(`${base}.show_seconds`, () => render())),
        row("Sekundenbalken", toggle(`${base}.seconds_bar`, () => render()), "Dünner Fortschrittsbalken"),
      ], "Die Uhrzeit holt sich das Panel von Home Assistant – Zeitzone unter Einstellungen → Allgemein."),
      group("Größe & Platzierung", [...sizeRows(type, base, area, { key: ctx.key }), placeRow(base, { type, area, key: ctx.key })]), colors];
  }
  if (type === "marquee") {
    const ent = o.source === "entity";
    return [
      group("Inhalt", [
        row("Quelle", seg(`${base}.source`, [["text", "Fester Text"], ["entity", "Aus Home Assistant"]]),
          ent ? "Zeigt den Zustand oder ein Attribut – z. B. den Songtitel des Players" : "Dein eigener Text"),
        !ent && row("Text", textField(`${base}.text`, { placeholder: "z. B. Willkommen zu Hause!", transform: (v) => v.slice(0, 200) }), "Ä Ö Ü, € und ° gehen – Emojis und seltene Zeichen fallen weg"),
        ent && row("Entität", entityButton(`${base}.entity`, (e) => e.domain === "media_player" || e.domain === "input_text" || e.domain === "sensor")),
        ent && o.entity && row("Angezeigter Wert", attrSelect(`${base}.attribute`, o.entity), "Beim Medien-Player z. B. „media_title“ oder „media_artist“"),
        ent && row("Davor (optional)", textField(`${base}.prefix`, { wide: false, placeholder: "z. B. ♪ ", transform: (v) => v.slice(0, 16) })),
      ]),
      group("Darstellung", [
        row("Immer laufen lassen", toggle(`${base}.always`, () => render()), "Aus = steht still, solange der Text auf die Fläche passt"),
        row("Geschwindigkeit", seg(`${base}.scroll_speed`, SPEED_OPTS)),
        row("Durchlauf", seg(`${base}.scroll_loop`, LOOP_OPTS), loopSub(o.scroll_loop)),
        titleRow,
        ...iconRows(base),
      ]),
      group("Größe & Platzierung", [...sizeRows(type, base, area, { key: ctx.key }), placeRow(base, { type, area, key: ctx.key })]),
      colors];
  }
  if (type === "calendar") {
    const helper = o.source === "helper";
    const cals = o.calendars || (o.calendars = []);
    const calRows = cals.map((c, i) => el("div", { class: "row" },
      el("input", { type: "color", value: c.color || o.accent || "#ff453a", title: "Farbe für Datum/Uhrzeit",
        oninput: (e) => change(`${base}.calendars.${i}.color`, e.target.value) }),
      el("div", { class: "label" }, entityButton(`${base}.calendars.${i}.entity`, (e) => e.domain === "calendar")),
      el("button", { class: "iconbtn", title: "Entfernen", html: SVG.x, onclick: () => { cals.splice(i, 1); change(`${base}.calendars`, cals, true); } })));
    if (cals.length < 4) calRows.push(el("button", { class: "row pick", style: { color: "var(--accent)" },
      onclick: () => openPicker({ prefer: (e) => e.domain === "calendar", title: "Kalender auswählen", onpick: (eid) => {
        if (!eid) return;
        cals.push({ entity: eid, color: ["#ff453a", "#0a84ff", "#30d158", "#ff9f0a"][cals.length % 4] });
        change(`${base}.calendars`, cals, true);
      } }) }, "＋ Kalender hinzufügen"));
    const out = [
      group("Ansicht", [
        row("Darstellung", seg(`${base}.view`, [["list", "Liste"], ["next", "Groß"]]),
          o.view === "next" ? "Wenige Termine groß – zu lange Titel laufen durch" : "Wie im Handy-Kalender: Tag, darunter die Termine mit Uhrzeit"),
      ]),
      group("Datenquelle", [
        row("Termine aus", seg(`${base}.source`, [["entities", "Kalendern"], ["helper", "Helfer-Sensor (Liste)"]]),
          helper ? "Mehrere nächste Termine aus einem Helfer in Home Assistant" : "Je Kalender der nächste Termin – nach Zeit sortiert"),
      ]),
      helper && group("Helfer-Sensor", [
        row("Sensor", entityButton(`${base}.helper`, (e) => e.entity_id.startsWith("sensor.") && !!(e.attributes || {}).e1)),
        row("Termine zeigen", selectField(`${base}.count`, Array.from({ length: 12 }, (_, i) => [i + 1, String(i + 1)])), "Höchstens – was nicht passt, lässt das Panel weg"),
        row("Einrichten", el("button", { class: "btn", onclick: () => calendarHelperSheet(o) }, "Anleitung & YAML …"), "Einmal in Home Assistant anlegen – dann kommen die nächsten Termine als Liste"),
      ]),
      group("Kalender", calRows, helper ? "Diese Kalender kommen in die YAML für den Helfer." : "Bis zu 4 Kalender. Läuft ein Termin gerade, steht JETZT da; ganztägige Termine ohne Uhrzeit."),
      group("Darstellung", [titleRow,
        row("Ausblenden", textField(`${base}.hide`, { wide: false, placeholder: "z. B. WKT Frei, Geburtstag" }), "Termine mit diesen Wörtern nicht zeigen – mehrere mit Komma trennen"),
      ], "Doppelte Termine (gleicher Titel am gleichen Tag) erscheinen nur einmal. Mehrtägige Termine stehen einmal mit „bis …“."),
      group("Größe & Platzierung", [...sizeRows(type, base, area, { key: ctx.key }), placeRow(base, { type, area, key: ctx.key })],
        o.view === "next" ? "Zu lange Titel laufen als Laufschrift. Auf großen Panels passen mehr Termine untereinander."
          : "Die Schrift passt sich der Panel-Größe an – auf großen Panels passen mehr Termine untereinander. Zu lange Titel werden gekürzt."),
      group("Farben", [row("Titel der Termine", colorField(`${base}.color`)), row("Akzentfarbe", colorField(`${base}.accent`), "Überschrift und Datum")]),
    ];
    return out;
  }
  if (type === "chart") {
    const list = o.mode === "list";
    const e = S.byId[o.entity];
    const listAttrs = e ? Object.entries(e.attributes || {}).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, `${k} (${v.length} Einträge)`]) : [];
    if (o.list_attr && !listAttrs.some(([k]) => k === o.list_attr)) listAttrs.push([o.list_attr, o.list_attr]);
    const pv = list && e ? S.R.plist(e.attributes[o.list_attr] === undefined ? "" : JSON.stringify(e.attributes[o.list_attr]), (o.list_key || "").trim()) : null;
    return [
      group("Datenquelle", [
        row("Entität", entityButton(`${base}.entity`, null), "Ein Zahlenwert – z. B. Temperatur, Verbrauch, Strompreis"),
        row("Werte", seg(`${base}.mode`, [["record", "Panel zeichnet auf"], ["list", "Liste aus Attribut"]]),
          list ? "Fertige Werte-Reihe aus Home Assistant – z. B. Strompreise der nächsten Stunden" : "Das Panel merkt sich den Wert selbst – auch nach Neustart"),
        !list && o.entity && row("Angezeigter Wert", attrSelect(`${base}.attribute`, o.entity)),
        !list && row("Zeitraum", seg(`${base}.period`, [["6h", "6 h"], ["24h", "24 h"], ["4d", "4 Tage"], ["7d", "7 Tage"]]), "48 Punkte – je Punkt der Mittelwert"),
        list && o.entity && row("Attribut mit Liste", selectField(`${base}.list_attr`, [["", "Bitte wählen …"], ...listAttrs])),
        list && o.list_attr && row("Schlüssel (optional)", textField(`${base}.list_key`, { wide: false, placeholder: "automatisch" }),
          pv ? (pv.length ? `${pv.length} Werte erkannt` : "Keine Zahlen erkannt – Schlüssel angeben, z. B. „value“ oder „price“") : "z. B. „value“, „total“ oder „price“"),
      ], list ? null : "Nach dem Übertragen beginnt das Panel mit der Aufzeichnung. Die Vorschau hier zeigt schon den Verlauf aus Home Assistant."),
      group("Darstellung", [
        row("Art", seg(`${base}.style`, [["line", "Linie"], ["bars", "Balken"]])),
        row("Aktueller Wert", toggle(`${base}.show_now`, () => render()), "Oben rechts"),
        row("Min / Max", toggle(`${base}.show_minmax`, () => render()), "Kleine Zahlen rechts am Diagramm"),
        titleRow,
        row("Einheit", textField(`${base}.unit`, { wide: false, placeholder: e && !o.attribute ? (e.unit || "keine") : "keine" }), "Leer = Einheit aus Home Assistant"),
        row("Nachkommastellen", selectField(`${base}.decimals`, [[-1, "Automatisch"], [0, "0"], [1, "1"], [2, "2"], [3, "3"]])),
      ]),
      group("Farben", [row("Diagramm & Wert", colorField(`${base}.color`)), row("Titel", colorField(`${base}.accent`))])];
  }
  if (type === "weather") {
    return [
      group("Datenquelle", [
        row("Entität", entityButton(`${base}.entity`, (e) => e.domain === "weather"), "Zustand + Attribute „temperature“ und „humidity“"),
      ]),
      group("Größe & Platzierung", [...sizeRows(type, base, area, { icon: true, key: ctx.key }), placeRow(base, { type, area, key: ctx.key })]),
      group("Darstellung", [row("Luftfeuchtigkeit anzeigen", toggle(`${base}.show_humidity`, () => render()))]), colors];
  }
  if (type === "entity") {
    const e = S.byId[o.entity];
    return [
      group("Datenquelle", [
        row("Entität", entityButton(`${base}.entity`, null), "Jede Entität aus Home Assistant – z. B. Füllstand des Wassertanks"),
        o.entity && row("Angezeigter Wert", attrSelect(`${base}.attribute`, o.entity), "Zustand oder ein Attribut der Entität"),
      ]),
      group("Icon", [
        ...iconRows(base),
        row("Position", seg(`${base}.icon_pos`, [["top", "Oben"], ["bottom", "Unten"]]), "Icon über oder unter dem Wert"),
        ...animRows(base, type),
      ], "„Füllstand automatisch“ zeigt leer, halb oder voll – passend zum Prozentwert."),
      group("Größe & Platzierung", [...sizeRows(type, base, area, { icon: !!o.icon, key: ctx.key }), placeRow(base, { type, area, key: ctx.key })]),
      group("Darstellung", [
        row("Titel (optional)", textField(`${base}.title`, { wide: false, placeholder: "z. B. TANK", transform: (v) => v.slice(0, 60), after: tf.upd })),
        row("Einheit", textField(`${base}.unit`, { wide: false, placeholder: e && !o.attribute ? (e.unit || "keine") : "keine" }), "Leer = Einheit aus Home Assistant · „%“ steht direkt hinter der Zahl"),
        row("Nachkommastellen", selectField(`${base}.decimals`, [[-1, "Automatisch"], [0, "0"], [1, "1"], [2, "2"]])),
      ]),
      group("Farben", [row("Hauptfarbe", colorField(`${base}.color`)), row("Akzentfarbe", colorField(`${base}.accent`), "Für den Titel")])];
  }
  if (type === "value") {
    const e = S.byId[o.entity];
    const numeric = (x) => x && /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(String(x.state));
    return [
      group("Datenquelle", [
        row("Entität", entityButton(`${base}.entity`, null), "Jede Entität aus Home Assistant"),
        o.entity && row("Angezeigter Wert", attrSelect(`${base}.attribute`, o.entity), "Zustand oder ein Attribut der Entität"),
      ]),
      group("Größe & Platzierung", [...sizeRows(type, base, area, { icon: !!o.icon, key: ctx.key }), placeRow(base, { type, area, key: ctx.key })]),
      group("Darstellung", [
        titleRow,
        ...iconRows(base),
        ...animRows(base, type),
        row("Einheit", textField(`${base}.unit`, { wide: false, placeholder: e && !o.attribute ? (e.unit || "keine") : "keine" }), "Leer = Einheit aus Home Assistant"),
        row("Nachkommastellen", selectField(`${base}.decimals`, [[-1, "Automatisch"], [0, "0"], [1, "1"], [2, "2"], [3, "3"]])),
        row("Tausenderpunkte", toggle(`${base}.thousands`), "1.234 statt 1234"),
      ], e && !numeric(e) && !o.attribute ? "Kein Zahlenwert – der Zustand wird als Text angezeigt (on/off → AN/AUS)." : null),
      group("Zweite Zeile (optional)", [
        row("Entität", entityButton(`${base}.second_entity`, null, { optional: true, placeholder: "Keine" }), "Kleiner Wert darunter"),
        o.second_entity && row("Als Trend einfärben", toggle(`${base}.trend`), "Positiv grün mit +, negativ rot – z. B. 24-h-Änderung"),
      ]),
      colors];
  }
  // Liste
  const items = o.items || (o.items = []);
  const lf = items.some((i) => i.entity) ? Object.assign({ cap: 0, cols: 1, rows: 0, sm: 4 }, measure(type, o, area, ctx.key))
    : S.R.listFit(area.w, area.h, o.title, 1, S.R.sizeOf(o));
  const rows = items.map((it, i) => el("div", { class: "row" + (i >= lf.cap ? " over" : ""), title: i >= lf.cap ? "Passt nicht mehr aufs Panel" : null },
    el("input", { class: "field", style: { width: "120px" }, placeholder: "Beschriftung", value: it.label || "", maxlength: 12,
      oninput: (e) => change(`${base}.items.${i}.label`, e.target.value) }),
    el("div", { class: "label" }, entityButton(`${base}.items.${i}.entity`, null)),
    el("button", { class: "iconbtn", title: "Entfernen", html: SVG.x, onclick: () => { items.splice(i, 1); change(`${base}.items`, items, true); } })));
  if (items.length < 24) rows.push(el("button", { class: "row pick", style: { color: "var(--accent)" },
    onclick: () => openPicker({ onpick: (eid) => {
      if (!eid) return;
      const e = S.byId[eid];
      items.push({ entity: eid, label: shortTitle(e ? e.name : eid).split(" ")[0].slice(0, 8) });
      change(`${base}.items`, items, true);
    } }) }, "＋ Entität hinzufügen"));
  return [
    group("Größe & Platzierung", [...sizeRows(type, base, area, { key: ctx.key }), placeRow(base, { vertical: true, type, area, key: ctx.key })]),
    group("Darstellung", [row("Titel", textField(`${base}.title`, { placeholder: "ZUHAUSE", wide: false, transform: (v) => v.slice(0, 60), after: tf.upd }), "Leer = ohne Kopfzeile")]),
    group("Einträge", rows, `Auf dieser Fläche passen gerade ${lf.cap} Einträge (${lf.cols} Spalte${lf.cols > 1 ? "n" : ""} × ${lf.rows} Zeilen, Schrift ${fmtQ(lf.sm)}). Kleinere Schrift = mehr Platz. Einheiten kommen aus Home Assistant, An/Aus wird zu AN/AUS.`),
    colors];
}

// ---------------------------------------------------------------- Panel-Bilder (maßstabsgetreu)
const escH = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let svgId = 0;
// mods: vorhandene Module, gone: fehlende Module, fields: Felder (optional) – alles in Pixeln
function panelSvg(W, H, mods, { gone = [], fields = [], labels = null, maxW = 110, maxH = 64, on = false, sel = -1, onpick = null } = {}) {
  const k = Math.min(maxW / W, maxH / H);
  const id = "d" + (++svgId);
  const r = Math.max(2, Math.min(W, H) * 0.06);
  const m0 = mods[0] || { w: W, h: H };
  const dot = Math.max(4, Math.min(m0.w, m0.h) / 4);
  const sw = Math.max(1.5, Math.max(W, H) / 70);
  const fs = Math.max(8, Math.min(H, W) * 0.2);
  let out = `<svg viewBox="-2 -2 ${W + 4} ${H + 4}" width="${Math.round(W * k)}" height="${Math.round(H * k)}" style="display:block">`;
  out += `<defs><pattern id="${id}" width="${dot}" height="${dot}" patternUnits="userSpaceOnUse"><circle cx="${dot / 2}" cy="${dot / 2}" r="${dot * 0.2}" fill="#ff9f0a" opacity=".9"/></pattern></defs>`;
  for (const m of gone) out += `<rect x="${m.x + 2}" y="${m.y + 2}" width="${m.w - 4}" height="${m.h - 4}" rx="${r}" fill="none" stroke="#8e8e93" stroke-width="${Math.max(1.5, W / 90)}" stroke-dasharray="${dot / 1.5} ${dot / 2}"/>`;
  for (const m of mods) out += `<rect x="${m.x + sw}" y="${m.y + sw}" width="${m.w - 2 * sw}" height="${m.h - 2 * sw}" rx="${r}" fill="#0d0d0e" stroke="#8e8e93" stroke-width="${sw}"/>` +
    (fields.length ? "" : `<rect x="${m.x + sw}" y="${m.y + sw}" width="${m.w - 2 * sw}" height="${m.h - 2 * sw}" rx="${r}" fill="url(#${id})"/>`);
  const fillOf = (i) => (on && (sel < 0 || sel === i) ? "#0a84ff" : "#5a5a5e");
  fields.forEach((f, i) => {
    out += `<rect data-k="${i}" x="${f.x + 3}" y="${f.y + 3}" width="${f.w - 6}" height="${f.h - 6}" rx="${r}" fill="${fillOf(i)}"${onpick ? ' style="cursor:pointer"' : ""}/>`;
  });
  if (fields.length) for (const m of mods) out += `<rect x="${m.x + sw}" y="${m.y + sw}" width="${m.w - 2 * sw}" height="${m.h - 2 * sw}" rx="${r}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="${sw * 0.6}" stroke-dasharray="${sw * 2} ${sw * 1.5}"/>`;
  fields.forEach((f, i) => {
    const t = labels ? labels[i] : String(i + 1);
    const size = Math.min(fs * 1.4, (f.w - 8) / Math.max(1, String(t).length) * 1.6, f.h * 0.5);
    out += `<text x="${f.x + f.w / 2}" y="${f.y + f.h / 2}" fill="#fff" font-size="${size}" font-weight="700" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif" paint-order="stroke" stroke="${fillOf(i)}" stroke-width="${size * 0.25}" pointer-events="none">${escH(t)}</text>`;
  });
  const node = el("span", { class: "psvg", html: out + "</svg>" });
  if (onpick) node.addEventListener("click", (e) => { const k = e.target.getAttribute && e.target.getAttribute("data-k"); if (k !== null && k !== undefined) onpick(+k); });
  return node;
}
const geomFields = (g) => ({ mods: g.moduleRects() });

// ---------------------------------------------------------------- Stapel
function posName(a, g) {
  const hz = a.w < g.W ? (a.x === 0 ? "links" : a.x + a.w === g.W ? "rechts" : "Mitte") : "";
  const vt = a.h < g.H ? (a.y === 0 ? "oben" : a.y + a.h === g.H ? "unten" : "Mitte") : "";
  return [vt, hz].filter(Boolean).join(" ") || "ganze Fläche";
}
const FIELD_TYPES = ["clock", "weather", "value", "entity", "list", "timer", "marquee", "calendar", "chart"];
function fieldLabel(f) {
  if (!f || !f.type) return "leer";
  const o = f.options || {};
  if (f.type === "value") return o.title || (o.entity && S.byId[o.entity] ? shortTitle(S.byId[o.entity].name) : "Wert");
  if (f.type === "list") return o.title || "Liste";
  if (f.type === "entity") return o.title || (o.entity && S.byId[o.entity] ? shortTitle(S.byId[o.entity].name) : "Entität");
  if (f.type === "timer") return o.title || (o.entity && S.byId[o.entity] ? shortTitle(S.byId[o.entity].name) : "Timer");
  if (f.type === "chart") return o.title || (o.entity && S.byId[o.entity] ? shortTitle(S.byId[o.entity].name) : "Verlauf");
  if (f.type === "marquee") return o.title || (o.source === "entity" ? "Laufschrift" : (o.text || "Laufschrift").slice(0, 12));
  return o.title || PAGE_META[f.type].title;
}
S.fieldTab = {};
function fieldRect(p) {
  const rects = geom().stackRects(p.options.layout);
  if (!rects) return null;
  return rects[Math.min(S.fieldTab[p.id] || 0, rects.length - 1)];
}
function stackEditor(p, idx) {
  const g = geom(), base = `pages.${idx}.options`, o = p.options;
  const presets = g.stackPresets();
  if (!presets.length) {
    return [el("div", { class: "banner warn" }, el("div", {}, el("b", {}, "Zu wenig Platz für einen Stapel"),
      "Ein Stapel braucht mindestens zwei Felder von 32 × 32 Pixel – z. B. ein 64×64-Panel oder zwei Panels nebeneinander."))];
  }
  const cur = presets.find((x) => x.key === o.layout);
  const mods = g.moduleRects();
  const cards = el("div", { class: "lcards" }, presets.map((pr) => {
    const on = cur && pr.key === cur.key;
    return el("button", { class: "lcard" + (on ? " on" : ""), onclick: () => { S.fieldTab[p.id] = 0; change(`${base}.layout`, pr.key, true); } },
      panelSvg(g.W, g.H, mods, { fields: pr.rects, on }), el("span", {}, pr.name));
  }));
  const out = [group("Aufteilung", [el("div", { class: "row", style: { display: "block", padding: "12px 14px" } }, cards)],
    "Passend zu deiner Panel-Fläche. Jedes Feld hat einen eigenen Inhalt mit eigenen Einstellungen.")];
  if (!cur) return [...out, el("div", { class: "banner info" }, "Wähle oben eine Aufteilung.")];

  const fields = o.fields || [];
  const k = Math.min(S.fieldTab[p.id] || 0, cur.rects.length - 1);
  const a = cur.rects[k];
  const f = fields[k] && fields[k].type ? fields[k] : null;
  const pick = (kk) => { S.fieldTab[p.id] = kk; render(); };
  const tabs = el("div", { class: "field-tabs" }, cur.rects.map((r, kk) =>
    el("button", { class: kk === k ? "on" : "", onclick: () => pick(kk) },
      el("b", {}, `Feld ${kk + 1}`), el("small", {}, fieldLabel(fields[kk])))));
  const setField = (v) => {
    const fs = clone(fields);
    while (fs.length < cur.rects.length) fs.push({ type: "", options: {} });
    if (!v) fs[k] = { type: "", options: {} };
    else if (v.startsWith("copy:")) {
      const q = S.draft.pages.find((x) => x.id === v.slice(5));
      fs[k] = q ? { type: q.type, options: clone(q.options) } : { type: "", options: {} };
    } else fs[k] = { type: v, options: clone(S.boot.templates[v].options) };
    change(`${base}.fields`, fs, true);
  };
  const copies = S.draft.pages.filter((q) => FIELD_TYPES.includes(q.type));
  const typeSel = el("select", { class: "field", onchange: (e) => setField(e.target.value) },
    el("option", { value: "", selected: !f }, "— leer —"),
    FIELD_TYPES.map((t) => el("option", { value: t, selected: f && f.type === t }, PAGE_META[t].title)),
    copies.length ? el("optgroup", { label: "Einstellungen kopieren von …" },
      copies.map((q) => el("option", { value: "copy:" + q.id }, `${PAGE_META[q.type].title}: ${q.name}`))) : null);
  out.push(group("Felder", [
    el("div", { class: "row", style: { display: "block", padding: "12px 14px" } },
      el("div", { class: "field-map" }, panelSvg(g.W, g.H, mods, { fields: cur.rects, labels: cur.rects.map((r, kk) => `${kk + 1} ${fieldLabel(fields[kk])}`), on: true, sel: k, maxW: 420, maxH: g.H > g.W ? 260 : 170,
        onpick: pick })),
      tabs),
    row(`Inhalt von Feld ${k + 1}`, typeSel, `${posName(a, g)} · ${a.w} × ${a.h} Pixel – im Vorschaubild blau umrandet`),
    row("Trennlinien", toggle(`${base}.dividers`, () => renderPanels()), "Dünne Linie zwischen den Feldern"),
  ], "Jedes Feld ist unabhängig von deinen anderen Seiten. Mit „Einstellungen kopieren von …“ übernimmst du einmalig die Einstellungen einer Seite."));
  if (f) {
    const fb = `${base}.fields.${k}.options`;
    out.push(el("div", { class: "field-head" }, el("span", { class: "pico", style: { background: PAGE_META[f.type].color }, html: PAGE_META[f.type].icon }),
      `Feld ${k + 1}: ${PAGE_META[f.type].title}`));
    out.push(...optionGroups(f.type, fb, a, { key: `${p.id}#${k}` }));
  }
  return out;
}

let devState = { q: "", domain: "" };
function viewDevices() {
  const body = el("div");
  const chips = el("div", { class: "chips" });
  const draw = () => {
    const words = devState.q.toLowerCase().split(/\s+/).filter(Boolean);
    const matchQ = (e) => !words.length || words.every((w) => (e.name + " " + e.entity_id + " " + e.device + " " + e.area + " " + e.integration).toLowerCase().includes(w));
    const base = S.entities.filter(matchQ);
    const counts = {};
    base.forEach((e) => (counts[e.domain] = (counts[e.domain] || 0) + 1));
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 9);
    chips.replaceChildren(
      el("button", { class: "chip" + (devState.domain ? "" : " on"), onclick: () => { devState.domain = ""; draw(); } }, "Alle", el("small", {}, base.length)),
      ...top.map(([d, n]) => el("button", { class: "chip" + (devState.domain === d ? " on" : ""), onclick: () => { devState.domain = d; draw(); } },
        (DOMAIN[d] || [d])[0], el("small", {}, n))));
    const items = base.filter((e) => !devState.domain || e.domain === devState.domain);
    const groups = new Map();
    items.forEach((e) => { const k = e.device || "Ohne Gerät"; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); });
    if (!items.length) {
      body.replaceChildren(el("div", { class: "empty-state" }, el("b", {}, S.entities.length ? "Keine Treffer" : "Noch keine Daten"),
        S.entities.length ? "Andere Suche oder Filter probieren." : "Trage unter Einstellungen deine Home-Assistant-Adresse und einen Token ein."));
      return;
    }
    body.replaceChildren(...[...groups.entries()].slice(0, 150).map(([dev, ents]) => {
      const f = ents[0];
      return el("section", { class: "group" }, el("div", { class: "card" },
        el("div", { class: "dev-head" }, el("div", { class: "label" }, el("b", {}, dev),
          el("small", {}, "  " + [f.manufacturer, f.model, f.area].filter(Boolean).join(" · "))), el("small", {}, ents.length)),
        ents.map((e) => el("div", { class: "row" },
          el("span", { class: "ent-ico" }, (DOMAIN[e.domain] || ["", "•"])[1]),
          el("div", { class: "label" }, e.name, S.fresh.has(e.entity_id) && el("span", { class: "new-badge" }, "NEU"),
            el("div", { class: "ent-id" }, e.entity_id)),
          el("span", { class: "state" + (e.state === "on" ? " on" : ""), "data-eid": e.entity_id }, fmtState(e)),
          el("button", { class: "btn", title: "Neue Panel-Seite mit dieser Entität", onclick: () => addPageForEntity(e.entity_id) },
            el("span", { html: SVG.plus }), "Als Seite")))));
    }));
  };
  const v = el("div", { class: "view" },
    head("Geräte & Entitäten", S.haStatus === "verbunden"
      ? `${S.entities.length} Entitäten auf ${S.counts.devices} Geräten – aktualisiert sich live, auch wenn du in HA neue Integrationen hinzufügst.`
      : S.haStatus === "demo" ? "Beispieldaten – verbinde Home Assistant unter Einstellungen." : `Status: ${S.haStatus}`),
    el("div", { class: "toolbar" },
      el("div", { class: "search" }, el("span", { html: SVG.search }),
        el("input", { class: "field", placeholder: "Suchen …", value: devState.q, oninput: (e) => { devState.q = e.target.value; draw(); } }))),
    el("div", { class: "toolbar" }, chips), body);
  v._redraw = draw;
  draw();
  return v;
}

function viewDeploy() {
  const s = S.draft.settings;
  const mode = deployMode();
  const local = mode === "local";
  const target = local ? (s.device_host || `${s.device_name}.local (automatisch)`)
    : mode === "folder" ? `esphome/${s.device_name}.yaml` : (s.dashboard_url || (S.boot.app ? "http://172.30.32.1:6052" : "http://homeassistant.local:6052"));
  const warn = [];
  const vb = versionBanner();
  if (vb) warn.push(vb);
  if (local && !S.boot.esphomeInstalled) warn.push(el("div", { class: "banner warn" }, el("div", {}, el("b", {}, "ESPHome ist auf diesem PC noch nicht installiert"),
    "Einmalig in der Eingabeaufforderung: ", el("code", {}, "pip install esphome"), " – oder unter Einstellungen auf „ESPHome in Home Assistant“ umstellen.")));
  if (local && !s.wifi_ssid) warn.push(el("div", { class: "banner warn" }, el("div", {}, el("b", {}, "WLAN-Daten fehlen"), "Trag sie unter Einstellungen → Zugänge & Sicherheit → WLAN ein, damit das Panel ins Netz kommt.")));
  const stepsEl = el("div", { class: "steps", id: "steps" });
  const consoleEl = el("div", { class: "console", id: "console" });
  const yamlBox = el("div");
  const v = el("div", { class: "view" },
    head("Übertragen", mode === "folder" ? "Erzeugt die ESPHome-Konfiguration und legt sie in den ESPHome Device Builder – dort installierst du sie mit einem Klick."
      : "Erzeugt die ESPHome-Konfiguration, speichert sie, kompiliert und spielt sie per WLAN aufs Panel.",
      el("button", { class: "btn primary big", id: "deploy-btn", onclick: startDeploy }, el("span", { html: SVG.upload }), "Jetzt übertragen")),
    warn,
    group("Ziel", [
      row("Methode", el("span", {}, local ? "Lokal auf diesem PC (ESPHome)" : mode === "folder" ? "ESPHome-Ordner (Installieren im Device Builder)" : "Automatisch über den ESPHome Device Builder")),
      row("Gerät", el("span", { class: "ent-id", style: { fontSize: "12px" } }, target)),
      row("Aktive Seiten", el("span", {}, enabledPages().map((p) => p.name).join(", ") || "—")),
    ], local ? "Der erste Flash muss einmal per USB passieren (unter Einstellungen → Zugänge & Sicherheit → „Gerät“ den COM-Port eintragen, z. B. COM3). Danach geht alles über WLAN. Das erste Kompilieren dauert ein paar Minuten, danach deutlich schneller."
      : "Ein neuer ESP32 muss einmal per USB bespielt werden: im ESPHome Device Builder beim Gerät auf „Installieren“ → per USB. Danach geht alles über WLAN. Das erste Kompilieren dauert ein paar Minuten."),
    group("Fortschritt", [stepsEl, el("div", { id: "usage" }), consoleEl,
      el("div", { class: "row" }, el("div", { class: "label" }), el("button", { class: "btn danger", id: "cancel-btn", onclick: () => api("/api/deploy/cancel", { method: "POST" }) }, "Abbrechen"))]),
    group("ESPHome-YAML", [el("div", { class: "row" }, el("div", { class: "label" }, "Die komplette Konfiguration, die aufs Panel geht", el("small", {}, "Wird automatisch erzeugt – nicht von Hand bearbeiten.")),
      el("button", { class: "btn", onclick: () => loadYaml(yamlBox) }, "Anzeigen"),
      el("button", { class: "btn", onclick: downloadYaml }, "Herunterladen")), yamlBox]));
  setTimeout(() => { drawDeploy(); pollDeploy(); }, 0);
  return v;
}
async function loadYaml(box) {
  const r = await api("/api/yaml", { method: "POST", body: JSON.stringify(S.draft) });
  box.replaceChildren(r.ok ? el("pre", { class: "yaml" }, r.yaml) : el("div", { class: "banner err", style: { margin: "12px" } }, r.error));
  return r;
}
// Echte Belegung laut ESPHome nach dem Kompilieren (RAM = fest belegt, ohne Bildspeicher)
function usageRow(u) {
  if (!u || !(u.ram || u.flash)) return "";
  const pill = (lbl, x) => x && el("span", { class: "use-pill " + (x.pct >= 90 ? "bad" : x.pct >= 75 ? "warn" : "ok") }, `${lbl} ${Math.round(x.pct)} %`);
  return el("div", { class: "row usage-row" }, el("div", { class: "label" }, "Speicher auf dem ESP",
    el("small", {}, "Laut ESPHome beim letzten Kompilieren. RAM ohne den Bildspeicher, der erst beim Start reserviert wird.")),
    el("span", { class: "use-pills" }, pill("RAM", u.ram), pill("Flash", u.flash)));
}
async function downloadYaml() {
  const r = await api("/api/yaml", { method: "POST", body: JSON.stringify(S.draft) });
  if (!r.ok) return toast(r.error);
  const a = el("a", { href: URL.createObjectURL(new Blob([r.yaml], { type: "text/yaml" })), download: `${S.draft.settings.device_name || "pixelpanel"}.yaml` });
  a.click();
}
function drawDeploy() {
  const d = S.deploy;
  const st = $("#steps");
  if (st) {
    const steps = d.steps || ["YAML speichern", "Kompilieren", "Übertragen", "Neustart"];
    st.replaceChildren(...steps.map((name, i) => {
      let cls = "";
      if (d.ok === true || i < d.step) cls = "done";
      else if (d.running && i === d.step) cls = "cur";
      else if (d.ok === false && i === d.step) cls = "fail";
      return el("div", { class: "step " + cls }, el("div", { class: "c" }, cls === "done" ? "✓" : cls === "fail" ? "!" : i + 1), name);
    }));
  }
  const c = $("#console");
  if (c) {
    if (!d.lines.length) c.replaceChildren(el("span", { style: { color: "#636366" } }, "Noch nichts übertragen. Klick auf „Jetzt übertragen“."));
    else {
      const stick = c.scrollTop + c.clientHeight >= c.scrollHeight - 30;
      c.replaceChildren(...d.lines.slice(-800).map((l) => el("div", { class: /^✔/.test(l) ? "ok" : /^(✖|■)|error/i.test(l) ? "err" : /^\$/.test(l) ? "cmd" : "" }, l)));
      if (stick) c.scrollTop = c.scrollHeight;
    }
  }
  const u = $("#usage");
  if (u) u.replaceChildren(usageRow(d.usage));
  const b = $("#deploy-btn"), cb = $("#cancel-btn");
  if (b) b.disabled = d.running;
  if (cb) cb.disabled = !d.running;
}
let polling = false;
async function pollDeploy() {
  if (polling) return;
  polling = true;
  try {
    for (;;) {
      const r = await api(`/api/deploy?since=${S.deploy.total}`);
      if (r.lines) {
        Object.assign(S.deploy, { running: r.running, ok: r.ok, step: r.step, steps: r.steps, usage: r.usage || {} });
        S.deploy.lines.push(...r.lines);
        S.deploy.total = r.total;
        drawDeploy();
        renderSidebar();
      }
      if (!S.deploy.running) {
        if (S.deploy.ok === true && S.deploy.justStarted) toast("✓ Panel aktualisiert");
        S.deploy.justStarted = false;
        break;
      }
      await new Promise((res) => setTimeout(res, 700));
    }
  } finally { polling = false; }
}
async function startDeploy() {
  const r = await api("/api/deploy", { method: "POST", body: JSON.stringify(S.draft) });
  if (!r.ok) { toast(r.error || "Fehler"); return false; }
  S.saved = clone(S.draft);
  updateSavebar();
  S.deploy = { running: true, total: 0, lines: [], step: 0, ok: null, justStarted: true };
  if (S.view !== "deploy") go("deploy"); else drawDeploy();
  pollDeploy();
  return true;
}

// ---- Animation (Untermenü der Einstellungen)
function viewAnimation() {
  const g = geom();
  const a = animCfg();
  // Vorschau: zwei deiner Seiten im Wechsel (sonst Uhr + Analoguhr)
  let demo = S.draft.pages.filter((p) => p.type !== "stack" && p.type !== "timer" && (p.type !== "list" || (p.options.items || []).length)).slice(0, 2);
  const tpl = (opts) => ({ id: "demo" + Math.random(), type: "clock", options: Object.assign(clone(S.boot.templates.clock.options), opts) });
  if (demo.length < 2) demo = [demo[0] || tpl({}), tpl({ style: "analog", show_seconds: true })];
  const its = demo.map((p) => [{ page: p, area: g.areaOf(p) }]);
  const HOLD = 1300, t0 = performance.now();
  const get = () => {
    const c = animCfg(), cyc = HOLD + (c.style === "none" ? 0 : c.ms);
    const t = (performance.now() - t0) % (2 * cyc);
    const i = t < cyc ? 0 : 1, lt = t < cyc ? t : t - cyc;
    if (lt < HOLD || c.style === "none") return { items: its[i] };
    return { items: its[1 - i], trans: { prev: its[i], p: Math.trunc((lt - HOLD) * 1000 / c.ms), style: c.style, ease: c.ease } };
  };
  const set = (k, v, re = true) => { const n = Object.assign(animCfg(), { [k]: v }); change("settings.anim", n, re); };
  const cards = el("div", { class: "anim-cards" }, ANIMS.map(([k, name, sub]) => {
    const pl = perf(k);
    return el("button", { class: "anim-card" + (a.style === k ? " on" : ""), onclick: () => set("style", k) },
      el("div", { class: "athumb2 at-" + k }, el("i", { class: "pa" }), el("i", { class: "pb" })),
      el("b", {}, name, el("span", { class: "pdot " + pl.level, title: PERF_TXT[pl.level] })), el("small", {}, sub));
  }));
  const msOut = el("span", { class: "rng-val" }, (a.ms / 1000).toLocaleString(LOCALE) + " s");
  return el("div", { class: "view" },
    head("Einstellungen", "Wie das Panel zwischen den Seiten wechselt – sanft statt hartem Schnitt.", langSwitch()),
    settingsNav(),
    explainToggle(),
    el("div", { class: "cols" + (g.W / g.H >= 1.6 ? " wide" : "") },
      el("div", { class: "sticky" },
        el("div", { class: "panel-wrap" }, mountPanel(get, { live: true, maxH: 0.42 }),
          el("div", { class: "panel-meta" }, el("span", {}, el("b", {}, "Vorschau"), ` · ${demo.map((p) => p.name || "Uhr").join(" ⇄ ")}`), el("span", {}, "exakt wie auf dem Panel")))),
      el("div", {},
        group("Läuft das flüssig?", [el("div", { class: "row", style: { display: "block", padding: "12px 14px" } }, perfBanner(a.style))],
          "Der Punkt an jeder Karte zeigt es für dein Board und deine Panel-Größe: grün = flüssig, gelb = kann leicht ruckeln, rot = ruckelt."),
        group("Seitenwechsel", [el("div", { class: "row", style: { display: "block", padding: "12px 14px" } }, cards)],
          "Gilt für jeden Wechsel – auch wenn ein Timer erscheint oder eine Bedingung eine Seite einblendet."),
        a.style !== "none" && group("Feinschliff", [
          row("Dauer", el("span", { class: "rng" }, el("input", { type: "range", min: 150, max: 2000, step: 50, value: a.ms,
            oninput: (e) => { msOut.textContent = (+e.target.value / 1000).toLocaleString(LOCALE) + " s"; set("ms", +e.target.value, false); } }), msOut),
            "0,4–0,8 s wirkt am elegantesten"),
          !["bounce", "drop"].includes(a.style) && row("Bewegung", seg("settings.anim.ease", [["smooth", "Sanft"], ["linear", "Gleichmäßig"]]), "Sanft: langsam anfahren und abbremsen"),
        ], "Während einer Animation zeichnet das Panel 30 Bilder pro Sekunde (sonst 5) und nutzt – wo der Speicher reicht – einen zweiten Bildpuffer gegen Flackern. Änderungen hier brauchen einmal „Übernehmen & aufs Panel“."))));
}

// ---- Erscheinungsbild (pro Browser gespeichert, wirkt sofort)
function getTheme() { try { const t = localStorage.getItem("pp-theme"); return t === "light" || t === "dark" ? t : "auto"; } catch (e) { return "auto"; } }
function setTheme(t) {
  try { if (t === "auto") localStorage.removeItem("pp-theme"); else localStorage.setItem("pp-theme", t); } catch (e) { /* privat */ }
  if (t === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  render();
}
function themeGroup() {
  const cur = getTheme();
  return group("Erscheinungsbild", [el("div", { class: "row" },
    el("div", { class: "label" }, "Modus", el("small", {}, "Gilt für die ganze Oberfläche, sofort und ohne Speichern")),
    el("div", { class: "theme-pick" }, [["auto", "Automatisch"], ["light", "Hell"], ["dark", "Dunkel"]].map(([v, l]) =>
      el("button", { class: v === cur ? "on" : "", onclick: () => setTheme(v) }, el("i", { class: "t-" + v }), l))))],
  "„Automatisch“ folgt der Einstellung von Windows. Die Panel-Vorschau bleibt immer dunkel – wie das echte Panel.");
}
// Sprache der Oberfläche (oben rechts in den Einstellungen) – unabhängig von der Panel-Sprache
function langSwitch() {
  return el("div", { class: "lang-switch" }, el("span", { class: "lang-label" }, "Sprache"),
    el("div", { class: "seg no-tr" }, [["de", "Deutsch"], ["en", "English"]].map(([v, l]) =>
      el("button", { class: LANG === v ? "on" : "", onclick: () => { setLang(v); render(); } }, l))));
}
// ---- Uhrzeiten anzeigen/auswählen im eingestellten Format (24 h / 12 h)
const is12 = () => S.draft.settings.time_format === "12";
function fmtClock(hm) {
  const [h, m] = String(hm || "0:00").split(":").map(Number);
  if (!is12()) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
const fmtLeft = (sec) => (sec >= 3600 ? `${Math.floor(sec / 3600)} h ${String(Math.floor(sec / 60) % 60).padStart(2, "0")} min` : `${Math.max(1, Math.ceil(sec / 60))} min`);
// Uhrzeit-Auswahl: Stunde + Minute (5er-Schritte), unabhängig vom Browser-Format
function timePick(path, { disabled = false, onchange } = {}) {
  const cur = String(getPath(S.draft, path) || "00:00");
  let [h, m] = cur.split(":").map(Number);
  const set = () => { change(path, `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, false); updateSavebar(); onchange && onchange(); };
  const hs = el("select", { class: "field tp", disabled, onchange: (e) => { h = +e.target.value; set(); } },
    Array.from({ length: 24 }, (_, i) => el("option", { value: i, selected: i === h }, is12() ? `${i % 12 === 0 ? 12 : i % 12} ${i < 12 ? "AM" : "PM"}` : String(i).padStart(2, "0"))));
  const mins = Array.from({ length: 12 }, (_, i) => i * 5);
  if (!mins.includes(m)) mins.push(m), mins.sort((a, b) => a - b);
  const ms = el("select", { class: "field tp", disabled, onchange: (e) => { m = +e.target.value; set(); } },
    mins.map((i) => el("option", { value: i, selected: i === m }, String(i).padStart(2, "0"))));
  return el("span", { class: "tpick" }, hs, el("b", {}, ":"), ms);
}
const DAY_NAMES = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
function quietSummary() {
  const q = S.draft.settings.quiet || {};
  if (!q.enabled) return "Aus – Panel läuft rund um die Uhr";
  const on = (q.days || []).filter((d) => d.on);
  if (!on.length) return "An, aber kein Tag ausgewählt";
  const same = on.every((d) => d.from === on[0].from && d.to === on[0].to && d.mode === on[0].mode);
  const st = S.quiet && S.quiet.enabled && S.quiet.mode ? " · gerade aktiv" : S.quiet && S.quiet.evening ? " · Abenddimmung aktiv" : "";
  return (same ? `${fmtClock(on[0].from)} – ${fmtClock(on[0].to)} · ${on[0].mode === "dim" ? "gedimmt" : on[0].mode === "night" ? "Nacht (rot)" : "aus"}${on.length < 7 ? ` · ${on.length} Nächte` : ""}`
    : `${on.length} Nächte · unterschiedliche Zeiten`) + st;
}
// 24-Stunden-Balken von 12 Uhr mittags bis 12 Uhr am nächsten Tag
function quietBar(d) {
  const q = S.draft.settings.quiet, day = q.days[d];
  const sec = (hm) => { const [h, m] = hm.split(":").map(Number); return h * 3600 + m * 60; };
  const st = sec(day.from), len = ((sec(day.to) - st) % 86400 + 86400) % 86400;
  const rel = (st - 43200 + 86400) % 86400;  // Sekunden ab 12:00
  const seg = (a, b, cls) => {
    const out = [];
    const push = (x, y) => { if (y > x) out.push(el("i", { class: cls, style: { left: `${x / 864}%`, width: `${(y - x) / 864}%` } })); };
    if (b <= 86400) push(a, b); else { push(a, 86400); push(0, b - 86400); }
    return out;
  };
  const parts = [];
  if (day.on && len > 0) {
    const ev = q.evening || {};
    if (q.enabled && ev.enabled) { const l = (ev.lead || 60) * 60; parts.push(...seg((rel - l + 86400) % 86400, (rel - l + 86400) % 86400 + l, "qb-eve")); }
    parts.push(...seg(rel, rel + len, day.mode === "dim" ? "qb-dim" : day.mode === "night" ? "qb-night" : "qb-off"));
  }
  return el("div", { class: "qbar" }, parts, el("span", { class: "qb-ticks" }, ["12", "18", "0", "6", "12"].map((t) =>
    el("small", {}, is12() ? { "12": "12 PM", "18": "6 PM", "0": "12 AM", "6": "6 AM" }[t] : `${t} h`))));
}
function quietGroups() {
  const s = "settings.quiet";
  const q = S.draft.settings.quiet;
  const on = q.enabled;
  const anyDim = on && q.days.some((d) => d.on && (d.mode === "dim" || d.mode === "night"));
  const rr = () => { updateSavebar(); render(); };
  const dayRows = q.days.map((d, i) => el("div", { class: "qrow" + (d.on ? "" : " off") },
    el("div", { class: "qhead" },
      el("label", { class: "qday" }, el("input", { type: "checkbox", checked: d.on, disabled: !on, onchange: (e) => { setPath(S.draft, `${s}.days.${i}.on`, e.target.checked); rr(); } }),
        el("b", {}, `${DAY_NAMES[i]} → ${DAY_NAMES[(i + 1) % 7]}`)),
      el("span", { class: "qtimes" }, timePick(`${s}.days.${i}.from`, { disabled: !on || !d.on, onchange: render }), el("span", { class: "qto" }, "bis"),
        timePick(`${s}.days.${i}.to`, { disabled: !on || !d.on, onchange: render })),
      el("div", { class: "seg qmode" }, [["off", "Aus"], ["dim", "Gedimmt"], ["night", "Nacht"]].map(([v, l]) =>
        el("button", { class: d.mode === v ? "on" : "", disabled: !on || !d.on, onclick: () => { setPath(S.draft, `${s}.days.${i}.mode`, v); rr(); } }, l)))),
    quietBar(i)));
  const pageChips = S.draft.pages.map((p) => {
    const sel = (q.dim_pages || []).includes(p.id);
    return el("button", { class: "qchip" + (sel ? " on" : ""), disabled: !anyDim, onclick: () => {
      const cur = new Set(q.dim_pages || []);
      cur.has(p.id) ? cur.delete(p.id) : cur.add(p.id);
      setPath(S.draft, `${s}.dim_pages`, S.draft.pages.map((x) => x.id).filter((id) => cur.has(id))); rr();
    } }, el("span", { class: "pico", style: { background: pageColor(p) }, html: pageSvg(p) }), p.name);
  });
  const pctCtl = (path, min, max, disabled) => {
    const v = getPath(S.draft, path);
    const out = el("span", { class: "rng-val" }, `${v} %`);
    return el("span", { class: "rng" }, el("input", { type: "range", min, max, value: v, disabled,
      oninput: (e) => { out.textContent = `${e.target.value} %`; setPath(S.draft, path, +e.target.value); updateSavebar(); renderPanels(); },
      onchange: () => render() }), out);
  };
  const ev = q.evening;
  return [
    group("Ruhezeit", [
      row("Ruhezeit", toggle(`${s}.enabled`, () => render()), on ? "Zu festen Zeiten schaltet das Panel aus oder dimmt – läuft direkt im Panel, auch ohne PC" : "Aus – Panel läuft rund um die Uhr"),
      on && el("div", { class: "row qtable" }, dayRows,
        el("div", { class: "qtools" },
          el("button", { class: "btn small", onclick: () => { const f = q.days[0]; q.days.forEach((d, i) => { if (i) Object.assign(d, { on: f.on, from: f.from, to: f.to, mode: f.mode }); }); rr(); } }, "Montag für alle übernehmen"),
          el("span", { class: "qlegend" }, el("i", { class: "qb-norm" }), "normal", el("i", { class: "qb-off" }), "aus", el("i", { class: "qb-dim" }), "gedimmt", el("i", { class: "qb-night" }), "Nacht (rot)", ev.enabled ? [el("i", { class: "qb-eve" }), "Abenddimmung"] : ""))),
      on && row("Helligkeit gedimmt & Nacht", pctCtl(`${s}.dim_pct`, 1, 50, !anyDim), anyDim ? "So hell ist das Panel in Nächten mit „Gedimmt“ oder „Nacht“ – nachts reichen oft 3–5 %" : "Nur für Nächte mit „Gedimmt“ oder „Nacht“"),
      on && el("div", { class: "row qpages" + (anyDim ? "" : " disabled") },
        el("div", { class: "label" }, "Sichtbar, wenn gedimmt oder Nacht", el("small", {}, anyDim
          ? ((q.dim_pages || []).length ? "Nur diese Seiten laufen in der Ruhezeit weiter" : "Keine Seite gewählt – das Panel bleibt dann dunkel")
          : "Nur wenn mindestens eine Nacht auf „Gedimmt“ oder „Nacht“ steht")),
        el("div", { class: "qchips" }, pageChips)),
    ], on ? "Die Zeile „Mo → Di“ ist die Nacht von Montag auf Dienstag. Ein Beginn vor 12 Uhr zählt schon als nach Mitternacht (z. B. 00:30). „Nacht“ = gedimmt und alles in Rot. In Home Assistant gibt es zusätzlich den Schalter „Ruhezeit“ – z. B. für eine Party." : ""),
    group("Nachtmodus", [
      row("Nacht ansehen", el("label", { class: "switch" }, el("input", { type: "checkbox", checked: !!S.nightView,
        onchange: (e) => { S.nightView = e.target.checked; tickRotation(false); render(); } }), el("span")),
        S.nightView ? "Die Vorschau zeigt jetzt, wie das Panel nachts aussieht – nur hier, das Panel selbst ändert sich nicht" : "Zeigt in der Vorschau, wie das Panel im Nachtmodus aussieht: gedimmt und alles in Rot"),
      !on && row("Helligkeit im Nachtmodus", pctCtl(`${s}.dim_pct`, 1, 50, false), "So hell ist das Panel, wenn du den Nachtmodus in Home Assistant einschaltest"),
    ], "In Home Assistant hat das Panel den Schalter „Nachtmodus“: rot und gedimmt, unabhängig von den Uhrzeiten – z. B. per Automation, wenn im Schlafzimmer das Licht ausgeht. Die Seiten laufen dabei weiter wie gewohnt."),
    group("Abenddimmung", [
      row("Abenddimmung", el("label", { class: "switch" }, el("input", { type: "checkbox", checked: ev.enabled, disabled: !on,
        onchange: (e) => { setPath(S.draft, `${s}.evening.enabled`, e.target.checked); rr(); } }), el("span")),
        on ? "Vor der Ruhezeit langsam dunkler werden – endet immer genau, wenn die Ruhezeit beginnt" : "Erst die Ruhezeit einschalten – die Abenddimmung richtet sich nach ihr"),
      on && ev.enabled && row("Beginn", el("div", { class: "seg" }, [[30, "30 Min."], [60, "1 Std."], [120, "2 Std."], [180, "3 Std."]].map(([v, l]) =>
        el("button", { class: ev.lead === v ? "on" : "", onclick: () => { setPath(S.draft, `${s}.evening.lead`, v); rr(); } }, l))), "vor der Ruhezeit"),
      on && ev.enabled && row("Helligkeit abends", pctCtl(`${s}.evening.pct`, 5, 90, false), "Höchstens so hell – war es schon dunkler eingestellt, bleibt es dunkler"),
      on && ev.enabled && row("Sanft abdunkeln", toggle(`${s}.evening.smooth`, () => render()), "Über 15 Minuten langsam statt auf einen Schlag"),
    ]),
  ];
}

// ---- Einstellungen: in Bereiche aufgeteilt (oben als Reiter, links im Menü)
const SETTINGS_TABS = [
  ["settings", "Allgemein", "#8e8e93"],
  ["settings:access", "Zugänge & Sicherheit", "#ff9f0a"],
  ["settings:panel", "Panel & Hardware", "#30b0c7"],
  ["animation", "Animation", "#bf5af2"],
  ["settings:feedback", "Feedback", "#34c759"],
];
const SETTINGS_SUB = {
  settings: "Aussehen, Sprache und Zeit.",
  "settings:access": "Alles mit Logins: Home Assistant, WLAN, Übertragung, Schlüssel – und der Zugriff vom Handy.",
  "settings:panel": "Dein LED-Panel: Name, Größe und Aufteilung, Stromversorgung und das ESP32-Board.",
  "settings:feedback": "Ideen und Fehler direkt an die Entwicklung schicken.",
};
const isSettingsView = (v) => v === "animation" || v === "settings" || v.startsWith("settings:");
function settingsNav() {
  return el("div", { class: "subnav" }, SETTINGS_TABS.map(([id, label]) =>
    el("button", { class: S.view === id ? "on" : "", onclick: () => go(id) }, label)));
}
function explainToggle(compact = false) {
  if (compact) return el("label", { class: "explain-mini" + (S.explain ? " on" : ""), title: "Zu jeder Einstellung eine Erklärung in einfachen Worten" },
    el("span", {}, "💡 Einfach erklärt"),
    el("span", { class: "switch" }, el("input", { type: "checkbox", checked: S.explain, onchange: (e) => setExplain(e.target.checked) }), el("span")));
  return el("div", { class: "explain-toggle" + (S.explain ? " on" : "") },
    el("div", {}, el("b", {}, "Einfach erklärt"), el("small", {}, S.explain
      ? "An: Zu jeder Einstellung steht eine ausführliche Erklärung in einfachen Worten."
      : "Neu hier? Einschalten – dann wird jede Einstellung Schritt für Schritt in einfachen Worten erklärt.")),
    el("label", { class: "switch" }, el("input", { type: "checkbox", checked: S.explain, onchange: (e) => setExplain(e.target.checked) }), el("span")));
}
function viewSettings() {
  const tab = S.view;
  const s = "settings";
  let body;
  if (tab === "settings:access") body = settingsAccess();
  else if (tab === "settings:panel") body = [
    group("Gerät", [
      row("Gerätename", textField(`${s}.device_name`, { wide: false, transform: (v) => v.toLowerCase().replace(/[^a-z0-9-]/g, "-") }), "Hostname in ESPHome, z. B. pixelpanel"),
      row("Anzeigename", textField(`${s}.friendly_name`, { wide: false }), "So heißt es in Home Assistant"),
    ]),
    panelGroup(), powerGroup(), hardwareGroup()];
  else if (tab === "settings:feedback") body = [feedbackGroup()];
  else body = [
    themeGroup(),
    group("Sprache", [
      row("Sprache der Oberfläche", el("div", { class: "seg no-tr" }, [["de", "Deutsch"], ["en", "English"]].map(([v, l]) =>
        el("button", { class: LANG === v ? "on" : "", onclick: () => { setLang(v); render(); } }, l))), "Wird in diesem Browser gemerkt"),
      row("Sprache auf dem Panel", seg(`${s}.panel_lang`, [["de", "Deutsch"], ["en", "English"]]),
        "Nur die Texte auf dem LED-Panel (Wochentage, FERTIG/DONE, AN/AUS, Wetter). Wirkt nach „Übernehmen & aufs Panel“."),
    ]),
    group("Zeit", [
      row("Zeitzone", textField(`${s}.timezone`, { wide: false })),
      row("Uhrzeit-Format", seg(`${s}.time_format`, [["24", "24 Std. · 14:30"], ["12", "12 Std. · 2:30 PM"]]),
        "Gilt überall: Uhr-Seiten, Timer-Endzeit, Ruhezeit"),
    ]),
    ...quietGroups()];
  return el("div", { class: "view" },
    head("Einstellungen", SETTINGS_SUB[tab] || "", langSwitch()),
    settingsNav(),
    explainToggle(),
    body);
}
// Übertragungswege: lokal (nur PC-Version), ESPHome-Ordner (nur App), automatisch über den ESPHome Device Builder
function deployModes() {
  const m = [];
  if (!S.boot.app) m.push(["local", "Lokal (dieser PC)"]);
  if (S.boot.esphomeDir) m.push(["folder", "ESPHome-Ordner"]);
  m.push(["dashboard", S.boot.app ? "Automatisch" : "ESPHome in HA"]);
  return m;
}
function deployMode() {
  const v = S.draft.settings.deploy_mode || "local";
  const ok = deployModes().map((x) => x[0]);
  return ok.includes(v) ? v : ok[0];
}
function settingsAccess() {
  const s = "settings";
  const mode = deployMode();
  const local = mode === "local";
  const testRes = el("span", { class: "status" });
  const dbRes = el("span", { class: "status" });
  return [
    S.boot.app ? group("Home Assistant", [
      el("div", { class: "row" }, el("div", { class: "label" }, "Verbunden über die Home-Assistant-App",
        el("small", {}, "Adresse und Zugriffstoken braucht es hier nicht – die App meldet sich selbst bei Home Assistant an."))),
    ]) : group("Home Assistant", [
      row("Adresse", textField(`${s}.ha_url`, { placeholder: "http://homeassistant.local:8123" })),
      row("Zugriffstoken", textField(`${s}.ha_token`, { type: "password", placeholder: "Langlebiges Zugriffstoken" }),
        "HA → Profil → Sicherheit → „Langlebige Zugriffstokens“"),
      el("div", { class: "row" }, el("div", { class: "label" }, testRes),
        el("button", { class: "btn", onclick: async () => {
          testRes.replaceChildren("Teste …");
          const r = await api("/api/test-ha", { method: "POST", body: JSON.stringify({ url: S.draft.settings.ha_url, token: S.draft.settings.ha_token }) });
          testRes.replaceChildren(el("span", { class: "dot " + (r.ok ? "ok" : "err") }), r.message);
        } }, "Verbindung testen")),
    ], "Nach dem Speichern verbindet sich das Studio dauerhaft per WebSocket – neue Geräte und Integrationen tauchen sofort auf."),
    group("WLAN", [
      row("Netzwerk (SSID)", textField(`${s}.wifi_ssid`, { wide: false })),
      row("Passwort", textField(`${s}.wifi_password`, { type: "password", wide: false })),
    ], local ? "Wird lokal in secrets.yaml abgelegt." : "Leer lassen, wenn die secrets.yaml im ESPHome Device Builder schon wifi_ssid / wifi_password enthält."),
    group("Übertragung", [
      row("Methode", seg(`${s}.deploy_mode`, deployModes())),
      local && row("Gerät", textField(`${s}.device_host`, { placeholder: "leer = automatisch · IP · oder COM3", wide: false }), "IP-Adresse fürs WLAN-Update, oder COM-Port beim allerersten Flash"),
      mode === "folder" && el("div", { class: "row" }, el("div", { class: "label" }, "So funktioniert es",
        el("small", {}, "„Übernehmen & aufs Panel“ legt die Konfiguration direkt in den ESPHome Device Builder. Dort beim Gerät auf „Installieren“ klicken – beim allerersten Mal per USB, danach per WLAN. Es muss kein Port geöffnet werden."))),
      mode === "dashboard" && row("Dashboard-Adresse", textField(`${s}.dashboard_url`, { placeholder: S.boot.app ? "leer = http://172.30.32.1:6052" : "http://homeassistant.local:6052" }),
        S.boot.app ? "Leer lassen – dann derselbe Home-Assistant-Rechner" : "Adresse des ESPHome Device Builders mit Port 6052"),
      mode === "dashboard" && !S.boot.app && row("Dashboard-Benutzer", textField(`${s}.dashboard_user`, { wide: false, placeholder: "falls gesetzt" })),
      mode === "dashboard" && row("Dashboard-Passwort", textField(`${s}.dashboard_password`, { type: "password", wide: false, placeholder: "falls gesetzt" })),
      mode === "dashboard" && el("div", { class: "row" }, el("div", { class: "label" }, dbRes),
        el("button", { class: "btn", onclick: async () => {
          dbRes.replaceChildren("Teste …");
          const r = await api("/api/test-dashboard", { method: "POST", body: JSON.stringify({ url: S.draft.settings.dashboard_url, password: S.draft.settings.dashboard_password }) });
          dbRes.replaceChildren(el("span", { class: "dot " + (r.ok ? "ok" : "err") }), r.message);
        } }, "Verbindung testen")),
      mode === "dashboard" && S.boot.app && el("div", { class: "row", style: { display: "block" } },
        el("div", { class: "label" }, "Einmalig im ESPHome Device Builder einstellen"),
        el("ol", { class: "howto" },
          el("li", {}, "Home Assistant → Einstellungen → Apps → ESPHome Device Builder → Reiter „Konfiguration“"),
          el("li", {}, "„Nicht verwendete optionale Konfigurationsoptionen einblenden“ einschalten"),
          el("li", {}, "„Disable external authentication“ einschalten → Speichern"),
          el("li", {}, "Bei „Netzwerk“ 6052 eintragen → Speichern"),
          el("li", {}, "Reiter „Info“ → Neu starten, dann hier „Verbindung testen“")),
        el("div", { class: "banner warn", style: { marginTop: "8px" } }, el("div", {}, el("b", {}, "Gut zu wissen"),
          "Damit ist der ESPHome Device Builder in deinem WLAN ohne Passwort erreichbar. Lieber nicht? Dann „ESPHome-Ordner“ wählen – dort klickst du nur selbst auf „Installieren“."))),
    ], mode === "local" ? "Kompiliert mit ESPHome auf diesem PC und spielt die Firmware direkt aufs Panel."
      : mode === "folder" ? "Sicherer Weg: kein offener Port, nichts an ESPHome umstellen."
        : "Speichert die Konfiguration im ESPHome Device Builder, lässt dort kompilieren und spielt sie per WLAN auf – alles mit einem Klick."),
    group("Sicherheit", [
      row("API-Schlüssel", el("span", { style: { display: "flex", gap: "6px" } }, textField(`${s}.api_key`, { placeholder: "Base64, 32 Byte" }),
        el("button", { class: "btn", onclick: () => {
          const b = new Uint8Array(32); crypto.getRandomValues(b);
          change(`${s}.api_key`, btoa(String.fromCharCode(...b)), true);
        } }, "Neu")), "Hat dein Panel schon einen? Dann genau den eintragen, sonst fragt HA neu nach."),
      row("OTA-Passwort", textField(`${s}.ota_password`, { type: "password", wide: false, placeholder: "optional" })),
      row("Ersatz-WLAN", el("span", { class: "secret-pw" }, el("code", { class: "no-tr" }, S.showAp ? S.draft.settings.ap_password : "••••••••••••"),
        el("button", { class: "btn small", onclick: () => { S.showAp = !S.showAp; render(); } }, S.showAp ? "Verbergen" : "Anzeigen"),
        el("button", { class: "btn small", onclick: () => {
          const A = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789", b = new Uint32Array(12); crypto.getRandomValues(b);
          change(`${s}.ap_password`, Array.from(b, (v) => A[v % A.length]).join(""), true); S.showAp = true; render();
        } }, "Neu")),
        "Findet das Panel dein WLAN nicht, öffnet es den Hotspot „PixelPanel Fallback“ – nur mit diesem Passwort"),
    ]),
    !S.boot.app && accessGroup(), !S.boot.app && devicesGroup()];
}

// ---- QR-Code (lokal erzeugt mit qrcode.js, MIT-Lizenz)
const SVG_QR = '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M1 1h6v6H1zm1.5 1.5v3h3v-3zM9 1h6v6H9zm1.5 1.5v3h3v-3zM1 9h6v6H1zm1.5 1.5v3h3v-3zM9 9h2v2H9zm2 2h2v2h-2zm2-2h2v2h-2zm-4 4h2v2H9zm4 0h2v2h-2z"/></svg>';
function qrSvg(text) {
  if (typeof qrcode !== "function") return "";
  const q = qrcode(0, "M");
  q.addData(text);
  q.make();
  const n = q.getModuleCount(), m = 4, size = n + 2 * m;
  let d = "";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x + m} ${y + m}h1v1h-1z`;
  return `<svg viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
// ---- Zugriff vom Handy & Tablet (Benutzername + Passwort; nur am PC änderbar)
function accessGroup() {
  const A = S.access;
  const box = el("div", {});
  if (!A) {
    api("/api/access").then((r) => { if (!r.error) { S.access = r; if (isSettingsView(S.view)) render(); } });
    return group("Zugriff vom Handy & Tablet", [el("div", { class: "row" }, el("div", { class: "label" }, "…"))]);
  }
  const F = (S.accessForm ||= { user: A.user || "", pw: "", pw2: "" });
  const save = async (extra, creds = false) => {
    const body = Object.assign({}, extra);
    if (creds && (F.user !== A.user || F.pw)) {
      if (F.pw && F.pw !== F.pw2) { toast("Die beiden Passwörter sind nicht gleich"); return; }
      body.user = F.user.trim();
      if (F.pw) body.password = F.pw;
    }
    const r = await api("/api/access", { method: "POST", body: JSON.stringify(body) });
    if (r.error) { toast(r.error, 4000); return; }
    S.access = Object.assign({}, A, r);
    if (creds) S.accessForm = { user: r.user, pw: "", pw2: "" };
    if (r.restart) {
      toast(body.lan ? "Wird freigegeben – das Studio startet kurz neu …" : "Freigabe beendet – das Studio startet kurz neu …", 3500);
      const want = !!body.lan;
      const poll = (n) => setTimeout(() => api("/api/access").then((x) => {
        if (x.error || (x.serving_lan !== want && n > 0)) return poll(n - 1);
        S.access = x; render();
      }).catch(() => n > 0 && poll(n - 1)), 1200);
      poll(10);
    } else toast("Gespeichert");
    render();
  };
  if (!A.local) {
    return group("Zugriff vom Handy & Tablet", [
      row("Angemeldet als", el("b", {}, A.user)),
      el("div", { class: "row" }, el("div", { class: "label" }, el("small", {}, "Benutzername, Passwort und Freigabe lassen sich nur am PC ändern, auf dem das Studio läuft.")),
        el("button", { class: "btn", onclick: async () => { await api("/api/logout", { method: "POST" }); location.href = U("/login"); } }, "Abmelden")),
    ]);
  }
  const lanOn = A.lan && A.has_password;
  const pwRow = (label, key, hint) => row(label, el("input", { class: "field", type: "password", autocomplete: "new-password", value: F[key],
    placeholder: A.has_password ? "unverändert" : `mindestens ${A.min_pw} Zeichen`, oninput: (e) => (F[key] = e.target.value) }), hint);
  return group("Zugriff vom Handy & Tablet", [
    el("div", { class: "row sec-note" }, el("span", { class: "sec-ico" }, "🔒"), el("div", { class: "label" },
      "Geschützt durch Benutzername und Passwort. Ändern geht nur an diesem PC – schütze ihn mit einem Windows-Passwort. Im Heimnetz ohne HTTPS: nutze ein eigenes Passwort und gib das Studio nie im Router fürs Internet frei.")),
    row("Benutzername", el("input", { class: "field", autocomplete: "username", autocapitalize: "none", value: F.user, maxlength: 32,
      placeholder: "z. B. bitax", oninput: (e) => (F.user = e.target.value) })),
    pwRow(A.has_password ? "Neues Passwort" : "Passwort fürs Handy", "pw", A.has_password ? "Leer lassen, um es zu behalten" : "Nur fürs Handy/Tablet – am PC selbst brauchst du keins"),
    pwRow("Passwort wiederholen", "pw2"),
    el("div", { class: "row" }, el("div", { class: "label" }, el("small", {}, "Ändern meldet alle Geräte ab. Kein Passwort verwenden, das du woanders auch nutzt.")),
      el("button", { class: "btn", onclick: () => save({}, true) }, A.has_password ? "Zugangsdaten ändern" : "Festlegen")),
    row("Im WLAN freigeben", el("label", { class: "switch" }, el("input", { type: "checkbox", checked: lanOn, disabled: !A.has_password || A.env_host,
      onchange: (e) => save({ lan: e.target.checked }) }), el("span")),
      !A.has_password ? "Erst Benutzername und Passwort festlegen" : lanOn ? "An – Handy und Tablet können sich mit Benutzername und Passwort anmelden" : "Aus – nur dieser PC kommt ins Studio"),
    lanOn && A.serving_lan && el("div", { class: "row access-addr" }, el("div", { class: "label" }, "Am Handy öffnen", S.explain && el("div", { class: "explain" }, "Diese Adresse tippst du am Handy oder Tablet in den Browser – oder du tippst auf das QR-Symbol und scannst den Code mit der Handy-Kamera. Das Handy muss dafür im selben WLAN sein. Tipp: Danach im Browser „Zum Home-Bildschirm“ wählen, dann ist das Studio wie eine App da."),
      el("small", {}, "Im Browser eintippen, dann anmelden. Tipp: danach „Zum Home-Bildschirm“ – dann wirkt es wie eine App.")),
      el("div", { class: "addr-list" }, (A.addresses || []).map((u) => el("div", { class: "addr" },
        el("code", {}, u),
        el("button", { class: "qr-btn" + (S.qrOpen === u ? " on" : ""), title: "QR-Code fürs Handy", "aria-label": "QR-Code", html: SVG_QR,
          onclick: () => { S.qrOpen = S.qrOpen === u ? null : u; render(); } }))))),
    lanOn && A.serving_lan && S.qrOpen && (A.addresses || []).includes(S.qrOpen) && el("div", { class: "row qr-row" },
      el("div", { class: "qr-box", html: qrSvg(S.qrOpen) }),
      el("div", { class: "label" }, "Mit der Handy-Kamera scannen", el("small", {}, S.qrOpen),
        el("small", {}, "Das Handy muss im selben WLAN sein. Danach mit Benutzername und Passwort anmelden."))),
  ], A.env_host
    ? "Die Freigabe wird gerade über PIXELPANEL_HOST gesteuert. Ohne Benutzername und Passwort kommen andere Geräte trotzdem nicht hinein."
    : "Beim ersten Einschalten fragt Windows evtl. nach der Firewall – „Private Netzwerke“ erlauben. Niemals im Router fürs Internet freigeben.");
}
// ---- Angemeldete Geräte: Liste, einzeln abmelden (am PC jedes, im WLAN nur das eigene)
const fmtAgo = (ts) => {
  const d = Math.max(0, Date.now() / 1000 - ts);
  if (d < 120) return "gerade eben";
  if (d < 3600) return `vor ${Math.round(d / 60)} Min.`;
  if (d < 86400) return `vor ${Math.round(d / 3600)} Std.`;
  if (d < 2 * 86400) return "gestern";
  return new Date(ts * 1000).toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric" });
};
function devicesGroup() {
  const A = S.access;
  if (!A || !(A.lan && A.has_password) || !(A.devices || []).length && !A.local) return null;
  const list = A.devices || [];
  const reload = async () => { const r = await api("/api/access"); if (!r.error) { S.access = r; render(); } };
  const end = async (d) => {
    const r = await api("/api/access/end", { method: "POST", body: JSON.stringify({ id: d.id }) });
    if (r.error) { toast(r.error, 4000); return; }
    if (d.me) { location.href = U("/login"); return; }
    toast(`„${d.name}“ abgemeldet`); reload();
  };
  const rows = list.map((d) => el("div", { class: "row dev-row" + (d.me ? " me" : "") },
    el("span", { class: "dev-ico" }, /iPhone|Android/.test(d.ua) ? "📱" : /iPad/.test(d.ua) ? "▭" : "💻"),
    el("div", { class: "label" }, d.name, d.me && el("span", { class: "dev-me" }, "dieses Gerät"),
      el("small", {}, [d.auto ? null : d.ua, `zuletzt aktiv ${fmtAgo(d.seen)}`, d.remember ? "bleibt 30 Tage angemeldet" : "bis der Browser geschlossen wird"].filter(Boolean).join(" · "))),
    (A.local || d.me) && el("button", { class: "btn", onclick: () => end(d) }, "Abmelden")));
  if (!list.length) rows.push(el("div", { class: "row" }, el("div", { class: "label" }, el("small", {}, "Noch kein Handy oder Tablet angemeldet."))));
  if (A.local && list.length > 1) rows.push(el("div", { class: "row" }, el("div", { class: "label" }),
    el("button", { class: "btn danger", onclick: async () => { await api("/api/access/end-all", { method: "POST" }); toast("Alle Geräte abgemeldet"); reload(); } }, "Alle abmelden")));
  return group("Angemeldete Geräte", rows, A.local ? "iPads melden sich im Browser oft als „Mac“ – beim Anmelden lässt sich deshalb ein eigener Name vergeben." : "Andere Geräte kann nur der PC abmelden, auf dem das Studio läuft.");
}
function hardwareGroup() {
  const s = "settings", B = S.boot.boards;
  const key = B[S.draft.settings.hw_board] ? S.draft.settings.hw_board : "devkit";
  const bd = B[key];
  const pick = (k) => { setPath(S.draft, `${s}.board`, B[k].pio); change(`${s}.hw_board`, k, true); };
  const cards = el("div", { class: "bcards" }, Object.entries(B).map(([k, b]) =>
    el("button", { class: "bcard" + (k === key ? " on" : ""), onclick: () => pick(k) },
      el("b", {}, b.name), el("span", { class: "chip " + b.chip.replace(/[^A-Z0-9]/gi, "") }, b.chip))));
  const pins = bd.pins || S.draft.settings.pins;
  const pinGrid = el("div", { class: "pins" + (bd.pins ? " ro" : "") }, S.boot.pinKeys.map((k) => el("label", {}, k.toUpperCase(),
    bd.pins ? el("span", { class: "field num" }, `GPIO${pins[k]}`)
      : el("input", { class: "field num", type: "number", min: 0, max: 48, value: S.draft.settings.pins[k] ?? "",
        oninput: (e) => change(`${s}.pins.${k}`, e.target.value === "" ? "" : +e.target.value) }))));
  return group("Hardware", [
    el("div", { class: "row", style: { display: "block", padding: "12px 14px" } }, cards),
    row("Gewählt", el("span", { class: "chip " + bd.chip.replace(/[^A-Z0-9]/gi, "") }, bd.chip), bd.note),
    row(bd.pins ? "Pin-Belegung" : "Pin-Belegung (selbst eintragen)", el("span"), bd.preset
      ? `Fertiges ESPHome-Board-Preset „${bd.preset}“ – die Pins setzt ESPHome selbst, so sind sie fest verdrahtet:`
      : bd.pins ? "Diese Pins werden in die Firmware geschrieben:" : "GPIO vom ESP32 zum HUB75-Stecker. E ist ab 64 Pixel Höhe Pflicht."),
    el("div", { class: "row", style: { display: "block", padding: "4px 14px 12px" } }, pinGrid),
    el("div", { class: "row", style: { display: "block", padding: "12px 14px" } },
      el("div", { class: "label", style: { marginBottom: "8px" } }, "Passt das Board zu deinem Panel?", el("small", {}, "Speicher und Tempo – mit deiner Animation „" + ((ANIMS.find((x) => x[0] === animCfg().style) || [, "–"])[1]) + "“")),
      perfBanner(animCfg().style)),
    el("div", { class: "row" }, el("div", { class: "label" }, "Anleitung", el("small", {}, "Wo welches Kabel hin muss – Panel, ESP32 und Netzteil, mit Bildern")),
      el("button", { class: "btn primary", onclick: () => go("wiring") }, "Verkabelung zeigen")),
    row("Treiberchip", selectField(`${s}.shift_driver`, [["GENERIC", "Standard (GENERIC)"], ["FM6126A", "FM6126A / ICN2038S"], ["FM6124", "FM6124"], ["MBI5124", "MBI5124"], ["DP3246", "DP3246"]]),
      "Falsche Farben oder dunkles Panel? Hier zuerst FM6126A probieren."),
  ], "Boards mit Preset entsprechen genau den Board-Vorlagen von ESPHome. Für große Flächen (mehr als 128 × 64) ist ein ESP32-S3 empfohlen.");
}
// ---------------------------------------------------------------- Panel-Anordnung
const LAYOUT_TXT = {
  HORIZONTAL: "Eine Reihe", TOP_LEFT_DOWN: "Schlange ab oben links", TOP_RIGHT_DOWN: "Schlange ab oben rechts",
  BOTTOM_LEFT_UP: "Schlange ab unten links", BOTTOM_RIGHT_UP: "Schlange ab unten rechts",
  TOP_LEFT_DOWN_ZIGZAG: "Zickzack ab oben links", TOP_RIGHT_DOWN_ZIGZAG: "Zickzack ab oben rechts",
  BOTTOM_LEFT_UP_ZIGZAG: "Zickzack ab unten links", BOTTOM_RIGHT_UP_ZIGZAG: "Zickzack ab unten rechts",
};
function setPanel(key, val) { setPanelMulti({ [key]: val }); }
function setPanelMulti(obj) {
  const pc = Object.assign({}, S.draft.settings.panel, obj);
  const key = Object.keys(obj).join(",");
  if (/cols|rows/.test(key)) pc.missing = (pc.missing || []).filter((m) => { const [r, c] = m.split(",").map(Number); return r < pc.rows && c < pc.cols; });
  change("settings.panel", pc, true);
  resetRotation();
}
function panelGroup() {
  const g = geom();
  const pc = S.draft.settings.panel;
  const num = (key, max) => el("span", { class: "stepper" },
    el("button", { disabled: g[key] <= 1, onclick: () => setPanel(key, g[key] - 1), title: "weniger" }, "−"),
    el("b", {}, g[key]),
    el("button", { disabled: g[key] >= max, onclick: () => setPanel(key, g[key] + 1), title: "mehr" }, "+"));
  // Raster der Module (Ansicht von vorne, ungedreht)
  const cellsEl = el("div", { class: "mod-grid", style: { gridTemplateColumns: `repeat(${g.cols}, 1fr)`, aspectRatio: `${g.PW} / ${g.PH}` } });
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
    const key = r + "," + c, miss = g.missing.has(key), info = g.chain[key];
    cellsEl.append(el("button", { class: "mod" + (miss ? " miss" : ""), title: miss ? "Fehlt – klicken zum Hinzufügen" : "Klicken, wenn hier kein Modul sitzt",
      onclick: () => {
        if (g.rows * g.cols === 1) return;
        const set = new Set(pc.missing || []);
        if (set.has(key)) set.delete(key); else if (set.size < g.rows * g.cols - 1) set.add(key);
        setPanel("missing", [...set]);
      } },
    miss ? el("span", { class: "mod-x" }, "leer") : [
      el("b", {}, info.pos + 1), info.pos === 0 ? el("span", { class: "mod-esp" }, "ESP") : null,
      info.flip ? el("span", { class: "mod-flip", title: "Modul steht in dieser Verkabelung auf dem Kopf" }, "↻ 180°") : null]));
  }
  // Fertige Anordnungen als Bilder
  const ARR = [
    ["1 Panel", 1, 1, []], ["2 nebeneinander", 2, 1, []], ["3 nebeneinander", 3, 1, []], ["4 nebeneinander", 4, 1, []],
    ["2 übereinander", 1, 2, []], ["3 übereinander", 1, 3, []], ["2 × 2", 2, 2, []], ["3 × 2", 3, 2, []],
    ["L-Form", 2, 2, ["0,1"]], ["L-Form", 2, 2, ["0,0"]], ["L-Form", 2, 2, ["1,1"]], ["L-Form", 2, 2, ["1,0"]],
  ];
  const curMiss = [...g.missing].sort().join("|");
  const arrThumb = (cols, rows, miss) => {
    const set = new Set(miss), mods = [], gone = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
      (set.has(r + "," + c) ? gone : mods).push({ x: c * g.mw, y: r * g.mh, w: g.mw, h: g.mh });
    return panelSvg(cols * g.mw, rows * g.mh, mods, { gone, maxW: 92, maxH: 52 });
  };
  const arrCards = el("div", { class: "acards" }, ARR.map(([label, cols, rows, miss]) => {
    const on = g.cols === cols && g.rows === rows && [...miss].sort().join("|") === curMiss;
    return el("button", { class: "acard" + (on ? " on" : ""), onclick: () => setPanelMulti({ cols, rows, missing: miss, layout: "auto" }) },
      arrThumb(cols, rows, miss), el("span", {}, label));
  }));
  const pxTotal = g.PW * g.PH;
  const cm = (v) => (v * g.pitch / 10).toLocaleString(LOCALE, { maximumFractionDigits: 1 });
  return group("Panel", [
    row("Modul", el("select", { class: "field", onchange: (e) => setPanel("module", e.target.value) },
      Object.keys(S.boot.geo.modules).map((k) => el("option", { value: k, selected: g.module === k }, k.replace("x", " × ") + " Pixel"))), "Auflösung eines einzelnen Panels"),
    row("Pixelabstand", el("select", { class: "field", onchange: (e) => setPanel("pitch", +e.target.value) },
      S.boot.geo.pitches.map((v) => el("option", { value: v, selected: Math.abs(v - g.pitch) < 0.01 }, `P${String(v).replace(".", ",")} (${String(v).replace(".", ",")} mm)`))), "Steht meist auf dem Panel oder der Verpackung, z. B. P3"),
    el("div", { class: "row", style: { display: "block", padding: "12px 14px" } },
      el("div", { class: "label", style: { marginBottom: "10px" } }, "Anordnung", el("small", {}, "Wie deine Panels zusammengesetzt sind (Ansicht von vorne)")),
      arrCards),
    row("Eigene Anordnung", el("span", { class: "dur" }, num("cols", 4), "nebeneinander ×", num("rows", 4), "übereinander"), "Für alles, was oben nicht dabei ist"),
    g.rows * g.cols > 1 && el("div", { class: "row", style: { flexDirection: "column", alignItems: "stretch", gap: "8px" } },
      el("div", { class: "label" }, "Verkabelung", el("small", {}, "Die Zahlen zeigen die Reihenfolge der Kette ab dem ESP, ↻ = Modul steht auf dem Kopf. Ein Modul anklicken, wenn dort keins sitzt.")),
      cellsEl),
    g.rows * g.cols > 1 && row("Ketten-Layout", el("select", { class: "field", onchange: (e) => setPanel("layout", e.target.value) },
      el("option", { value: "auto", selected: g.layoutSetting === "auto" }, `Automatisch (${LAYOUT_TXT[g.layout]})`),
      g.allowedLayouts.map((L) => el("option", { value: L, selected: g.layoutSetting === L }, LAYOUT_TXT[L]))),
    "Schlange: jede zweite Reihe steht auf dem Kopf (kurze Kabel). Zickzack: alle aufrecht."),
    row("Drehung", el("div", { class: "seg" }, [0, 90, 180, 270].map((v) => el("button", { class: g.rot === v ? "on" : "", onclick: () => setPanel("rotation", v) }, v + "°"))),
      "Wenn das Panel hochkant oder kopfüber hängt"),
  ], [
    el("div", {}, `Gesamt: ${g.W} × ${g.H} Pixel · ${cm(g.W)} × ${cm(g.H)} cm · ${g.modules} Modul${g.modules > 1 ? "e" : ""} · gut lesbar ab ca. ${String(Math.max(1, Math.round(g.pitch))).replace(".", ",")} m`),
    !g.chainValid ? el("div", { class: "banner err", style: { marginTop: "8px" } }, "Mit diesem Layout sitzt ein fehlendes Modul mitten in der Kette – dann kommt das Bild nicht an. Wähle „Automatisch“ oder ein anderes Layout.") : null,
    pxTotal > 8192 && (S.boot.boards[S.draft.settings.hw_board] || S.boot.boards.devkit).chip === "ESP32" ? el("div", { class: "banner warn", style: { marginTop: "8px" } },
      "Große Fläche für einen klassischen ESP32: die Farbtiefe wird automatisch reduziert. Für flüssige Darstellung ist ein ESP32-S3 besser.") : null,
    g.modules > 1 ? el("div", {}, "Falls das Bild nach dem Übertragen vertauscht oder gespiegelt ist: anderes Ketten-Layout probieren.") : null,
  ]);
}
// Strom-Tabelle neu berechnen, ohne das Eingabefeld zu verlieren
let powerTimer;
function refreshPower() {
  clearTimeout(powerTimer);
  powerTimer = setTimeout(() => {
    const old = document.getElementById("power-group");
    if (!old) return;
    const fresh = powerGroup();
    // Zusammenfassung (Satz, Balken, Farbe), Tabelle und Fußtext ersetzen – die Eingabefelder bleiben
    for (const sel of [".psu-summary", ".power-rows", ".group-foot"]) {
      const o = old.querySelector(sel), n = fresh.querySelector(sel);
      if (o && n) o.replaceWith(n);
    }
    renderPanels();
  }, 150);
}
function powerGroup() {
  const g = geom(), pw = power();
  const budget = Math.max(0.05, pw.amp * S.boot.geo.safety - S.boot.geo.espReserve - pw.idle);
  const fullWhite = pw.module_amp * g.modules;
  const whitePct = Math.min(100, Math.round(budget / fullWhite * 100));
  const rows = S.draft.pages.filter((p) => p.enabled).map((p) => {
    const f = frame([{ page: p, area: g.areaOf(p) }]);
    const pct = Math.round(Math.min(f.cap, 255) / 2.55);
    return el("div", { class: "row" }, el("div", { class: "label" }, p.name, el("small", {}, `≈ ${fmtA(f.fullNeed)} bei voller Helligkeit`)),
      el("span", { class: "state" + (pct < 100 ? " warn" : " on") }, pct < 100 ? `max. ${pct} %` : "100 %"));
  });
  const ok = budget >= fullWhite;
  const summary = el("div", { class: "row psu-summary", style: { display: "block", padding: "12px 14px" } },
    el("div", { class: "psu-sum " + (ok ? "ok" : whitePct >= 40 ? "warn" : "bad") },
      el("b", {}, ok ? "Dein Netzteil reicht für alles – auch für komplett weiße Bilder."
        : whitePct >= 40 ? "Dein Netzteil reicht für Texte und Uhren in voller Helligkeit. Große helle Flächen dimmt das Panel automatisch."
          : "Dein Netzteil ist knapp: Das Panel dimmt oft automatisch herunter, damit nichts überlastet wird."),
      el("div", { class: "psu-bar" }, el("i", { style: { width: Math.min(100, whitePct) + "%" } })),
      el("small", {}, `Verfügbar für die LEDs: ${fmtA(budget)} · komplett weiß bräuchte ${fmtA(fullWhite)}${ok ? "" : ` · für alles in voller Helligkeit wären ca. ${Math.ceil((fullWhite + S.boot.geo.espReserve + pw.idle) / S.boot.geo.safety)} A nötig`}`)));
  const gEl = group("Stromversorgung", [
    summary,
    row("Netzteil", el("span", { class: "dur" },
      el("input", { class: "field", type: "number", min: 3, max: 24, step: 0.1, value: pw.volt, style: { width: "64px" },
        oninput: (e) => { change("settings.power.volt", +e.target.value); refreshPower(); } }), "V",
      el("input", { class: "field", type: "number", min: 0.5, max: 60, step: 0.5, value: pw.amp, style: { width: "64px" },
        oninput: (e) => { change("settings.power.amp", +e.target.value); refreshPower(); } }), "A"),
    "Was auf deinem Netzteil steht, z. B. 5 V / 3 A"),
    row("Strom pro Modul bei Vollweiß", el("span", { class: "dur" },
      el("input", { class: "field", type: "number", min: 0.1, max: 20, step: 0.1, value: pw.auto ? "" : pw.module_amp, placeholder: String(pw.module_amp).replace(".", ","), style: { width: "64px" },
        oninput: (e) => { change("settings.power.module_amp", e.target.value === "" ? null : +e.target.value); refreshPower(); } }), "A"),
    "Leer = Schätzung (ca. 1 mA pro Pixel). Datenblatt-Wert ist genauer."),
    el("div", { class: "row" }, el("div", { class: "label" }, "Höchste Helligkeit je Seite", el("small", {}, "Wie hell jede deiner Seiten mit diesem Netzteil werden darf"))),
    el("div", { class: "power-rows" }, rows),
  ], [
    Math.abs(pw.volt - 5) > 0.3 ? el("div", { class: "banner err", style: { marginBottom: "8px" } }, "HUB75-Panels laufen mit 5 V – ein anderes Netzteil kann sie beschädigen.") : null,
    `Für die LEDs bleiben ${fmtA(budget)} (Netzteil ${fmtA(pw.amp)} − 10 % Reserve − ESP32 − Grundlast). Das Panel rechnet jedes Bild selbst durch und dimmt nur, wenn es sonst zu viel ziehen würde. Die Prozente zeigen die höchste sichere Helligkeit je Seite – komplett weiß ginge nur ${whitePct} %.`,
  ]);
  gEl.id = "power-group";
  return gEl;
}

// ================================================================ Router & Rendering
function go(view) {
  document.body.classList.remove("nav-open");
  S.view = view;
  location.hash = view;
  render();
  $("#main").scrollTop = 0;
}
function render() {
  destroyMini();
  S.R.setCustomIcons(S.draft.icons || {});
  const main = $("#main");
  const v = S.view;
  let node;
  if (v === "overview") node = viewOverview();
  else if (v.startsWith("page:")) node = viewPage(v.slice(5));
  else if (v === "devices") node = viewDevices();
  else if (v === "deploy") node = viewDeploy();
  else if (v === "settings" || v.startsWith("settings:")) node = viewSettings();
  else if (v === "animation") node = viewAnimation();
  else if (v === "wiring") node = viewWiring();
  else return go("overview");
  if (!node) return;
  main.replaceChildren(node);
  renderSidebar();
  updateTimeline();
  renderPanels();
}
let planTimer;
function updateSavebar() {
  const show = dirty();
  $("#savebar").classList.toggle("show", show);
  clearTimeout(planTimer);
  if (show) planTimer = setTimeout(updatePlan, 250);
}
async function updatePlan() {
  const r = await api("/api/plan", { method: "POST", body: JSON.stringify(S.draft) });
  S.needsFlash = r.needs_flash !== false;
  const apply = $("#btn-apply");
  apply.textContent = S.needsFlash ? "Übernehmen & aufs Panel" : "Live übernehmen";
  $("#savebar span").textContent = S.needsFlash
    ? (r.deployed ? "Änderung braucht einmal Übertragen" : "Ungespeicherte Änderungen")
    : "Nur Live-Werte geändert – kein Flashen nötig";
}
async function applyChanges() {
  if (S.needsFlash !== false) return startDeploy();
  const r = await api("/api/live", { method: "POST", body: JSON.stringify(S.draft) });
  if (r.error && r.ok === false && !("pushed" in r)) { toast(r.error); return updatePlan(); }
  S.saved = clone(S.draft);
  updateSavebar();
  if (r.demo) toast("Gespeichert – im Demo-Modus geht nichts ans Panel");
  else if (r.ok) toast(r.pushed ? `⚡ Live aufs Panel übertragen (${r.pushed} Wert${r.pushed > 1 ? "e" : ""})` : "Gespeichert – Panel war schon aktuell");
  else toast(r.error || `Gespeichert, aber ${(r.missing || []).length + (r.failed || []).length} Werte kamen nicht an`, 5000);
}

// ---- Sofort-Regler: Helligkeit & Panel an/aus (gespeichert + aufs Panel + auf alle Geräte)
let quickTimer = null, quickPending = {};
function applyQuick(v) {
  for (const c of [S.draft, S.saved]) {
    if ("brightness" in v) c.settings.brightness = v.brightness;
    if ("active" in v) c.active = v.active;
  }
}
function quickSet(v) {
  applyQuick(v);
  updateSavebar(); renderPanels(); renderSidebar();
  Object.assign(quickPending, v);
  if (quickTimer) return;
  const send = async () => {
    const body = quickPending; quickPending = {};
    const r = await api("/api/quick", { method: "POST", body: JSON.stringify(body) });
    if (r.error) toast(r.error);
    quickTimer = Object.keys(quickPending).length ? setTimeout(send, 250) : null;
  };
  quickTimer = setTimeout(send, "active" in v ? 0 : 150);
}
// ---- Gleichzeitig auf PC und Handy: Änderungen der anderen Geräte übernehmen
async function remoteChanged() {
  const cfg = await api("/api/config");
  if (!cfg || !cfg.pages || cfg.error) return;
  if (JSON.stringify(cfg) === JSON.stringify(S.saved)) return;
  if (!dirty()) { S.saved = cfg; S.draft = clone(cfg); afterRemote(); toast("Auf einem anderen Gerät geändert – übernommen"); return; }
  S.remote = cfg;
  showSyncBar();
}
function afterRemote() {
  hideSyncBar(); S.remote = null;
  resetRotation(); updateSavebar(); render();
  if (typeof updatePlan === "function") updatePlan();
}
function hideSyncBar() { const b = document.getElementById("sync-bar"); if (b) b.remove(); }
function showSyncBar() {
  hideSyncBar();
  document.body.append(el("div", { class: "sync-bar", id: "sync-bar", role: "alert" },
    el("span", {}, el("b", {}, "Auf einem anderen Gerät geändert. "), "Du hast hier noch ungespeicherte Änderungen."),
    el("span", { class: "sync-btns" },
      el("button", { class: "btn", onclick: () => { S.saved = S.remote; afterRemote(); toast("Deine Änderungen bleiben – beim Speichern ersetzen sie die anderen"); } }, "Meine Änderungen behalten"),
      el("button", { class: "btn primary", onclick: () => { S.saved = S.remote; S.draft = clone(S.remote); afterRemote(); } }, "Neu laden"))));
}

async function save() {
  const r = await api("/api/config", { method: "PUT", body: JSON.stringify(S.draft) });
  if (r.ok) { S.saved = clone(S.draft); updateSavebar(); toast("Gespeichert"); }
  else toast(r.error || "Speichern fehlgeschlagen");
}

// ================================================================ Live-Daten
async function loadEntities() {
  const r = await api("/api/entities");
  if (!r.entities) return;
  if (S.seen) r.entities.forEach((e) => { if (!S.seen.has(e.entity_id)) S.fresh.add(e.entity_id); });
  S.seen = new Set(r.entities.map((e) => e.entity_id));
  S.entities = r.entities;
  S.byId = Object.fromEntries(r.entities.map((e) => [e.entity_id, e]));
  S.haStatus = r.status; S.haError = r.error;
  S.counts = { devices: r.devices, areas: r.areas };
  autoSuggest();
  const node = $("#main").firstChild;
  const typing = document.activeElement && ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName);
  if (!typing && !$(".overlay")) render();
  else if (node && node._redraw) { node._redraw(); renderSidebar(); }
  else renderSidebar();
}
// Einmalig sinnvolle Entitäten vorschlagen, wenn noch nichts gewählt ist
let suggested = false;
function autoSuggest() {
  if (suggested || !S.entities.length) return;
  suggested = true;
  for (const p of S.draft.pages) {
    const o = p.options;
    if (p.type === "weather" && !o.entity) {
      const w = S.entities.find((e) => e.domain === "weather");
      if (w) o.entity = w.entity_id;
    }
  }
  updateSavebar();
}

let regTimer;
function connectEvents() {
  const es = new EventSource(U("/api/events"));
  es.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.type === "registry" || msg.type === "status") {
      clearTimeout(regTimer);
      regTimer = setTimeout(loadEntities, 350);
    } else if (msg.type === "config") {
      if (msg.origin !== CLIENT_ID) remoteChanged();
    } else if (msg.type === "quick") {
      if (msg.origin === CLIENT_ID) return;
      const v = {};
      if ("brightness" in msg) v.brightness = msg.brightness;
      if ("active" in msg) v.active = msg.active;
      applyQuick(v);
      const sl = document.getElementById("quick-bright");
      if (sl && "brightness" in v && document.activeElement !== sl) sl.value = v.brightness;
      if ("active" in v && S.view === "overview") render(); else { renderPanels(); renderSidebar(); }
      updateSavebar();
    } else if (msg.type === "state") {
      const e = S.byId[msg.entity_id];
      if (!e) return;
      e.state = msg.state; e.attributes = msg.attributes;
      e.unit = (msg.attributes || {}).unit_of_measurement || "";
      const cell = document.querySelector(`[data-eid="${CSS.escape(msg.entity_id)}"]`);
      if (cell) {
        cell.textContent = fmtState(e);
        cell.classList.toggle("on", e.state === "on");
        cell.classList.add("flash");
        setTimeout(() => cell.classList.remove("flash"), 60);
      }
      renderPanels();
    }
  };
}

// ================================================================ Start
(async function init() {
  S.boot = await api("/api/bootstrap");
  if (!S.boot.config) return;  // nicht angemeldet → api() leitet zur Anmeldung um
  if (!S.boot.app) api("/api/access").then((r) => { if (!r.error) { S.access = r; renderSidebar(); } });
  if (!S.boot.app) api("/api/update").then((r) => { if (r && r.available) { S.update = r; if (S.view === "overview") render(); } });
  S.saved = S.boot.config;
  S.draft = clone(S.saved);
  S.R = PixelRenderer.create(S.boot);
  $("#btn-discard").onclick = () => { S.draft = clone(S.saved); resetRotation(); updateSavebar(); render(); };
  $("#btn-save").onclick = save;
  $("#btn-apply").onclick = applyChanges;
  window.addEventListener("beforeunload", (e) => { if (dirty()) { e.preventDefault(); e.returnValue = ""; } });
  window.addEventListener("resize", () => renderPanels());
  window.addEventListener("hashchange", () => {
    const v = decodeURIComponent(location.hash.slice(1)) || "overview";
    if (v !== S.view) { S.view = v; render(); }
  });
  S.view = decodeURIComponent(location.hash.slice(1)) || "overview";
  render();
  await loadEntities();
  connectEvents();
  resetRotation();
  setInterval(() => {
    tickRotation(); renderPanels(); refreshAnimState();
    document.querySelectorAll("[data-tkey]").forEach((n) => {
      const m = S.timers[n.dataset.tkey];
      n.textContent = timerText(m); n.classList.toggle("on", !!(m && m.rem > 0));
    });
  }, 1000);
  const d = await api("/api/deploy");
  if (d.running) { S.deploy = { running: true, total: 0, lines: [], step: 0, ok: null }; pollDeploy(); }
})();

// ---- Mobil: Menü-Knopf, Seitentitel in der oberen Leiste
(() => {
  const btn = document.getElementById("menu-btn"), bd = document.getElementById("nav-backdrop");
  if (btn) btn.addEventListener("click", () => document.body.classList.toggle("nav-open"));
  if (bd) bd.addEventListener("click", () => document.body.classList.remove("nav-open"));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.body.classList.remove("nav-open"); });
  const title = document.getElementById("mbar-title"), main = document.getElementById("main");
  if (title && main) new MutationObserver(() => {
    const h = main.querySelector(".view-head h2");
    const t = h ? h.textContent : "PixelPanel Studio";
    if (title.textContent !== t) title.textContent = t;
  }).observe(main, { childList: true, subtree: true, characterData: true });
})();
