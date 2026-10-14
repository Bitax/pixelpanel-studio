/* Anleitung „Verkabelung & Strom“ – zeichnet alle Bilder als SVG passend zum gewählten Board und Panel.
 * Wird von app.js über go("wiring") geöffnet (Einstellungen → Hardware → „Verkabelung zeigen“). */

// HUB75-Eingang, Draufsicht auf den Stecker am Panel (Pin 1 oben links, Kerbe links)
const HUB75 = [["r1", "g1"], ["b1", "gnd"], ["r2", "g2"], ["b2", "e"], ["a", "b"], ["c", "d"], ["clk", "lat"], ["oe", "gnd"]];
const SIG_COLOR = (k) => (k === "r1" || k === "r2" ? "#ff453a" : k === "g1" || k === "g2" ? "#30d158" : k === "b1" || k === "b2" ? "#0a84ff"
  : ["a", "b", "c", "d", "e"].includes(k) ? "#bf5af2" : k === "gnd" ? "#8e8e93" : "#ff9f0a");
const SIG_NAME = { r1: "R1", g1: "G1", b1: "B1", r2: "R2", g2: "G2", b2: "B2", a: "A", b: "B", c: "C", d: "D", e: "E", clk: "CLK", lat: "LAT", oe: "OE", gnd: "GND" };
const SIG_WHAT = {
  r1: "Rot, obere Hälfte", g1: "Grün, obere Hälfte", b1: "Blau, obere Hälfte", r2: "Rot, untere Hälfte", g2: "Grün, untere Hälfte", b2: "Blau, untere Hälfte",
  a: "Zeilen-Adresse", b: "Zeilen-Adresse", c: "Zeilen-Adresse", d: "Zeilen-Adresse", e: "Zeilen-Adresse (ab 64 Pixel Höhe)",
  clk: "Takt", lat: "Übernehmen (Latch)", oe: "Ein/Aus (Output Enable)", gnd: "Masse",
};

function svgEl(w, h, body, cls = "") {
  return el("div", { class: "wsvg " + cls, html: `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img">${body}</svg>` });
}
const tx = (x, y, t, o = {}) => `<text x="${x}" y="${y}" font-size="${o.s || 13}" fill="${o.c || "var(--w-text)"}" text-anchor="${o.a || "start"}" font-weight="${o.b ? 700 : 500}" font-family="system-ui, sans-serif">${escH(t)}</text>`;
const rc = (x, y, w, h, o = {}) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.r ?? 8}" fill="${o.f || "var(--w-box)"}" stroke="${o.s || "var(--w-line)"}" stroke-width="${o.sw || 1.5}"/>`;
const wire = (d, c, o = {}) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${o.w || 3}" stroke-linecap="round" ${o.flow ? `class="flow${o.slow ? " slow" : ""}"` : ""} ${o.dash ? 'stroke-dasharray="2 5"' : ""}/>`;

// ---- Stecker-Bild mit allen 16 Kontakten
function hub75Svg() {
  const W = 420, H = 300, px = 160, py = 34, gap = 30;
  let b = rc(px - 26, py - 22, 120, 8 * gap + 14, { f: "#1c1c1e", s: "#48484a", r: 6 });
  b += `<rect x="${px - 30}" y="${py + 3 * gap - 14}" width="8" height="${2 * gap}" fill="var(--w-bg)"/>`;
  b += tx(px - 26, py + 8 * gap + 8, "↑ Kerbe (Aussparung) auf dieser Seite", { s: 11, c: "var(--w-sub)" });
  HUB75.forEach((pair, r) => pair.forEach((k, c) => {
    const x = px + c * 64, y = py + r * gap;
    b += `<circle cx="${x}" cy="${y}" r="9" fill="${SIG_COLOR(k)}" class="pin-pulse" style="animation-delay:${(r * 2 + c) * 0.18}s"/>`;
    b += tx(c ? x + 22 : x - 22, y + 5, SIG_NAME[k], { a: c ? "start" : "end", b: true, s: 14 });
    b += tx(c ? x + 66 : x - 66, y + 5, String(r * 2 + c + 1), { a: c ? "start" : "end", s: 10, c: "var(--w-sub)" });
  }));
  b += tx(W / 2, H + 18, "Blick auf den Eingang (IN) am Panel · Pin 1 oben links", { a: "middle", s: 12, c: "var(--w-sub)" });
  return svgEl(W, H + 26, b);
}

