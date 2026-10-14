/* Community: Feedback, Icon-Vorschläge und Community-Icon-Store – alles über GitHub (Issues + Datei im Repo).
 * Das Studio selbst sendet nichts: es öffnet nur ein vorausgefülltes GitHub-Formular im Browser,
 * das der Nutzer dort selbst abschickt. Das Repo steht in version.py (GITHUB_REPO). */

const ghRepo = () => (S.boot.github && S.boot.github.repo) || "";
function ghIssueUrl(template, title, fields) {
  const q = new URLSearchParams(Object.assign({ template, title }, fields));
  return `https://github.com/${ghRepo()}/issues/new?${q}`;
}
function ghOpen(url) { window.open(url, "_blank", "noopener"); }

// Technische Angaben – nur wenn der Nutzer zustimmt, nie Passwörter, Tokens oder Adressen
function techInfo() {
  const st = S.draft.settings, g = geom();
  const board = (S.boot.boards[st.hw_board] || {}).name || st.hw_board;
  const types = {};
  S.draft.pages.forEach((p) => (types[p.type] = (types[p.type] || 0) + 1));
  return [
    `Studio-Version: ${S.boot.version}`,
    `Board: ${board}`,
    `Panel: ${g.W} × ${g.H} Pixel (${g.modules} Modul${g.modules > 1 ? "e" : ""})`,
    `Seiten: ${Object.entries(types).map(([t, n]) => `${t}×${n}`).join(", ") || "–"}`,
    `Animation: ${animCfg().style}`,
    `Sprache: Oberfläche ${LANG}, Panel ${st.panel_lang || "de"}`,
    `Browser: ${navigator.userAgent.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim().slice(0, 120)}`,
  ].join("\n");
}

// ---------------------------------------------------------------- Feedback (Einstellungen)
function feedbackGroup() {
  const F = (S.feedback ||= { kind: "idee", title: "", text: "", tech: true });
  const repo = ghRepo();
  const kindSeg = el("div", { class: "seg" }, [["idee", "Idee / Wunsch"], ["fehler", "Fehler melden"]].map(([k, l]) =>
    el("button", { class: F.kind === k ? "on" : "", onclick: () => { F.kind = k; render(); } }, l)));
  const send = () => {
    if (!F.text.trim()) { toast("Bitte kurz beschreiben, worum es geht"); return; }
    const title = (F.title.trim() || F.text.trim().split("\n")[0]).slice(0, 80);
    ghOpen(ghIssueUrl(F.kind === "fehler" ? "bug.yml" : "idea.yml", (F.kind === "fehler" ? "Bug: " : "Idea: ") + title,
      { description: F.text.trim().slice(0, 4000), tech: F.tech ? techInfo() : "" }));
    toast("GitHub ist geöffnet – dort nur noch „Create“ klicken");
  };
  return group("Feedback & Ideen", [
    row("Art", kindSeg),
    el("div", { class: "row fb-row" },
      el("input", { class: "field", placeholder: F.kind === "fehler" ? "Kurz: was klappt nicht?" : "Kurz: was wünschst du dir?", value: F.title, maxlength: 80,
        oninput: (e) => (F.title = e.target.value) }),
      el("textarea", { class: "field fb-text", rows: 4, placeholder: F.kind === "fehler"
        ? "Was hast du gemacht, was ist passiert, was hättest du erwartet?"
        : "Beschreib deine Idee – gern mit Beispiel (welche Seite, welches Gerät …)", oninput: (e) => (F.text = e.target.value) }, F.text)),
    row("Technische Infos anhängen", el("label", { class: "switch" }, el("input", { type: "checkbox", checked: F.tech, onchange: (e) => (F.tech = e.target.checked) }), el("span")),
      "Version, Board, Panel-Größe und Seitentypen – keine Passwörter, Tokens oder Adressen"),
    el("div", { class: "row" }, el("div", { class: "label" }, el("small", {}, repo
      ? "Öffnet GitHub mit deinem Text. Dort nur noch absenden – dafür brauchst du ein kostenloses GitHub-Konto."
      : "Noch nicht verfügbar – das Projekt ist noch nicht auf GitHub veröffentlicht.")),
      repo && el("button", { class: "btn", onclick: () => ghOpen(`https://github.com/${repo}/issues`) }, "Alle Vorschläge"),
      el("button", { class: "btn primary", disabled: !repo, onclick: send }, "Auf GitHub senden …")),
  ], "Jeder Vorschlag wird gelesen. Was umgesetzt wird, kommt mit dem nächsten Update für alle.");
}

// ---------------------------------------------------------------- Icon vorschlagen (aus dem Icon-Editor)
function submitIconUrl(icon) {
  const json = JSON.stringify({ name: icon.name, rows: icon.rows, pal: icon.pal, studio: S.boot.version });
  return ghIssueUrl("icon.yml", `Icon: ${icon.name}`, { name: icon.name, icon_json: json });
}

// ---------------------------------------------------------------- Community-Icon-Store (in der Icon-Auswahl)
async function loadCommunity(force) {
  if (S.community && !force) return S.community;
  try { S.community = await api("/api/community-icons" + (force ? "?refresh=1" : "")); }
  catch (e) { S.community = { icons: [], source: "error" }; }
  return S.community;
}
function communitySection(cur, onPick) {
  const grid = el("div", { class: "icon-grid" }, el("small", { class: "muted" }, "Lade Community-Icons …"));
  const box = el("div", { class: "icon-group" }, el("h4", { class: "group-title" }, "Community-Icons"), grid);
  loadCommunity().then((c) => {
    const list = c.icons || [];
    if (!list.length) {
      grid.replaceChildren(el("small", { class: "muted ic-empty" }, ghRepo()
        ? "Noch keine Community-Icons – zeichne eins und schlag es vor!"
        : "Kommt mit der Veröffentlichung auf GitHub: Icons anderer Nutzer, kostenlos für alle."));
      return;
    }
    grid.replaceChildren(...list.map((ic) => {
      const key = "c_" + ic.id;
      const have = (S.draft.icons || {})[key];
      return el("button", { class: "icon-tile" + (key === cur ? " on" : ""), title: ic.author ? `${ic.name} · von ${ic.author}` : ic.name,
        onclick: () => {
          if (!have) S.draft.icons = Object.assign({}, S.draft.icons, { [key]: { name: ic.name, rows: ic.rows, pal: ic.pal, community: ic.id } });
          onPick(key);
        } }, iconCanvas(ic), el("small", {}, ic.name));
    }));
  });
  return box;
}
