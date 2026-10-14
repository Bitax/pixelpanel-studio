"""Community-Icons: Vorschläge aus GitHub-Issues prüfen, Vorschau rendern, angenommene Icons eintragen.

  python community_icons.py preview   – prüft das Icon, lädt ein Vorschaubild hoch und kommentiert
  python community_icons.py accept    – trägt das Icon in community/icons.json ein
  python community_icons.py test FILE – lokal testen: liest den Issue-Text aus FILE, schreibt preview.png

Eingaben kommen aus Umgebungsvariablen (ISSUE_BODY, ISSUE_NUMBER, …). Der Issue-Text ist fremder Inhalt
und wird nur als Daten gelesen – nichts daraus wird ausgeführt. Nur Python-Standardbibliothek.
"""
import base64
import datetime
import json
import os
import re
import struct
import sys
import urllib.error
import urllib.request
import zlib
from pathlib import Path

ALPH = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "community" / "icons.json"
PREVIEW_BRANCH = "icon-previews"


# ---------------------------------------------------------------- Issue lesen und prüfen
def parse(body):
    """Icon-Daten (JSON) und Bestätigungen aus dem Issue-Text holen. Gibt (icon, fehler) zurück."""
    body = body or ""
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", body, re.S) or re.search(r"(\{\s*\"name\".*\})", body, re.S)
    if not m:
        return None, "No icon data found – please submit the icon from the Studio via “Suggest icon for everyone”. · Keine Icon-Daten gefunden – bitte im Studio über „Icon für alle vorschlagen“ einreichen."
    try:
        d = json.loads(m.group(1))
    except ValueError:
        return None, "The icon data is damaged (invalid JSON) – please suggest it again from the Studio. · Die Icon-Daten sind beschädigt – bitte im Studio neu vorschlagen."
    err = check(d)
    if err:
        return None, err
    ticks = len(re.findall(r"^\s*-\s*\[[xX]\]", body, re.M))
    if ticks < 2:
        return None, "Please tick both confirmations (made by you / no logos, and CC0). · Bitte beide Bestätigungen ankreuzen (selbst erstellt / keine Logos und CC0)."
    name = re.sub(r"\s+", " ", str(d.get("name", ""))).strip()[:24] or "Icon"
    return {"name": name, "rows": d["rows"], "pal": ["#" + c.lstrip("#").lower() for c in d["pal"]]}, None


def check(d):
    """Gleiche Regeln wie im Studio (yaml_gen.custom_icon_ok)."""
    if not isinstance(d, dict):
        return "Die Icon-Daten haben ein falsches Format."
    rows, pal = d.get("rows"), d.get("pal")
    if not isinstance(rows, list) or not rows or len(rows) > 16 or not all(isinstance(r, str) for r in rows):
        return "Das Icon muss 1–16 Zeilen haben."
    w = len(rows[0])
    if not 1 <= w <= 16 or any(len(r) != w for r in rows):
        return "Das Icon muss 1–16 Pixel breit sein und alle Zeilen gleich lang."
    if not isinstance(pal, list) or not pal or len(pal) > len(ALPH) or not all(isinstance(c, str) and re.fullmatch(r"#?[0-9a-fA-F]{6}", c) for c in pal):
        return "Die Farbliste ist ungültig."
    ok = set(ALPH[:len(pal)]) | {"."}
    if any(ch not in ok for r in rows for ch in r):
        return "Das Icon enthält ungültige Zeichen."
    if all(ch == "." for r in rows for ch in r):
        return "Das Icon ist leer."
    return None


# ---------------------------------------------------------------- Vorschaubild (PNG, ohne Zusatzpakete)
def render_png(icon, cell=16, pad=16):
    rows, pal = icon["rows"], icon["pal"]
    n = 16
    oy, ox = (n - len(rows)) // 2, (n - len(rows[0])) // 2
    size = n * cell + 2 * pad
    bg, off = (17, 17, 19), (30, 30, 33)
    img = [[bg] * size for _ in range(size)]
    r0 = cell * 0.42
    for gy in range(n):
        for gx in range(n):
            ch = rows[gy - oy][gx - ox] if 0 <= gy - oy < len(rows) and 0 <= gx - ox < len(rows[0]) else "."
            col = off if ch == "." else tuple(int(pal[ALPH.index(ch)].lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
            cx, cy = pad + gx * cell + cell / 2, pad + gy * cell + cell / 2
            for y in range(int(cy - cell / 2), int(cy + cell / 2)):
                for x in range(int(cx - cell / 2), int(cx + cell / 2)):
                    if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r0 * r0:
                        img[y][x] = col
    raw = b"".join(b"\x00" + bytes(c for px in line for c in px) for line in img)

    def chunk(t, data):
        return struct.pack(">I", len(data)) + t + data + struct.pack(">I", zlib.crc32(t + data) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


# ---------------------------------------------------------------- GitHub-API (nur Standardbibliothek)
def gh(method, path, data=None):
    req = urllib.request.Request(f"https://api.github.com/repos/{os.environ['REPO']}{path}", method=method,
                                 data=json.dumps(data).encode() if data is not None else None,
                                 headers={"Authorization": f"Bearer {os.environ['GH_TOKEN']}",
                                          "Accept": "application/vnd.github+json", "User-Agent": "pixelpanel-community"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def comment(text):
    gh("POST", f"/issues/{os.environ['ISSUE_NUMBER']}/comments", {"body": text})


def upload_preview(png):
    """Vorschaubild auf einen eigenen Branch legen (hält main sauber) und die Bild-URL zurückgeben."""
    st, ref = gh("GET", f"/git/ref/heads/{PREVIEW_BRANCH}")
    if st == 404:
        _, repo = gh("GET", "")
        _, base = gh("GET", f"/git/ref/heads/{repo.get('default_branch', 'main')}")
        gh("POST", "/git/refs", {"ref": f"refs/heads/{PREVIEW_BRANCH}", "sha": base["object"]["sha"]})
    path = f"previews/{os.environ['ISSUE_NUMBER']}.png"
    st, cur = gh("GET", f"/contents/{path}?ref={PREVIEW_BRANCH}")
    data = {"message": f"Vorschau für #{os.environ['ISSUE_NUMBER']}", "branch": PREVIEW_BRANCH,
            "content": base64.b64encode(png).decode()}
    if st == 200 and "sha" in cur:
        data["sha"] = cur["sha"]
    st, res = gh("PUT", f"/contents/{path}", data)
    sha = (res.get("content") or {}).get("sha", "")
    return f"https://raw.githubusercontent.com/{os.environ['REPO']}/{PREVIEW_BRANCH}/{path}?v={sha[:8]}"


# ---------------------------------------------------------------- Befehle
def cmd_preview():
    icon, err = parse(os.environ.get("ISSUE_BODY"))
    if err:
        comment(f"⚠️ {err}")
        return
    url = upload_preview(render_png(icon))
    w, h = len(icon["rows"][0]), len(icon["rows"])
    comment(f"✅ Icon checked / geprüft: **{icon['name']}** · {w} × {h} px · {len(icon['pal'])} colours / Farben\n\n"
            f"<img src=\"{url}\" width=\"192\" alt=\"Preview\">\n\n"
            "Maintainer: add the label `icon-accepted` to publish it. · Zum Übernehmen das Label `icon-accepted` setzen.")


def slug(s):
    t = s.lower().translate(str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss"}))
    return re.sub(r"[^a-z0-9]+", "_", t).strip("_")[:20] or "icon"


def cmd_accept():
    icon, err = parse(os.environ.get("ISSUE_BODY"))
    if err:
        comment(f"⚠️ Could not be added / Konnte nicht übernommen werden: {err}")
        sys.exit(1)
    cat = json.loads(CATALOG.read_text(encoding="utf-8")) if CATALOG.exists() else {"version": 1, "license": "CC0-1.0", "icons": []}
    num = os.environ["ISSUE_NUMBER"]
    cat["icons"] = [i for i in cat.get("icons", []) if i.get("issue") != int(num)]
    cat["icons"].append({"id": f"{slug(icon['name'])}_{num}", **icon, "author": os.environ.get("ISSUE_AUTHOR", "")[:40],
                         "added": datetime.date.today().isoformat(), "issue": int(num)})
    CATALOG.parent.mkdir(exist_ok=True)
    CATALOG.write_text(json.dumps(cat, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def cmd_test(path):
    icon, err = parse(Path(path).read_text(encoding="utf-8"))
    print("Fehler:" if err else "OK:", err or f"{icon['name']} {len(icon['rows'][0])}×{len(icon['rows'])}, {len(icon['pal'])} Farben")
    if icon:
        Path("preview.png").write_bytes(render_png(icon))


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "preview":
        cmd_preview()
    elif cmd == "accept":
        cmd_accept()
    elif cmd == "test" and len(sys.argv) > 2:
        cmd_test(sys.argv[2])
    else:
        print(__doc__)