// ---- ESP ⇄ Panel: jede Leitung einzeln, mit laufenden Datenpunkten
function wiresSvg(pins, chip) {
  const order = ["r1", "g1", "b1", "r2", "g2", "b2", "a", "b", "c", "d", "e", "clk", "lat", "oe", "gnd"];
  const W = 760, rowH = 26, top = 56, H = top + order.length * rowH + 30;
  const ex = 40, ew = 190, cx = 560, gap = 30;
  let b = rc(ex, 20, ew, H - 40, { f: "#1f2a3a", s: "#0a84ff" });
  b += tx(ex + ew / 2, 44, chip + " (Board)", { a: "middle", b: true, s: 14, c: "#9fd8ff" });
  b += rc(cx - 22, top - 30, 160, 8 * gap + 24, { f: "#1c1c1e", s: "#48484a", r: 6 });
  b += tx(cx + 37, top - 40, "HUB75 IN (Panel)", { a: "middle", b: true, s: 14 });
  const pinPos = {};
  HUB75.forEach((pair, r) => pair.forEach((k, c) => {
    const x = cx + c * 74, y = top - 6 + r * gap;
    if (!(k === "gnd" && pinPos.gnd)) pinPos[k] = [x, y];
    b += `<circle cx="${x}" cy="${y}" r="8" fill="${SIG_COLOR(k)}"/>` + tx(x + 13, y + 4, SIG_NAME[k], { s: 11, b: true });
  }));
  order.forEach((k, i) => {
    const y = top + i * rowH, label = k === "gnd" ? "GND" : (pins[k] === "" || pins[k] == null ? "–" : `GPIO ${pins[k]}`);
    b += tx(ex + 16, y + 4, label, { s: 13, b: true });
    b += tx(ex + ew - 16, y + 4, SIG_NAME[k], { a: "end", s: 11, c: SIG_COLOR(k) });
    b += `<circle cx="${ex + ew}" cy="${y}" r="4" fill="${SIG_COLOR(k)}"/>`;
    const [px, py] = pinPos[k];
    const d = `M${ex + ew} ${y} C ${ex + ew + 140} ${y}, ${px - 150} ${py}, ${px - 8} ${py}`;
    b += wire(d, SIG_COLOR(k), { w: 2.2 }) + wire(d, "#ffffff", { w: 2.2, flow: true, dash: true });
  });
  return svgEl(W, H, b, "wide");
}

// ---- Board steckt direkt auf dem Panel
function plugSvg(name) {
  const W = 520, H = 230;
  let b = rc(20, 20, 480, 190, { f: "#111", s: "#48484a", r: 10 });
  for (let i = 0; i < 12; i++) for (let j = 0; j < 5; j++) b += `<circle cx="${60 + i * 36}" cy="${48 + j * 34}" r="3" fill="#2c2c2e"/>`;
  b += rc(200, 80, 120, 34, { f: "#1c1c1e", s: "#8e8e93", r: 4 }) + tx(260, 102, "HUB75 IN", { a: "middle", s: 12, b: true });
  b += `<g class="plug-in">${rc(180, 128, 160, 70, { f: "#1f2a3a", s: "#0a84ff" })}${tx(260, 160, name, { a: "middle", s: 12, b: true, c: "#9fd8ff" })}${tx(260, 180, "steckt direkt auf", { a: "middle", s: 11, c: "var(--w-sub)" })}</g>`;
  b += tx(260, 222, "Rückseite des Panels", { a: "middle", s: 11, c: "var(--w-sub)" });
  return svgEl(W, H + 10, b);
}

