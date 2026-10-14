/* Icon-Editor: eigene 16×16-Icons zeichnen oder aus einem Bild erzeugen.
 * Gespeichert in config.icons[id] = { name, rows: ["..ab.."], pal: ["#rrggbb", …] } (Zeichen = Farbindex).
 * Wird aus der Icon-Auswahl geöffnet (openIconEditor). */

function openIconEditor(id, onSave) {
  const N = 16, ALPH = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const existing = id && S.draft.icons && S.draft.icons[id];
  // Arbeitsfläche: 16×16 Farben (null = aus)
  let px = Array.from({ length: N * N }, () => null);
  if (existing) {
    const h = existing.rows.length, w = existing.rows[0].length, oy = Math.floor((N - h) / 2), ox = Math.floor((N - w) / 2);
    existing.rows.forEach((r, y) => [...r].forEach((ch, x) => {
      if (ch !== ".") px[(y + oy) * N + x + ox] = "#" + existing.pal[ALPH.indexOf(ch)].replace("#", "").toLowerCase();
    }));
  }
  let name = existing ? existing.name : "";
  let color = "#ff9f0a", tool = "pen", down = false;
  const undo = [];
  const SWATCH = ["#ffffff", "#8e8e93", "#3a3a3c", "#ff453a", "#ff9f0a", "#ffd60a", "#30d158", "#64d2ff", "#0a84ff", "#bf5af2", "#ff2d55", "#a2845e"];
  const CELL = 22;
  const cv = el("canvas", { class: "ie-canvas", width: N * CELL, height: N * CELL });
  const prev = el("canvas", { class: "ie-prev", width: N * 6, height: N * 6 });
  const draw = () => {
    const c = cv.getContext("2d");
    c.fillStyle = "#050505"; c.fillRect(0, 0, cv.width, cv.height);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = px[y * N + x];
      c.fillStyle = v || ((x + y) % 2 ? "#141416" : "#1b1b1e");
      c.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
    }
    // LED-Vorschau
    const p = prev.getContext("2d");
    p.fillStyle = "#000"; p.fillRect(0, 0, prev.width, prev.height);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = px[y * N + x];
      p.fillStyle = v || "#111"; p.beginPath(); p.arc(x * 6 + 3, y * 6 + 3, 2.3, 0, Math.PI * 2); p.fill();
    }
    used.replaceChildren(...[...new Set(px.filter(Boolean))].slice(0, 24).map((c2) =>
      el("button", { class: "ie-sw" + (c2 === color ? " on" : ""), style: { background: c2 }, title: c2, onclick: () => setColor(c2) })));
    { const nc = new Set(px.filter(Boolean)).size; count.textContent = nc === 1 ? "1 Farbe" : `${nc} Farben`; }
  };
  const snapshot = () => { undo.push(px.slice()); if (undo.length > 40) undo.shift(); };
  const at = (e) => {
    const r = cv.getBoundingClientRect();
    return [Math.floor((e.clientX - r.left) / r.width * N), Math.floor((e.clientY - r.top) / r.height * N)];
  };
  const fill = (x, y, to) => {
    const from = px[y * N + x];
    if (from === to) return;
    const st = [[x, y]];
    while (st.length) {
      const [a, b] = st.pop();
      if (a < 0 || b < 0 || a >= N || b >= N || px[b * N + a] !== from) continue;
      px[b * N + a] = to;
      st.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]);
    }
  };
  const paint = (e) => {
    const [x, y] = at(e);
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    const erase = tool === "erase" || e.buttons === 2;
    if (tool === "fill" && !erase) fill(x, y, color);
    else px[y * N + x] = erase ? null : color;
    draw();
  };
  cv.addEventListener("pointerdown", (e) => { e.preventDefault(); snapshot(); down = true; cv.setPointerCapture(e.pointerId); paint(e); });
  cv.addEventListener("pointermove", (e) => { if (down && tool !== "fill") paint(e); });
  cv.addEventListener("pointerup", () => { down = false; });
  cv.addEventListener("contextmenu", (e) => e.preventDefault());

  const colorIn = el("input", { type: "color", value: color, oninput: (e) => setColor(e.target.value) });
  const used = el("div", { class: "ie-swatches" });
  const count = el("small", { class: "ie-count" });
  const setColor = (c2) => { color = c2.toLowerCase(); colorIn.value = color; if (tool === "erase") setTool("pen"); draw(); };
  const toolBtns = {};
  const setTool = (t) => { tool = t; Object.entries(toolBtns).forEach(([k, b]) => b.classList.toggle("on", k === t)); };
  const tools = el("div", { class: "seg" }, [["pen", "Stift"], ["fill", "Füllen"], ["erase", "Radierer"]].map(([k, l]) =>
    (toolBtns[k] = el("button", { class: k === tool ? "on" : "", onclick: () => setTool(k) }, l))));

  // Bild laden: auf 16×16 verkleinern, Transparenz übernehmen, Farben zusammenfassen
  let blackOff = true;
  const loadImage = (file) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = N; c.height = N;
      const g = c.getContext("2d");
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
      const k = Math.min(N / img.width, N / img.height), w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
      g.drawImage(img, Math.floor((N - w) / 2), Math.floor((N - h) / 2), w, h);
      const d = g.getImageData(0, 0, N, N).data;
      snapshot();
      const q = (v) => Math.min(255, Math.round(v / 24) * 24);
      for (let i = 0; i < N * N; i++) {
        const [r, gg, b, a] = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3]];
        px[i] = a < 110 || (blackOff && r + gg + b < 60) ? null : "#" + [q(r), q(gg), q(b)].map((v) => v.toString(16).padStart(2, "0")).join("");
      }
      reduce(40);
      draw();
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  };
  // höchstens n Farben: seltene Farben auf die nächstliegende häufige setzen
  const reduce = (n) => {
    const freq = {};
    px.forEach((v) => { if (v) freq[v] = (freq[v] || 0) + 1; });
    const keep = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, n).map(([v]) => v);
    const rgb = (v) => [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16));
    const K = keep.map(rgb);
    px = px.map((v) => {
      if (!v || keep.includes(v)) return v;
      const [r, g, b] = rgb(v);
      let best = 0, bd = 1e9;
      K.forEach(([r2, g2, b2], i) => { const dd = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2; if (dd < bd) { bd = dd; best = i; } });
      return keep[best];
    });
  };
  const file = el("input", { type: "file", accept: "image/*", style: { display: "none" }, onchange: (e) => e.target.files[0] && loadImage(e.target.files[0]) });

  // Für alle vorschlagen (öffnet ein vorausgefülltes GitHub-Formular)
  const repo = typeof ghRepo === "function" ? ghRepo() : "";
  let share = false, rights = false;
  const rightsBox = el("label", { class: "ie-check ie-rights", style: { display: "none" } },
    el("input", { type: "checkbox", onchange: (e) => (rights = e.target.checked) }),
    el("span", {}, "Ich habe das Icon selbst erstellt (oder darf es weitergeben), es enthält keine Logos oder fremden Marken, und es darf unter CC0 (gemeinfrei) für alle veröffentlicht werden."));
  const shareBox = el("div", { class: "ie-label" }, "Community",
    el("label", { class: "ie-check" + (repo ? "" : " off") },
      el("input", { type: "checkbox", disabled: !repo, onchange: (e) => { share = e.target.checked; rightsBox.style.display = share ? "" : "none"; } }),
      repo ? "Icon für alle vorschlagen" : "Icon für alle vorschlagen (kommt mit der Veröffentlichung auf GitHub)"),
    rightsBox,
    repo && el("small", { class: "ie-hint" }, "Nach dem Sichern öffnet sich GitHub mit deinem Icon – dort nur noch absenden. Einmal im Monat wird entschieden, welche Icons per Update für alle kommen."));

  const save = () => {
    if (share && !rights) { toast("Bitte erst die Bestätigung zum Vorschlagen ankreuzen"); return; }
    reduce(ALPH.length);
    const cols = [...new Set(px.filter(Boolean))];
    if (!cols.length) { toast("Das Icon ist noch leer"); return; }
    // auf den genutzten Bereich zuschneiden
    let x0 = N, x1 = -1, y0 = N, y1 = -1;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (px[y * N + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const rows = [];
    for (let y = y0; y <= y1; y++) {
      let r = "";
      for (let x = x0; x <= x1; x++) { const v = px[y * N + x]; r += v ? ALPH[cols.indexOf(v)] : "."; }
      rows.push(r);
    }
    let key = id;
    if (!key) { let n = 1; do { key = "u_" + n++; } while ((S.draft.icons || {})[key] || S.boot.icons[key]); }
    const icon = { name: (name || "Eigenes Icon").slice(0, 24), rows, pal: cols };
    S.draft.icons = Object.assign({}, S.draft.icons, { [key]: icon });
    if (share && rights) { ghOpen(submitIconUrl(icon)); toast("GitHub ist geöffnet – dort nur noch „Create“ klicken"); }
    close();
    updateSavebar();
    onSave && onSave(key);
    render();
  };
  const del = () => {
    if (!id || !confirm("Dieses Icon löschen? Seiten, die es nutzen, zeigen dann kein Icon mehr.")) return;
    const ic = Object.assign({}, S.draft.icons); delete ic[id]; S.draft.icons = ic;
    const strip = (o) => { if (o && o.icon === id) o.icon = ""; };
    S.draft.pages.forEach((p) => { strip(p.options); (p.options.fields || []).forEach((f) => strip(f && f.options)); });
    close(); updateSavebar(); render();
  };
  const close = () => ov.remove();
  const ov = el("div", { class: "overlay", onclick: (e) => e.target === ov && close() },
    el("div", { class: "sheet ie-sheet" },
      el("div", { class: "sheet-head" }, el("h3", {}, existing ? "Icon bearbeiten" : "Eigenes Icon"),
        el("div", { style: { color: "var(--text-2)" } }, "16 × 16 Pixel. Zeichne mit der Maus (rechte Maustaste radiert) oder lade ein Bild – es wird automatisch verkleinert. Schwarz leuchtet auf dem Panel nicht.")),
      el("div", { class: "sheet-body ie-body" },
        el("div", { class: "ie-left" }, cv),
        el("div", { class: "ie-right" },
          el("label", { class: "ie-label" }, "Name", el("input", { class: "field", value: name, maxlength: 24, placeholder: "z. B. Mein Logo", oninput: (e) => (name = e.target.value) })),
          el("div", { class: "ie-label" }, "Werkzeug", tools),
          el("div", { class: "ie-label" }, "Farbe", el("div", { class: "ie-swatches" }, colorIn, SWATCH.map((c2) => el("button", { class: "ie-sw", style: { background: c2 }, title: c2, onclick: () => setColor(c2) })))),
          el("div", { class: "ie-label" }, el("span", {}, "Im Icon verwendet ", count), used),
          el("div", { class: "ie-label" }, "Bild laden",
            el("div", { class: "ie-row" }, el("button", { class: "btn", onclick: () => file.click() }, "Bild auswählen …"), file,
              el("label", { class: "ie-check" }, el("input", { type: "checkbox", checked: blackOff, onchange: (e) => (blackOff = e.target.checked) }), "dunkle Pixel weglassen"))),
          el("div", { class: "ie-row" },
            el("button", { class: "btn", onclick: () => { if (undo.length) { px = undo.pop(); draw(); } } }, "Rückgängig"),
            el("button", { class: "btn", onclick: () => { snapshot(); px = px.map(() => null); draw(); } }, "Alles leeren")),
          el("div", { class: "ie-label" }, "So sieht es auf dem Panel aus", prev),
          shareBox)),
      el("div", { class: "sheet-foot" },
        existing && el("button", { class: "btn danger", onclick: del }, "Löschen"),
        el("button", { class: "btn", onclick: close }, "Abbrechen"),
        el("button", { class: "btn primary", onclick: save }, "Sichern"))));
  document.body.append(ov);
  draw();
}
