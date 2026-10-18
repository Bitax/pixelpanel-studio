/* PixelPanel-Renderer + Geometrie.
 * Spiegelt 1:1 geometry.py und die C++-Lambdas aus yaml_gen.py – Änderungen immer an allen Stellen. */
(function (root) {
  // Umlaute, € und ° haben eigene Pixelzeichen (Kodierung wie in pixelfont.py: \x80 … \x84)
  const ASCII_REP = { "ä": "\x80", "ö": "\x81", "ü": "\x82", "Ä": "\x80", "Ö": "\x81", "Ü": "\x82", "ß": "ss",
    "°": "\x84", "€": "\x83", "$": "USD", "²": "2", "³": "3", "µ": "u" };
  const GREY = [142, 142, 147], TRACK = [38, 38, 40];

  function hex(c) {
    const h = /^#?([0-9a-f]{6})$/i.exec(c || "") ? c.replace("#", "") : "ffffff";
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  // ================================================================ Geometrie (geometry.py)
  function makeGeometry(G) {
    const MODULES = G.modules, BU = G.bu;
    const DEF = { module: "64x64", cols: 1, rows: 1, missing: [], layout: "auto", pitch: 3, rotation: 0 };
    function allowed(L, rows, cols) {
      if (rows === 1 && cols === 1) return L === "HORIZONTAL";
      if (L === "HORIZONTAL") return rows === 1;
      if (L.includes("ZIGZAG")) return rows > 1 && cols > 1;
      return rows > 1;
    }
    function remap(x, y, L, pw, ph, rows, cols) {
      if (L === "HORIZONTAL") return [x, y, false];
      const row = Math.floor(y / ph), ly = y % ph, vrx = cols * pw, dmax = pw * rows * cols - 1, inv = rows - 1 - row;
      switch (L) {
        case "TOP_LEFT_DOWN": return row % 2 === 0 ? [dmax - x - row * vrx, ph - 1 - ly, true] : [(rows - (row + 1)) * vrx + x, ly, false];
        case "TOP_RIGHT_DOWN": return row % 2 === 1 ? [dmax - x - row * vrx, ph - 1 - ly, true] : [(rows - (row + 1)) * vrx + x, ly, false];
        case "BOTTOM_LEFT_UP": return inv % 2 === 1 ? [(rows - (inv + 1)) * vrx + x, ly, false] : [dmax - inv * vrx - x, ph - 1 - ly, true];
        case "BOTTOM_RIGHT_UP": return inv % 2 === 0 ? [(rows - (inv + 1)) * vrx + x, ly, false] : [dmax - inv * vrx - x, ph - 1 - ly, true];
        case "TOP_LEFT_DOWN_ZIGZAG": case "TOP_RIGHT_DOWN_ZIGZAG": return [(rows - (row + 1)) * vrx + x, ly, false];
        case "BOTTOM_LEFT_UP_ZIGZAG": case "BOTTOM_RIGHT_UP_ZIGZAG": return [(rows - (inv + 1)) * vrx + x, ly, false];
        default: return [x, y, false];
      }
    }
    function chainInfo(L, pw, ph, rows, cols) {
      const n = rows * cols, info = {};
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const [dx, , flip] = remap(c * pw + pw / 2, r * ph + ph / 2, L, pw, ph, rows, cols);
        info[r + "," + c] = { pos: n - 1 - Math.floor(dx / pw), flip };
      }
      return info;
    }
    function chainOk(L, rows, cols, missing, pw, ph) {
      const info = chainInfo(L, pw, ph, rows, cols), present = rows * cols - missing.size;
      return [...missing].every((m) => info[m].pos >= present);
    }
    const PREFS = ["HORIZONTAL", "TOP_LEFT_DOWN_ZIGZAG", "TOP_RIGHT_DOWN_ZIGZAG", "BOTTOM_LEFT_UP_ZIGZAG",
      "BOTTOM_RIGHT_UP_ZIGZAG", "TOP_LEFT_DOWN", "TOP_RIGHT_DOWN", "BOTTOM_LEFT_UP", "BOTTOM_RIGHT_UP"];

    function Geom(settings) {
      const pc = Object.assign({}, DEF, (settings && settings.panel) || {});
      const g = {};
      g.module = MODULES[pc.module] ? pc.module : "64x64";
      [g.mw, g.mh] = MODULES[g.module];
      g.cols = Math.max(1, Math.min(4, parseInt(pc.cols, 10) || 1));
      g.rows = Math.max(1, Math.min(4, parseInt(pc.rows, 10) || 1));
      let miss = new Set();
      for (const m of pc.missing || []) {
        const [r, c] = String(m).split(",").map((v) => parseInt(v, 10));
        if (r >= 0 && r < g.rows && c >= 0 && c < g.cols) miss.add(r + "," + c);
      }
      if (miss.size >= g.rows * g.cols) miss = new Set();
      g.missing = miss;
      const rot = parseInt(pc.rotation, 10) || 0;
      g.rot = [0, 90, 180, 270].includes(rot) ? rot : 0;
      g.pitch = parseFloat(pc.pitch) || 3;
      g.PW = g.mw * g.cols; g.PH = g.mh * g.rows;
      [g.W, g.H] = g.rot === 90 || g.rot === 270 ? [g.PH, g.PW] : [g.PW, g.PH];
      g.modules = g.rows * g.cols - miss.size;
      g.layoutSetting = pc.layout || "auto";
      g.layout = (() => {
        const L = g.layoutSetting;
        if (L !== "auto" && G.layouts.includes(L) && allowed(L, g.rows, g.cols)) return L;
        for (const c of PREFS) if (allowed(c, g.rows, g.cols) && chainOk(c, g.rows, g.cols, miss, g.mw, g.mh)) return c;
        for (const c of PREFS) if (allowed(c, g.rows, g.cols)) return c;
        return "HORIZONTAL";
      })();
      g.chain = chainInfo(g.layout, g.mw, g.mh, g.rows, g.cols);
      g.chainValid = chainOk(g.layout, g.rows, g.cols, miss, g.mw, g.mh);
      g.allowedLayouts = G.layouts.filter((L) => allowed(L, g.rows, g.cols));
      g.toPhys = (x, y) => {
        if (g.rot === 90) return [y, g.PH - 1 - x];
        if (g.rot === 180) return [g.PW - 1 - x, g.PH - 1 - y];
        if (g.rot === 270) return [g.PW - 1 - y, x];
        return [x, y];
      };
      g.present = (x, y) => {
        if (x < 0 || y < 0 || x >= g.W || y >= g.H) return false;
        const [px, py] = g.toPhys(x, y);
        return !miss.has(Math.floor(py / g.mh) + "," + Math.floor(px / g.mw));
      };
      g.blockPresent = (bx, by) => g.present(bx * BU + BU / 2, by * BU + BU / 2);
      g.areaOk = (a) => {
        if (!a) return false;
        const { x, y, w, h } = a;
        if ([x, y, w, h].some((v) => !Number.isInteger(v) || v % BU)) return false;
        if (w < BU || h < BU || x < 0 || y < 0 || x + w > g.W || y + h > g.H) return false;
        for (let bx = x / BU; bx < (x + w) / BU; bx++) for (let by = y / BU; by < (y + h) / BU; by++) if (!g.blockPresent(bx, by)) return false;
        return true;
      };
      g.defaultArea = (() => {
        const full = { x: 0, y: 0, w: g.W, h: g.H };
        if (g.areaOk(full)) return full;
        let best = null, bestA = -1;
        const bw = g.W / BU, bh = g.H / BU;
        for (let y0 = 0; y0 < bh; y0++) for (let x0 = 0; x0 < bw; x0++)
          for (let y1 = y0 + 1; y1 <= bh; y1++) for (let x1 = x0 + 1; x1 <= bw; x1++) {
            const a = { x: x0 * BU, y: y0 * BU, w: (x1 - x0) * BU, h: (y1 - y0) * BU };
            if (a.w * a.h > bestA && g.areaOk(a)) { best = a; bestA = a.w * a.h; }
          }
        return best || { x: 0, y: 0, w: g.W, h: g.H };
      })();
      g.full = () => ({ x: 0, y: 0, w: g.W, h: g.H });
      g.areaOf = (page) => (page && page.type === "stack" ? g.full() : Object.assign({}, g.defaultArea));
      g.moduleRects = () => {
        const out = [];
        for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
          if (miss.has(r + "," + c)) continue;
          const pts = [[c * g.mw, r * g.mh], [(c + 1) * g.mw - 1, (r + 1) * g.mh - 1]].map(([px, py]) => {
            if (g.rot === 90) return [g.PH - 1 - py, px];
            if (g.rot === 180) return [g.PW - 1 - px, g.PH - 1 - py];
            if (g.rot === 270) return [py, g.PW - 1 - px];
            return [px, py];
          });
          const x0 = Math.min(pts[0][0], pts[1][0]), y0 = Math.min(pts[0][1], pts[1][1]);
          out.push({ x: x0, y: y0, w: Math.max(pts[0][0], pts[1][0]) + 1 - x0, h: Math.max(pts[0][1], pts[1][1]) + 1 - y0 });
        }
        out.sort((a, b) => a.y - b.y || a.x - b.x);
        return out;
      };
      g.stackPresets = () => {
        const W = g.W, H = g.H, R = (x, y, w, h) => ({ x, y, w, h }), fl = Math.floor;
        const cands = [
          ["h2", "2 nebeneinander", [R(0, 0, fl(W / 2), H), R(fl(W / 2), 0, fl(W / 2), H)]],
          ["h3", "3 nebeneinander", [0, 1, 2].map((i) => R(fl(i * W / 3), 0, fl(W / 3), H))],
          ["h4", "4 nebeneinander", [0, 1, 2, 3].map((i) => R(fl(i * W / 4), 0, fl(W / 4), H))],
          ["v2", "2 übereinander", [R(0, 0, W, fl(H / 2)), R(0, fl(H / 2), W, fl(H / 2))]],
          ["v3", "3 übereinander", [0, 1, 2].map((i) => R(0, fl(i * H / 3), W, fl(H / 3)))],
          ["g4", "2 × 2", [R(0, 0, fl(W / 2), fl(H / 2)), R(fl(W / 2), 0, fl(W / 2), fl(H / 2)), R(0, fl(H / 2), fl(W / 2), fl(H / 2)), R(fl(W / 2), fl(H / 2), fl(W / 2), fl(H / 2))]],
          ["l1r2", "Groß links, 2 rechts", [R(0, 0, fl(W / 2), H), R(fl(W / 2), 0, fl(W / 2), fl(H / 2)), R(fl(W / 2), fl(H / 2), fl(W / 2), fl(H / 2))]],
          ["l2r1", "2 links, groß rechts", [R(0, 0, fl(W / 2), fl(H / 2)), R(0, fl(H / 2), fl(W / 2), fl(H / 2)), R(fl(W / 2), 0, fl(W / 2), H)]],
          ["t1b2", "Groß oben, 2 unten", [R(0, 0, W, fl(H / 2)), R(0, fl(H / 2), fl(W / 2), fl(H / 2)), R(fl(W / 2), fl(H / 2), fl(W / 2), fl(H / 2))]],
          ["t2b1", "2 oben, groß unten", [R(0, 0, fl(W / 2), fl(H / 2)), R(fl(W / 2), 0, fl(W / 2), fl(H / 2)), R(0, fl(H / 2), W, fl(H / 2))]],
        ];
        if (g.modules > 1) {
          cands.push(["mod", "Je Panel ein Feld", g.moduleRects()]);
          const big = g.defaultArea;
          if (big.w !== W || big.h !== H) {
            const ov = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
            cands.push(["big", "Große Fläche + Rest", [big, ...g.moduleRects().filter((m) => !ov(m, big))]]);
          }
        }
        const out = [], seen = new Set();
        for (const [key, name, rects] of cands) {
          if (!rects.every((a) => g.areaOk(a))) continue;
          const sig = rects.map((a) => [a.x, a.y, a.w, a.h].join(",")).sort().join("|");
          if (seen.has(sig)) continue;
          seen.add(sig);
          out.push({ key, name, rects });
        }
        return out;
      };
      g.stackRects = (key) => { const p = g.stackPresets().find((x) => x.key === key); return p ? p.rects : null; };
      return g;
    }

    function powerCfg(settings, g) {
      const pw = Object.assign({ volt: 5, amp: 3, module_amp: null }, (settings && settings.power) || {});
      let ma = parseFloat(pw.module_amp);
      const auto = !(ma > 0);
      if (auto) ma = Math.round(g.mw * g.mh * 0.001 * 100) / 100;
      const amp = Math.max(0.5, parseFloat(pw.amp) || 3);
      return { volt: parseFloat(pw.volt) || 5, amp, module_amp: ma, i_px: ma / (g.mw * g.mh), idle: G.idlePerModule * g.modules, auto };
    }
    function brightnessCap(acc, i_px, amp, idle) {
      const need = acc / 765.0 * i_px;
      let budget = amp * G.safety - G.espReserve - idle;
      if (budget < 0.05) budget = 0.05;
      if (need <= 0.001) return 255;
      return Math.max(1, Math.min(255, Math.trunc(255.0 * budget / need)));
    }
    const needAmps = (acc, i_px) => acc / 765.0 * i_px;

    // Rotation – spiegelt die Intervall-Lambda in yaml_gen.py. r: {lead, elapsed, wasOk[]}
    function rotate(r, { ok, sticky, interrupt, durs, areas, advance = true }) {
      const N = ok.length;
      let lead = r.lead;
      const was = r.wasOk || [];
      for (let i = 0; i < N; i++) {
        if (ok[i] && !was[i] && interrupt[i] && !sticky[i] && i !== lead) { lead = i; r.elapsed = 0; break; }
      }
      r.wasOk = ok.slice();
      const nextLead = (from) => {
        for (let k = 1; k <= N; k++) { const j = ((from < 0 ? -1 : from) + k) % N; if (ok[j] && !sticky[j]) return j; }
        return -1;
      };
      const ov = (a, b) => areas[a].x < areas[b].x + areas[b].w && areas[b].x < areas[a].x + areas[a].w
        && areas[a].y < areas[b].y + areas[b].h && areas[b].y < areas[a].y + areas[a].h;
      let vis = [], last = -1, gdur = 1;
      const build = (ld) => {
        vis = new Array(N).fill(false); last = ld; gdur = 1;
        if (ld < 0) return;
        vis[ld] = true; gdur = Math.max(1, durs[ld]);
        for (let k = 1; k < N; k++) {
          const j = (ld + k) % N;
          if (!ok[j] || sticky[j]) continue;
          if (vis.some((v, i) => v && ov(i, j))) break;
          vis[j] = true; last = j; gdur = Math.max(gdur, Math.max(1, durs[j]));
        }
      };
      if (lead < 0 || lead >= N || !ok[lead] || sticky[lead]) { lead = nextLead(lead); r.elapsed = 0; build(lead); }
      else {
        build(lead);
        if (advance) {
          r.elapsed++;
          if (r.elapsed >= gdur) { lead = nextLead(last); r.elapsed = 0; build(lead); }
        }
      }
      for (let i = 0; i < N; i++) {
        if (!sticky[i] || !ok[i]) continue;
        if (!vis.some((v, j) => v && ov(i, j))) vis[i] = true;
      }
      r.lead = lead;
      return { vis, gdur };
    }
    // Bedingung gegen einen Zustand (Text) prüfen – wie _cond_cpp
    function condTrue(c, s, thr) {
      s = s == null ? "" : String(s);
      if (!s || s === "unavailable" || s === "unknown") return false;
      const isN = (v) => /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(String(v ?? "").trim());
      const numeric = [">", "<", ">=", "<="].includes(c.op) || isN(c.value);
      if (numeric && isN(c.value)) {
        if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return false;
        const a = Math.fround(parseFloat(s)), v = Math.fround(thr != null ? thr : parseFloat(c.value));
        return { ">": a > v, "<": a < v, ">=": a >= v, "<=": a <= v, "==": a === v, "!=": a !== v }[c.op];
      }
      if (c.op === "==") return s === String(c.value);
      if (c.op === "!=") return s !== String(c.value);
      return false;
    }
    // ---- Timer (spiegelt TIMER_HELPERS / timer_step_cpp in yaml_gen.py)
    const isNumT = (v) => /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(v);
    function isoEpoch(s) {
      s = String(s ?? "");
      const m = /^\s*([-+]?\d{1,4})-([-+]?\d{1,2})-([-+]?\d{1,2})[\s\S]([-+]?\d{1,2}):([-+]?\d{1,2})/.exec(s);
      if (s.length < 16 || !m) return null;
      const [Y, M, D, h, mi] = m.slice(1, 6).map((v) => parseInt(v, 10));
      let p = 16, ss = 0;
      if (p < s.length && s[p] === ":") { ss = parseInt(s.slice(p + 1), 10) || 0; p += 3; }
      while (p < s.length && (s[p] === "." || /[0-9]/.test(s[p]))) p++;
      let off = 0;
      if (p < s.length && (s[p] === "+" || s[p] === "-")) {
        const o = /^([-+]?\d{1,2})(?::([-+]?\d{1,2}))?/.exec(s.slice(p + 1)) || [];
        const oh = parseInt(o[1], 10) || 0, om = parseInt(o[2], 10) || 0;
        off = (oh * 3600 + om * 60) * (s[p] === "-" ? -1 : 1);
      }
      const y = Y - (M <= 2 ? 1 : 0);
      const era = Math.trunc((y >= 0 ? y : y - 399) / 400);
      const yoe = y - era * 400;
      const doy = Math.trunc((153 * (M + (M > 2 ? -3 : 9)) + 2) / 5) + D - 1;
      const doe = yoe * 365 + Math.trunc(yoe / 4) - Math.trunc(yoe / 100) + doy;
      const days = era * 146097 + doe - 719468;
      return days * 86400 + h * 3600 + mi * 60 + ss - off;
    }
    function hms(s) {
      const m = /^\s*([-+]?\d+)(?::\s*([-+]?\d+)(?::\s*([-+]?\d+))?)?/.exec(String(s ?? ""));
      if (!m || m[2] === undefined) return null;
      const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
      if (m[3] !== undefined) return { v: a * 3600 + b * 60 + parseInt(m[3], 10), n: 3 };
      return { v: a * 3600 + b * 60, n: 2 };
    }
    const UNITS = { s: 1, min: 60, h: 3600 };
    // mem: Zustand eines Timers über die Takte; get(entity, attr) -> Text wie der text_sensor; now: ms; epoch: s oder null
    function timerStep(mem, o, get, now, epoch) {
      Object.assign(mem, Object.assign({ rem: -1, max: 0, done: 0, pz: false, first: true, last: "", t0: 0, base: -1, gr: 1 }, mem));
      const mode = ["remaining", "end", "timer"].includes(o.mode) ? o.mode : "remaining";
      const s = get(o.entity, null);
      let r = -1, tot = 0, pz = false;
      const fromEnd = (txt) => {
        const e = epoch == null ? null : isoEpoch(txt);
        if (e == null) return -1;
        const d = e - epoch;
        return d > 0 ? Math.min(d, 359999) : 0;
      };
      if (mode === "remaining") {
        const f = UNITS[o.unit] || 60;
        // läuft intern selbst herunter und gleicht sich bei jedem neuen Wert aus HA neu ab
        if (mem.first || s !== mem.last) {
          mem.first = false; mem.last = s; mem.t0 = now;
          const x = hms(s);
          if (x) mem.base = x.v;
          else if (isNumT(s)) { const v = Math.fround(Math.fround(parseFloat(s)) * f); mem.base = v > 0 ? Math.round(v) : 0; }
          else mem.base = -1;
        }
        if (mem.base >= 0) { r = mem.base - Math.floor(((now - mem.t0) >>> 0) / 1000); if (r < 0) r = 0; }
      } else if (mode === "end") {
        r = fromEnd(s);
      } else {
        const d = hms(get(o.entity, "duration"));
        tot = d ? d.v : 0;
        if (s === "active") r = fromEnd(get(o.entity, "finishes_at"));
        else if (s === "paused") { const x = hms(get(o.entity, "remaining")); if (x) { r = x.v; pz = true; } }
      }
      const prev = mem.rem;
      if (r > 0) { if (prev <= 0 || r > mem.max) mem.max = Math.max(tot, r); mem.done = 0; }
      else if (prev > 0) mem.done = (now + 1) >>> 0;
      mem.rem = r;
      mem.pz = pz && r > 0;
      return mem;
    }
    const timerDoneMs = (o) => Math.max(0, Math.min(240, parseInt(o.done_minutes ?? 2, 10) || 0)) * 60000;
    function timerVisible(mem, o, now) {
      if (o.only_running === false) return true;
      if (!mem) return false;
      const dm = timerDoneMs(o);
      return mem.rem > 0 || (dm > 0 && mem.done !== 0 && ((now + 1 - mem.done) >>> 0) < dm);
    }
    // Leistung & Speicher – spiegelt hw_plan in geometry.py
    const bufferKb = (px, bits, dbl) => px * (G.bppb || 1.75) * bits * (dbl ? 2 : 1) / 1024;
    function hwPlan(chip, px, style, nEnt = 0) {
      const chips = G.chips || {}, cost = G.animCost || {};
      const c = chips[chip] || chips.ESP32 || { ram_kb: 140, px_rate: 9000 };
      const extra = nEnt * (G.entKb || 0.75);
      let bits = 8;
      while (bits > 4 && bufferKb(px, bits, false) + extra > c.ram_kb) bits--;
      const fits = bufferKb(px, bits, false) <= c.ram_kb;
      const smooth = style !== "none";
      const dbl = smooth && bufferKb(px, bits, true) + extra <= c.ram_kb;
      const load = smooth ? px * (cost[style] || 1) / c.px_rate : px / (c.px_rate * 6);
      const level = load <= 1 ? "ok" : load <= 1.6 ? "warn" : "bad";
      const interval = !smooth ? 200 : load <= 1 ? 33 : load <= 1.6 ? 50 : 66;
      return { bits, double: dbl, fits, load: Math.round(load * 100) / 100, level, interval, mem_kb: Math.round(bufferKb(px, bits, dbl)), ram_kb: c.ram_kb };
    }
    // ---- Ruhezeit + Abenddimmung (wie quiet_cfg / quiet_eval_cpp in yaml_gen.py)
    const hmSec = (v, dflt) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || ""));
      if (!m) return dflt;
      const h = +m[1], mi = +m[2];
      return h < 24 && mi < 60 ? h * 3600 + mi * 60 : dflt;
    };
    function quietCfg(st, pages) {
      const q = (st && st.quiet) || {};
      const days = q.days || [];
      const win = [];
      for (let d = 0; d < 7; d++) {
        const dd = days[d] || {};
        const start = hmSec(dd.from, 23 * 3600), end = hmSec(dd.to, 6 * 3600 + 1800);
        const len = (((end - start) % 86400) + 86400) % 86400;
        const on = dd.on !== false && len > 0;
        const base = d * 86400 + start + (start < 12 * 3600 ? 86400 : 0);
        win.push({ start: base % 604800, len: on ? len : 0, mode: dd.mode === "dim" ? 2 : 1 });
      }
      const pct = (v, dflt) => Math.max(1, Math.min(100, Math.trunc(typeof v === "number" ? v : dflt)));
      const ev = q.evening || {};
      const lead = Math.max(0, Math.min(360, Math.trunc(ev.lead ?? 60) || 0)) * 60;
      const allowed = new Set(q.dim_pages || []);
      return {
        enabled: !!q.enabled && win.some((w) => w.len),
        win,
        dimCap: Math.max(1, Math.round(255 * pct(q.dim_pct, 5) / 100)),
        evLead: ev.enabled ? lead : 0,
        evCap: Math.max(1, Math.round(255 * pct(ev.pct, 30) / 100)),
        smooth: ev.smooth !== false,
        dimOk: (pages || []).map((p) => allowed.has(p.id)),
      };
    }
    // W = Sekunde der Woche (Mo 0:00 = 0) → { mode: 0 normal / 1 aus / 2 gedimmt, cap: 0..255, left: Sekunden bis Ende }
    function quietEval(q, W) {
      const WEEK = 604800;
      let mode = 0, cap = 255, left = 0, evening = false;
      if (!q || !q.enabled) return { mode, cap, left, evening };
      for (let d = 0; d < 7; d++) {
        const w = q.win[d];
        if (w.len <= 0) continue;
        const dd = (((W - w.start) % WEEK) + WEEK) % WEEK;
        if (dd < w.len) { mode = w.mode; cap = w.mode === 2 ? q.dimCap : 0; left = w.len - dd; }
      }
      if (mode === 0 && q.evLead > 0) {
        for (let d = 0; d < 7; d++) {
          const w = q.win[d];
          if (w.len <= 0) continue;
          const dd = (((W - (w.start - q.evLead)) % WEEK) + WEEK) % WEEK;
          if (dd < q.evLead) {
            const ramp = q.smooth ? Math.min(q.evLead, 900) : 0;
            const c = ramp > 0 && dd < ramp ? 255 - Math.trunc((255 - q.evCap) * dd / ramp) : q.evCap;
            if (c < cap) { cap = c; evening = true; left = q.evLead - dd; }
          }
        }
      }
      return { mode, cap, left, evening };
    }
    // Timer im Vordergrund (wie focus_cpp in yaml_gen.py): ok[] auf genau einen laufenden „exklusiven“ Timer begrenzen
    function timerFocus(ok, pages, timers, settings, nowMs) {
      const excl = pages.map((p, i) => (p.type === "timer" && p.options && p.options.exclusive ? i : -1)).filter((i) => i >= 0);
      if (!excl.length) return ok;
      const tm = (settings && settings.timers) || {};
      const every = Math.max(5, Math.min(60, Math.trunc(tm.every || 10)));
      const shortest = tm.mode !== "alternate";
      const fr = excl.map((i) => { const m = timers[pages[i].id]; return m && typeof m.rem === "number" ? m.rem : -1; });
      const cand = [];
      excl.forEach((i, k) => { if (ok[i]) cand.push(k); });
      if (!cand.length) return ok;
      let pick = cand[0];
      if (shortest) { for (let k = 1; k < cand.length; k++) { const a = fr[cand[k]], b = fr[pick]; if (a > 0 && (b <= 0 || a < b)) pick = cand[k]; } }
      else pick = cand[Math.trunc(Math.trunc(nowMs / 1000) / every) % cand.length];
      return ok.map((_, i) => i === excl[pick]);
    }
    const weekSec = (t) => ((t.getDay() + 6) % 7) * 86400 + t.getHours() * 3600 + t.getMinutes() * 60 + t.getSeconds();

    return { Geom, powerCfg, brightnessCap, needAmps, chainInfo, allowed, rotate, condTrue, BU, timerStep, timerVisible, isoEpoch, hms, hwPlan, quietCfg, quietEval, weekSec, timerFocus };
  }

  // ================================================================ Renderer
  function create(assets) {
    const { font, icons, palette, weather, stateWords } = assets;
    const WATER_AUTO = assets.waterAuto || [[34, "water_empty"], [67, "water_half"], [101, "water_full"]];
    // Eigene Icons (aus dem Icon-Editor): Zeichen a–z/A–Z = Index in die eigene Farbtabelle – wie custom_icon_ok in yaml_gen.py
    const ALPH = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const palMap = {};
    let customNames = [];
    function customOk(c) {
      if (!c || !Array.isArray(c.rows) || !Array.isArray(c.pal)) return false;
      const { rows, pal } = c;
      if (!rows.length || rows.length > 16 || !pal.length || pal.length > ALPH.length) return false;
      const w = rows[0].length;
      if (w < 1 || w > 16 || rows.some((r) => typeof r !== "string" || r.length !== w)) return false;
      const ok = new Set([...ALPH.slice(0, pal.length), "."]);
      return rows.every((r) => [...r].every((ch) => ok.has(ch))) && pal.every((x) => /^#?[0-9a-fA-F]{6}$/.test(x));
    }
    function setCustomIcons(map) {
      for (const n of customNames) { delete icons[n]; delete palMap[n]; }
      customNames = [];
      for (const [n, c] of Object.entries(map || {})) {
        if (!customOk(c) || n in icons) continue;
        icons[n] = c.rows; palMap[n] = c.pal.map((x) => (x[0] === "#" ? x : "#" + x)); customNames.push(n);
      }
    }
    const geo = makeGeometry(assets.geo);
    const fontH = font.height;
    const glyph = font.glyphs;
    // Mini-Schrift (Größe 3): eigene 3×5-Pixel, 1:1 gezeichnet
    const mini = font.mini || {}, miniH = font.miniHeight || 6;

    function asciiText(s) {
      let out = "";
      for (const c of String(s || "")) out += c in ASCII_REP ? ASCII_REP[c] : c;
      return [...out].filter((c) => c in glyph).join("");
    }

    // Zeichenfläche (wie PRELUDE in yaml_gen.py): Bereich OX/OY/DW/DH, Abschneiden am Bereich, Farbsumme
    function Surface(W, H) {
      const buf = new Uint8Array(W * H * 3);
      const s = { buf, acc: 0, ICOL: [10, 132, 255], OX: 0, OY: 0, DW: W, DH: H, TX: 0, TY: 0, GX0: 0, GY0: 0, GX1: W, GY1: H, AL: 255, ovf: 0, scrMs: 35, scrTick: false, long: false };
      s.FR = (x, y, w, h, c) => {
        if (x < 0) { w += x; x = 0; }
        if (y < 0) { h += y; y = 0; }
        if (x + w > s.DW) w = s.DW - x;
        if (y + h > s.DH) h = s.DH - y;
        if (w <= 0 || h <= 0) return;
        let X = s.OX + x, Y = s.OY + y;
        if (X < s.GX0) { w -= s.GX0 - X; X = s.GX0; }
        if (Y < s.GY0) { h -= s.GY0 - Y; Y = s.GY0; }
        if (X + w > s.GX1) w = s.GX1 - X;
        if (Y + h > s.GY1) h = s.GY1 - Y;
        if (w <= 0 || h <= 0) return;
        if (s.AL < 255) c = [Math.trunc(c[0] * s.AL / 255), Math.trunc(c[1] * s.AL / 255), Math.trunc(c[2] * s.AL / 255)];
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
          const XX = X + i, YY = Y + j;
          if (XX < 0 || YY < 0 || XX >= W || YY >= H) continue;
          const o = (YY * W + XX) * 3;
          buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2];
        }
        s.acc += (c[0] + c[1] + c[2]) * w * h;
      };
      s.LN = (x0, y0, x1, y1, c) => {
        const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (;;) {
          s.FR(x0, y0, 1, 1, c);
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 >= dy) { err += dy; x0 += sx; }
          if (e2 <= dx) { err += dx; y0 += sy; }
        }
      };
      s.CI = (cx, cy, r, c) => {
        let x = r, y = 0, err = 1 - r;
        while (x >= y) {
          s.FR(cx + x, cy + y, 1, 1, c); s.FR(cx + y, cy + x, 1, 1, c); s.FR(cx - y, cy + x, 1, 1, c); s.FR(cx - x, cy + y, 1, 1, c);
          s.FR(cx - x, cy - y, 1, 1, c); s.FR(cx - y, cy - x, 1, 1, c); s.FR(cx + y, cy - x, 1, 1, c); s.FR(cx + x, cy - y, 1, 1, c);
          y++;
          if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
        }
      };
      s.HL = (x, y, w, c) => s.FR(x, y, w, 1, c);
      s.RC = (x, y, w, h, c) => { s.FR(x, y, w, 1, c); s.FR(x, y + h - 1, w, 1, c); s.FR(x, y + 1, 1, h - 2, c); s.FR(x + w - 1, y + 1, 1, h - 2, c); };
      // Größen in Viertel-Schritten (q = 4 -> 1×, 6 -> 1,5×): Bitmap-Spalte i liegt bei P(i, q)
      const P = (i, q) => Math.floor(i * q / 4);
      const tcols = (str, q) => { const G = q === 3 ? mini : glyph; let c = 0; for (const ch of String(str)) { const g = G[ch]; if (g) c += g.w; } return c; };
      s.tw = (str, q) => (q === 3 ? tcols(str, 3) : P(tcols(str, q), q));
      s.tw1 = (str, q) => { const c = tcols(str, q); return c > 0 ? (q === 3 ? c - 1 : P(c - 1, q)) : 0; };
      s.TH = (q) => (q === 3 ? miniH : P(7, q));
      s.tx = (x, y, q, c, align, str) => {
        str = String(str);
        const w = s.tw(str, q);
        if (align === 1) x -= Math.trunc(w / 2); else if (align === 2) x -= w;
        let c0 = 0;
        if (q === 3) {
          for (const ch of str) {
            const g = mini[ch];
            if (!g) continue;
            for (let r = 0; r < miniH; r++) { const row = g.rows[r]; for (let k = 0; k < Math.min(8, row.length); k++) if (row[k] === "#") s.FR(x + c0 + k, y + r, 1, 1, c); }
            c0 += g.w;
          }
          return;
        }
        for (const ch of str) {
          const g = glyph[ch];
          if (!g) continue;
          for (let r = 0; r < fontH; r++) {
            const row = g.rows[r];
            if (!row.includes("#")) continue;
            const ya = y + P(r, q), hh = P(r + 1, q) - P(r, q);
            for (let k = 0; k < Math.min(8, row.length); k++) if (row[k] === "#") { const xa = x + P(c0 + k, q); s.FR(xa, ya, x + P(c0 + k + 1, q) - xa, hh, c); }
          }
          c0 += g.w;
        }
      };
      s.icon = (name, x0, y0, q) => {
        const rows = icons[name];
        if (!rows) return;
        const pal = palMap[name];
        rows.forEach((row, y) => {
          const ya = y0 + P(y, q), hh = P(y + 1, q) - P(y, q);
          if (hh <= 0) return;
          [...row].forEach((ch, x) => {
            const c = pal ? (ch === "." ? null : hex(pal[ALPH.indexOf(ch)])) : ch === "C" ? s.ICOL : palette[ch] ? hex(palette[ch]) : null;
            if (c) s.FR(x0 + P(x, q), ya, P(x + 1, q) - P(x, q), hh, c);
          });
        });
      };
      s.P = P;
      s.fit = (t, room, sc) => { t = String(t); while (t.length && s.tw(t, sc) > room) t = t.slice(0, -1); return t; };
      // Laufschrift (wie "scr" in yaml_gen.py)
      s.scr = (x, y, room, sc, c, t, tk) => {
        if (room <= 0) return;
        const w = s.tw(t, sc), gap = tk ? P(16, sc) : P(12, sc), per = w + gap, PAUSE = tk ? 0 : 40;
        let off = (Math.trunc(s.ms / s.scrMs) % (per + PAUSE)) - PAUSE;
        if (off < 0) off = 0;
        const g0 = s.GX0, g1 = s.GX1;
        s.GX0 = Math.max(s.GX0, s.OX + x); s.GX1 = Math.min(s.GX1, s.OX + x + room);
        s.tx(x - off, y, sc, c, 0, t);
        s.tx(x - off + per, y, sc, c, 0, t);
        if (tk) {
          const d = Math.max(1, sc >> 2), dx = x - off + w + Math.trunc((gap - d) / 2), dy = y + Math.trunc((s.TH(sc) - d) / 2);
          s.FR(dx, dy, d, d, c); s.FR(dx + per, dy, d, d, c);
        }
        s.GX0 = g0; s.GX1 = g1;
        s.scrolled = true;
      };

      const dec = (q) => (q % 4 ? q - (q % 4) : q - 4);
      // ---- Zeilen-Layout (wie "lay" in yaml_gen.py)
      s.lay = (L, pref, iq = 0, va = 1, ha = 1) => {
        const M = 2, AW = s.DW - 2 * M, AH = s.DH - 2 * M, n = L.length;
        const on = new Array(n).fill(true), fx = new Array(n).fill(0);
        let sm = pref > 0 ? pref : 32, ss = 4, gp = 2, tot = 0;
        const icq = (sc) => (iq > 0 ? Math.min(iq, sm) : Math.max(4, Math.trunc(sc / 8) * 4));
        const dims = (l, sc) => {
          const ic = icq(sc);
          let w = 0, h = 0;
          if (l.bar >= 0) return [AW > 12 ? AW - 4 : AW, Math.max(2, 2 * (sc >> 2))];
          if (l.ic) { w += P(icons[l.ic][0].length, ic); h = P(icons[l.ic].length, ic); if (l.t) w += 2 * Math.max(1, ic >> 2); }
          if (l.t) { w += l.deg ? s.tw(l.t, sc) : s.tw1(l.t, sc); h = Math.max(h, s.TH(sc)); }
          if (l.deg) w += (sc >> 2) + 2;
          return [w, h];
        };
        const lim = (l) => (l.role ? AW : s.DW - 2);
        const qs = (l) => { const b = l.role ? ss : sm; return l.qq ? Math.min(l.qq, b) : b; };
        for (;;) {
          ss = sm === 3 ? 3 : Math.max(4, Math.trunc(sm / 8) * 4); gp = (ss >> 2) + 1;
          tot = 0; let cnt = 0, wide = -1;
          for (let i = 0; i < n; i++) {
            if (!on[i]) continue;
            const [w, h] = dims(L[i], qs(L[i]));
            if (w > lim(L[i]) && wide < 0 && !fx[i] && L[i].sc !== 2 && L[i].sc !== 3) wide = i;
            tot += h; cnt++;
          }
          if (cnt > 1) tot += (cnt - 1) * gp;
          if (wide < 0 && tot <= AH) break;
          if (wide >= 0) {
            const l = L[wide];
            const txt = !!l.t && (l.sc === 0 || l.sc === 1 || l.sc === -1), mode = l.sc === -1 ? 1 : s.ovf;
            if (l.role === 0 && sm > 4) { sm = dec(sm); continue; }
            if (txt && l.role === 1) { const cur = qs(l); if (cur > 4) { l.qq = dec(cur); continue; } if (cur === 4) { l.qq = 3; continue; } }
            if (txt && l.alt) { const k = l.alt.indexOf("\n"); l.t = k < 0 ? l.alt : l.alt.slice(0, k); l.alt = k < 0 ? "" : l.alt.slice(k + 1); continue; }
            if (txt) s.long = true;
            if (txt && mode === 0) { fx[wide] = 1; continue; }
            if (txt && mode === 2 && l.pri > 0) { on[wide] = false; continue; }
            if (txt) { fx[wide] = 2; continue; }
            if (l.role === 1 && ss > 4) { sm = dec(sm); continue; }
            if (l.ic) { l.ic = null; continue; }
            if (l.pri > 0) { on[wide] = false; continue; }
            break;
          }
          let drop = -1;
          for (let i = 0; i < n; i++) if (on[i] && L[i].pri > 0 && (drop < 0 || L[i].pri > L[drop].pri)) drop = i;
          if (sm > 8) { sm = dec(sm); continue; }
          if (drop >= 0) { on[drop] = false; continue; }
          if (sm > 4) { sm = dec(sm); continue; }
          break;
        }
        let y = M + Math.trunc((AH - tot) * va / 2);
        let ich = 0, titleWide = false;
        for (let i = 0; i < n; i++) {
          if (!on[i]) continue;
          const l = L[i], sc = qs(l);
          let [w, h] = dims(l, sc);
          if (l.role === 1 && l.t && l.bar < 0 && w > lim(l)) titleWide = true;
          if (l.t && l.bar < 0 && (l.sc === 2 || ((fx[i] === 1 || l.sc === 3) && w > lim(l)))) {
            let x = Math.trunc((s.DW - lim(l)) / 2);
            const ic = icq(sc);
            if (l.ic) {
              const ih = icons[l.ic].length;
              s.icon(l.ic, x, y + Math.trunc((h - P(ih, ic)) / 2), ic);
              x += P(icons[l.ic][0].length, ic) + 2 * Math.max(1, ic >> 2);
            }
            s.scr(x, y + Math.trunc((h - s.TH(sc)) / 2), Math.trunc((s.DW - lim(l)) / 2) + lim(l) - x, sc, l.c, l.t, l.tk ? l.tk === 2 : s.scrTick);
            y += h + gp;
            continue;
          }
          if (w > lim(l) && l.t) { l.t = s.fit(l.t, s.tw(l.t, sc) - (w - lim(l)), sc); [w, h] = dims(l, sc); }
          const room = s.DW - w;
          let x = ha === 1 ? Math.trunc(room / 2) : ha === 0 ? Math.min(M, room) : room - Math.min(M, room);
          if (l.bar >= 0) {
            s.FR(x, y, w, h, [38, 38, 40]);
            if (l.bar > 0) s.FR(x, y, Math.trunc(w * l.bar / 1000), h, l.c);
          } else {
            const ic = icq(sc);
            if (l.ic) {
              const ih = icons[l.ic].length;
              ich = ich || ic;
              s.icon(l.ic, x, y + Math.trunc((h - P(ih, ic)) / 2), ic);
              x += P(icons[l.ic][0].length, ic) + (l.t ? 2 * Math.max(1, ic >> 2) : 0);
            }
            if (l.t) {
              const ty = y + Math.trunc((h - s.TH(sc)) / 2);
              s.tx(x, ty, sc, l.c, 0, l.t);
              x += s.tw(l.t, sc);
              if (l.deg) s.RC(x + 1, ty + (sc >> 2), (sc >> 2) + 1, (sc >> 2) + 1, l.c);
            }
          }
          y += h + gp;
        }
        return { sm, ss, ic: ich, auto: pref <= 0, titleWide };
      };
      // ---- Liste (wie "lst" in yaml_gen.py)
      s.lst = (title, lab, val, pref, va, main, acc) => {
        const M = 2, AW = s.DW - 2 * M, AH = s.DH - 2 * M, n = lab.length;
        let q = pref > 0 ? pref : 16, cols = 1, rows = 0, hh = 0, sp = 1, lh = 7;
        for (;;) {
          sp = Math.max(1, q >> 2); lh = s.TH(q);
          hh = (title && AH >= lh * 3 + 2 * sp + 4 && (s.ovf !== 2 || s.tw1(title, q) <= AW)) ? lh + 5 : 0;
          rows = Math.max(0, Math.trunc((AH - hh + sp + 1) / (lh + sp + 1)));
          cols = Math.max(1, Math.trunc((AW + 4 * sp) / (60 * sp + 4 * sp)));
          let wfit = true;
          const cw0 = Math.trunc((AW - (cols - 1) * 4 * sp) / cols);
          for (let i = 0; i < Math.min(n, rows * cols) && q > 4; i++)
            if (s.tw(lab[i], q) + s.tw(val[i], q) + 2 * sp > cw0) { wfit = false; break; }
          if ((rows * cols >= n && rows > 0 && wfit) || q <= 4) break;
          q = dec(q);
        }
        const m = Math.min(n, rows * cols);
        const ru = Math.max(1, Math.trunc((m + cols - 1) / cols));
        const gap = sp + 1, cg = 4 * sp;
        const bh = hh + ru * lh + (ru - 1) * gap;
        const y0 = M + Math.trunc((AH - bh) * va / 2);
        const titleWide = !!title && s.tw1(title, q) > AW;
        if (titleWide) s.long = true;
        if (hh) {
          if (!titleWide) s.tx(Math.trunc(s.DW / 2), y0, q, acc, 1, title);
          else if (s.ovf === 0) s.scr(M, y0, AW, q, acc, title, s.scrTick);
          else s.tx(M, y0, q, acc, 0, s.fit(title, AW + 1, q));
          s.HL(M, y0 + lh + 2, AW, [58, 58, 60]);
        }
        const cw = Math.trunc((AW - (cols - 1) * cg) / cols);
        for (let i = 0; i < m; i++) {
          const c = Math.trunc(i / ru), r = i % ru;
          const x0 = M + c * (cw + cg), y = y0 + hh + r * (lh + gap);
          const v = s.fit(val[i], cw + sp, q);
          s.tx(x0 + cw + sp, y, q, main, 2, v);
          s.tx(x0, y, q, [174, 174, 178], 0, s.fit(lab[i], cw - s.tw(v, q) - 2 * sp, q));
        }
        return { sm: q, sc: q, cap: rows * cols, cols, rows, auto: pref <= 0, titleWide };
      };
      // ---- Verlauf (wie "chrt" in yaml_gen.py)
      s.chrt = (v, n, style, mm, title, nv, nu, main, acc, dc, nodata) => {
        const F = Math.fround, tr = Math.trunc, GR = [142, 142, 147];
        const M = 2, AW = s.DW - 2 * M, AH = s.DH - 2 * M;
        let y = M, nw = nv + nu;
        if (s.tw1(nw, 4) > AW) nw = nv;
        if (s.tw1(nw, 4) > AW) nw = "";
        if ((title || nw) && AH >= 20) {
          const nwd = nw ? s.tw1(nw, 4) : 0;
          if (nwd) s.tx(M + AW - nwd, y, 4, main, 0, nw);
          const room = AW - nwd - (nwd ? 4 : 0);
          if (title && room > 0) s.tx(M, y, 4, acc, 0, s.fit(title, room + 1, 4));
          y += 9;
        }
        const ch = M + AH - y;
        if (ch < 4) return;
        let mn = 0, mx = 0, cnt = 0;
        for (let i = 0; i < n; i++) {
          const f = v[i];
          if (Number.isNaN(f)) continue;
          if (cnt === 0 || f < mn) mn = f;
          if (cnt === 0 || f > mx) mx = f;
          cnt++;
        }
        if (cnt === 0) { s.tx(tr(s.DW / 2), y + tr((ch - 7) / 2), 4, GR, 1, nodata); return; }
        let lw = 0, smx = "", smn = "";
        if (mm && ch >= 16) {
          smx = numFmt(mx, dc, false); smn = numFmt(mn, dc, false);
          lw = Math.max(s.tw1(smx, 4), s.tw1(smn, 4)) + 2;
          if (lw > tr(AW / 2)) lw = 0;
        }
        const cw = AW - lw;
        if (lw) {
          s.tx(M + AW - s.tw1(smx, 4), y, 4, GR, 0, smx);
          s.tx(M + AW - s.tw1(smn, 4), y + ch - 7, 4, GR, 0, smn);
        }
        const rg = F(mx - mn);
        const Y = (f) => (rg > 0 ? tr(F(F(F(F(f - mn) / rg) * (ch - 1)) + 0.5)) : tr((ch - 1) / 2));
        const dim = [tr(main[0] / 4), tr(main[1] / 4), tr(main[2] / 4)];
        if (style === 1 && cw >= 2 * n) {
          for (let b = 0; b < n; b++) {
            const f = v[b];
            if (Number.isNaN(f)) continue;
            const yy = Y(f), x0 = tr(b * cw / n), x1 = tr((b + 1) * cw / n);
            s.FR(M + x0, y + ch - 1 - yy, x1 - x0 - 1, yy + 1, main);
          }
          return;
        }
        let py = -1;
        for (let x = 0; x < cw; x++) {
          const f = v[tr(x * n / cw)];
          if (Number.isNaN(f)) { py = -1; continue; }
          const yy = Y(f);
          if (style === 1) { s.FR(M + x, y + ch - 1 - yy, 1, yy + 1, main); continue; }
          s.FR(M + x, y + ch - yy, 1, yy, dim);
          const a = py < 0 ? yy : py, lo = Math.min(a, yy), hi = Math.max(a, yy);
          s.FR(M + x, y + ch - 1 - hi, 1, hi - lo + 1, main);
          py = yy;
        }
      };
      return s;
    }

    const pad = (n) => String(n).padStart(2, "0");
    const SIN60 = Array.from({ length: 60 }, (_, i) => Math.round(Math.sin(i * Math.PI / 30) * 1000));
    const stStr = (states, eid) => (states[eid] && states[eid].state != null ? String(states[eid].state) : "");
    const attrStr = (states, eid, a) => {
      const v = states[eid] && states[eid].attributes ? states[eid].attributes[a] : undefined;
      return v === undefined || v === null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    };
    const unitOf = (states, eid) => asciiText(attrStr(states, eid, "unit_of_measurement"));
    const isNum = (v) => /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(v);
    const numFmt = (f, dec, thou) => {
      f = Math.fround(f);
      if (dec < 0) dec = Math.abs(f - Math.round(f)) < 0.05 ? 0 : 1;
      // wie printf: genau in der Mitte wird zur geraden Ziffer gerundet (22,25 -> 22,2)
      const a = Math.abs(f), full = a.toFixed(Math.min(100, dec + 60)), dot = full.indexOf(".");
      let fx = a.toFixed(dec);
      if (/^50*$/.test(full.slice(dot + 1 + dec))) {
        const tr = dec ? full.slice(0, dot + 1 + dec) : full.slice(0, dot);
        if ((+tr[tr.length - 1]) % 2 === 0) fx = tr;
      }
      let str = (f < 0 || Object.is(f, -0) ? "-" : "") + fx, sign = "";
      if (str[0] === "-") { sign = "-"; str = str.slice(1); }
      const [ip, fp = ""] = str.split(".");
      let out = "";
      for (let i = 0; i < ip.length; i++) {
        if (thou && i > 0 && (ip.length - i) % 3 === 0) out += T.thou || ".";
        out += ip[i];
      }
      if (fp) out += (T.dec || ",") + fp;
      return sign + out;
    };
    // Panel-Sprache (paneltext.py): wird pro Bild aus ctx.lang gesetzt
    const PT = assets.panelText || { de: { wd: ["SO", "MO", "DI", "MI", "DO", "FR", "SA"], months: null, done: "FERTIG", end: "ENDE", pause: "PAUSE", words: stateWords, weather: {} } };
    let T = PT.de;
    const word = (v) => (Object.prototype.hasOwnProperty.call(T.words, v) ? T.words[v] : ascRT(v));
    const dateStr = (t) => (T.months ? `${T.wd[t.getDay()]} ${t.getDate()} ${T.months[t.getMonth()]}` : `${T.wd[t.getDay()]} ${pad(t.getDate())}.${pad(t.getMonth() + 1)}.`);
    // Kurzformen des Datums für enge Flächen (wie date_alt_cpp in yaml_gen.py)
    const dateAlt = (t) => (T.months ? `${T.wd[t.getDay()]} ${t.getDate()}\n${t.getDate()} ${T.months[t.getMonth()]}`
      : `${T.wd[t.getDay()]} ${pad(t.getDate())}.\n${pad(t.getDate())}.${pad(t.getMonth() + 1)}.`);
    const mk = (t, c, role, pri, extra) => Object.assign({ t, c, role, pri, ic: null, deg: false, bar: -1, sc: 0, tk: 0, qq: 0, alt: "" }, extra || {});
    // ---- 3.2: animierte Icons (wie anim_icon_cpp / is_act in yaml_gen.py)
    const ANIM = assets.iconAnim || {};
    const ACTIVE = new Set(assets.activeStates || []);
    const animOf = (o) => (o.icon_anim && o.icon && ANIM[o.icon] ? o.icon : null);
    const animThr = (o) => {
      const v = String(o.anim_above ?? "").trim().replace(",", ".");
      return isNum(v) && Number.isFinite(parseFloat(v)) ? Math.fround(parseFloat(v)) : null;
    };
    const isAct = (raw, thr) => {
      const v = String(raw ?? "").trim().toLowerCase();
      if (isNum(v)) { const f = Math.fround(parseFloat(v)); return thr !== null ? f > thr : f > 0; }
      return ACTIVE.has(v);
    };
    // Bild der Animation zur Zeit ms – aktiv: Einzelbilder im Wechsel, sonst „aus“-Bild bzw. normales Icon
    const animPick = (s, icon, active) => {
      const a = ANIM[icon];
      if (!active) return a.off || icon;
      s.anim = true;
      return a.frames[Math.floor((s.ms >>> 0) / a.ms) % a.frames.length];
    };
    const animSrc = (o, ctx, raw) => (o.anim_entity ? stStr(ctx.states, o.anim_entity) : raw);
    const doneMs = (o) => Math.max(0, Math.min(240, toInt(o.done_minutes ?? 2, 2))) * 60000;
    const tscOf = () => 0;
    // Zu langer Text (pro Seite/Feld) – wie overflow_cpp in yaml_gen.py
    const SCROLL_SPEEDS = { slow: 50, normal: 35, fast: 22 };
    const setOvf = (s, o) => {
      s.ovf = ({ scroll: 0, cut: 1, hide: 2 })[o.overflow] ?? 0;
      s.scrMs = SCROLL_SPEEDS[o.scroll_speed] || 35;
      s.scrTick = o.scroll_loop === "ticker";
    };
    // Text aus HA für die Pixelschrift (wie "asc" in yaml_gen.py)
    const ascRT = (v) => { let o = ""; for (const ch of String(v ?? "")) { const r = { "ä": "\x80", "ö": "\x81", "ü": "\x82", "Ä": "\x80", "Ö": "\x81", "Ü": "\x82", "ß": "ss", "€": "\x83", "°": "\x84" }[ch]; if (r) o += r; else if (ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) < 128) o += ch; } return o; };
    // Kalender (wie "dfc"/"pev" in yaml_gen.py)
    const dfc = (y, m, d) => {
      y -= m <= 2 ? 1 : 0;
      const era = Math.trunc(y / 400), yoe = y - era * 400;
      const doy = Math.trunc((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
      return era * 146097 + yoe * 365 + Math.trunc(yoe / 4) - Math.trunc(yoe / 100) + doy - 719468;
    };
    const dg = (st, i, n) => {
      if (i + n > st.length) return -1;
      let v = 0;
      for (let k = i; k < i + n; k++) { const c = st.charCodeAt(k); if (c < 48 || c > 57) return -1; v = v * 10 + c - 48; }
      return v;
    };
    const pev = (st, ad) => {
      const Y = dg(st, 0, 4), M = dg(st, 5, 2), D = dg(st, 8, 2);
      if (Y < 1970 || M < 1 || M > 12 || D < 1 || D > 31 || st[4] !== "-" || st[7] !== "-") return null;
      const h = st.length > 10 ? dg(st, 11, 2) : -1, mi = st.length > 10 ? dg(st, 14, 2) : -1;
      const all = ad || h < 0 || mi < 0;
      const day = dfc(Y, M, D);
      return { day, mo: M, dd: D, ad: all, sec: all ? 0 : h * 3600 + mi * 60, ld: day, t: "", c: null };
    };
    const pend = (en, e) => {
      const Y = dg(en, 0, 4), M = dg(en, 5, 2), D = dg(en, 8, 2);
      if (Y < 1970 || M < 1 || M > 12 || D < 1 || D > 31) return;
      let z = dfc(Y, M, D);
      const h = en.length > 10 ? dg(en, 11, 2) : -1, mi = en.length > 10 ? dg(en, 14, 2) : -1;
      if (e.ad || (h <= 0 && mi <= 0)) z--;
      if (z > e.day) e.ld = z;
    };
    const cfd = (z) => {
      z += 719468;
      const tr = Math.trunc, era = tr(z / 146097), doe = z - era * 146097;
      const yoe = tr((doe - tr(doe / 1460) + tr(doe / 36524) - tr(doe / 146096)) / 365);
      const doy = doe - (365 * yoe + tr(yoe / 4) - tr(yoe / 100)), mp = tr((5 * doy + 2) / 153);
      return [mp < 10 ? mp + 3 : mp - 9, doy - tr((153 * mp + 2) / 5) + 1];
    };
    const calHide = (o) => {
      const out = [];
      for (let w of String(o.hide || "").split(/[,;\n]/)) { w = asciiText(w).trim().slice(0, 32); if (w && !out.includes(w)) out.push(w); }
      return out.slice(0, 12);
    };
    // Verlauf: Zahlen aus einer Attribut-Liste (wie "plist" in yaml_gen.py)
    const ntok = (str, i) => {
      let j = i;
      while (j < str.length && /[0-9+\-.eE]/.test(str[j])) j++;
      const t = str.slice(i, j);
      return isNum(t) ? Math.fround(parseFloat(t)) : NaN;
    };
    const plist = (str, key0) => {
      const out = [];
      let key = key0;
      const dl = (c) => c === " " || c === "," || c === "[" || c === "]" || c === "(" || c === ")";
      if (str.indexOf(":") < 0) {
        let i = 0;
        while (i < str.length && out.length < 96) {
          while (i < str.length && dl(str[i])) i++;
          let j = i;
          while (j < str.length && !dl(str[j])) j++;
          if (j > i) {
            const t = str.slice(i, j);
            if (isNum(t)) out.push(Math.fround(parseFloat(t)));
            else if (t === "None" || t === "null") out.push(NaN);
          }
          i = j;
        }
        return out;
      }
      if (!key) {
        for (const k of ["value", "total", "price", "price_per_kwh"]) if (str.includes(`'${k}'`) || str.includes(`"${k}"`)) { key = k; break; }
        if (!key) return out;
      }
      let p = 0;
      while (out.length < 96) {
        p = str.indexOf(key, p);
        if (p < 0) break;
        let e = p + key.length;
        const qa = p > 0 && (str[p - 1] === "'" || str[p - 1] === '"');
        const qb = e < str.length && str[e] === str[p > 0 ? p - 1 : 0];
        p = e;
        if (!qa || !qb) continue;
        e++;
        while (e < str.length && str[e] === " ") e++;
        if (e >= str.length || str[e] !== ":") continue;
        e++;
        while (e < str.length && str[e] === " ") e++;
        out.push(ntok(str, e));
      }
      return out;
    };
    const histKey = (o) => `${o.entity || ""}|${(o.attribute || "").trim()}|${o.period || "24h"}`;
    const toInt = (v, d) => { const n = parseInt(v, 10); return Number.isNaN(n) ? d : n; };
    const sizeOf = (o) => {
      let v = o.scale !== undefined && o.scale !== null && o.scale !== "" ? toInt(o.scale, 0) : toInt(o.size, 0) * 4;
      return v <= 0 ? 0 : v === 3 ? 3 : Math.max(4, Math.min(32, v));
    };
    const iconOf = (o) => { const v = toInt(o.icon_scale, 0); return v <= 0 ? 0 : Math.max(2, Math.min(16, v)); };
    const placeOf = (o) => [Math.max(0, Math.min(2, toInt(o.valign ?? 1, 1))), Math.max(0, Math.min(2, toInt(o.halign ?? 1, 1)))];
    const layArgs = (o) => [sizeOf(o), iconOf(o), ...placeOf(o)];
    const pages = {
      clock(s, o, ctx) {
        if (o.style === "analog") return pages.clockAnalog(s, o, ctx);
        const t = ctx.now, main = hex(o.color), acc = hex(o.accent);
        const L = [];
        if (o.show_date !== false) L.push(mk(dateStr(t), acc, 1, 2, { alt: dateAlt(t) }));
        const H = t.getHours(), h12 = !!ctx.time12, ap = H < 12 ? "AM" : "PM";
        L.push(mk(h12 ? `${H % 12 === 0 ? 12 : H % 12}:${pad(t.getMinutes())}` : `${pad(H)}:${pad(t.getMinutes())}`, main, 0, 0));
        if (o.show_seconds) L.push(mk(h12 ? `${pad(t.getSeconds())} ${ap}` : pad(t.getSeconds()), main, 1, 3));
        else if (h12) L.push(mk(ap, main, 1, 3));
        if (o.seconds_bar !== false) L.push(mk("", acc, 1, 4, { bar: Math.floor(t.getSeconds() * 1000 / 59) }));
        return s.lay(L, ...layArgs(o));
      },
      clockAnalog(s, o, ctx) {
        const t = ctx.now, main = hex(o.color), acc = hex(o.accent);
        const [va, ha] = placeOf(o);
        const M = 2, AW = s.DW - 2 * M, AH = s.DH - 2 * M;
        let date = o.show_date !== false && AH - Math.min(AW, AH) >= 9;
        let D = Math.min(AW, AH - (date ? 9 : 0));
        if (D < 7) { D = Math.min(AW, AH); date = false; }
        const R = Math.trunc((D - 1) / 2);
        const bh = 2 * R + 1 + (date ? 9 : 0);
        const x0 = M + Math.trunc((AW - (2 * R + 1)) * ha / 2), y0 = M + Math.trunc((AH - bh) * va / 2);
        const cx = x0 + R, cy = y0 + R;
        const px = (i, l) => cx + Math.trunc(l * SIN60[i % 60] / 1000);
        const py = (i, l) => cy - Math.trunc(l * SIN60[(i + 15) % 60] / 1000);
        const rg = o.ring !== false && R >= 10;
        if (rg) s.CI(cx, cy, R, [58, 58, 60]);
        const ro = R - (rg ? 2 : 0);
        for (let i = 0; i < 60; i += 5) {
          const major = i % 15 === 0;
          const l = major ? Math.max(2, Math.trunc(R / 5)) : Math.max(1, Math.trunc(R / 9));
          s.LN(px(i, ro), py(i, ro), px(i, ro - l + 1), py(i, ro - l + 1), major ? main : [142, 142, 147]);
        }
        const hand = (i, l, th, c) => {
          const ex = px(i, l), ey = py(i, l);
          s.LN(cx, cy, ex, ey, c);
          if (th > 0) {
            const hor = Math.abs(ex - cx) > Math.abs(ey - cy);
            s.LN(cx + (hor ? 0 : 1), cy + (hor ? 1 : 0), ex + (hor ? 0 : 1), ey + (hor ? 1 : 0), c);
          }
        };
        hand((t.getHours() % 12) * 5 + Math.trunc(t.getMinutes() / 12), Math.trunc(R * 50 / 100), R >= 14 ? 1 : 0, main);
        hand(t.getMinutes(), Math.trunc(R * 78 / 100), R >= 20 ? 1 : 0, main);
        if (o.show_seconds !== false) hand(t.getSeconds(), Math.trunc(R * 88 / 100), 0, acc);
        if (R >= 10) s.FR(cx - 1, cy - 1, 3, 3, acc); else s.FR(cx, cy, 1, 1, acc);
        if (date) {
          const ds = s.fit(dateStr(t), AW, 4);
          s.tx(x0 + R + 1, y0 + 2 * R + 1 + 3, 4, acc, 1, ds);
        }
        return { sm: 0, analog: true, R };
      },
      weather(s, o, ctx) {
        const main = hex(o.color), acc = hex(o.accent);
        const m = weather[stStr(ctx.states, o.entity)];
        const tv = attrStr(ctx.states, o.entity, "temperature");
        const L = [mk(isNum(tv) ? numFmt(parseFloat(tv), 0, false) : "--", main, 0, 0, { ic: m ? m[0] : "cloud", deg: true })];
        const lab = m ? asciiText((T.weather && T.weather[stStr(ctx.states, o.entity)]) || m[1]) : "";
        if (lab) L.push(mk(lab, acc, 1, 2, { alt: asciiText((T.weather_short || {})[stStr(ctx.states, o.entity)] || "") }));
        if (o.show_humidity !== false) {
          const hv = attrStr(ctx.states, o.entity, "humidity");
          L.push(mk(isNum(hv) ? numFmt(parseFloat(hv), 0, false) + "%" : "--", main, 1, 3, { ic: "drop" }));
        }
        return s.lay(L, ...layArgs(o));
      },
      entity(s, o, ctx) {
        const main = hex(o.color), acc = hex(o.accent);
        const attrName = (o.attribute || "").trim();
        const raw = attrName ? attrStr(ctx.states, o.entity, attrName) : stStr(ctx.states, o.entity);
        const unit = o.unit ? asciiText(o.unit) : (attrName ? "" : unitOf(ctx.states, o.entity));
        const title = asciiText(o.title || "");
        const dec = o.decimals === undefined ? -1 : parseInt(o.decimals, 10);
        const num = isNum(raw);
        const inline = unit === "%";
        s.ICOL = hex(o.icon_color || "#0a84ff");
        let ic = o.icon && icons[o.icon] ? o.icon : null;
        if (o.icon === "water_auto") {
          ic = WATER_AUTO[0][1];
          if (num) { const wf = Math.fround(parseFloat(raw)); for (let k = 1; k < WATER_AUTO.length; k++) if (wf >= WATER_AUTO[k - 1][0]) ic = WATER_AUTO[k][1]; }
        }
        if (animOf(o)) ic = animPick(s, o.icon, isAct(animSrc(o, ctx, raw), animThr(o)));
        const L = [];
        if (title) L.push(mk(title, acc, 1, 2, { sc: tscOf(o) }));
        const top = o.icon_pos !== "bottom";
        if (ic && top) L.push(mk("", main, 0, 0, { ic }));
        let v = num ? numFmt(parseFloat(raw), dec, o.thousands !== false) : word(raw);
        if (num && inline && unit) v += unit;
        L.push(mk(v, main, 0, 0));
        if (unit && !inline && num) L.push(mk(unit, GREY, 1, 4));
        if (ic && !top) L.push(mk("", main, 0, 0, { ic }));
        const [va, ha] = placeOf(o);
        return s.lay(L, sizeOf(o), iconOf(o) || 32, va, ha);
      },
      marquee(s, o, ctx) {
        const main = hex(o.color), acc = hex(o.accent);
        const title = asciiText(o.title || "");
        let txt;
        if (o.source === "entity") {
          const a = (o.attribute || "").trim();
          const raw = a ? attrStr(ctx.states, o.entity, a) : stStr(ctx.states, o.entity);
          txt = asciiText(o.prefix || "") + word(raw);
        } else txt = asciiText(o.text || "");
        s.ICOL = hex(o.icon_color || "#0a84ff");
        const mi = o.icon === "water_auto" ? WATER_AUTO[WATER_AUTO.length - 1][1] : o.icon;
        const ic = mi && icons[mi] ? mi : null;
        const L = [];
        if (title) L.push(mk(title, acc, 1, 2, { sc: tscOf(o) }));
        L.push(mk(txt, main, 0, 0, { sc: o.always !== false ? 2 : 3, tk: ({ pause: 1, ticker: 2 })[o.loop] || 0, ic }));
        return s.lay(L, ...layArgs(o));
      },
      calendar(s, o, ctx) {
        const P = (i, q) => (i * q) >> 2;
        const main = hex(o.color), acc = hex(o.accent), t = ctx.now, st = ctx.states;
        const [va, ha] = placeOf(o);
        const today = dfc(t.getFullYear(), t.getMonth() + 1, t.getDate()), nows = t.getHours() * 3600 + t.getMinutes() * 60 + t.getSeconds();
        const hide = calHide(o);
        const keep = (x) => !hide.some((w) => x.toLowerCase().includes(w.toLowerCase()));
        let E = [];
        if (o.source === "helper") {
          const n = Math.max(1, Math.min(12, toInt(o.count, 6)));
          for (let k = 0; o.helper && k < n; k++) {
            const r = attrStr(st, o.helper, `e${k + 1}`), b = r.indexOf("|");
            const e = b >= 0 ? pev(r.slice(0, b), false) : null;
            if (!e) continue;
            let rest = r.slice(b + 1);
            const b2 = rest.indexOf("|");
            if (b2 >= 0 && dg(rest, 0, 4) >= 1970) { pend(rest.slice(0, b2), e); rest = rest.slice(b2 + 1); }
            e.t = ascRT(rest); e.c = acc;
            if (keep(e.t)) E.push(e);
          }
        } else {
          for (const c of (o.calendars || []).filter((c) => c && c.entity).slice(0, 4)) {
            const a = attrStr(st, c.entity, "all_day");
            // ganztägig: „true“ (Vorschau) oder „on“ (so schickt Home Assistant es ans Panel)
            const al = String(a || "").toLowerCase();
            const e = pev(attrStr(st, c.entity, "start_time"), al.startsWith("t") || al.startsWith("on"));
            if (!e) continue;
            pend(attrStr(st, c.entity, "end_time"), e);
            e.t = ascRT(attrStr(st, c.entity, "message")); e.c = hex(c.color || o.accent);
            if (keep(e.t)) E.push(e);
          }
        }
        E = E.filter((v) => v.ld >= today);
        for (const v of E) if (v.day < today) { v.day = today; if (!v.ad) v.sec = 0; v.ad = true; }
        for (let i = 1; i < E.length; i++) for (let j = i; j > 0 && E[j].day * 86400 + E[j].sec < E[j - 1].day * 86400 + E[j - 1].sec; j--) [E[j], E[j - 1]] = [E[j - 1], E[j]];
        { const F = []; for (const v of E) if (!F.some((u) => u.day === v.day && u.sec === v.sec && u.ad === v.ad && u.t === v.t)) F.push(v); E = F; }
        const dshort = (dd, mo) => (T.months ? `${dd} ${T.months[mo - 1]}` : `${pad(dd)}.${pad(mo)}.`);
        const dayl = (day, dd, mo) => { const d = day - today; return d <= 0 ? T.today : d === 1 ? T.tomorrow : `${T.wd[(day + 4) % 7]} ${dshort(dd, mo)}`; };
        const untl = (ld) => { const [mo, dd] = cfd(ld); return dshort(dd, mo); };
        const tfmt = (sec) => { const h = Math.trunc(sec / 3600), mi = Math.trunc(sec / 60) % 60; return ctx.time12 ? `${h % 12 === 0 ? 12 : h % 12}:${pad(mi)}${sec < 43200 ? "AM" : "PM"}` : `${pad(h)}:${pad(mi)}`; };
        const title = asciiText(o.title || "");
        if (o.view !== "next") {
          const M = 2, AW = s.DW - 2 * M, AH = s.DH - 2 * M, tr = Math.trunc;
          if (!E.length) {
            const L = [];
            if (title) L.push(mk(title, acc, 1, 5, { sc: tscOf(o) }));
            L.push(mk(T.noevents, GREY, 1, 0, { sc: 1 }));
            return s.lay(L, 4, 0, va, ha);
          }
          let q = sizeOf(o);
          if (q <= 0) { q = 4; while (q < 16 && P(80, q + 4) <= AW && tr((AH + ((q + 4) >> 2) + 1) / (P(7, q + 4) + ((q + 4) >> 2) + 1)) >= 6) q += 4; }
          let sp = Math.max(1, q >> 2), lh = s.TH(q), gap = sp + 1;
          let hh = title && AH >= lh * 3 + 2 * gap + 4 && (s.ovf !== 2 || s.tw1(title, q) <= AW) ? lh + 5 : 0;
          let rows = Math.max(1, tr((AH - hh + gap) / (lh + gap)));
          while (q > 4 && rows < 2) {
            q = q % 4 ? q - (q % 4) : q - 4; sp = Math.max(1, q >> 2); lh = s.TH(q); gap = sp + 1;
            hh = title && AH >= lh * 3 + 2 * gap + 4 && (s.ovf !== 2 || s.tw1(title, q) <= AW) ? lh + 5 : 0; rows = Math.max(1, tr((AH - hh + gap) / (lh + gap)));
          }
          const R = [];
          let cur = -(1 << 30);
          for (let k = 0; k < E.length; k++) {
            if (rows === 1) { R.push(0); break; }
            if (E[k].day !== cur) { if (R.length + 2 > rows) break; R.push(-1 - k); cur = E[k].day; }
            if (R.length + 1 > rows) break;
            R.push(k);
          }
          const used = R.length, bh = hh + used * lh + Math.max(0, used - 1) * gap;
          let y = M + tr((AH - bh) * va / 2);
          const titleWide = !!title && s.tw1(title, q) > AW;
          if (titleWide) s.long = true;
          if (hh) {
            if (!titleWide) s.tx(tr(s.DW / 2), y, q, acc, 1, title);
            else if (s.ovf === 0) s.scr(M, y, AW, q, acc, title, s.scrTick);
            else s.tx(M, y, q, acc, 0, s.fit(title, AW + 1, q));
            s.HL(M, y + lh + 2, AW, [58, 58, 60]);
            y += hh;
          }
          const ds = Math.max(2, P(3, q)), tx0 = M + ds + P(2, q);
          for (const r of R) {
            if (r < 0) {
              const v = E[-1 - r];
              s.tx(M, y, q, acc, 0, s.fit(dayl(v.day, v.dd, v.mo), AW + 1, q));
            } else {
              const v = E[r];
              s.FR(M, y + tr((lh - ds) / 2), ds, ds, v.c);
              let tb = "";
              if (v.ld > v.day) tb = "-" + untl(v.ld);
              else if (!v.ad) tb = v.day === today && v.sec <= nows ? T.now : tfmt(v.sec);
              let rw = tb ? s.tw1(tb, q) : 0;
              let room = M + AW - tx0 - (rw ? rw + P(3, q) : 0);
              if (room < P(v.ld > v.day ? 36 : 20, q)) { rw = 0; room = M + AW - tx0; }
              if (rw) s.tx(M + AW - rw, y, q, GREY, 0, tb);
              s.tx(tx0, y, q, main, 0, s.fit(v.t, room + sp, q));
            }
            y += lh + gap;
          }
          return { sm: q, auto: sizeOf(o) <= 0, titleWide, cap: rows, shown: R.filter((r) => r >= 0).length, total: E.length };
        }
        const L = [];
        if (title) L.push(mk(title, acc, 1, 50, { sc: tscOf(o) }));
        if (!E.length) L.push(mk(T.noevents, GREY, 0, 0, { sc: 1 }));
        E.forEach((v, k) => {
          const run = v.day === today && (v.ad ? v.ld > today : v.sec <= nows);
          const tb = v.ad ? "" : " " + tfmt(v.sec);
          const lab = run && v.ld > today ? `${T.until} ${untl(v.ld)}` : run ? T.now : dayl(v.day, v.dd, v.mo) + tb;
          L.push(mk(lab, v.c, 1, k ? 11 + 2 * k : 3, { sc: 1 }));
          L.push(mk(v.t, main, 0, k ? 10 + 2 * k : 0, { sc: 1 }));
        });
        return s.lay(L, sizeOf(o), 0, va, ha);
      },
      chart(s, o, ctx) {
        const main = hex(o.color), acc = hex(o.accent), title = asciiText(o.title || "");
        const dc = Math.max(-1, Math.min(3, toInt(o.decimals ?? -1, -1)));
        let V, now = null, unit;
        if (o.mode === "list") {
          V = plist(attrStr(ctx.states, o.entity, (o.list_attr || "").trim()), asciiText(o.list_key || "").trim());
          if (o.show_now !== false) now = stStr(ctx.states, o.entity);
          unit = o.unit ? asciiText(o.unit) : unitOf(ctx.states, o.entity);
        } else {
          const a = (o.attribute || "").trim();
          const h = ctx.history && ctx.history[histKey(o)];
          V = Array.isArray(h) && h.length === 48 ? h.map((x) => (x === null || x === undefined ? NaN : Math.fround(x))) : new Array(48).fill(NaN);
          if (o.show_now !== false) now = a ? attrStr(ctx.states, o.entity, a) : stStr(ctx.states, o.entity);
          unit = o.unit ? asciiText(o.unit) : (a ? "" : unitOf(ctx.states, o.entity));
        }
        const num = now !== null && isNum(now);
        const nv = now === null ? "" : num ? numFmt(parseFloat(now), dc, true) : word(now);
        s.chrt(V, V.length, o.style === "bars" ? 1 : 0, o.show_minmax !== false, title, nv, num ? unit : "", main, acc, dc, T.nodata);
      },
      value(s, o, ctx) {
        const main = hex(o.color), acc = hex(o.accent);
        const attrName = (o.attribute || "").trim();
        const raw = attrName ? attrStr(ctx.states, o.entity, attrName) : stStr(ctx.states, o.entity);
        const unit = o.unit ? asciiText(o.unit) : (attrName ? "" : unitOf(ctx.states, o.entity));
        const title = asciiText(o.title || "");
        const dec = o.decimals === undefined ? -1 : parseInt(o.decimals, 10);
        const num = isNum(raw);
        s.ICOL = hex(o.icon_color || "#0a84ff");
        let ic = o.icon && icons[o.icon] ? o.icon : null;
        if (o.icon === "water_auto") {
          ic = WATER_AUTO[0][1];
          if (num) { const wf = Math.fround(parseFloat(raw)); for (let k = 1; k < WATER_AUTO.length; k++) if (wf >= WATER_AUTO[k - 1][0]) ic = WATER_AUTO[k][1]; }
        }
        if (animOf(o)) ic = animPick(s, o.icon, isAct(animSrc(o, ctx, raw), animThr(o)));
        const L = [];
        if (title || ic) L.push(mk(title, acc, 1, 2, { ic, sc: tscOf(o) }));
        L.push(mk(num ? numFmt(parseFloat(raw), dec, o.thousands !== false) : word(raw), main, 0, 0));
        if (unit && num) L.push(mk(unit, GREY, 1, 4));
        if (o.second_entity) {
          const r2 = stStr(ctx.states, o.second_entity), u2 = unitOf(ctx.states, o.second_entity);
          if (o.trend !== false) {
            if (isNum(r2)) {
              const f2 = Math.fround(parseFloat(r2));
              L.push(mk((f2 >= 0 ? "+" : "-") + numFmt(Math.abs(f2), 1, false) + u2, f2 >= 0 ? [48, 209, 88] : [255, 69, 58], 1, 3));
            }
          } else L.push(mk(isNum(r2) ? numFmt(parseFloat(r2), -1, true) + u2 : word(r2), GREY, 1, 3));
        }
        return s.lay(L, ...layArgs(o));
      },
      list(s, o, ctx) {
        const items = (o.items || []).filter((i) => i.entity).slice(0, 24);
        const lab = [], val = [];
        for (const item of items) {
          const r = stStr(ctx.states, item.entity);
          lab.push(asciiText(item.label || item.entity.split(".").pop()));
          val.push(isNum(r) ? numFmt(parseFloat(r), -1, true) + unitOf(ctx.states, item.entity) : word(r));
        }
        return s.lst(asciiText(o.title || ""), lab, val, sizeOf(o), placeOf(o)[0], hex(o.color), hex(o.accent));
      },
      timer(s, o, ctx) {
        const main = hex(o.color), acc = hex(o.accent);
        const Tm = (ctx.timers && ctx.timers[ctx.tkey]) || { rem: -1, max: 0, done: 0, pz: false };
        const TX = T;
        const r = Tm.rem, done = r <= 0 && Tm.done !== 0;
        s.ICOL = hex(o.icon_color || "#0a84ff");
        let tic = o.icon === "water_auto" ? WATER_AUTO[WATER_AUTO.length - 1][1] : o.icon;
        if (animOf(o)) tic = animPick(s, o.icon, r > 0 && !Tm.pz);
        const hasIcon = tic && icons[tic];
        const title = asciiText(o.title || "");
        const L = [];
        if (title || hasIcon) L.push(mk(title, acc, 1, 2, { ic: hasIcon ? tic : null, sc: tscOf(o) }));
        if (r > 0) L.push(mk(r >= 3600 ? `${Math.trunc(r / 3600)}:${pad(Math.trunc(r / 60) % 60)}:${pad(r % 60)}` : `${Math.trunc(r / 60)}:${pad(r % 60)}`, main, 0, 0));
        else L.push(mk(done ? TX.done : "--:--", done ? acc : GREY, 0, 0));
        if (r > 0 && Tm.pz) L.push(mk(TX.pause, acc, 1, 3));
        else if (r > 0 && o.show_end !== false) {
          const t = ctx.now;
          const e = (t.getHours() * 3600 + t.getMinutes() * 60 + t.getSeconds() + r) % 86400;
          const eh = Math.trunc(e / 3600);
          L.push(mk(ctx.time12 ? `${TX.end} ${eh % 12 === 0 ? 12 : eh % 12}:${pad(Math.trunc(e / 60) % 60)} ${eh < 12 ? "AM" : "PM"}`
            : `${TX.end} ${pad(eh)}:${pad(Math.trunc(e / 60) % 60)}`, GREY, 1, 3));
        }
        if (o.show_bar !== false && r > 0 && Tm.max > 0) L.push(mk("", acc, 1, 4, { bar: Math.max(0, Math.trunc((Tm.max - r) * 1000 / Tm.max)) }));
        const info = s.lay(L, ...layArgs(o));
        // 3.2: Rahmen blinkt, solange „FERTIG“ angezeigt wird (0,4 s an / 0,4 s aus)
        const dm = doneMs(o), nw = s.ms >>> 0;
        if (o.done_blink && dm && done && ((nw + 1 - Tm.done) >>> 0) < dm) {
          s.anim = true;
          if (Math.floor(nw / 400) % 2 === 0) {
            const bw = Math.max(1, Math.trunc(Math.min(s.DW, s.DH) / 48)), bc = hex(o.blink_color || "#ff453a");
            for (let k = 0; k < bw; k++) s.RC(k, k, s.DW - 2 * k, s.DH - 2 * k, bc);
          }
        }
        return info;
      },
      stack(s, o, ctx) {
        const rects = ctx.geom && ctx.geom.stackRects(o.layout);
        if (!rects) return;
        const fields = o.fields || [];
        rects.forEach((a, k) => {
          const f = fields[k];
          if (!f || !f.type || f.type === "stack" || !pages[f.type]) return;
          Object.assign(s, { OX: a.x + s.TX, OY: a.y + s.TY, DW: a.w, DH: a.h });
          setOvf(s, f.options || {});
          pages[f.type](s, f.options || {}, Object.assign({}, ctx, { tkey: `${ctx.tkey}#${k}` }));
        });
        if (o.dividers !== false) {
          Object.assign(s, { OX: s.TX, OY: s.TY, DW: ctx.geom.W, DH: ctx.geom.H });
          for (const a of rects) {
            if (a.x > 0) s.FR(a.x, a.y, 1, a.h, [44, 44, 46]);
            if (a.y > 0) s.FR(a.x, a.y, a.w, 1, [44, 44, 46]);
          }
        }
      },
    };

    // Wie viele Listeneinträge passen in einen Bereich (für die Oberfläche)
    function listFit(w, h, title, n, pref) {
      const s = Surface(w, h);
      return s.lst(asciiText(title || ""), new Array(n).fill(""), new Array(n).fill(""), pref, 1, [0, 0, 0], [0, 0, 0]);
    }

    return {
      asciiText, geo, listFit, histKey, plist, sizeOf, iconOf, setCustomIcons, isAct, animThr,
      // items: [{page, area}] – zeichnet Seiten in eine W×H-Fläche, liefert Puffer + Farbsumme (+ gewählte Schriftgröße)
      // trans (optional): { prev: [{page, area}], p: 0..1000, style, ease } – Seitenwechsel wie transition_cpp
      renderFrame(W, H, items, ctx, trans) {
        T = PT[ctx && ctx.lang === "en" ? "en" : "de"] || PT.de;
        const s = Surface(W, H);
        s.ms = ctx && ctx.ms != null ? ctx.ms : Date.now();
        s.long = false;
        let info = null;
        const draw = (list) => {
          for (const { page, area } of list) {
            const fn = pages[page.type];
            if (!fn || !area) continue;
            Object.assign(s, { OX: area.x + s.TX, OY: area.y + s.TY, DW: area.w, DH: area.h });
            setOvf(s, page.options || {});
            info = fn(s, page.options || {}, Object.assign({}, ctx, { tkey: page.id })) || info;
          }
        };
        if (!trans || trans.style === "none" || trans.p >= 1000) draw(items);
        else {
          const p = trans.p, prev = trans.prev || [];
          const e = trans.ease === "linear" ? p : Math.trunc(Math.trunc(p * p / 1000) * (3000 - 2 * p) / 1000);
          const tr = Math.trunc;
          // Rechteck in Bildschirm-Koordinaten (für schwarze Flächen und den Scanner-Strich)
          const box = (x, y, w, h, c) => {
            const keep = [s.GX0, s.GY0, s.GX1, s.GY1, s.AL];
            Object.assign(s, { OX: 0, OY: 0, DW: W, DH: H, GX0: 0, GY0: 0, GX1: W, GY1: H, AL: 255 });
            s.FR(x, y, w, h, c);
            [s.GX0, s.GY0, s.GX1, s.GY1, s.AL] = keep;
          };
          switch (trans.style) {
            case "fade":
              if (e < 500) { s.AL = tr(255 * (500 - e) / 500); draw(prev); } else { s.AL = tr(255 * (e - 500) / 500); draw(items); }
              break;
            case "slide_left": { const o = tr(W * e / 1000); s.TX = -o; draw(prev); s.TX = W - o; draw(items); break; }
            case "slide_up": { const o = tr(H * e / 1000); s.TY = -o; draw(prev); s.TY = H - o; draw(items); break; }
            case "wipe": { const x = tr(W * e / 1000); s.GX0 = x; draw(prev); s.GX0 = 0; s.GX1 = x; draw(items); break; }
            case "curtain": {
              const h = tr(tr(W / 2) * e / 1000), a = tr(W / 2) - h, b = W - a;
              s.GX1 = a; draw(prev); s.GX0 = b; s.GX1 = W; draw(prev); s.GX0 = a; s.GX1 = b; draw(items); break;
            }
            case "slide_right": { const o = tr(W * e / 1000); s.TX = o; draw(prev); s.TX = o - W; draw(items); break; }
            case "glide":
              if (e < 500) { s.TX = -tr(tr(W / 3) * e / 500); s.AL = tr(255 * (500 - e) / 500); draw(prev); }
              else { s.TX = tr(tr(W / 3) * (1000 - e) / 500); s.AL = tr(255 * (e - 500) / 500); draw(items); }
              break;
            case "rollo": { const y = tr(H * e / 1000); s.GY0 = y; draw(prev); s.GY0 = 0; s.GY1 = y; draw(items); break; }
            case "blinds": {
              draw(prev);
              const sh = tr(H / 8);
              for (let k = 0; k < 8; k++) {
                const h = tr(sh * e / 1000);
                if (h <= 0) continue;
                box(0, k * sh, W, h, [0, 0, 0]); s.GY0 = k * sh; s.GY1 = k * sh + h; draw(items);
              }
              break;
            }
            case "box": {
              draw(prev);
              const hw = tr(tr(W / 2) * e / 1000), hh = tr(tr(H / 2) * e / 1000);
              if (hw > 0 && hh > 0) {
                const x0 = tr(W / 2) - hw, y0 = tr(H / 2) - hh;
                box(x0, y0, 2 * hw, 2 * hh, [0, 0, 0]);
                Object.assign(s, { GX0: x0, GX1: x0 + 2 * hw, GY0: y0, GY1: y0 + 2 * hh }); draw(items);
              }
              break;
            }
            case "tiles": {
              const ORD = [4, 0, 8, 2, 6, 1, 7, 3, 5];
              draw(prev);
              const n = tr(e * 10 / 1000);
              for (let r = 0; r < n && r < 9; r++) {
                const k = ORD[r], c = k % 3, w = tr(k / 3);
                const x0 = tr(W * c / 3), x1 = tr(W * (c + 1) / 3), y0 = tr(H * w / 3), y1 = tr(H * (w + 1) / 3);
                box(x0, y0, x1 - x0, y1 - y0, [0, 0, 0]);
                Object.assign(s, { GX0: x0, GX1: x1, GY0: y0, GY1: y1 }); draw(items);
              }
              break;
            }
            case "scanner": {
              const x = tr((W + 2) * e / 1000) - 1;
              s.GX0 = Math.max(0, x); draw(prev); s.GX0 = 0; s.GX1 = Math.max(0, x); draw(items);
              s.GX1 = W; box(x, 0, 2, H, [190, 225, 255]);
              break;
            }
            case "bounce": {
              const u = p - 1000;
              const f = 1000 + tr(2701 * u * u * u / 1000000000) + tr(1701 * u * u / 1000000);
              const o = tr(W * f / 1000); s.TX = -o; draw(prev); s.TX = W - o; draw(items);
              break;
            }
            case "drop": {
              const t11 = 11 * p;
              let f;
              if (t11 < 4000) f = tr(t11 * t11 / 16000);
              else if (t11 < 8000) { const u = t11 - 6000; f = tr(u * u / 16000) + 750; }
              else if (t11 < 10000) { const u = t11 - 9000; f = tr(u * u / 16000) + 937; }
              else { const u = t11 - 10500; f = tr(u * u / 16000) + 984; }
              if (p < 364) { s.TY = tr(H * f / 1000); draw(prev); }
              s.TY = tr(H * f / 1000) - H; draw(items);
              break;
            }
            case "stairs": {
              draw(prev);
              for (let k = 0; k < 8; k++) {
                let l = tr((e - k * 60) * 1000 / 580);
                if (l <= 0) continue;
                if (l > 1000) l = 1000;
                const x0 = tr(W * k / 8), x1 = tr(W * (k + 1) / 8), h = tr(H * l / 1000);
                box(x0, 0, x1 - x0, h, [0, 0, 0]);
                Object.assign(s, { GX0: x0, GX1: x1, GY0: 0, GY1: h }); draw(items);
              }
              break;
            }
            case "split": {
              const h = tr(tr(H / 2) * e / 1000), a = tr(H / 2) - h, b = H - a;
              s.GY1 = a; draw(prev); s.GY0 = b; s.GY1 = H; draw(prev); s.GY0 = a; s.GY1 = b; draw(items); break;
            }
            case "cross": {
              draw(prev);
              const hw = tr(tr(W / 2) * e / 1000), hh = tr(tr(H / 2) * e / 1000);
              if (hh > 0) { box(0, tr(H / 2) - hh, W, 2 * hh, [0, 0, 0]); s.GY0 = tr(H / 2) - hh; s.GY1 = tr(H / 2) + hh; draw(items); s.GY0 = 0; s.GY1 = H; }
              if (hw > 0) { box(tr(W / 2) - hw, 0, 2 * hw, H, [0, 0, 0]); s.GX0 = tr(W / 2) - hw; s.GX1 = tr(W / 2) + hw; draw(items); }
              break;
            }
            case "wave": {
              draw(prev);
              for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
                if (e < tr((r + c + 1) * 1000 / 8)) continue;
                const x0 = tr(W * c / 4), x1 = tr(W * (c + 1) / 4), y0 = tr(H * r / 4), y1 = tr(H * (r + 1) / 4);
                box(x0, y0, x1 - x0, y1 - y0, [0, 0, 0]);
                Object.assign(s, { GX0: x0, GX1: x1, GY0: y0, GY1: y1 }); draw(items);
              }
              break;
            }
            case "zipper": {
              const o = tr(W * e / 1000);
              s.GY1 = tr(H / 2); s.TX = -o; draw(prev); s.TX = W - o; draw(items);
              s.GY0 = tr(H / 2); s.GY1 = H; s.TX = o; draw(prev); s.TX = o - W; draw(items);
              break;
            }
            case "blink":
              if (e < 500) { const h = tr(tr(H / 2) * (500 - e) / 500); s.GY0 = tr(H / 2) - h; s.GY1 = tr(H / 2) + h; draw(prev); }
              else { const h = tr(tr(H / 2) * (e - 500) / 500); s.GY0 = tr(H / 2) - h; s.GY1 = tr(H / 2) + h; draw(items); }
              break;
            default: draw(items);
          }
          Object.assign(s, { TX: 0, TY: 0, GX0: 0, GY0: 0, GX1: W, GY1: H, AL: 255 });
        }
        return { buf: s.buf, acc: s.acc, info, scrolled: !!s.scrolled || !!s.anim, long: !!s.long };
      },
    };
  }

  const api = { create, makeGeometry };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.PixelRenderer = api;
})(this);