// ---- Stromversorgung: Bausteine
const PSU = (x, y, label = "Netzteil 5 V") => rc(x, y, 150, 70, { f: "#2a2a1c", s: "#ffd60a" }) + tx(x + 75, y + 30, label, { a: "middle", b: true, s: 13 })
  + `<circle cx="${x + 130}" cy="${y + 50}" r="5" fill="#ff453a"/>` + tx(x + 118, y + 54, "+", { a: "end", s: 12, c: "#ff453a", b: true })
  + `<circle cx="${x + 20}" cy="${y + 50}" r="5" fill="#8e8e93"/>` + tx(x + 32, y + 54, "−", { s: 12, b: true });
const PANEL = (x, y, label = "LED-Panel") => rc(x, y, 190, 110, { f: "#111", s: "#48484a" }) + tx(x + 95, y + 24, label, { a: "middle", b: true, s: 13 })
  + rc(x + 14, y + 66, 64, 30, { f: "#1c1c1e", s: "#8e8e93", r: 4 }) + tx(x + 46, y + 86, "Strom", { a: "middle", s: 11 })
  + rc(x + 112, y + 66, 64, 30, { f: "#1c1c1e", s: "#8e8e93", r: 4 }) + tx(x + 144, y + 86, "IN", { a: "middle", s: 11, b: true })
  + rc(x + 124, y + 36, 52, 22, { f: "#1c1c1e", s: "#636366", r: 4 }) + tx(x + 150, y + 51, "OUT", { a: "middle", s: 10, c: "var(--w-sub)" });
const ESP = (x, y, label = "ESP32") => rc(x, y, 150, 80, { f: "#1f2a3a", s: "#0a84ff" }) + tx(x + 75, y + 26, label, { a: "middle", b: true, s: 13, c: "#9fd8ff" })
  + tx(x + 14, y + 52, "5V / VIN", { s: 11 }) + tx(x + 14, y + 70, "GND", { s: 11 }) + rc(x + 112, y + 46, 30, 22, { f: "#2c2c2e", s: "#8e8e93", r: 3 }) + tx(x + 127, y + 61, "USB", { a: "middle", s: 9 });
const RED = "#ff453a", BLK = "#8e8e93", RIB = "#bf5af2";
const pw2 = (d, c) => wire(d, c, { w: 4 }) + wire(d, "#fff", { w: 2, flow: true, dash: true, slow: c === BLK });

function powerSvg(kind) {
  const W = 720, H = 300;
  let b = "";
  if (kind === "one") {
    b += PSU(30, 30) + PANEL(500, 20) + ESP(250, 190);
    b += pw2("M160 80 C 300 80, 420 120, 528 116", RED) + pw2("M50 80 C 50 160, 420 150, 520 112", BLK);
    b += pw2("M160 80 C 200 140, 180 236, 250 238", RED) + pw2("M50 80 C 40 250, 200 258, 250 258", BLK);
    b += wire("M400 230 C 470 230, 640 200, 640 116", RIB, { w: 6 }) + wire("M400 230 C 470 230, 640 200, 640 116", "#fff", { w: 2, flow: true, dash: true });
    b += tx(470, 270, "Flachbandkabel (Daten + Masse)", { s: 11, c: RIB });
  } else if (kind === "usbc") {
    b += rc(20, 30, 130, 60, { f: "#2a2a1c", s: "#ffd60a" }) + tx(85, 56, "USB-C-Netzteil", { a: "middle", b: true, s: 12 }) + tx(85, 74, "5 V / 3 A", { a: "middle", s: 11 });
    b += rc(220, 30, 150, 60, { f: "#1c1c1e", s: "#8e8e93" }) + tx(295, 56, "USB-C-Buchse", { a: "middle", b: true, s: 12 }) + tx(295, 74, "mit Schraubklemmen", { a: "middle", s: 11 });
    b += wire("M150 60 L 220 60", "#d1d1d6", { w: 6 }) + tx(185, 50, "Kabel", { a: "middle", s: 10, c: "var(--w-sub)" });
    b += PANEL(500, 20) + ESP(250, 190);
    b += pw2("M370 50 C 440 50, 470 116, 528 116", RED) + pw2("M370 72 C 430 80, 470 112, 520 112", BLK);
    b += pw2("M330 90 C 330 150, 230 236, 250 238", RED) + pw2("M300 90 C 290 160, 220 258, 250 258", BLK);
    b += wire("M400 230 C 470 230, 640 200, 640 116", RIB, { w: 6 }) + wire("M400 230 C 470 230, 640 200, 640 116", "#fff", { w: 2, flow: true, dash: true });
  } else if (kind === "split") {
    b += PSU(30, 30) + PANEL(500, 20) + ESP(250, 190);
    b += rc(30, 200, 130, 70, { f: "#2c2c2e", s: "#8e8e93" }) + tx(95, 230, "PC / Ladegerät", { a: "middle", b: true, s: 12 }) + tx(95, 250, "USB", { a: "middle", s: 11 });
    b += wire("M160 236 C 240 236, 330 236, 362 246", "#d1d1d6", { w: 6 });
    b += pw2("M160 80 C 300 80, 420 120, 528 116", RED) + pw2("M50 80 C 50 160, 420 150, 520 112", BLK);
    b += wire("M400 230 C 470 230, 640 200, 640 116", RIB, { w: 6 }) + wire("M400 230 C 470 230, 640 200, 640 116", "#fff", { w: 2, flow: true, dash: true });
    b += tx(470, 270, "Masse kommt über das Flachbandkabel mit", { s: 11, c: RIB });
  } else if (kind === "multi") {
    b += PSU(20, 100, "Netzteil 5 V (stark)");
    [0, 1].forEach((i) => { b += PANEL(260 + i * 240, 20, `Panel ${i + 1}`); });
    b += ESP(260, 200);
    b += pw2("M150 150 C 220 150, 240 116, 288 116", RED) + pw2("M40 150 C 40 200, 240 140, 280 112", BLK);
    b += pw2("M150 150 C 320 170, 450 140, 528 116", RED) + pw2("M40 150 C 60 230, 460 150, 520 112", BLK);
    b += wire("M410 236 C 460 236, 400 140, 400 116", RIB, { w: 6 }) + wire("M410 236 C 460 236, 400 140, 400 116", "#fff", { w: 2, flow: true, dash: true });
    b += tx(470, 236, "ESP → Panel 1 IN · Panel 1 OUT → Panel 2 IN", { s: 11, c: RIB });
    b += wire("M436 67 C 480 67, 600 60, 644 86", RIB, { w: 6 }) + wire("M436 67 C 480 67, 600 60, 644 86", "#fff", { w: 2, flow: true, dash: true });
    b += pw2("M150 135 C 190 135, 200 236, 260 238", RED) + pw2("M40 160 C 40 260, 200 258, 260 258", BLK);
  } else {
    b += PSU(30, 30) + PANEL(500, 20, "LED-Panel + Board");
    b += pw2("M160 80 C 300 80, 420 120, 528 116", RED) + pw2("M50 80 C 50 160, 420 150, 520 112", BLK);
    b += `<g class="plug-in">${rc(590, 140, 110, 50, { f: "#1f2a3a", s: "#0a84ff" })}${tx(645, 170, "Board", { a: "middle", s: 12, b: true, c: "#9fd8ff" })}</g>`;
    b += pw2("M160 80 C 300 200, 520 240, 600 190", RED) + pw2("M50 80 C 60 280, 520 270, 620 190", BLK);
    b += tx(330, 280, "Board-Strom: Schraubklemme oder USB-C – siehe Anleitung des Boards", { a: "middle", s: 11, c: "var(--w-sub)" });
  }
  b += tx(18, H - 8, "rot = +5 V · grau = Masse (GND) · weiße Punkte = Stromfluss", { s: 11, c: "var(--w-sub)" });
  return svgEl(W, H, b, "wide");
}

// ================================================================ Ansicht
function viewWiring() {
  S.wiringTab ||= "one";
  const g = geom(), b = boardOf(), pw = power();
  const integrated = !!b.preset;
  const pins = b.pins || S.draft.settings.pins;
  const full = pw.module_amp * g.modules;
  const need = Math.ceil((full + S.boot.geo.espReserve + pw.idle) / S.boot.geo.safety);
  const minA = Math.max(2, Math.ceil(g.modules * 2));
  const step = (n, title, sub, ...body) => el("section", { class: "wstep" },
    el("div", { class: "wnum" }, String(n)), el("div", { class: "wbody" }, el("h3", {}, title), sub && el("p", { class: "wsub" }, sub), ...body));
  const need_list = [
    [`${g.modules} × LED-Panel ${g.module}`, "mit Flachbandkabel und Stromkabel – liegen meist bei"],
    [b.name, integrated ? "steckt direkt auf dem Panel" : "dein ESP32-Board"],
    integrated ? null : ["15 Steckkabel Buchse–Buchse", "„Dupont-Kabel“, ca. 10–20 cm – oder eine HUB75-Adapterplatine"],
    [`Netzteil 5 V, mindestens ${minA} A`, `für volle Helligkeit bei weißen Bildern ca. ${need} A · NIE 12 V oder 24 V!`],
    ["USB-Datenkabel", "für das allererste Aufspielen (manche Ladekabel können keine Daten)"],
    ["Kondensator 1000–2000 µF, ab 10 V (optional)", "pro Panel an den Stromanschluss – gegen Flackern bei hellen Bildern"],
  ].filter(Boolean);
  const tabs = [["one", "Ein Netzteil für alles", "empfohlen"], ["usbc", "USB-C-Netzteil", "z. B. 5 V / 3 A"], ["split", "ESP am USB, Panel am Netzteil", "zum Testen"],
    ["multi", "Mehrere Panels", `${g.modules > 1 ? "deine Anordnung" : "2 und mehr"}`], ["board", "Board mit Anschluss", "Trinity, Huidu, Matrix Portal …"]];
  const TXT = {
    one: ["Ein 5-V-Netzteil versorgt Panel und ESP32 gemeinsam.", [
      "Netzteil + (rot) an „+5V“/„VCC“ am Stromkabel des Panels, − (schwarz) an „GND“.",
      "Vom selben Netzteil zwei dünnere Kabel zum ESP32: + an den Pin „5V“ (manchmal „VIN“), − an „GND“.",
      "Das Flachbandkabel verbindet ESP und Panel – darüber laufen nur die Daten (und die Masse).",
      "Beim Aufspielen per USB das Netzteil ausstecken oder den 5V-Draht zum ESP kurz lösen."]],
    usbc: ["Ein normales USB-C-Ladegerät reicht für ein Panel – das Studio dimmt automatisch passend zum Netzteil.", [
      "Eine USB-C-Buchse mit Schraubklemmen („USB-C Breakout“, mit 5,1-kΩ-Widerständen an CC) liefert 5 V.",
      "Von den Klemmen + und − zum Stromkabel des Panels und dünn weiter zum ESP32 (5V und GND).",
      "Keinen „PD-Trigger“ auf 9/12/20 V stellen – das Panel verträgt nur 5 V.",
      "3 A reichen für ein 64×64-Panel bei Texten und Uhren; helle Flächen dimmt das Panel automatisch (Einstellungen → Panel & Hardware → Stromversorgung: 3 A eintragen)."]],
    split: ["Praktisch zum Ausprobieren: der ESP hängt am PC, das Panel am Netzteil.", [
      "ESP32 per USB am PC oder Handy-Ladegerät.",
      "Panel am 5-V-Netzteil (rot + / schwarz −).",
      "Die Masse (GND) muss verbunden sein – bei Steckkabeln den GND-Draht nicht vergessen, sonst gibt es Pixelsalat.",
      "Nie zusätzlich + vom Netzteil an den ESP, solange er am PC steckt."]],
    multi: ["Jedes Panel bekommt sein eigenes Stromkabel direkt vom Netzteil – nicht von Panel zu Panel durchschleifen.", [
      "Das Netzteil muss alle Panels schaffen: pro 64×64-Panel 2–4 A, das Studio dimmt bei Bedarf.",
      "Daten laufen als Kette: ESP → Panel 1 IN, Panel 1 OUT → Panel 2 IN … (Pfeile auf der Platine zeigen die Richtung).",
      `Die Reihenfolge der Kette steht unter Einstellungen → Panel & Hardware${g.modules > 1 ? " (bei dir " + g.modules + " Module)" : ""}.`,
      "Dicke Stromkabel verwenden (ab 5 A mindestens 1,5 mm²) und an jedes Panel einen Kondensator."]],
    board: ["Boards wie ESP32 Trinity, Matrix Portal S3, Huidu HD-WF1/WF2 oder Apollo M1 stecken direkt am HUB75-Eingang.", [
      "Board auf den Eingang (IN) des Panels stecken – keine Steckkabel nötig.",
      "Das Panel bekommt trotzdem sein eigenes Stromkabel vom 5-V-Netzteil.",
      "Das Board selbst: je nach Modell über USB-C oder eine Schraubklemme – steht in der Anleitung des Boards.",
      "Huidu-Boards beim ersten Mal per USB im Boot-Modus flashen (Taste beim Einstecken gedrückt halten)."]],
  };
  const [lead, bullets] = TXT[S.wiringTab];
  const pinTable = el("table", { class: "wtable" }, el("tr", {}, el("th", {}, "Panel"), el("th", {}, "Bedeutung"), el("th", {}, `ESP32 (${b.chip})`)),
    ["r1", "g1", "b1", "r2", "g2", "b2", "a", "b", "c", "d", "e", "clk", "lat", "oe", "gnd"].map((k) =>
      el("tr", {}, el("td", {}, el("span", { class: "sigdot", style: { background: SIG_COLOR(k) } }), SIG_NAME[k]), el("td", {}, SIG_WHAT[k]),
        el("td", {}, k === "gnd" ? "GND" : pins[k] === "" || pins[k] == null ? "–" : `GPIO ${pins[k]}`))));
  return el("div", { class: "view wiring" },
    head("Verkabelung & Strom", `Schritt für Schritt für dein Setup: ${g.modules} × ${g.module}, ${b.name}.`,
      el("button", { class: "btn", onclick: () => go("settings:panel") }, "Zurück zu den Einstellungen")),
    el("div", { class: "banner warn" }, el("div", {}, el("b", {}, "Erst alles verkabeln, dann Strom einschalten."),
      "Nie Kabel umstecken, solange Strom anliegt. Panels laufen ausschließlich mit 5 V.")),
    step(1, "Das brauchst du", null, el("div", { class: "wneed" }, need_list.map(([t, s2]) => el("div", { class: "wcard" }, el("b", {}, t), el("small", {}, s2))))),
    step(2, "Der Eingang am Panel", "Hinten auf dem Panel sitzen zwei 16-polige Stecker. Kleine Pfeile auf der Platine zeigen die Laufrichtung: der Stecker, von dem die Pfeile weg zeigen, ist der Eingang (IN). Dort kommt der ESP dran, der andere (OUT) führt zum nächsten Panel.",
      hub75Svg()),
    integrated
      ? step(3, "Board aufstecken", `Dein ${b.name} hat den passenden Stecker schon eingebaut – einfach auf den Eingang (IN) stecken. Die Pins sind fest verdrahtet (ESPHome-Preset „${b.preset}“).`, plugSvg(b.name), pinTable)
      : step(3, "ESP32 mit dem Panel verbinden", "Jede Leitung vom ESP32 zum gleichnamigen Kontakt am Stecker. Die GPIO-Nummern stehen auf dem Board aufgedruckt (z. B. „D25“, „IO25“ oder „25“). Tipp: das mitgelieferte Flachbandkabel in den Panel-Eingang stecken und die Steckkabel in die andere Seite des Flachbandkabels – so kannst du nichts am Panel verbiegen.",
        wiresSvg(pins, b.chip), pinTable),
    step(4, "Strom anschließen", "Wähle, wie du dein Panel versorgst – die Bilder zeigen, wo Plus und Minus hinkommen.",
      el("div", { class: "wtabs" }, tabs.map(([k, t, s2]) => el("button", { class: S.wiringTab === k ? "on" : "", onclick: () => { S.wiringTab = k; render(); } }, el("b", {}, t), el("small", {}, s2)))),
      el("p", { class: "wlead" }, lead), powerSvg(S.wiringTab), el("ol", { class: "wlist" }, bullets.map((t) => el("li", {}, t)))),
    step(5, "Software aufspielen", null, el("ol", { class: "wlist" },
      el("li", {}, "ESP32 per USB-Datenkabel an diesen PC stecken."),
      el("li", {}, "Einstellungen → Zugänge & Sicherheit → Übertragung → Gerät: den COM-Anschluss eintragen (Windows-Geräte-Manager → „Anschlüsse“)."),
      el("li", {}, "Oben auf „Übernehmen & aufs Panel“ – beim ersten Mal dauert das einige Minuten."),
      el("li", {}, "Danach das Gerät-Feld leeren: ab jetzt geht jedes Update über WLAN."))),
    step(6, "Sicher & stabil", null, el("ul", { class: "wlist" },
      el("li", {}, "Nur 5 V. Ein 12-V-Netzteil zerstört das Panel sofort."),
      el("li", {}, "Rot ist Plus (+5V / VCC), Schwarz ist Minus (GND). Vor dem Einschalten zweimal prüfen."),
      el("li", {}, "Das Panel nie über den ESP32 oder den USB-Anschluss des PCs mit Strom versorgen – nur direkt vom Netzteil."),
      el("li", {}, "ESP32 und Panel brauchen eine gemeinsame Masse (GND)."),
      el("li", {}, "Ein Kondensator mit 1000–2000 µF pro Panel am Stromanschluss verhindert Flackern bei hellen Bildern."),
      el("li", {}, "Kabeldicke: bis 5 A mindestens 0,75 mm², darüber 1,5 mm². Dünne Kabel werden warm."))),
    step(7, "Wenn etwas nicht klappt", null, el("table", { class: "wtable" },
      el("tr", {}, el("th", {}, "Was du siehst"), el("th", {}, "Was hilft")),
      [["Panel bleibt dunkel", "Strom am Panel? OE, LAT und CLK prüfen · Treiberchip auf „FM6126A“ stellen und neu übertragen"],
        ["Nur die obere oder untere Hälfte leuchtet", "E-Leitung fehlt (bei 64 Pixel Höhe Pflicht)"],
        ["Farben vertauscht", "R/G/B-Leitungen tauschen oder in den Pins prüfen"],
        ["Zufällige Pixel / Flimmern", "GND verbinden · Steckkabel kürzer · Kondensator · Netzteil stärker"],
        ["Bild doppelt / verschoben", "A/B/C/D vertauscht oder Ketten-Layout unter Einstellungen → Panel & Hardware ändern"],
        ["ESP startet bei hellen Bildern neu", "Netzteil zu schwach – in Einstellungen → Panel & Hardware → Stromversorgung den echten Wert eintragen"],
      ].map(([a, b2]) => el("tr", {}, el("td", {}, a), el("td", {}, b2))))));
}
