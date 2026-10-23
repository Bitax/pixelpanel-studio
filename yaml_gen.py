"""Erzeugt aus der Dashboard-Konfiguration eine vollständige ESPHome-YAML.

Schrift und Icons werden als Pixeldaten direkt in die Firmware eingebettet –
dadurch ist die Browser-Vorschau (static/renderer.js) pixelgenau identisch
mit dem Panel. Layout-Änderungen IMMER hier und im Renderer machen.

Jede Seite kann beliebige Home-Assistant-Entitäten nutzen; alle Werte kommen
als text_sensor aufs Panel und werden dort formatiert.
"""
import json
import math
import re

from geometry import ESP_RESERVE, SAFETY, Geom, hw_plan, power_cfg
from icons import ICONS, PALETTE, WEATHER, WATER_AUTO, ANIM, ACTIVE_STATES
from pixelfont import GLYPHS as FONT, HEIGHT as FONT_H, MINI, MINI_HEIGHT as MINI_H
from version import VERSION
import boards as hwboards
from paneltext import PANEL_TEXT, lang_of

PIN_KEYS = ["r1", "g1", "b1", "r2", "g2", "b2", "a", "b", "c", "d", "e", "lat", "oe", "clk"]
GLYPHS = "".join(FONT.keys())
STATE_WORDS = {
    "on": "AN", "off": "AUS", "open": "AUF", "closed": "ZU", "opening": "AUF..", "closing": "ZU..",
    "home": "DA", "not_home": "WEG", "locked": "ZU", "unlocked": "AUF",
    "playing": "PLAY", "paused": "PAUSE", "idle": "IDLE", "standby": "STBY",
    "heat": "HEIZEN", "cool": "KUEHLEN", "auto": "AUTO", "cleaning": "SAUGT", "docked": "DOCK",
    "above_horizon": "TAG", "below_horizon": "NACHT",
    "unavailable": "--", "unknown": "--",
}
MAX_PAGES = 16


class GenError(Exception):
    pass


# ---------------------------------------------------------------- Helfer
def ascii_text(s: str) -> str:
    """Umlaute & Sonderzeichen so umschreiben, dass die Pixelschrift sie hat."""
    rep = {"ä": "\x80", "ö": "\x81", "ü": "\x82", "Ä": "\x80", "Ö": "\x81", "Ü": "\x82",
           "ß": "ss", "°": "\x84", "€": "\x83", "$": "USD", "²": "2", "³": "3", "µ": "u"}
    out = "".join(rep.get(c, c) for c in (s or ""))
    return "".join(c for c in out if c in FONT)


def ascii_plain(s: str) -> str:
    """Nur ASCII (für Namen in Home Assistant/ESPHome): Umlaute als ae/oe/ue."""
    rep = {"ä": "ae", "ö": "oe", "ü": "ue", "Ä": "AE", "Ö": "OE", "Ü": "UE", "ß": "ss", "€": "EUR", "°": ""}
    out = "".join(rep.get(c, c) for c in (s or ""))
    return "".join(c for c in out if 32 <= ord(c) < 127 and c in FONT)


def yq(s) -> str:
    """Text sicher als YAML-String in doppelten Anführungszeichen (JSON-Escapes sind gültiges YAML)."""
    return json.dumps(str(s), ensure_ascii=False)


def cstr(s: str) -> str:
    # Zusatzzeichen (\x80 …) als Oktal-Escape – immer genau 3 Ziffern, damit nichts mit dem Folgezeichen verschmilzt
    return '"' + "".join("\\%03o" % ord(c) if ord(c) >= 127 else c for c in s.replace("\\", "\\\\").replace('"', '\\"')) + '"'


def color(hex_: str) -> str:
    h = (hex_ or "#ffffff").lstrip("#")
    if not re.fullmatch(r"[0-9a-fA-F]{6}", h):
        h = "ffffff"
    return f"Color({int(h[0:2], 16)}, {int(h[2:4], 16)}, {int(h[4:6], 16)})"


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9_]", "_", (s or "").lower())


def ind(code: str, n: int) -> str:
    # C++ ist einrückungs-egal, YAML-Blockskalare nicht -> jede Zeile gleich einrücken
    lines = [l.strip() for l in code.strip("\n").splitlines()]
    return "\n".join((" " * n + l) if l else "" for l in lines)


FONT_CODES = list(range(32, 127)) + list(range(128, 133))  # ASCII + Ä Ö Ü € °


def _font_cpp() -> str:
    return _font_tab(FONT, FONT_H, "FW", "FB") + "\n" + _font_tab(MINI, MINI_H, "MW", "MB")


def _font_tab(FONT, FONT_H, nw, nb) -> str:
    widths, rows = [], []
    for code in FONT_CODES:
        g = FONT.get(chr(code))
        if not g:
            widths.append("0")
            rows.append("{" + ",".join(["0"] * FONT_H) + "}")
            continue
        widths.append(str(g["w"]))
        bytes_ = []
        for r in g["rows"]:
            v = 0
            for i, c in enumerate(r[:8]):
                if c == "#":
                    v |= 0x80 >> i
            bytes_.append(f"0x{v:02X}")
        rows.append("{" + ",".join(bytes_) + "}")
    return (
        f"static const uint8_t {nw}[{len(FONT_CODES)}] = {{{','.join(widths)}}};\n"
        f"static const uint8_t {nb}[{len(FONT_CODES)}][{FONT_H}] = {{{','.join(rows)}}};"
    )




# ---------------------------------------------------------------- Zeichen-Helfer (einmal pro Bild)
# Jede Seite zeichnet in ihren Bereich (OX/OY = Ursprung, DW/DH = Größe). FR schneidet am Bereich ab
# und summiert die Farbwerte (ACC) für die Strombegrenzung. Die Seiten bestehen aus Zeilen, die "lay"
# zentriert anordnet und so lange verkleinert, bis alles passt – nichts wird abgeschnitten oder überlappt.
PRELUDE = _font_cpp() + """
int OX = 0, OY = 0, DW = 64, DH = 64;
// Zu langer Text (pro Seite): OVF 0 = Laufschrift, 1 = abkürzen, 2 = ausblenden; SMS = ms pro Pixel, STK = endlos (Ticker)
int OVF = 0; uint32_t SMS = 35; bool STK = false;
// Animationen: TX/TY verschieben alles, GX/GY = sichtbarer Bildschirmausschnitt, AL = Helligkeit 0..255
int TX = 0, TY = 0, GX0 = 0, GY0 = 0, GX1 = 4096, GY1 = 4096, AL = 255;
uint32_t ACC = 0;
// Nachtmodus: jede Farbe wird zu Rot in derselben Helligkeit (hellster Farbanteil)
const bool NIGHT = id(q_night);
Color ICOL = Color(10, 132, 255);  // frei wählbare Icon-Farbe (Palette "C")
auto FR = [&](int x, int y, int w, int h, Color c) {
if (x < 0) { w += x; x = 0; }
if (y < 0) { h += y; y = 0; }
if (x + w > DW) w = DW - x;
if (y + h > DH) h = DH - y;
if (w <= 0 || h <= 0) return;
int X = OX + x, Y = OY + y;
if (X < GX0) { w -= GX0 - X; X = GX0; }
if (Y < GY0) { h -= GY0 - Y; Y = GY0; }
if (X + w > GX1) w = GX1 - X;
if (Y + h > GY1) h = GY1 - Y;
if (w <= 0 || h <= 0) return;
if (NIGHT) c = Color(std::max(c.r, std::max(c.g, c.b)), 0, 0);
if (AL < 255) c = Color(c.r * AL / 255, c.g * AL / 255, c.b * AL / 255);
it.filled_rectangle(X, Y, w, h, c);
ACC += (uint32_t) (c.r + c.g + c.b) * w * h;
};
// Linie (Bresenham) und Kreis (Mittelpunkt-Verfahren) – für die Analoguhr
auto LN = [&](int x0, int y0, int x1, int y1, Color c) {
int dx = abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -abs(y1 - y0), sy = y0 < y1 ? 1 : -1, err = dx + dy;
for (;;) {
FR(x0, y0, 1, 1, c);
if (x0 == x1 && y0 == y1) break;
int e2 = 2 * err;
if (e2 >= dy) { err += dy; x0 += sx; }
if (e2 <= dx) { err += dx; y0 += sy; }
}
};
auto CI = [&](int cx, int cy, int r, Color c) {
int x = r, y = 0, err = 1 - r;
while (x >= y) {
FR(cx + x, cy + y, 1, 1, c); FR(cx + y, cy + x, 1, 1, c); FR(cx - y, cy + x, 1, 1, c); FR(cx - x, cy + y, 1, 1, c);
FR(cx - x, cy - y, 1, 1, c); FR(cx - y, cy - x, 1, 1, c); FR(cx + y, cy - x, 1, 1, c); FR(cx + x, cy - y, 1, 1, c);
y++;
if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
}
};
auto HL = [&](int x, int y, int w, Color c) { FR(x, y, w, 1, c); };
auto RC = [&](int x, int y, int w, int h, Color c) {
FR(x, y, w, 1, c); FR(x, y + h - 1, w, 1, c); FR(x, y + 1, 1, h - 2, c); FR(x + w - 1, y + 1, 1, h - 2, c);
};
// Größen in Viertel-Schritten (q = 4 -> 1×, 6 -> 1,5×, 8 -> 2× …): Bitmap-Spalte i liegt bei P(i, q)
auto P = [](int i, int q) -> int { return (i * q) >> 2; };
// Zeichen -> Index in FW/FB (ASCII 32–126, dazu 128–132 = Ä Ö Ü € °), sonst -1
auto GI = [](int ch) -> int { return ch >= 32 && ch < 127 ? ch - 32 : ch >= 128 && ch < 133 ? ch - 33 : -1; };
// Größe 3 = „Mini“: eigene 3×5-Schrift (MW/MB), 1:1 gezeichnet
auto tcols = [&](const char* s, int q) -> int {
int c = 0;
for (; *s; s++) { int g = GI((uint8_t) *s); if (g >= 0) c += q == 3 ? MW[g] : FW[g]; }
return c;
};
auto tw = [&](const char* s, int q) -> int { return q == 3 ? tcols(s, 3) : P(tcols(s, q), q); };
// Breite ohne die leere Spalte hinter dem letzten Zeichen
auto tw1 = [&](const char* s, int q) -> int { int c = tcols(s, q); return c > 0 ? (q == 3 ? c - 1 : P(c - 1, q)) : 0; };
// Texthöhe einer Zeile
auto TH = [&](int q) -> int { return q == 3 ? %d : P(7, q); };
// align: 0 = links, 1 = mittig, 2 = rechts
auto tx = [&](int x, int y, int q, Color col, int align, const char* s) {
int w = tw(s, q);
if (align == 1) x -= w / 2; else if (align == 2) x -= w;
int c0 = 0;
if (q == 3) {
for (; *s; s++) {
int i = GI((uint8_t) *s);
if (i < 0) continue;
for (int r = 0; r < %d; r++) { uint8_t b = MB[i][r]; for (int k = 0; b && k < 8; k++) if (b & (0x80 >> k)) FR(x + c0 + k, y + r, 1, 1, col); }
c0 += MW[i];
}
return;
}
for (; *s; s++) {
int c = (uint8_t) *s;
int i = GI(c);
if (i < 0) continue;
for (int r = 0; r < %d; r++) {
uint8_t b = FB[i][r];
if (!b) continue;
int ya = y + P(r, q), hh = P(r + 1, q) - P(r, q);
for (int k = 0; k < 8; k++) if (b & (0x80 >> k)) { int xa = x + P(c0 + k, q); FR(xa, ya, x + P(c0 + k + 1, q) - xa, hh, col); }
}
c0 += FW[i];
}
};
// pal != nullptr: eigenes Icon – jedes Zeichen (a–z, A–Z) ist ein Index in die Farbtabelle
auto draw_icon = [&](const char* const* rows, int h, int x0, int y0, int q, const uint32_t* pal) {
for (int y = 0; y < h; y++) {
int ya = y0 + P(y, q), hh = P(y + 1, q) - P(y, q);
if (hh <= 0) continue;
for (int x = 0; rows[y][x] != 0; x++) {
int xa = x0 + P(x, q), ww = P(x + 1, q) - P(x, q);
char ch = rows[y][x];
if (pal) {
if (ch == '.') continue;
int k = ch >= 'a' && ch <= 'z' ? ch - 'a' : ch - 'A' + 26;
uint32_t v = pal[k];
FR(xa, ya, ww, hh, Color((v >> 16) & 255, (v >> 8) & 255, v & 255));
continue;
}
switch (ch) {
%s
case 'C': FR(xa, ya, ww, hh, ICOL); break;
default: break;
}
}
}
};
// Zahl erkennen (gleiche Regeln wie die Vorschau)
auto is_num = [](const std::string& s) -> bool {
size_t i = 0, n = s.size();
if (i < n && (s[i] == '+' || s[i] == '-')) i++;
size_t a = i; while (i < n && isdigit((unsigned char) s[i])) i++;
size_t ip = i - a, fp = 0;
if (i < n && s[i] == '.') { i++; size_t b = i; while (i < n && isdigit((unsigned char) s[i])) i++; fp = i - b; }
if (ip == 0 && fp == 0) return false;
if (i < n && (s[i] == 'e' || s[i] == 'E')) {
i++; if (i < n && (s[i] == '+' || s[i] == '-')) i++;
size_t e = i; while (i < n && isdigit((unsigned char) s[i])) i++;
if (i == e) return false;
}
return i == n;
};
// 1234.5 -> "1.234,5" (dec = -1: automatisch 0 oder 1 Nachkommastelle)
auto num_fmt = [](float f, int dec, bool thou) -> std::string {
if (dec < 0) dec = fabsf(f - roundf(f)) < 0.05f ? 0 : 1;
char raw[40];
snprintf(raw, sizeof(raw), "%%.*f", dec, f);
std::string s(raw), sign, out;
if (!s.empty() && s[0] == '-') { sign = "-"; s = s.substr(1); }
size_t dot = s.find('.');
std::string ip = dot == std::string::npos ? s : s.substr(0, dot);
std::string fp = dot == std::string::npos ? "" : s.substr(dot + 1);
for (size_t i = 0; i < ip.size(); i++) {
if (thou && i > 0 && (ip.size() - i) %% 3 == 0) out += '.';
out += ip[i];
}
if (!fp.empty()) { out += ','; out += fp; }
return sign + out;
};
// 3.2: „an / läuft“ für animierte Icons – Zahl > Schwelle (ohne Schwelle > 0) oder ein bekannter Zustand
auto is_act = [&](const std::string& in, bool ht, float thr) -> bool {
size_t a = 0, b = in.size();
while (a < b && isspace((unsigned char) in[a])) a++;
while (b > a && isspace((unsigned char) in[b - 1])) b--;
std::string s;
for (size_t i = a; i < b; i++) s += (char) tolower((unsigned char) in[i]);
if (is_num(s)) { float f = strtof(s.c_str(), nullptr); return ht ? f > thr : f > 0; }
static const char* const AW[] = {@ACTIVE@, nullptr};
for (int i = 0; AW[i]; i++) if (s == AW[i]) return true;
return false;
};
// Text aus Home Assistant für die Pixelschrift: Umlaute/€/° auf die Zusatzzeichen, Unbekanntes weglassen
auto asc = [](const std::string& in) -> std::string {
std::string o;
for (size_t i = 0; i < in.size(); i++) {
unsigned char ch = (unsigned char) in[i];
if (ch < 0x80) { if (ch >= 32) o += (char) ch; continue; }
if (ch == 0xC3 && i + 1 < in.size()) {
unsigned char d = (unsigned char) in[++i];
if (d == 0xA4 || d == 0x84) o += (char) 0x80; else if (d == 0xB6 || d == 0x96) o += (char) 0x81; else if (d == 0xBC || d == 0x9C) o += (char) 0x82;
else if (d == 0x9F) o += "ss";
continue;
}
if (ch == 0xC2 && i + 1 < in.size()) { if ((unsigned char) in[++i] == 0xB0) o += (char) 0x84; continue; }
if (ch == 0xE2 && i + 2 < in.size() && (unsigned char) in[i + 1] == 0x82 && (unsigned char) in[i + 2] == 0xAC) { o += (char) 0x83; i += 2; continue; }
while (i + 1 < in.size() && ((unsigned char) in[i + 1] & 0xC0) == 0x80) i++;
}
return o;
};
auto word = [&](const std::string& s) -> std::string {
%s
return asc(s);
};
auto fit = [&](std::string t, int room, int sc) -> std::string {
while (!t.empty() && tw(t.c_str(), sc) > room) t.pop_back();
return t;
};
// ---- Zeilen-Layout
// sc: 0 = normal (läuft nur, wenn die Laufschrift eingeschaltet ist), 1 = erst kleiner, dann Laufschrift,
//     2 = läuft immer, 3 = läuft wenn zu lang (ohne zu verkleinern), -1 = abkürzen statt laufen
// tk: 0 = wie eingestellt, 1 = mit Pause am Anfang, 2 = endlos (Ticker)
// qq: eigene (kleinere) Größe dieser Zeile, 0 = wie die anderen; alt: kürzere Fassungen, durch \\n getrennt
struct Ln { std::string t; const char* const* ic; int ih; const uint32_t* pal; Color c; int role; int pri; bool deg; int bar; int sc; int tk; int qq; std::string alt; };
auto mk = [](const std::string& t, Color c, int role, int pri) -> Ln {
Ln l; l.t = t; l.ic = nullptr; l.ih = 0; l.pal = nullptr; l.c = c; l.role = role; l.pri = pri; l.deg = false; l.bar = -1; l.sc = 0; l.tk = 0; l.qq = 0; return l;
};
// Laufschrift: Text läuft im Fenster [x, x+room) von rechts nach links
// tk = false: kurze Pause am Anfang, tk = true: endlos ohne Halt (Ticker, Punkt zwischen den Durchläufen)
auto scr = [&](int x, int y, int room, int s, Color c, const char* t, bool tk) {
if (room <= 0) return;
int w = tw(t, s), gap = tk ? P(16, s) : P(12, s), per = w + gap;
const int PAUSE = tk ? 0 : 40;
int off = (int) ((millis() / SMS) %% (uint32_t) (per + PAUSE)) - PAUSE;
if (off < 0) off = 0;
int g0 = GX0, g1 = GX1;
GX0 = std::max(GX0, OX + x); GX1 = std::min(GX1, OX + x + room);
tx(x - off, y, s, c, 0, t);
tx(x - off + per, y, s, c, 0, t);
if (tk) {
int d = std::max(1, s >> 2), dx = x - off + w + (gap - d) / 2, dy = y + (TH(s) - d) / 2;
FR(dx, dy, d, d, c); FR(dx + per, dy, d, d, c);
}
GX0 = g0; GX1 = g1;
};
// nächstkleinere Größe: erst auf ganze Vielfache, dann in ganzen Schritten
auto dec = [](int q) -> int { return q %% 4 ? q - q %% 4 : q - 4; };
// pref: 0 = so groß wie möglich, sonst Wunschgröße (wird nur verkleinert, nie abgeschnitten)
// iq: Icongröße (0 = passend zur Schrift), va/ha: 0 = oben/links, 1 = mittig, 2 = unten/rechts
auto lay = [&](std::vector<Ln>& L, int pref, int iq, int va, int ha) {
const int M = 2;
int AW = DW - 2 * M, AH = DH - 2 * M;
int n = (int) L.size();
std::vector<char> on(n, 1), fx(n, 0);  // fx: 1 = läuft als Laufschrift, 2 = wird abgekürzt
int sm = pref > 0 ? pref : 32, ss = 4, gp = 2, tot = 0;
auto icq = [&](int s) -> int { return iq > 0 ? std::min(iq, sm) : std::max(4, (s / 8) * 4); };
auto dims = [&](Ln& l, int s, int& w, int& h) {
int ic = icq(s);
w = 0; h = 0;
if (l.bar >= 0) { w = AW > 12 ? AW - 4 : AW; h = std::max(2, 2 * (s >> 2)); return; }
if (l.ic) { w += P((int) strlen(l.ic[0]), ic); h = P(l.ih, ic); if (!l.t.empty()) w += 2 * std::max(1, ic >> 2); }
if (!l.t.empty()) { w += l.deg ? tw(l.t.c_str(), s) : tw1(l.t.c_str(), s); h = std::max(h, TH(s)); }
if (l.deg) w += (s >> 2) + 2;
};
// Hauptzeilen dürfen den Rand nutzen, Nebenzeilen halten Abstand
auto lim = [&](Ln& l) -> int { return l.role ? AW : DW - 2; };
// Größe einer Zeile: Haupt- oder Nebenschrift, ggf. nur diese Zeile kleiner (qq)
auto qs = [&](Ln& l) -> int { int b = l.role ? ss : sm; return l.qq ? std::min(l.qq, b) : b; };
for (;;) {
ss = sm == 3 ? 3 : std::max(4, (sm / 8) * 4); gp = (ss >> 2) + 1;
tot = 0; int cnt = 0, wide = -1;
for (int i = 0; i < n; i++) {
if (!on[i]) continue;
int w, h; dims(L[i], qs(L[i]), w, h);
if (w > lim(L[i]) && wide < 0 && !fx[i] && L[i].sc != 2 && L[i].sc != 3) wide = i;
tot += h; cnt++;
}
if (cnt > 1) tot += (cnt - 1) * gp;
if (wide < 0 && tot <= AH) break;
if (wide >= 0) {
Ln& l = L[wide];
bool txt = !l.t.empty() && (l.sc == 0 || l.sc == 1 || l.sc == -1);
int mode = l.sc == -1 ? 1 : OVF;
// Hauptzeilen werden erst kleiner; Nebenzeilen (Titel) laufen bzw. werden gekürzt, statt den Hauptwert zu verkleinern
if (l.role == 0 && sm > 4) { sm = dec(sm); continue; }
// Nebenzeile (Datum, „WOLKIG“, Titel): nur diese Zeile kleiner – bis zur Mini-Schrift –, dann die Kurzform
if (txt && l.role == 1) { int cur = qs(l); if (cur > 4) { l.qq = dec(cur); continue; } if (cur == 4) { l.qq = 3; continue; } }
if (txt && !l.alt.empty()) { size_t k = l.alt.find('\\n'); l.t = l.alt.substr(0, k); l.alt = k == std::string::npos ? "" : l.alt.substr(k + 1); continue; }
if (txt && mode == 0) { fx[wide] = 1; continue; }
if (txt && mode == 2 && l.pri > 0) { on[wide] = 0; continue; }
if (txt) { fx[wide] = 2; continue; }
if (l.role == 1 && ss > 4) { sm = dec(sm); continue; }
if (l.ic) { l.ic = nullptr; continue; }
if (l.pri > 0) { on[wide] = 0; continue; }
break;
}
int drop = -1;
for (int i = 0; i < n; i++) if (on[i] && L[i].pri > 0 && (drop < 0 || L[i].pri > L[drop].pri)) drop = i;
if (sm > 8) { sm = dec(sm); continue; }
if (drop >= 0) { on[drop] = 0; continue; }
if (sm > 4) { sm = dec(sm); continue; }
break;
}
int y = M + (AH - tot) * va / 2;
for (int i = 0; i < n; i++) {
if (!on[i]) continue;
Ln& l = L[i];
int s = qs(l), w, h;
dims(l, s, w, h);
bool run = !l.t.empty() && l.bar < 0 && (l.sc == 2 || ((fx[i] == 1 || l.sc == 3) && w > lim(l)));
if (run) {
int x = (DW - lim(l)) / 2, ic = icq(s);
if (l.ic) { draw_icon(l.ic, l.ih, x, y + (h - P(l.ih, ic)) / 2, ic, l.pal); x += P((int) strlen(l.ic[0]), ic) + 2 * std::max(1, ic >> 2); }
scr(x, y + (h - TH(s)) / 2, (DW - lim(l)) / 2 + lim(l) - x, s, l.c, l.t.c_str(), l.tk ? l.tk == 2 : STK);
y += h + gp;
continue;
}
if (w > lim(l) && !l.t.empty()) { l.t = fit(l.t, tw(l.t.c_str(), s) - (w - lim(l)), s); dims(l, s, w, h); }
int room = DW - w;
int x = ha == 1 ? room / 2 : ha == 0 ? std::min(M, room) : room - std::min(M, room);
if (l.bar >= 0) {
FR(x, y, w, h, Color(38, 38, 40));
if (l.bar > 0) FR(x, y, w * l.bar / 1000, h, l.c);
} else {
int ic = icq(s);
if (l.ic) { draw_icon(l.ic, l.ih, x, y + (h - P(l.ih, ic)) / 2, ic, l.pal); x += P((int) strlen(l.ic[0]), ic) + (l.t.empty() ? 0 : 2 * std::max(1, ic >> 2)); }
if (!l.t.empty()) {
int ty = y + (h - TH(s)) / 2;
tx(x, ty, s, l.c, 0, l.t.c_str());
x += tw(l.t.c_str(), s);
if (l.deg) RC(x + 1, ty + (s >> 2), (s >> 2) + 1, (s >> 2) + 1, l.c);
}
}
y += h + gp;
}
};
// ---- Liste: Zeilen/Spalten passend zum Bereich, Schrift so groß wie möglich
auto lst = [&](const std::string& title, std::vector<std::string>& lab, std::vector<std::string>& val, int pref, int va, Color main, Color acc) {
const int M = 2;
int AW = DW - 2 * M, AH = DH - 2 * M;
int n = (int) lab.size();
int q = pref > 0 ? pref : 16, cols = 1, rows = 0, hh = 0, sp = 1, lh = 7;
for (;;) {
sp = std::max(1, q >> 2); lh = TH(q);
hh = (!title.empty() && AH >= lh * 3 + 2 * sp + 4 && (OVF != 2 || tw1(title.c_str(), q) <= AW)) ? lh + 5 : 0;
rows = std::max(0, (AH - hh + sp + 1) / (lh + sp + 1));
cols = std::max(1, (AW + 4 * sp) / (60 * sp + 4 * sp));
// passt jede Zeile (Beschriftung + Wert) ohne Kürzen?
bool wfit = true;
int cw0 = (AW - (cols - 1) * 4 * sp) / cols;
for (int i = 0; i < std::min(n, rows * cols) && q > 4; i++)
if (tw(lab[i].c_str(), q) + tw(val[i].c_str(), q) + 2 * sp > cw0) { wfit = false; break; }
if ((rows * cols >= n && rows > 0 && wfit) || q <= 4) break;
q = dec(q);
}
int m = std::min(n, rows * cols);
int ru = std::max(1, (m + cols - 1) / cols);
int gap = sp + 1, cg = 4 * sp;
int bh = hh + ru * lh + (ru - 1) * gap;
int y0 = M + (AH - bh) * va / 2;
if (hh) {
if (tw1(title.c_str(), q) <= AW) tx(DW / 2, y0, q, acc, 1, title.c_str());
else if (OVF == 0) scr(M, y0, AW, q, acc, title.c_str(), STK);
else tx(M, y0, q, acc, 0, fit(title, AW + 1, q).c_str());
HL(M, y0 + lh + 2, AW, Color(58, 58, 60));
}
int cw = (AW - (cols - 1) * cg) / cols;
for (int i = 0; i < m; i++) {
int c = i / ru, r = i %% ru;
int x0 = M + c * (cw + cg), y = y0 + hh + r * (lh + gap);
std::string v = fit(val[i], cw + sp, q);
tx(x0 + cw + sp, y, q, main, 2, v.c_str());
tx(x0, y, q, Color(174, 174, 178), 0, fit(lab[i], cw - tw(v.c_str(), q) - 2 * sp, q).c_str());
}
};
// ---- Kalender: Datum "2026-10-14 14:30:00" (oder nur "2026-10-14") -> Tage seit 1970 + Sekunde
auto dg = [](const std::string& s, size_t i, size_t n) -> int {
if (i + n > s.size()) return -1;
int v = 0;
for (size_t k = i; k < i + n; k++) { if (s[k] < '0' || s[k] > '9') return -1; v = v * 10 + (s[k] - '0'); }
return v;
};
auto dfc = [](int y, int m, int d) -> int {
y -= m <= 2 ? 1 : 0;
int era = y / 400, yoe = y - era * 400;
int doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
return era * 146097 + yoe * 365 + yoe / 4 - yoe / 100 + doy - 719468;
};
// Tage seit 1970 -> Monat/Tag
auto cfd = [](int z, int& m, int& d) {
z += 719468;
int era = z / 146097, doe = z - era * 146097;
int yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
int doy = doe - (365 * yoe + yoe / 4 - yoe / 100), mp = (5 * doy + 2) / 153;
d = doy - (153 * mp + 2) / 5 + 1; m = mp < 10 ? mp + 3 : mp - 9;
};
struct Ev { int day; int sec; int mo; int dd; bool ad; int ld; std::string t; Color c; };
auto pev = [&](const std::string& st, bool ad, Ev& e) -> bool {
int Y = dg(st, 0, 4), M = dg(st, 5, 2), D = dg(st, 8, 2);
if (Y < 1970 || M < 1 || M > 12 || D < 1 || D > 31 || st[4] != '-' || st[7] != '-') return false;
e.day = dfc(Y, M, D); e.mo = M; e.dd = D;
int h = st.size() > 10 ? dg(st, 11, 2) : -1, mi = st.size() > 10 ? dg(st, 14, 2) : -1;
e.ad = ad || h < 0 || mi < 0;
e.sec = e.ad ? 0 : h * 3600 + mi * 60;
e.ld = e.day;
return true;
};
// Ende eines Termins -> letzter Tag (ganztägig: Ende zählt nicht mit, 00:00 ebenso)
auto pend = [&](const std::string& en, Ev& e) {
int Y = dg(en, 0, 4), M = dg(en, 5, 2), D = dg(en, 8, 2);
if (Y < 1970 || M < 1 || M > 12 || D < 1 || D > 31) return;
int z = dfc(Y, M, D), h = en.size() > 10 ? dg(en, 11, 2) : -1, mi = en.size() > 10 ? dg(en, 14, 2) : -1;
if (e.ad || (h <= 0 && mi <= 0)) z--;
if (z > e.day) e.ld = z;
};
// Wörter ausblenden: Groß-/Kleinschreibung egal
auto hasw = [](const std::string& s, const char* w) -> bool {
size_t n = strlen(w);
if (!n || n > s.size()) return false;
for (size_t i = 0; i + n <= s.size(); i++) {
size_t k = 0;
while (k < n && tolower((unsigned char) s[i + k]) == tolower((unsigned char) w[k])) k++;
if (k == n) return true;
}
return false;
};
// ---- Verlauf: Zahlen aus einer Attribut-Liste lesen ([1.2, 3.4] oder [{'value': 1.2}, …])
auto ntok = [&](const std::string& s, size_t i) -> float {
size_t j = i;
while (j < s.size() && ((s[j] >= '0' && s[j] <= '9') || s[j] == '+' || s[j] == '-' || s[j] == '.' || s[j] == 'e' || s[j] == 'E')) j++;
std::string t = s.substr(i, j - i);
return is_num(t) ? strtof(t.c_str(), nullptr) : NAN;
};
auto plist = [&](const std::string& s, const std::string& key0, std::vector<float>& out) {
out.clear();
std::string key = key0;
if (s.find(':') == std::string::npos) {
size_t i = 0;
while (i < s.size() && out.size() < 96) {
while (i < s.size() && (s[i] == ' ' || s[i] == ',' || s[i] == '[' || s[i] == ']' || s[i] == '(' || s[i] == ')')) i++;
size_t j = i;
while (j < s.size() && !(s[j] == ' ' || s[j] == ',' || s[j] == '[' || s[j] == ']' || s[j] == '(' || s[j] == ')')) j++;
if (j > i) {
std::string t = s.substr(i, j - i);
if (is_num(t)) out.push_back(strtof(t.c_str(), nullptr));
else if (t == "None" || t == "null") out.push_back(NAN);
}
i = j;
}
return;
}
if (key.empty()) {
static const char* const AUTO[] = {"value", "total", "price", "price_per_kwh"};
for (const char* k : AUTO) {
if (s.find(std::string("'") + k + "'") != std::string::npos || s.find(std::string("\\"") + k + "\\"") != std::string::npos) { key = k; break; }
}
if (key.empty()) return;
}
size_t p = 0;
while (out.size() < 96) {
p = s.find(key, p);
if (p == std::string::npos) break;
size_t e = p + key.size();
bool qa = p > 0 && (s[p - 1] == '\\'' || s[p - 1] == '"');
bool qb = e < s.size() && s[e] == s[p > 0 ? p - 1 : 0];
p = e;
if (!qa || !qb) continue;
e++;
while (e < s.size() && s[e] == ' ') e++;
if (e >= s.size() || s[e] != ':') continue;
e++;
while (e < s.size() && s[e] == ' ') e++;
out.push_back(ntok(s, e));
}
};
// Verlauf zeichnen: Kopfzeile (Titel links, aktueller Wert rechts), darunter Linie oder Balken, Min/Max rechts
auto chrt = [&](const float* v, int n, int style, bool mm, const std::string& title, const std::string& nv, const std::string& nu, Color main, Color acc, int dc, const char* nodata) {
const int M = 2;
int AW = DW - 2 * M, AH = DH - 2 * M, y = M;
std::string nw = nv + nu;
if (tw1(nw.c_str(), 4) > AW) nw = nv;
if (tw1(nw.c_str(), 4) > AW) nw = "";
if ((!title.empty() || !nw.empty()) && AH >= 20) {
int nwd = nw.empty() ? 0 : tw1(nw.c_str(), 4);
if (nwd) tx(M + AW - nwd, y, 4, main, 0, nw.c_str());
int room = AW - nwd - (nwd ? 4 : 0);
if (!title.empty() && room > 0) tx(M, y, 4, acc, 0, fit(title, room + 1, 4).c_str());
y += 9;
}
int ch = M + AH - y;
if (ch < 4) return;
float mn = 0, mx = 0;
int cnt = 0;
for (int i = 0; i < n; i++) {
float f = v[i];
if (f != f) continue;
if (cnt == 0 || f < mn) mn = f;
if (cnt == 0 || f > mx) mx = f;
cnt++;
}
if (cnt == 0) { tx(DW / 2, y + (ch - 7) / 2, 4, Color(142, 142, 147), 1, nodata); return; }
int lw = 0;
std::string smx, smn;
if (mm && ch >= 16) {
smx = num_fmt(mx, dc, false); smn = num_fmt(mn, dc, false);
lw = std::max(tw1(smx.c_str(), 4), tw1(smn.c_str(), 4)) + 2;
if (lw > AW / 2) lw = 0;
}
int cw = AW - lw;
if (lw) {
tx(M + AW - tw1(smx.c_str(), 4), y, 4, Color(142, 142, 147), 0, smx.c_str());
tx(M + AW - tw1(smn.c_str(), 4), y + ch - 7, 4, Color(142, 142, 147), 0, smn.c_str());
}
float rg = mx - mn;
auto Y = [&](float f) -> int { return rg > 0 ? (int) ((f - mn) / rg * (float) (ch - 1) + 0.5f) : (ch - 1) / 2; };
Color dim = Color(main.r / 4, main.g / 4, main.b / 4);
if (style == 1 && cw >= 2 * n) {
for (int b = 0; b < n; b++) {
float f = v[b];
if (f != f) continue;
int yy = Y(f), x0 = b * cw / n, x1 = (b + 1) * cw / n;
FR(M + x0, y + ch - 1 - yy, x1 - x0 - 1, yy + 1, main);
}
return;
}
int py = -1;
for (int x = 0; x < cw; x++) {
float f = v[x * n / cw];
if (f != f) { py = -1; continue; }
int yy = Y(f);
if (style == 1) { FR(M + x, y + ch - 1 - yy, 1, yy + 1, main); continue; }
FR(M + x, y + ch - yy, 1, yy, dim);
int a = py < 0 ? yy : py, lo = std::min(a, yy), hi = std::max(a, yy);
FR(M + x, y + ch - 1 - hi, 1, hi - lo + 1, main);
py = yy;
}
};
""" % (
    MINI_H, MINI_H,
    FONT_H,
    "\n".join(f"case '{k}': FR(xa, ya, ww, hh, {color(v)}); break;" for k, v in PALETTE.items()),
    "\n".join(f'if (s == "{k}") return std::string("{v}");' for k, v in STATE_WORDS.items()),
)
PRELUDE = PRELUDE.replace("@ACTIVE@", ", ".join(cstr(w) for w in ACTIVE_STATES))


def ota_screen_cpp(W, H):
    """Ruhiger Bildschirm, solange ein Update per WLAN läuft: nur „UPDATE“ in der Mitte.
    (3.4: ohne Balken – während ESPHome die Firmware empfängt, zeichnet der ESP32 nichts neu.)"""
    return f"""// Update läuft: nur „UPDATE“ – wird beim Start einmal gezeichnet und bleibt bis zum Neustart stehen
OX = 0; OY = 0; DW = {W}; DH = {H}; GX0 = 0; GY0 = 0; GX1 = {W}; GY1 = {H}; AL = 255;
int q = (tw("UPDATE", 8) <= {W} - 4 && {H} >= 48) ? 8 : (tw("UPDATE", 4) <= {W} - 2 ? 4 : 3);
tx({W} / 2, ({H} - TH(q)) / 2, q, Color(0, 150, 255), 1, "UPDATE");"""


def ota_yaml(ota_pw, interval):
    """OTA mit Update-Bildschirm: beim Start „UPDATE“ zeigen und den Takt drosseln, bei Fehler zurück zum normalen Takt."""
    return f"""ota:
  - platform: esphome
""" + (f"    password: {cstr(ota_pw)}\n" if ota_pw else "") + f"""    on_begin:
      - lambda: 'id(ota_st) = 1;'
      - component.resume:
          id: matrix
          update_interval: 1s
      - component.update: matrix
    on_error:
      - lambda: 'id(ota_st) = 0;'
      - component.resume:
          id: matrix
          update_interval: {interval}ms
"""


def prelude_for(lang):
    """PRELUDE mit den Zustandswörtern (an/aus …) in der Panel-Sprache."""
    if lang == "de":
        return PRELUDE
    old = "\n".join(f'if (s == "{k}") return std::string("{v}");' for k, v in STATE_WORDS.items())
    new = "\n".join(f'if (s == "{k}") return std::string("{v}");' for k, v in PANEL_TEXT[lang]["words"].items())
    out = PRELUDE.replace(old, new)
    T = PANEL_TEXT[lang]
    for a, b in ((" == 0) out += '.';", f" == 0) out += '{T['thou']}';"),
                 ("if (!fp.empty()) { out += ','; out += fp; }", f"if (!fp.empty()) {{ out += '{T['dec']}'; out += fp; }}")):
        assert a in out, a
        out = out.replace(a, b)
    return out


def date_cpp(lang, var="t"):
    """snprintf für das Datum: DE „SO 11.10.“, EN „SU 11 OCT“."""
    T = PANEL_TEXT[lang]
    wd = ", ".join(cstr(x) for x in T["wd"])
    if T["months"]:
        mo = ", ".join(cstr(x) for x in T["months"])
        return (f'static const char* WD[] = {{{wd}}}; static const char* MO[] = {{{mo}}};\n'
                f'snprintf(buf, sizeof(buf), "%s %d %s", WD[{var}.day_of_week - 1], {var}.day_of_month, MO[{var}.month - 1]);')
    return (f'static const char* WD[] = {{{wd}}};\n'
            f'snprintf(buf, sizeof(buf), "%s %02d.%02d.", WD[{var}.day_of_week - 1], {var}.day_of_month, {var}.month);')


def date_alt_cpp(lang, var="t"):
    """Kurzformen des Datums für enge Flächen: DE „DI 13.“ / „13.10.“, EN „TU 13“ / „13 OCT“ (in l.alt)."""
    if PANEL_TEXT[lang]["months"]:
        a = f'snprintf(b1, sizeof(b1), "%s %d", WD[{var}.day_of_week - 1], {var}.day_of_month); snprintf(b2, sizeof(b2), "%d %s", {var}.day_of_month, MO[{var}.month - 1]);'
    else:
        a = f'snprintf(b1, sizeof(b1), "%s %02d.", WD[{var}.day_of_week - 1], {var}.day_of_month); snprintf(b2, sizeof(b2), "%02d.%02d.", {var}.day_of_month, {var}.month);'
    return "{ char b1[16], b2[16]; " + a + " l.alt = std::string(b1) + \"\\n\" + b2; }"


def icon_cpp(name: str) -> str:
    rows = ", ".join(cstr(r) for r in ICONS[name])
    return f"static const char* const ICON_{name.upper()}[] = {{{rows}}};"


CUSTOM_ALPH = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"


def custom_icon_ok(c):
    """Eigenes Icon aus dem Studio prüfen: bis 16×16, Zeichen a–z/A–Z = Farbindex, '.' = aus."""
    try:
        rows, pal = c["rows"], c["pal"]
        if not rows or len(rows) > 16 or not pal or len(pal) > len(CUSTOM_ALPH):
            return False
        w = len(rows[0])
        if not 1 <= w <= 16 or any(len(r) != w for r in rows):
            return False
        ok = set(CUSTOM_ALPH[:len(pal)]) | {"."}
        return all(ch in ok for r in rows for ch in r) and all(re.fullmatch(r"#?[0-9a-fA-F]{6}", x) for x in pal)
    except (KeyError, TypeError):
        return False


def icon_ref(cx, name):
    """-> (Deklaration, Bezeichner, Höhe, Palette) für ein eingebautes oder eigenes Icon, sonst None."""
    if name in ICONS:
        return icon_cpp(name), f"ICON_{name.upper()}", len(ICONS[name]), "nullptr"
    c = (getattr(cx, "custom", None) or {}).get(name)
    if c and custom_icon_ok(c):
        cid = "ICU_" + slug(name).upper()
        rows = ", ".join(cstr(r) for r in c["rows"])
        pal = ", ".join("0x" + x.lstrip("#").upper() for x in c["pal"])
        return (f"static const char* const {cid}[] = {{{rows}}};\nstatic const uint32_t {cid}_P[] = {{{pal}}};",
                cid, len(c["rows"]), f"{cid}_P")
    return None


def icon_line_cpp(cx, icon, title, acc, num_var="num", raw_var="raw"):
    """Titelzeile mit Icon (auch Füllstand automatisch) – gemeinsam für Wert-, Timer- und Entitäten-Seite."""
    code = ""
    if icon == "water_auto":
        code += "\n".join(icon_cpp(n) for _, n in WATER_AUTO) + "\n"
        code += f"const char* const* wic = ICON_{WATER_AUTO[0][1].upper()};\n"
        code += f"if ({num_var}) {{ float wf = strtof({raw_var}.c_str(), nullptr);\n"
        for k in range(1, len(WATER_AUTO)):
            code += f"if (wf >= {WATER_AUTO[k - 1][0]}) wic = ICON_{WATER_AUTO[k][1].upper()};\n"
        code += "}\n"
        return code, "wic", len(ICONS[WATER_AUTO[0][1]]), "nullptr"
    ref = icon_ref(cx, icon)
    if not ref:
        return "", None, 0, None
    return ref[0] + "\n", ref[1], ref[2], ref[3]


def anim_of(o):
    """Icon der Seite, wenn es animiert werden soll (3.2), sonst None."""
    ic = (o or {}).get("icon") or ""
    return ic if o.get("icon_anim") and ic in ANIM else None


def anim_thr(o):
    """„Läuft ab“-Schwelle als C++-Argumente (hat_schwelle, wert)."""
    v = str((o or {}).get("anim_above") if (o or {}).get("anim_above") is not None else "").strip().replace(",", ".")
    # gleiche Zahlenregel wie die Vorschau (isNum in renderer.js)
    if re.fullmatch(r"[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?", v):
        x = float(v)
        if math.isfinite(x):
            return "true", f"{x!r}f"
    return "false", "0.0f"


def anim_icon_cpp(icon, active):
    """Animiertes Icon: (Deklarationen, Ausdruck für den Icon-Zeiger, Höhe). active = C++-Ausdruck (bool)."""
    a = ANIM[icon]
    names = []
    for n in [icon, *a["frames"], a["off"]]:
        if n and n not in names:
            names.append(n)
    decl = "\n".join(icon_cpp(n) for n in names)
    frames = ", ".join(f"ICON_{n.upper()}" for n in a["frames"])
    decl += f"\nstatic const char* const* const AF[] = {{{frames}}};\n"
    idle = f"ICON_{(a['off'] or icon).upper()}"
    expr = f"(({active}) ? AF[(millis() / {a['ms']}u) % {len(a['frames'])}u] : {idle})"
    return decl, expr, len(ICONS[icon])


def anim_active_cpp(o, cx, pid, raw_var="raw"):
    """C++-Ausdruck: ist das Gerät an / läuft es? Eigene Entität oder der angezeigte Wert."""
    ht, thr = anim_thr(o)
    ent = (o.get("anim_entity") or "").strip()
    src = cx.sensor(f"{pid}_an", ent) if ent else raw_var
    return f"is_act({src}, {ht}, {thr})"


GREY = "Color(142, 142, 147)"


def _int(v, d):
    try:
        return int(v)
    except (TypeError, ValueError):
        return d


def size_of(o):
    """Schriftgröße in Viertel-Schritten (0 = so groß wie möglich)."""
    v = _int(o.get("scale"), None)
    if v is None:
        v = _int(o.get("size"), 0) * 4
    return 0 if v <= 0 else 3 if v == 3 else max(4, min(32, v))


def icon_of(o):
    v = _int(o.get("icon_scale"), 0)
    return 0 if v <= 0 else max(2, min(16, v))


def place(o):
    va = max(0, min(2, _int(o.get("valign", 1), 1)))
    ha = max(0, min(2, _int(o.get("halign", 1), 1)))
    return va, ha


def tsc(o):
    """Titelzeilen folgen der Einstellung „Zu langer Text“ der Seite."""
    return 0


OVERFLOW_MODES = {"scroll": 0, "cut": 1, "hide": 2}


def overflow_cpp(o):
    """Pro Seite/Feld: was mit zu langem Text passiert (vor dem Zeichnen gesetzt)."""
    ov = OVERFLOW_MODES.get(o.get("overflow"), 0)
    ms = SCROLL_SPEEDS.get(o.get("scroll_speed"), 35)
    tk = "true" if o.get("scroll_loop") == "ticker" else "false"
    return f"OVF = {ov}; SMS = {ms}; STK = {tk};\n"


def page_code(p, cx, pid):
    """C++ einer Seite inklusive ihrer Einstellung für zu lange Texte."""
    return overflow_cpp(p.get("options") or {}) + PAGES[p["type"]](p, cx, pid)


def lay_args(o):
    va, ha = place(o)
    return f"{size_of(o)}, {icon_of(o)}, {va}, {ha}"


class Ctx:
    """Sammelt die HA-Sensoren, die eine Seite braucht."""

    def __init__(self, units, pages=None):
        self.units = units
        self.sensors = []  # (id, entity, attribute)
        self.pages = {p.get("id"): p for p in (pages or [])}
        self.geom = None
        self.timers = []  # (tid, options, {rolle: sensor-ausdruck})
        self.custom = {}  # eigene Icons aus dem Studio
        self.lang = "de"  # Sprache auf dem Panel
        self.time12 = False  # Uhrzeit-Format (Einstellungen → Allgemein → Zeit)
        self.charts = []  # (cid, Sekunden pro Balken, sensor-ausdruck) – Verlauf, im ESP aufgezeichnet

    def sensor(self, sid, entity, attribute=None):
        # Sicherheit: nur gültige Namen landen in der Firmware-Datei (kein Einschleusen von YAML/C++)
        if not re.fullmatch(r"[a-z0-9_]+\.[a-z0-9_]+", str(entity or "")):
            raise GenError(f"Ungültige Entität: „{str(entity)[:60]}“")
        if attribute is not None and not re.fullmatch(r"[A-Za-z0-9_\-]{1,64}", str(attribute)):
            raise GenError(f"Ungültiges Attribut: „{str(attribute)[:60]}“")
        self.sensors.append((sid, entity, attribute))
        return f"id({sid}).state"

    def timer(self, tid, o):
        """Timer anmelden: das Intervall rechnet die Restzeit, die Seite liest nur die Globals."""
        ent = o.get("entity")
        mode = o.get("mode") if o.get("mode") in TIMER_MODES else "remaining"
        src = {"st": self.sensor(f"{tid}_s", ent)}
        if mode == "timer":
            src["fin"] = self.sensor(f"{tid}_f", ent, "finishes_at")
            src["rem"] = self.sensor(f"{tid}_r", ent, "remaining")
            src["dur"] = self.sensor(f"{tid}_d", ent, "duration")
        self.timers.append((tid, {**o, "mode": mode}, src))
        return tid

    def chart(self, cid, secs, expr):
        self.charts.append((cid, secs, expr))
        return cid

    def unit(self, entity):
        return ascii_text(self.units.get(entity, ""))


# ---------------------------------------------------------------- Seiten
# Jede Seite: (p, cx, pid) -> C++-Code, der in den aktuellen Bereich (OX/OY/DW/DH) zeichnet.
SIN60 = [round(__import__("math").sin(i * __import__("math").pi / 30) * 1000) for i in range(60)]


def page_clock(p, cx, pid):
    o = p["options"]
    if o.get("style") == "analog":
        return page_clock_analog(p, cx, pid)
    main, acc = color(o.get("color")), color(o.get("accent"))
    h12 = cx.time12
    code = f"""
    auto t = id(ha_time).now();
    std::vector<Ln> L;
    if (!t.is_valid()) {{ L.push_back(mk("SYNC...", {GREY}, 1, 0)); lay(L, 4, 0, {place(o)[0]}, {place(o)[1]}); return; }}
    char buf[24];
    """
    if o.get("show_date", True):
        code += date_cpp(cx.lang) + f"""
    {{ Ln l = mk(buf, {acc}, 1, 2); {date_alt_cpp(cx.lang)} L.push_back(l); }}
    """
    code += f"""
    snprintf(buf, sizeof(buf), "{"%d:%02d" if h12 else "%02d:%02d"}", {"(t.hour % 12 == 0 ? 12 : t.hour % 12)" if h12 else "t.hour"}, t.minute);
    L.push_back(mk(buf, {main}, 0, 0));
    """
    if o.get("show_seconds", False):
        code += f"""
    snprintf(buf, sizeof(buf), "{"%02d %s" if h12 else "%02d"}", t.second{', t.hour < 12 ? "AM" : "PM"' if h12 else ""});
    L.push_back(mk(buf, {main}, 1, 3));
    """
    elif h12:
        code += f"""
    L.push_back(mk(t.hour < 12 ? "AM" : "PM", {main}, 1, 3));
    """
    if o.get("seconds_bar", True):
        code += f"""
    {{ Ln b = mk("", {acc}, 1, 4); b.bar = t.second * 1000 / 59; L.push_back(b); }}
    """
    return code + f"lay(L, {lay_args(o)});\n"


def page_clock_analog(p, cx, pid):
    """Analoguhr: Zifferblatt mit Strichen, Stunden-/Minutenzeiger, optional Sekundenzeiger und Datum."""
    o = p["options"]
    main, acc = color(o.get("color")), color(o.get("accent"))
    va, ha = place(o)
    show_date = "true" if o.get("show_date", True) else "false"
    show_sec = "true" if o.get("show_seconds", True) else "false"
    ring = "true" if o.get("ring", True) else "false"
    return f"""
    static const int16_t SN[60] = {{{", ".join(str(v) for v in SIN60)}}};
    auto t = id(ha_time).now();
    if (!t.is_valid()) {{ std::vector<Ln> L; L.push_back(mk("SYNC...", {GREY}, 1, 0)); lay(L, 4, 0, {va}, {ha}); return; }}
    const int M = 2;
    int AW = DW - 2 * M, AH = DH - 2 * M;
    bool date = {show_date} && AH - std::min(AW, AH) >= 9;
    int D = std::min(AW, AH - (date ? 9 : 0));
    if (D < 7) {{ D = std::min(AW, AH); date = false; }}
    int R = (D - 1) / 2;
    int bh = 2 * R + 1 + (date ? 9 : 0);
    int x0 = M + (AW - (2 * R + 1)) * {ha} / 2, y0 = M + (AH - bh) * {va} / 2;
    int ccx = x0 + R, ccy = y0 + R;
    auto px = [&](int i, int l) -> int {{ return ccx + l * SN[i % 60] / 1000; }};
    auto py = [&](int i, int l) -> int {{ return ccy - l * SN[(i + 15) % 60] / 1000; }};
    bool rg = {ring} && R >= 10;
    if (rg) CI(ccx, ccy, R, Color(58, 58, 60));
    int ro = R - (rg ? 2 : 0);
    for (int i = 0; i < 60; i += 5) {{
    bool major = i % 15 == 0;
    int l = major ? std::max(2, R / 5) : std::max(1, R / 9);
    LN(px(i, ro), py(i, ro), px(i, ro - l + 1), py(i, ro - l + 1), major ? {main} : Color(142, 142, 147));
    }}
    auto hand = [&](int i, int l, int th, Color c) {{
    int ex = px(i, l), ey = py(i, l);
    LN(ccx, ccy, ex, ey, c);
    if (th > 0) {{
    bool hor = abs(ex - ccx) > abs(ey - ccy);
    LN(ccx + (hor ? 0 : 1), ccy + (hor ? 1 : 0), ex + (hor ? 0 : 1), ey + (hor ? 1 : 0), c);
    }}
    }};
    hand((t.hour % 12) * 5 + t.minute / 12, R * 50 / 100, R >= 14 ? 1 : 0, {main});
    hand(t.minute, R * 78 / 100, R >= 20 ? 1 : 0, {main});
    if ({show_sec}) hand(t.second, R * 88 / 100, 0, {acc});
    if (R >= 10) FR(ccx - 1, ccy - 1, 3, 3, {acc}); else FR(ccx, ccy, 1, 1, {acc});
    if (date) {{
    char buf[24];
    {date_cpp(cx.lang)}
    std::string ds = fit(buf, AW, 4);
    tx(x0 + R + 1, y0 + 2 * R + 1 + 3, 4, {acc}, 1, ds.c_str());
    }}
    """


def page_weather(p, cx, pid):
    o = p["options"]
    ent = o.get("entity")
    if not ent:
        raise GenError(f"Seite „{p.get('name')}“: bitte eine Wetter-Entität auswählen.")
    main, acc = color(o.get("color")), color(o.get("accent"))
    cond = cx.sensor(f"{pid}_c", ent)
    temp = cx.sensor(f"{pid}_t", ent, "temperature")
    used = sorted({v[0] for v in WEATHER.values()} | {"cloud", "drop"})
    icons = "\n".join(icon_cpp(n) for n in used)
    labels = PANEL_TEXT[cx.lang]["weather"]
    shorts = PANEL_TEXT[cx.lang].get("weather_short", {})
    cases = "\n".join(
        f'if (c == "{k}") {{ ic = ICON_{v[0].upper()}; label = {cstr(ascii_text(labels.get(k, v[1])))}; lalt = {cstr(ascii_text(shorts.get(k, "")))}; }}'
        for k, v in WEATHER.items()
    )
    code = f"""
    {icons}
    std::string c = {cond};
    const char* const* ic = ICON_CLOUD;
    std::string label = "", lalt = "";
    {cases}
    std::string tv = {temp};
    std::vector<Ln> L;
    {{ Ln l = mk(is_num(tv) ? num_fmt(strtof(tv.c_str(), nullptr), 0, false) : std::string("--"), {main}, 0, 0);
    l.ic = ic; l.ih = 16; l.deg = true; L.push_back(l); }}
    if (!label.empty()) {{ Ln l = mk(label, {acc}, 1, 2); l.alt = lalt; L.push_back(l); }}
    """
    if o.get("show_humidity", True):
        hum = cx.sensor(f"{pid}_h", ent, "humidity")
        code += f"""
    std::string hv = {hum};
    {{ Ln l = mk(is_num(hv) ? num_fmt(strtof(hv.c_str(), nullptr), 0, false) + "%" : std::string("--"), {main}, 1, 3);
    l.ic = ICON_DROP; l.ih = 7; L.push_back(l); }}
    """
    return code + f"lay(L, {lay_args(o)});\n"


def page_value(p, cx, pid):
    o = p["options"]
    ent = o.get("entity")
    if not ent:
        raise GenError(f"Seite „{p.get('name')}“: bitte eine Entität auswählen.")
    main, acc = color(o.get("color")), color(o.get("accent"))
    attr = (o.get("attribute") or "").strip() or None
    val = cx.sensor(f"{pid}_v", ent, attr)
    unit = ascii_text(o["unit"]) if o.get("unit") else ("" if attr else cx.unit(ent))
    dec = int(o.get("decimals", -1))
    thou = "true" if o.get("thousands", True) else "false"
    title = ascii_text(o.get("title", ""))
    icon = o.get("icon") or ""
    code = f"ICOL = {color(o.get('icon_color') or '#0a84ff')};\n"
    code += f"""
    std::string raw = {val};
    bool num = is_num(raw);
    std::vector<Ln> L;
    """
    if anim_of(o):
        icode, ic, ih = anim_icon_cpp(icon, anim_active_cpp(o, cx, pid))
        pal = "nullptr"
    else:
        icode, ic, ih, pal = icon_line_cpp(cx, icon, title, acc)
    if ic or title:
        code += icode + f"{{ Ln l = mk({cstr(title)}, {acc}, 1, 2); l.sc = {tsc(o)}; {f'l.ic = {ic}; l.ih = {ih}; l.pal = {pal};' if ic else ''} L.push_back(l); }}\n"
    code += f"""
    L.push_back(mk(num ? num_fmt(strtof(raw.c_str(), nullptr), {dec}, {thou}) : word(raw), {main}, 0, 0));
    """
    if unit:
        code += f"""
    if (num) L.push_back(mk({cstr(unit)}, {GREY}, 1, 4));
    """
    ent2 = o.get("second_entity")
    if ent2:
        v2 = cx.sensor(f"{pid}_s", ent2)
        unit2 = cstr(cx.unit(ent2))
        if o.get("trend", True):
            code += f"""
    {{ std::string r2 = {v2};
    if (is_num(r2)) {{
    float f2 = strtof(r2.c_str(), nullptr);
    L.push_back(mk(std::string(f2 >= 0 ? "+" : "-") + num_fmt(fabsf(f2), 1, false) + {unit2},
    f2 >= 0 ? Color(48, 209, 88) : Color(255, 69, 58), 1, 3));
    }} }}
    """
        else:
            code += f"""
    {{ std::string r2 = {v2};
    L.push_back(mk(is_num(r2) ? num_fmt(strtof(r2.c_str(), nullptr), -1, true) + {unit2} : word(r2), {GREY}, 1, 3)); }}
    """
    return code + f"lay(L, {lay_args(o)});\n"


def page_entity(p, cx, pid):
    """Entitäten-Seite: ein Wert mit großem Icon darüber oder darunter (z. B. Wassertank 50 % + Füllstand)."""
    o = p["options"]
    ent = o.get("entity")
    if not ent:
        raise GenError(f"Seite „{p.get('name')}“: bitte eine Entität auswählen.")
    main, acc = color(o.get("color")), color(o.get("accent"))
    attr = (o.get("attribute") or "").strip() or None
    val = cx.sensor(f"{pid}_v", ent, attr)
    unit = ascii_text(o["unit"]) if o.get("unit") else ("" if attr else cx.unit(ent))
    dec = int(o.get("decimals", -1))
    thou = "true" if o.get("thousands", True) else "false"
    title = ascii_text(o.get("title", ""))
    inline = unit in ("%",)
    code = f"ICOL = {color(o.get('icon_color') or '#0a84ff')};\n"
    code += f"""
    std::string raw = {val};
    bool num = is_num(raw);
    std::vector<Ln> L;
    """
    if title:
        code += f"{{ Ln l = mk({cstr(title)}, {acc}, 1, 2); l.sc = {tsc(o)}; L.push_back(l); }}\n"
    if anim_of(o):
        icode, ic, ih = anim_icon_cpp(o["icon"], anim_active_cpp(o, cx, pid))
        pal = "nullptr"
    else:
        icode, ic, ih, pal = icon_line_cpp(cx, o.get("icon") or "", "", acc)
    iconline = (icode + f"{{ Ln l = mk(\"\", {main}, 0, 0); l.ic = {ic}; l.ih = {ih}; l.pal = {pal}; L.push_back(l); }}\n") if ic else ""
    top = o.get("icon_pos", "top") != "bottom"
    if top:
        code += iconline
    vexpr = f"num_fmt(strtof(raw.c_str(), nullptr), {dec}, {thou})"
    if inline and unit:
        vexpr = f"{vexpr} + {cstr(unit)}"
    code += f"L.push_back(mk(num ? {vexpr} : word(raw), {main}, 0, 0));\n"
    if unit and not inline:
        code += f"if (num) L.push_back(mk({cstr(unit)}, {GREY}, 1, 4));\n"
    if not top:
        code += iconline
    # Icon so groß wie die Schrift (Icongröße-Regler verkleinert es)
    va, ha = place(o)
    return code + f"lay(L, {size_of(o)}, {icon_of(o) or 32}, {va}, {ha});\n"


def page_list(p, cx, pid):
    o = p["options"]
    items = [i for i in o.get("items", []) if i.get("entity")][:24]
    if not items:
        raise GenError(f"Seite „{p.get('name')}“: mindestens eine Entität hinzufügen.")
    main, acc = color(o.get("color")), color(o.get("accent"))
    code = """
    std::vector<std::string> lab, val;
    std::string r;
    """
    for n, item in enumerate(items):
        st = cx.sensor(f"{pid}_e{n}", item["entity"])
        unit = cstr(cx.unit(item["entity"]))
        label = ascii_text(item.get("label") or item["entity"].split(".")[-1])
        code += f"""
    r = {st};
    lab.push_back({cstr(label)});
    val.push_back(is_num(r) ? num_fmt(strtof(r.c_str(), nullptr), -1, true) + {unit} : word(r));
    """
    return code + f"lst({cstr(ascii_text(o.get('title', '')))}, lab, val, {size_of(o)}, {place(o)[0]}, {main}, {acc});\n"


def page_stack(p, cx, pid):
    o = p["options"]
    g = cx.geom
    rects = g.stack_rects(o.get("layout")) if g else None
    if not rects:
        raise GenError(f"Stapel „{p.get('name')}“: diese Aufteilung passt nicht zur Panel-Fläche – bitte neu wählen.")
    fields = o.get("fields") or []
    code, used = "", 0
    for k, a in enumerate(rects):
        f = fields[k] if k < len(fields) else None
        if not isinstance(f, dict) or f.get("type") not in PAGES or f.get("type") == "stack":
            continue
        sub = {"name": f"{p.get('name')} – Feld {k + 1}", "type": f["type"], "options": f.get("options") or {}}
        used += 1
        body = page_code(sub, cx, f"{pid}_{k}")
        code += f"""
    OX = {a['x']} + TX; OY = {a['y']} + TY; DW = {a['w']}; DH = {a['h']};
    [&]() {{
    {body}
    }}();
    """
    if not used:
        raise GenError(f"Stapel „{p.get('name')}“: mindestens einem Feld einen Inhalt geben.")
    if o.get("dividers", True):
        code += f"OX = TX; OY = TY; DW = {g.W}; DH = {g.H};\n"
        for a in rects:
            if a["x"] > 0:
                code += f"FR({a['x']}, {a['y']}, 1, {a['h']}, Color(44, 44, 46));\n"
            if a["y"] > 0:
                code += f"FR({a['x']}, {a['y']}, {a['w']}, 1, Color(44, 44, 46));\n"
    return code


TIMER_MODES = ("remaining", "end", "timer")
TIMER_UNITS = {"s": 1, "min": 60, "h": 3600}


def timer_done_ms(o):
    return max(0, min(240, _int(o.get("done_minutes", 2), 2))) * 60000


def page_timer(p, cx, pid):
    o = p["options"]
    if not o.get("entity"):
        raise GenError(f"Timer „{p.get('name')}“: bitte eine Entität auswählen (Restzeit, Endzeit oder Timer).")
    main, acc = color(o.get("color")), color(o.get("accent"))
    t = cx.timer(f"{pid}_t", o)
    title = ascii_text(o.get("title", ""))
    icon = o.get("icon") or ""
    if icon == "water_auto":
        icon = WATER_AUTO[-1][1]
    code = f"ICOL = {color(o.get('icon_color') or '#0a84ff')};\n"
    code += f"""
    int r = id({t}_rem);
    bool done = r <= 0 && id({t}_done) != 0;
    """
    if anim_of(o):
        decl, expr, ih = anim_icon_cpp(icon, f"r > 0 && !id({t}_pz)")
        ref = (decl, expr, ih, "nullptr")
    else:
        ref = icon_ref(cx, icon)
    code += (ref[0] + "\n") if ref else ""
    code += """
    std::vector<Ln> L;
    char buf[24];
    """
    if title or ref:
        code += f"""
    {{ Ln l = mk({cstr(title)}, {acc}, 1, 2); l.sc = {tsc(o)}; {f"l.ic = {ref[1]}; l.ih = {ref[2]}; l.pal = {ref[3]};" if ref else ""} L.push_back(l); }}
    """
    code += f"""
    if (r > 0) {{
    if (r >= 3600) snprintf(buf, sizeof(buf), "%d:%02d:%02d", r / 3600, r / 60 % 60, r % 60);
    else snprintf(buf, sizeof(buf), "%d:%02d", r / 60, r % 60);
    L.push_back(mk(buf, {main}, 0, 0));
    }} else L.push_back(mk(done ? {cstr(PANEL_TEXT[cx.lang]["done"])} : "--:--", done ? {acc} : {GREY}, 0, 0));
    if (r > 0 && id({t}_pz)) L.push_back(mk({cstr(PANEL_TEXT[cx.lang]["pause"])}, {acc}, 1, 3));
    """
    if o.get("show_end", True):
        end_lbl = PANEL_TEXT[cx.lang]["end"]
        if cx.time12:
            end_fmt = ('int eh = e / 3600; snprintf(buf, sizeof(buf), "' + end_lbl + ' %d:%02d %s", '
                       '(eh % 12 == 0 ? 12 : eh % 12), e / 60 % 60, eh < 12 ? "AM" : "PM");')
        else:
            end_fmt = 'snprintf(buf, sizeof(buf), "' + end_lbl + ' %02d:%02d", e / 3600, e / 60 % 60);'
        code += f"""
    else if (r > 0) {{
    auto tt = id(ha_time).now();
    if (tt.is_valid()) {{
    int e = (tt.hour * 3600 + tt.minute * 60 + tt.second + r) % 86400;
    {end_fmt}
    L.push_back(mk(buf, {GREY}, 1, 3));
    }} }}
    """
    if o.get("show_bar", True):
        code += f"""
    if (r > 0 && id({t}_max) > 0) {{ Ln b = mk("", {acc}, 1, 4); b.bar = std::max(0, (int) ((long) (id({t}_max) - r) * 1000 / id({t}_max))); L.push_back(b); }}
    """
    code += f"lay(L, {lay_args(o)});\n"
    dm = timer_done_ms(o)
    if o.get("done_blink") and dm:
        # 3.2: Rahmen blinkt, solange „FERTIG“ angezeigt wird (0,4 s an / 0,4 s aus)
        code += f"""
    {{ uint32_t nw = millis();
    if (done && nw + 1 - id({t}_done) < {dm}u && (nw / 400u) % 2u == 0) {{
    int bw = std::max(1, std::min(DW, DH) / 48);
    for (int k = 0; k < bw; k++) RC(k, k, DW - 2 * k, DH - 2 * k, {color(o.get("blink_color") or "#ff453a")});
    }} }}
    """
    return code


TIMER_HELPERS = """
// Zeitstempel (2026-10-11T08:30:00+00:00) -> Sekunden seit 1970
auto iso_epoch = [](const std::string& s, long& out) -> bool {
int Y = 0, M = 0, D = 0, h = 0, m = 0, ss = 0;
if (s.size() < 16 || sscanf(s.c_str(), "%4d-%2d-%2d%*c%2d:%2d", &Y, &M, &D, &h, &m) != 5) return false;
size_t p = 16;
if (p < s.size() && s[p] == ':') { ss = atoi(s.c_str() + p + 1); p += 3; }
while (p < s.size() && (s[p] == '.' || isdigit((unsigned char) s[p]))) p++;
long off = 0;
if (p < s.size() && (s[p] == '+' || s[p] == '-')) {
int oh = 0, om = 0;
sscanf(s.c_str() + p + 1, "%2d:%2d", &oh, &om);
off = (long) (oh * 3600 + om * 60) * (s[p] == '-' ? -1 : 1);
}
int y = Y - (M <= 2 ? 1 : 0);
int era = (y >= 0 ? y : y - 399) / 400;
int yoe = y - era * 400;
int doy = (153 * (M + (M > 2 ? -3 : 9)) + 2) / 5 + D - 1;
int doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
long days = (long) era * 146097 + doe - 719468;
out = days * 86400 + h * 3600 + m * 60 + ss - off;
return true;
};
// "1:05:30" / "1:05" -> Sekunden; liefert die Anzahl der Teile (0 = kein Zeitformat)
auto hms = [](const std::string& s, int& out) -> int {
int a = 0, b = 0, c = 0;
int n = sscanf(s.c_str(), "%d:%d:%d", &a, &b, &c);
if (n == 3) { out = a * 3600 + b * 60 + c; return 3; }
if (n == 2) { out = a * 3600 + b * 60; return 2; }
return 0;
};
"""


def timer_step_cpp(tid, o, src):
    """C++ für das 1-s-Intervall: Restzeit bestimmen, Start/Ende merken."""
    mode = o["mode"]
    if mode == "remaining":
        f = TIMER_UNITS.get(o.get("unit"), 60)
        calc = f"""
    // Läuft intern selbst herunter (wie ein Wecker) und gleicht sich bei jedem neuen Wert aus HA neu ab.
    static std::string last; static uint32_t t0 = 0; static int base = -1; static bool first = true;
    if (first || s != last) {{
    first = false; last = s; t0 = now;
    int x;
    if (hms(s, x)) base = x;
    else if (is_num(s)) {{ float f = strtof(s.c_str(), nullptr) * {f}; base = f > 0 ? (int) lroundf(f) : 0; }}
    else base = -1;
    }}
    if (base >= 0) {{ r = base - (int) ((now - t0) / 1000); if (r < 0) r = 0; }}
    """
    elif mode == "end":
        calc = """
    long e; auto tt = id(ha_time).now();
    if (tt.is_valid() && iso_epoch(s, e)) { long d = e - (long) tt.timestamp; r = d > 0 ? (int) std::min(d, 359999L) : 0; }
    """
    else:
        calc = f"""
    if (!hms({src['dur']}, tot)) tot = 0;
    if (s == "active") {{
    long e; auto tt = id(ha_time).now();
    if (tt.is_valid() && iso_epoch({src['fin']}, e)) {{ long d = e - (long) tt.timestamp; r = d > 0 ? (int) std::min(d, 359999L) : 0; }}
    }} else if (s == "paused") {{ int x; if (hms({src['rem']}, x)) {{ r = x; pz = true; }} }}
    """
    return f"""
{{
std::string s = {src['st']};
int r = -1, tot = 0; bool pz = false;
{calc}
int prev = id({tid}_rem);
if (r > 0) {{ if (prev <= 0 || r > id({tid}_max)) id({tid}_max) = std::max(tot, r); id({tid}_done) = 0; }}
else if (prev > 0) id({tid}_done) = now + 1;
id({tid}_rem) = r;
id({tid}_pz) = pz && r > 0;
}}
"""


def page_marquee(p, cx, pid):
    """Laufschrift: ein fester Text oder ein Wert aus HA (z. B. Songtitel) läuft von rechts nach links."""
    o = p["options"]
    main, acc = color(o.get("color")), color(o.get("accent"))
    title = ascii_text(o.get("title", ""))
    if o.get("source") == "entity":
        ent = o.get("entity")
        if not ent:
            raise GenError(f"Laufschrift „{p.get('name')}“: bitte eine Entität auswählen.")
        attr = (o.get("attribute") or "").strip() or None
        val = cx.sensor(f"{pid}_v", ent, attr)
        txt = f"(std::string({cstr(ascii_text(o.get('prefix') or ''))}) + word({val}))"
    else:
        txt = f"std::string({cstr(ascii_text(o.get('text') or ''))})"
    code = f"ICOL = {color(o.get('icon_color') or '#0a84ff')};\nstd::vector<Ln> L;\n"
    if title:
        code += f"{{ Ln l = mk({cstr(title)}, {acc}, 1, 2); l.sc = {tsc(o)}; L.push_back(l); }}\n"
    icon = o.get("icon") or ""
    icode, ic, ih, pal = icon_line_cpp(cx, WATER_AUTO[-1][1] if icon == "water_auto" else icon, "", acc)
    code += icode
    sc = 2 if o.get("always", True) is not False else 3
    tk = {"pause": 1, "ticker": 2}.get(o.get("loop"), 0)
    code += f"{{ Ln l = mk({txt}, {main}, 0, 0); l.sc = {sc}; l.tk = {tk};"
    if ic:
        code += f" l.ic = {ic}; l.ih = {ih}; l.pal = {pal};"
    code += " L.push_back(l); }\n"
    va, ha = place(o)
    return code + f"lay(L, {size_of(o)}, {icon_of(o)}, {va}, {ha});\n"


CAL_MAX = 4  # Kalender (eigene Entitäten)
CAL_HELPER_MAX = 12  # Kalender über Helfer-Sensor


def cal_hide_words(o):
    """„Termine mit diesen Wörtern nicht zeigen“ -> Liste (ASCII, ohne Leereinträge)."""
    raw = o.get("hide") or ""
    out = []
    for w in re.split(r"[,;\n]", str(raw)):
        w = ascii_text(w).strip()
        if w and w not in out:
            out.append(w[:32])
    return out[:12]


def page_calendar(p, cx, pid):
    """Kalender: nächste Termine – als Liste wie im Handy-Kalender oder groß mit Laufschrift."""
    o = p["options"]
    main, acc = color(o.get("color")), color(o.get("accent"))
    T = PANEL_TEXT[cx.lang]
    title = ascii_text(o.get("title", ""))
    va, ha = place(o)
    listv = o.get("view", "list") != "next"
    code = f"""
    auto t = id(ha_time).now();
    if (!t.is_valid()) {{ std::vector<Ln> L; L.push_back(mk("SYNC...", {GREY}, 1, 0)); lay(L, 4, 0, {va}, {ha}); return; }}
    int today = dfc(t.year, t.month, t.day_of_month), nows = t.hour * 3600 + t.minute * 60 + t.second;
    std::vector<Ev> E;
    Ev e;
    """
    hide = cal_hide_words(o)
    if hide:
        code += f"static const char* const HIDE[] = {{{', '.join(cstr(w) for w in hide)}}};\n"
        code += "auto keep = [&](const std::string& s) -> bool { for (const char* w : HIDE) if (hasw(s, w)) return false; return true; };\n"
    else:
        code += "auto keep = [](const std::string&) -> bool { return true; };\n"
    if o.get("source") == "helper":
        ent = o.get("helper")
        if not ent:
            raise GenError(f"Kalender „{p.get('name')}“: bitte den Helfer-Sensor auswählen.")
        n = max(1, min(CAL_HELPER_MAX, _int(o.get("count"), 6)))
        for k in range(n):
            v = cx.sensor(f"{pid}_e{k}", ent, f"e{k + 1}")
            # "Start|Ende|Titel" (neu) oder "Start|Titel" (alter Helfer)
            code += f"""{{ std::string r = {v}; size_t b = r.find('|');
    if (b != std::string::npos && pev(r.substr(0, b), false, e)) {{
    std::string rest = r.substr(b + 1); size_t b2 = rest.find('|');
    if (b2 != std::string::npos && dg(rest, 0, 4) >= 1970) {{ pend(rest.substr(0, b2), e); rest = rest.substr(b2 + 1); }}
    e.t = asc(rest); e.c = {acc}; if (keep(e.t)) E.push_back(e); }} }}
    """
    else:
        cals = [c for c in (o.get("calendars") or []) if isinstance(c, dict) and c.get("entity")][:CAL_MAX]
        if not cals:
            raise GenError(f"Kalender „{p.get('name')}“: bitte mindestens einen Kalender auswählen.")
        for k, c in enumerate(cals):
            m = cx.sensor(f"{pid}_m{k}", c["entity"], "message")
            st = cx.sensor(f"{pid}_s{k}", c["entity"], "start_time")
            en = cx.sensor(f"{pid}_x{k}", c["entity"], "end_time")
            ad = cx.sensor(f"{pid}_a{k}", c["entity"], "all_day")
            code += f"""{{ std::string a = {ad};
    // ganztägig? Home Assistant schickt Ja/Nein-Attribute ans Panel als „on“/„off“ (die Vorschau sieht „true“)
    bool ad = !a.empty() && (a[0] == 'T' || a[0] == 't' || ((a[0] == 'o' || a[0] == 'O') && a.size() > 1 && (a[1] == 'n' || a[1] == 'N')));
    if (pev({st}, ad, e)) {{ pend({en}, e); e.t = asc({m}); e.c = {color(c.get('color') or o.get('accent'))}; if (keep(e.t)) E.push_back(e); }} }}
    """
    # vorbei? weg. Laufende mehrtägige Termine zählen ab heute. Sortieren, doppelte (gleicher Titel, Tag, Zeit) weg.
    code += """
    { std::vector<Ev> F;
    for (auto& v : E) { if (v.ld < today) continue; if (v.day < today) { v.day = today; if (!v.ad) v.sec = 0; v.ad = true; } F.push_back(v); }
    E.swap(F); }
    for (size_t i = 1; i < E.size(); i++) for (size_t j = i; j > 0 && E[j].day * 86400LL + E[j].sec < E[j - 1].day * 86400LL + E[j - 1].sec; j--) std::swap(E[j], E[j - 1]);
    { std::vector<Ev> F;
    for (auto& v : E) { bool dup = false; for (auto& u : F) if (u.day == v.day && u.sec == v.sec && u.ad == v.ad && u.t == v.t) { dup = true; break; } if (!dup) F.push_back(v); }
    E.swap(F); }
    """
    wd = ", ".join(cstr(x) for x in T["wd"])
    code += f"static const char* WD[] = {{{wd}}};\nchar buf[40], tb[16];\n"
    if T["months"]:
        code += f"static const char* MO[] = {{{', '.join(cstr(x) for x in T['months'])}}};\n"
        dfmt = lambda dd, mo: f'"%d %s", {dd}, MO[{mo} - 1]'
    else:
        dfmt = lambda dd, mo: f'"%02d.%02d.", {dd}, {mo}'
    # Tag: HEUTE / MORGEN / DO 15.10.
    code += f"""auto dayl = [&](int day, int dd, int mo, char* out, size_t n) {{
    int d = day - today;
    if (d <= 0) snprintf(out, n, "%s", {cstr(T['today'])});
    else if (d == 1) snprintf(out, n, "%s", {cstr(T['tomorrow'])});
    else {{ char x[16]; snprintf(x, sizeof(x), {dfmt('dd', 'mo')}); snprintf(out, n, "%s %s", WD[(day + 4) % 7], x); }}
    }};
    auto untl = [&](int ld, char* out, size_t n) {{ int mo, dd; cfd(ld, mo, dd); snprintf(out, n, {dfmt('dd', 'mo')}); }};
    """
    if cx.time12:
        code += 'auto tfmt = [](int sec, char* out, size_t n) { snprintf(out, n, "%d:%02d%s", (sec / 3600) % 12 == 0 ? 12 : (sec / 3600) % 12, sec / 60 % 60, sec < 43200 ? "AM" : "PM"); };\n'
    else:
        code += 'auto tfmt = [](int sec, char* out, size_t n) { snprintf(out, n, "%02d:%02d", sec / 3600, sec / 60 % 60); };\n'
    if listv:
        code += f"""
    // ---- Liste wie im Handy-Kalender: Tageszeile, darunter die Termine (Punkt in Kalenderfarbe, Zeit rechts)
    const int M = 2;
    int AW = DW - 2 * M, AH = DH - 2 * M;
    std::string TI = {cstr(title)};
    if (E.empty()) {{ std::vector<Ln> L; if (!TI.empty()) {{ Ln l = mk(TI, {acc}, 1, 5); l.sc = {tsc(o)}; L.push_back(l); }} Ln l = mk({cstr(T['noevents'])}, {GREY}, 1, 0); l.sc = 1; L.push_back(l); lay(L, 4, 0, {va}, {ha}); return; }}
    int q = {size_of(o)};
    if (q <= 0) {{ q = 4; while (q < 16 && P(80, q + 4) <= AW && (AH + ((q + 4) >> 2) + 1) / (P(7, q + 4) + ((q + 4) >> 2) + 1) >= 6) q += 4; }}
    int sp = std::max(1, q >> 2), lh = TH(q), gap = sp + 1;
    int hh = (!TI.empty() && AH >= lh * 3 + 2 * gap + 4 && (OVF != 2 || tw1(TI.c_str(), q) <= AW)) ? lh + 5 : 0;
    int rows = std::max(1, (AH - hh + gap) / (lh + gap));
    while (q > 4 && rows < 2) {{ q = dec(q); sp = std::max(1, q >> 2); lh = TH(q); gap = sp + 1; hh = (!TI.empty() && AH >= lh * 3 + 2 * gap + 4 && (OVF != 2 || tw1(TI.c_str(), q) <= AW)) ? lh + 5 : 0; rows = std::max(1, (AH - hh + gap) / (lh + gap)); }}
    // Zeilen planen: >= 0 Termin, < 0 Tageszeile (-1 - Termin)
    std::vector<int> R;
    int cur = -1 << 30;
    for (int k = 0; k < (int) E.size(); k++) {{
    if (rows == 1) {{ R.push_back(0); break; }}
    if (E[k].day != cur) {{ if ((int) R.size() + 2 > rows) break; R.push_back(-1 - k); cur = E[k].day; }}
    if ((int) R.size() + 1 > rows) break;
    R.push_back(k);
    }}
    int used = (int) R.size(), bh = hh + used * lh + std::max(0, used - 1) * gap;
    int y = M + (AH - bh) * {va} / 2;
    if (hh) {{
    if (tw1(TI.c_str(), q) <= AW) tx(DW / 2, y, q, {acc}, 1, TI.c_str());
    else if (OVF == 0) scr(M, y, AW, q, {acc}, TI.c_str(), STK);
    else tx(M, y, q, {acc}, 0, fit(TI, AW + 1, q).c_str());
    HL(M, y + lh + 2, AW, Color(58, 58, 60));
    y += hh;
    }}
    int ds = std::max(2, P(3, q)), tx0 = M + ds + P(2, q);
    for (int r : R) {{
    if (r < 0) {{
    Ev& v = E[-1 - r];
    dayl(v.day, v.dd, v.mo, buf, sizeof(buf));
    tx(M, y, q, {acc}, 0, fit(buf, AW + 1, q).c_str());
    }} else {{
    Ev& v = E[r];
    FR(M, y + (lh - ds) / 2, ds, ds, v.c);
    tb[0] = 0;
    if (v.ld > v.day) {{ char x[16]; untl(v.ld, x, sizeof(x)); snprintf(tb, sizeof(tb), "-%s", x); }}
    else if (!v.ad) {{ if (v.day == today && v.sec <= nows) snprintf(tb, sizeof(tb), "%s", {cstr(T['now'])}); else tfmt(v.sec, tb, sizeof(tb)); }}
    int rw = tb[0] ? tw1(tb, q) : 0;
    int room = M + AW - tx0 - (rw ? rw + P(3, q) : 0);
    if (room < P(v.ld > v.day ? 36 : 20, q)) {{ rw = 0; room = M + AW - tx0; }}
    if (rw) tx(M + AW - rw, y, q, {GREY}, 0, tb);
    tx(tx0, y, q, {main}, 0, fit(v.t, room + sp, q).c_str());
    }}
    y += lh + gap;
    }}
    """
        return code
    code += "std::vector<Ln> L;\n"
    if title:
        code += f"{{ Ln l = mk({cstr(title)}, {acc}, 1, 50); l.sc = {tsc(o)}; L.push_back(l); }}\n"
    code += f"""
    if (E.empty()) {{ Ln l = mk({cstr(T['noevents'])}, {GREY}, 0, 0); l.sc = 1; L.push_back(l); }}
    for (size_t k = 0; k < E.size(); k++) {{
    Ev& v = E[k];
    bool run = v.day == today && (v.ad ? v.ld > today : v.sec <= nows);
    tb[0] = ' '; tb[1] = 0;
    if (!v.ad) tfmt(v.sec, tb + 1, sizeof(tb) - 1); else tb[0] = 0;
    if (run && v.ld > today) {{ char x[16]; untl(v.ld, x, sizeof(x)); snprintf(buf, sizeof(buf), "%s %s", {cstr(T['until'])}, x); }}
    else if (run) snprintf(buf, sizeof(buf), "%s", {cstr(T['now'])});
    else {{ dayl(v.day, v.dd, v.mo, buf, sizeof(buf)); strncat(buf, tb, sizeof(buf) - strlen(buf) - 1); }}
    Ln a = mk(buf, v.c, 1, k ? 11 + 2 * (int) k : 3); a.sc = 1; L.push_back(a);
    Ln b = mk(v.t, {main}, 0, k ? 10 + 2 * (int) k : 0); b.sc = 1; L.push_back(b);
    }}
    """
    return code + f"lay(L, {size_of(o)}, 0, {va}, {ha});\n"


CHART_PERIODS = {"6h": 450, "24h": 1800, "4d": 7200, "7d": 12600}  # 48 Balken × Sekunden


def page_chart(p, cx, pid):
    """Verlauf: Linie oder Balken – im ESP aufgezeichnet (6 h … 7 Tage) oder aus einer Attribut-Liste (z. B. Strompreis-Prognose)."""
    o = p["options"]
    ent = o.get("entity")
    if not ent:
        raise GenError(f"Verlauf „{p.get('name')}“: bitte eine Entität auswählen.")
    main, acc = color(o.get("color")), color(o.get("accent"))
    title = ascii_text(o.get("title", ""))
    dc = max(-1, min(3, _int(o.get("decimals", -1), -1)))
    style = 1 if o.get("style") == "bars" else 0
    mm = "true" if o.get("show_minmax", True) is not False else "false"
    nodata = cstr(PANEL_TEXT[cx.lang]["nodata"])
    if o.get("mode") == "list":
        la = (o.get("list_attr") or "").strip()
        if not la:
            raise GenError(f"Verlauf „{p.get('name')}“: bitte das Attribut mit der Werte-Liste auswählen.")
        lv = cx.sensor(f"{pid}_l", ent, la)
        key = cstr(ascii_text(o.get("list_key") or "").strip())
        code = f"""static std::string LR;
    static bool LI = false;
    static std::vector<float> LV;
    {{ const std::string& r = {lv}; if (!LI || r != LR) {{ LI = true; LR = r; plist(r, {key}, LV); }} }}
    const float* V = LV.data();
    const int NV = (int) LV.size();
    """
        now = cx.sensor(f"{pid}_v", ent) if o.get("show_now", True) is not False else None
        unit = ascii_text(o["unit"]) if o.get("unit") else cx.unit(ent)
    else:
        attr = (o.get("attribute") or "").strip() or None
        val = cx.sensor(f"{pid}_v", ent, attr)
        c = cx.chart(f"{pid}_h", CHART_PERIODS.get(o.get("period"), 1800), val)
        code = f"""float V[48];
    for (int i = 0; i < 47; i++) V[i] = id({c}_a)[i + 1];
    V[47] = id({c}_n) > 0 ? id({c}_s) / id({c}_n) : NAN;
    const int NV = 48;
    """
        now = val if o.get("show_now", True) is not False else None
        unit = ascii_text(o["unit"]) if o.get("unit") else ("" if attr else cx.unit(ent))
    code += "std::string NW, NU;\n"
    if now:
        code += f"{{ std::string r = {now}; if (is_num(r)) {{ NW = num_fmt(strtof(r.c_str(), nullptr), {dc}, true); NU = {cstr(unit)}; }} else NW = word(r); }}\n"
    return code + f"chrt(V, NV, {style}, {mm}, {cstr(title)}, NW, NU, {main}, {acc}, {dc}, {nodata});\n"


def chart_step_cpp(c, secs, expr):
    """Verlauf aufzeichnen (Intervall, jede Sekunde): Mittelwert pro Abschnitt, 48 Abschnitte im Flash."""
    return f"""{{
auto ct = id(ha_time).now();
if (ct.is_valid()) {{
int32_t b = (int32_t) (ct.timestamp / {secs});
auto& A = id({c}_a);
if (id({c}_b) <= 0) {{ A.fill(NAN); id({c}_b) = b; id({c}_s) = 0; id({c}_n) = 0; }}
else if (b != id({c}_b)) {{
int k = b - id({c}_b);
float avg = id({c}_n) > 0 ? id({c}_s) / id({c}_n) : NAN;
if (k < 0 || k > 48) A.fill(NAN);
else {{ for (int i = 0; i < 48; i++) A[i] = i + k < 48 ? A[i + k] : NAN; A[48 - k] = avg; }}
id({c}_b) = b; id({c}_s) = 0; id({c}_n) = 0;
}}
std::string r = {expr};
if (is_num(r)) {{ id({c}_s) += strtof(r.c_str(), nullptr); id({c}_n)++; }}
}}
}}
"""


PAGES = {"clock": page_clock, "marquee": page_marquee, "calendar": page_calendar, "chart": page_chart, "weather": page_weather, "value": page_value, "entity": page_entity, "list": page_list, "timer": page_timer,
         "stack": page_stack}


# ---------------------------------------------------------------- Animationen (Seitenwechsel)
ANIM_STYLES = ("none", "fade", "slide_left", "slide_up", "wipe", "curtain",
               "slide_right", "glide", "rollo", "blinds", "box", "tiles", "scanner", "bounce", "drop", "blink",
               "stairs", "split", "cross", "wave", "zipper")
TILE_ORDER = [4, 0, 8, 2, 6, 1, 7, 3, 5]  # Kacheln: Mitte, Ecken, Kanten


# ---------------------------------------------------------------- Ruhezeit + Abenddimmung
DAY_KEYS = ("mo", "di", "mi", "do", "fr", "sa", "so")


def _hm(v, default):
    try:
        h, m = str(v).split(":")
        h, m = int(h), int(m)
        if 0 <= h < 24 and 0 <= m < 60:
            return h * 3600 + m * 60
    except (ValueError, AttributeError):
        pass
    return default


def quiet_cfg(s, pages=None):
    """Ruhezeit-Einstellungen bereinigt: Fenster in Sekunden der Woche (Mo 0:00 = 0)."""
    q = s.get("quiet") or {}
    days = q.get("days") or []
    win = []
    for d in range(7):
        dd = days[d] if d < len(days) and isinstance(days[d], dict) else {}
        start, end = _hm(dd.get("from"), 23 * 3600), _hm(dd.get("to"), 6 * 3600 + 1800)
        length = (end - start) % 86400
        on = bool(dd.get("on", True)) and length > 0
        # Zeile d = Nacht von Tag d auf Tag d+1: Beginn vor 12 Uhr liegt schon nach Mitternacht
        base = d * 86400 + start + (86400 if start < 12 * 3600 else 0)
        win.append({"start": base % 604800, "len": length if on else 0, "mode": {"dim": 2, "night": 3}.get(dd.get("mode"), 1)})
    pct = lambda v, dflt: max(1, min(100, int(v if isinstance(v, (int, float)) else dflt)))
    ev = q.get("evening") or {}
    lead = max(0, min(6 * 60, int(ev.get("lead", 60) or 0))) * 60
    allowed = set(q.get("dim_pages") or [])
    return {
        "enabled": bool(q.get("enabled")) and any(w["len"] for w in win),
        "win": win,
        "dim_cap": max(1, int(255 * pct(q.get("dim_pct"), 5) / 100 + 0.5)),
        "ev_lead": lead if ev.get("enabled") else 0,
        "ev_cap": max(1, int(255 * pct(ev.get("pct"), 30) / 100 + 0.5)),
        "smooth": bool(ev.get("smooth", True)),
        "dim_ok": [p.get("id") in allowed for p in (pages or [])],
    }


def quiet_eval_cpp(q):
    """C++: setzt qmode (0 normal, 1 aus, 2 gedimmt, 3 Nacht = gedimmt + rot) und qcap (Helligkeitsgrenze 0..255). Erwartet W (Sekunde der Woche)."""
    return f"""static const int32_t QS[7] = {{{", ".join(str(w["start"]) for w in q["win"])}}};
static const int32_t QL[7] = {{{", ".join(str(w["len"]) for w in q["win"])}}};
static const uint8_t QM[7] = {{{", ".join(str(w["mode"]) for w in q["win"])}}};
const int32_t WEEK = 604800, EV_LEAD = {q["ev_lead"]}, EV_CAP = {q["ev_cap"]}, DIM_CAP = {q["dim_cap"]};
for (int d = 0; d < 7; d++) {{
if (QL[d] <= 0) continue;
int32_t dd = ((W - QS[d]) % WEEK + WEEK) % WEEK;
if (dd < QL[d]) {{ qmode = QM[d]; qcap = QM[d] >= 2 ? DIM_CAP : 0; }}
}}
if (qmode == 0 && EV_LEAD > 0) {{
for (int d = 0; d < 7; d++) {{
if (QL[d] <= 0) continue;
int32_t dd = ((W - (QS[d] - EV_LEAD)) % WEEK + WEEK) % WEEK;
if (dd < EV_LEAD) {{
int32_t ramp = {"std::min<int32_t>(EV_LEAD, 900)" if q["smooth"] else "0"};
int c = (ramp > 0 && dd < ramp) ? (int) (255 - (int64_t) (255 - EV_CAP) * dd / ramp) : EV_CAP;
if (c < qcap) qcap = c;
}}
}}
}}
"""


SCROLL_SPEEDS = {"slow": 50, "normal": 35, "fast": 22}  # Millisekunden pro Pixel


def any_scroll(pages):
    """Kann irgendwo Text laufen? Dann zeichnet das Panel öfter (flüssige Laufschrift)."""
    def ok(t, o):
        o = o or {}
        return t == "marquee" or (t not in ("stack", "chart", "") and o.get("overflow", "scroll") == "scroll")
    for p in pages:
        if ok(p["type"], p.get("options")):
            return True
        if p["type"] == "stack" and any(isinstance(f, dict) and ok(f.get("type") or "", f.get("options")) for f in (p.get("options") or {}).get("fields") or []):
            return True
    return False


def scroll_cfg(s):
    sc = s.get("scroll") or {}
    return sc.get("on", True) is not False, SCROLL_SPEEDS.get(sc.get("speed"), 35)


def anim_cfg(s):
    a = (s or {}).get("anim") or {}
    style = a.get("style") if a.get("style") in ANIM_STYLES else "fade"
    ms = max(150, min(2000, _int(a.get("ms", 600), 600)))
    return {"style": style, "ms": ms, "ease": "linear" if a.get("ease") == "linear" else "smooth"}


def transition_cpp(an, W, H):
    """Zeichnet die sichtbaren Seiten; wechselt die Auswahl, wird für an['ms'] animiert übergeblendet."""
    if an["style"] == "none":
        return "draw_mask(id(vis_mask));\n"
    ease = "e = (p * p / 1000) * (3000 - 2 * p) / 1000;" if an["ease"] == "smooth" else "e = p;"
    styles = {
        "fade": "if (e < 500) { AL = 255 * (500 - e) / 500; draw_mask(tprev); } else { AL = 255 * (e - 500) / 500; draw_mask(tcur); }",
        "slide_left": f"{{ int o = {W} * e / 1000; TX = -o; draw_mask(tprev); TX = {W} - o; draw_mask(tcur); }}",
        "slide_up": f"{{ int o = {H} * e / 1000; TY = -o; draw_mask(tprev); TY = {H} - o; draw_mask(tcur); }}",
        "wipe": f"{{ int x = {W} * e / 1000; GX0 = x; draw_mask(tprev); GX0 = 0; GX1 = x; draw_mask(tcur); }}",
        "curtain": f"{{ int h = ({W} / 2) * e / 1000, a = {W} / 2 - h, b = {W} - a; GX1 = a; draw_mask(tprev); GX0 = b; GX1 = {W}; draw_mask(tprev); GX0 = a; GX1 = b; draw_mask(tcur); }}",
        "slide_right": f"{{ int o = {W} * e / 1000; TX = o; draw_mask(tprev); TX = o - {W}; draw_mask(tcur); }}",
        "glide": f"if (e < 500) {{ TX = -({W} / 3) * e / 500; AL = 255 * (500 - e) / 500; draw_mask(tprev); }} else {{ TX = ({W} / 3) * (1000 - e) / 500; AL = 255 * (e - 500) / 500; draw_mask(tcur); }}",
        "rollo": f"{{ int y = {H} * e / 1000; GY0 = y; draw_mask(tprev); GY0 = 0; GY1 = y; draw_mask(tcur); }}",
        "blinds": f"{{ draw_mask(tprev); int sh = {H} / 8; for (int k = 0; k < 8; k++) {{ int h = sh * e / 1000; if (h <= 0) continue; "
                  f"BOX(0, k * sh, {W}, h, Color(0, 0, 0)); GY0 = k * sh; GY1 = k * sh + h; draw_mask(tcur); }} }}",
        "box": f"{{ draw_mask(tprev); int hw = ({W} / 2) * e / 1000, hh = ({H} / 2) * e / 1000; if (hw > 0 && hh > 0) {{ "
               f"int x0 = {W} / 2 - hw, y0 = {H} / 2 - hh; BOX(x0, y0, 2 * hw, 2 * hh, Color(0, 0, 0)); "
               f"GX0 = x0; GX1 = x0 + 2 * hw; GY0 = y0; GY1 = y0 + 2 * hh; draw_mask(tcur); }} }}",
        "tiles": f"{{ static const int ORD[9] = {{{', '.join(map(str, TILE_ORDER))}}}; draw_mask(tprev); int n = e * 10 / 1000; "
                 f"for (int r = 0; r < n && r < 9; r++) {{ int k = ORD[r], c = k % 3, w = k / 3; "
                 f"int x0 = {W} * c / 3, x1 = {W} * (c + 1) / 3, y0 = {H} * w / 3, y1 = {H} * (w + 1) / 3; "
                 f"BOX(x0, y0, x1 - x0, y1 - y0, Color(0, 0, 0)); GX0 = x0; GX1 = x1; GY0 = y0; GY1 = y1; draw_mask(tcur); }} }}",
        "scanner": f"{{ int x = ({W} + 2) * e / 1000 - 1; GX0 = std::max(0, x); draw_mask(tprev); GX0 = 0; GX1 = std::max(0, x); draw_mask(tcur); "
                   f"GX1 = {W}; BOX(x, 0, 2, {H}, Color(190, 225, 255)); }}",
        "bounce": f"{{ long long u = p - 1000; int f = (int) (1000 + 2701LL * u * u * u / 1000000000LL + 1701LL * u * u / 1000000LL); "
                  f"int o = {W} * f / 1000; TX = -o; draw_mask(tprev); TX = {W} - o; draw_mask(tcur); }}",
        "drop": f"{{ int f; long long t11 = 11LL * p, u; "
                f"if (t11 < 4000) f = (int) (t11 * t11 / 16000); "
                f"else if (t11 < 8000) {{ u = t11 - 6000; f = (int) (u * u / 16000) + 750; }} "
                f"else if (t11 < 10000) {{ u = t11 - 9000; f = (int) (u * u / 16000) + 937; }} "
                f"else {{ u = t11 - 10500; f = (int) (u * u / 16000) + 984; }} "
                f"if (p < 364) {{ TY = {H} * f / 1000; draw_mask(tprev); }} TY = {H} * f / 1000 - {H}; draw_mask(tcur); }}",
        "stairs": f"{{ draw_mask(tprev); for (int k = 0; k < 8; k++) {{ int l = (e - k * 60) * 1000 / 580; if (l <= 0) continue; if (l > 1000) l = 1000; "
                  f"int x0 = {W} * k / 8, x1 = {W} * (k + 1) / 8, h = {H} * l / 1000; "
                  f"BOX(x0, 0, x1 - x0, h, Color(0, 0, 0)); GX0 = x0; GX1 = x1; GY0 = 0; GY1 = h; draw_mask(tcur); }} }}",
        "split": f"{{ int h = ({H} / 2) * e / 1000, a = {H} / 2 - h, b = {H} - a; GY1 = a; draw_mask(tprev); GY0 = b; GY1 = {H}; draw_mask(tprev); GY0 = a; GY1 = b; draw_mask(tcur); }}",
        "cross": f"{{ draw_mask(tprev); int hw = ({W} / 2) * e / 1000, hh = ({H} / 2) * e / 1000; "
                 f"if (hh > 0) {{ BOX(0, {H} / 2 - hh, {W}, 2 * hh, Color(0, 0, 0)); GY0 = {H} / 2 - hh; GY1 = {H} / 2 + hh; draw_mask(tcur); GY0 = 0; GY1 = {H}; }} "
                 f"if (hw > 0) {{ BOX({W} / 2 - hw, 0, 2 * hw, {H}, Color(0, 0, 0)); GX0 = {W} / 2 - hw; GX1 = {W} / 2 + hw; draw_mask(tcur); }} }}",
        "wave": f"{{ draw_mask(tprev); for (int r = 0; r < 4; r++) for (int c = 0; c < 4; c++) {{ if (e < (r + c + 1) * 1000 / 8) continue; "
                f"int x0 = {W} * c / 4, x1 = {W} * (c + 1) / 4, y0 = {H} * r / 4, y1 = {H} * (r + 1) / 4; "
                f"BOX(x0, y0, x1 - x0, y1 - y0, Color(0, 0, 0)); GX0 = x0; GX1 = x1; GY0 = y0; GY1 = y1; draw_mask(tcur); }} }}",
        "zipper": f"{{ int o = {W} * e / 1000; GY1 = {H} / 2; TX = -o; draw_mask(tprev); TX = {W} - o; draw_mask(tcur); "
                  f"GY0 = {H} / 2; GY1 = {H}; TX = o; draw_mask(tprev); TX = o - {W}; draw_mask(tcur); }}",
        "blink": f"if (e < 500) {{ int h = ({H} / 2) * (500 - e) / 500; GY0 = {H} / 2 - h; GY1 = {H} / 2 + h; draw_mask(tprev); }} "
                 f"else {{ int h = ({H} / 2) * (e - 500) / 500; GY0 = {H} / 2 - h; GY1 = {H} / 2 + h; draw_mask(tcur); }}",
    }
    return f"""
// Seitenwechsel-Animation: alte und neue Auswahl werden {an['ms']} ms lang übergeblendet
auto BOX = [&](int x, int y, int w, int h, Color c) {{
int s0 = GX0, s1 = GY0, s2 = GX1, s3 = GY1, s4 = AL;
OX = 0; OY = 0; DW = {W}; DH = {H}; GX0 = 0; GY0 = 0; GX1 = {W}; GY1 = {H}; AL = 255;
FR(x, y, w, h, c);
GX0 = s0; GY0 = s1; GX1 = s2; GY1 = s3; AL = s4;
}};
static uint32_t tcur = 0xFFFFFFFFu, tprev = 0, tt0 = 0;
uint32_t vm = id(vis_mask), tn = millis();
if (tcur == 0xFFFFFFFFu) {{ tcur = vm; tt0 = tn - {an['ms']}; }}
if (vm != tcur) {{ tprev = tcur; tcur = vm; tt0 = tn; }}
uint32_t tel = tn - tt0;
if (tel >= {an['ms']}u) draw_mask(tcur);
else {{
int p = (int) (tel * 1000 / {an['ms']}u), e;
{ease}
{styles[an['style']]}
TX = 0; TY = 0; GX0 = 0; GY0 = 0; GX1 = {W}; GY1 = {H}; AL = 255;
}}
"""


# ---------------------------------------------------------------- Bedingungen
OPS = {">": ">", "<": "<", ">=": ">=", "<=": "<=", "==": "==", "!=": "!="}


def is_num(v) -> bool:
    return bool(re.fullmatch(r"[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?", str(v).strip()))


def cond_of(p):
    """Gültige Bedingung einer Seite oder None."""
    c = p.get("condition") or {}
    if not c.get("entity") or c.get("op") not in OPS or str(c.get("value", "")).strip() == "":
        return None
    return c


def cond_numeric(c) -> bool:
    return c["op"] in (">", "<", ">=", "<=") or is_num(c["value"])


def page_complete(p, cfg=None) -> bool:
    try:
        cx = Ctx({}, (cfg or {}).get("pages"))
        cx.custom = (cfg or {}).get("icons") or {}
        cx.geom = Geom(cfg["settings"]) if cfg else None
        PAGES[p["type"]](p, cx, "x")
        return True
    except (GenError, KeyError):
        return False


# ---------------------------------------------------------------- Live-Entitäten
def esphome_object_id(name: str) -> str:
    """Wie ESPHome aus einem Namen die object_id bildet (snake_case + sanitize)."""
    return re.sub(r"[^a-z0-9_-]", "_", name.strip().lower().replace(" ", "_"))


def compiled_pages(cfg):
    """Seiten, die in die Firmware kommen: alle vollständigen (auch ausgeschaltete,
    damit man sie später live einschalten kann)."""
    out = []
    for p in cfg["pages"]:
        if p.get("enabled"):
            out.append(p)  # aktive Seiten müssen vollständig sein -> Fehler kommt beim Erzeugen
        elif page_complete(p, cfg):
            out.append(p)
    return out[:MAX_PAGES]


def ha_names(s):
    """Namen der Panel-Entitäten in Home Assistant – in der Panel-Sprache."""
    return PANEL_TEXT[lang_of(s)]["ha"]


def entity_names(cfg):
    H = ha_names(cfg["settings"])
    names, seen = [], set()
    for n, p in enumerate(compiled_pages(cfg)):
        base = ascii_plain(p.get("name") or "") or H["page"].format(n + 1)
        label = base
        k = 2
        while label.lower() in seen:
            label = f"{base} {k}"
            k += 1
        seen.add(label.lower())
        names.append({"en": H["show"].format(label), "dur": H["dur"].format(label), "thr": H["thr"].format(label)})
    return names


def live_entities(cfg):
    """Werte, die ohne Flashen über Home Assistant geändert werden können.
    -> Liste von (domain, object_id, wert)"""
    s = cfg["settings"]
    g = Geom(s)
    pw = power_cfg(s, g)
    H = ha_names(s)
    out = [("switch", esphome_object_id(H["display"]), bool(cfg.get("active", True))),
           ("number", esphome_object_id(H["bright"]), max(1, min(255, int(s.get("brightness", 128))))),
           ("number", esphome_object_id(H["psu"]), round(pw["amp"], 1))]
    for p, names in zip(compiled_pages(cfg), entity_names(cfg)):
        out.append(("switch", esphome_object_id(names["en"]), bool(p.get("enabled"))))
        out.append(("number", esphome_object_id(names["dur"]), max(1, int(p.get("duration", 10)))))
        c = cond_of(p)
        if c and cond_numeric(c) and is_num(c["value"]):
            out.append(("number", esphome_object_id(names["thr"]), float(c["value"])))
    return out


def live_normalized(cfg):
    """Kopie, bei der alle live änderbaren Werte neutralisiert sind –
    gleiche YAML => es reicht ein Live-Update, kein Flashen."""
    import copy
    c = copy.deepcopy(cfg)
    c["active"] = True
    c["settings"]["brightness"] = 128
    c["settings"].setdefault("power", {})
    c["settings"]["power"] = {**(c["settings"].get("power") or {}), "amp": 3.0}
    for p in c["pages"]:
        p["duration"] = 10
        cond = cond_of(p)
        if cond and cond_numeric(cond) and is_num(cond["value"]):
            cond["value"] = "0"
    keep = {id(p) for p in compiled_pages(c)}
    for p in c["pages"]:
        if id(p) in keep:
            p["enabled"] = True
    return c


# ---------------------------------------------------------------- Gesamt
def device_slug(s: dict) -> str:
    return slug(s.get("device_name") or "pixelpanel").replace("_", "-").strip("-") or "pixelpanel"


def _cond_cpp(c, pid, cx, idx):
    """C++-Block für die Bedingung einer Seite."""
    st = cx.sensor(f"{pid}_k", c["entity"])
    op = OPS[c["op"]]
    if cond_numeric(c) and is_num(c["value"]):
        expr = f"is_num(s) && strtof(s.c_str(), nullptr) {op} id({pid}_thr).state"
    elif op in ("==", "!="):
        expr = f"s {op} {cstr(str(c['value']))}"
    else:
        expr = "false"
    hold = int(c.get("hold", 0) or 0)
    return f"""
{{
std::string s = {st};
bool c = s != "unavailable" && s != "unknown" && s != "" && ({expr});
if (c) {{ if (since[{idx}] == 0) since[{idx}] = now + 1; }} else since[{idx}] = 0;
ok[{idx}] = ok[{idx}] && c{f" && (now + 1 - since[{idx}] >= {hold * 1000}u)" if hold > 0 else ""};
}}
"""


IS_NUM_CPP = """
auto is_num = [](const std::string& s) -> bool {
size_t i = 0, n = s.size();
if (i < n && (s[i] == '+' || s[i] == '-')) i++;
size_t a = i; while (i < n && isdigit((unsigned char) s[i])) i++;
size_t ip = i - a, fp = 0;
if (i < n && s[i] == '.') { i++; size_t b = i; while (i < n && isdigit((unsigned char) s[i])) i++; fp = i - b; }
if (ip == 0 && fp == 0) return false;
if (i < n && (s[i] == 'e' || s[i] == 'E')) {
i++; if (i < n && (s[i] == '+' || s[i] == '-')) i++;
size_t e = i; while (i < n && isdigit((unsigned char) s[i])) i++;
if (i == e) return false;
}
return i == n;
};
"""


def generate(cfg: dict, units: dict | None = None, secrets_inline: bool = False) -> str:
    units = units or {}
    s = cfg["settings"]
    if not any(p.get("enabled") for p in cfg["pages"]):
        raise GenError("Mindestens eine Seite muss aktiviert sein.")
    g = Geom(s)
    if not g.chain_valid():
        raise GenError("Mit dieser Panel-Anordnung kommt das Bild nicht an: fehlende Module müssen am Ende der Kette sitzen. "
                       "Wähle unter Hardware ein anderes Ketten-Layout oder „Automatisch“.")
    pw = power_cfg(s, g)
    pages = compiled_pages(cfg)
    friendly = "".join(ch for ch in str(s.get("friendly_name") or "Pixel Panel") if ch.isprintable() and ch not in '"\\')[:60] or "Pixel Panel"
    tz = str(s.get("timezone") or "Europe/Berlin").strip()
    if not re.fullmatch(r"[A-Za-z0-9_+\-/]{1,64}", tz):
        raise GenError(f"Zeitzone „{tz[:40]}“ ist ungültig – z. B. Europe/Berlin.")
    drv = str(s.get("shift_driver") or "GENERIC").strip()
    if not re.fullmatch(r"[A-Z0-9_]{1,24}", drv):
        raise GenError("Treiberchip ist ungültig – bitte unter Panel & Hardware neu wählen.")
    active = bool(cfg.get("active", True))
    bright = max(1, min(255, int(s.get("brightness", 128))))
    names = entity_names(cfg)
    HN = ha_names(s)
    q = quiet_cfg(s, pages)

    # Seiten bauen -> sammelt dabei die benötigten HA-Sensoren
    cx = Ctx(units, cfg["pages"])
    cx.geom = g
    cx.custom = cfg.get("icons") or {}
    cx.lang = lang_of(s)
    cx.time12 = s.get("time_format") == "12"
    pids, page_fns, areas, draws = [], [], [], []
    for n, p in enumerate(pages):
        pid = "p" + str(n) + "_" + slug(p.get("id", ""))[:20]
        fn = PAGES.get(p["type"])
        if not fn:
            raise GenError(f"Unbekannter Seitentyp: {p['type']}")
        a = g.area_of(p)
        code = page_code(p, cx, pid)
        pids.append(pid)
        areas.append(a)
        page_fns.append(f"auto page_{n} = [&]() {{\n{code}\n}};")
        draws.append(f"if (mask & (1u << {n})) {{ OX = {a['x']} + TX; OY = {a['y']} + TY; DW = {a['w']}; DH = {a['h']}; page_{n}(); }}")

    conds_cpp = [_cond_cpp(cond_of(p), pids[n], cx, n) for n, p in enumerate(pages) if cond_of(p)]
    timers_cpp = (TIMER_HELPERS if cx.timers else "") + "".join(timer_step_cpp(*t) for t in cx.timers)
    timers_cpp += "".join(chart_step_cpp(*c) for c in cx.charts)
    # Timer-Seiten: nur sichtbar, solange der Timer läuft (+ kurz „FERTIG“)
    for n, p in enumerate(pages):
        o = p.get("options") or {}
        if p["type"] == "timer" and o.get("only_running", True):
            t, dm = f"{pids[n]}_t", timer_done_ms(o)
            extra = f" || (id({t}_done) != 0 && now + 1 - id({t}_done) < {dm}u)" if dm else ""
            conds_cpp.append(f"ok[{n}] = ok[{n}] && (id({t}_rem) > 0{extra});\n")

    out = [f"""# ------------------------------------------------------------
# Automatisch erzeugt von PixelPanel Studio {VERSION}.
# Änderungen hier werden beim nächsten Übertragen überschrieben.
# Panel: {g.cols}x{g.rows} x {g.module} ({g.W}x{g.H} Pixel, P{g.pitch:g}), Netzteil {pw['volt']:g} V / {pw['amp']:g} A
# ------------------------------------------------------------
esphome:
  name: {device_slug(s)}
  friendly_name: {yq(friendly)}

esp32:
  board: {hwboards.BOARDS[hwboards.board_of(s)]["pio"]}

logger:
  level: WARN
"""]
    api_key = (s.get("api_key") or "").strip()
    if api_key and not re.fullmatch(r"[A-Za-z0-9+/]{43}=", api_key):
        raise GenError("Der API-Schlüssel ist ungültig (32 Byte, Base64) – unter Zugänge & Sicherheit auf „Neu“ klicken.")
    out.append("api:\n" + (f'  encryption:\n    key: "{api_key}"\n' if api_key else ""))
    ota_pw = (s.get("ota_password") or "").strip()

    ap_pw = str(s.get("ap_password") or "")
    if len(ap_pw) < 8 or not re.fullmatch(r"[A-Za-z0-9]{8,63}", ap_pw):
        raise GenError("Das Passwort fürs Ersatz-WLAN fehlt oder ist ungültig – bitte unter Zugänge & Sicherheit neu erzeugen.")
    if secrets_inline and s.get("wifi_ssid"):
        wifi = f'  ssid: {yq(s["wifi_ssid"])}\n  password: {yq(s.get("wifi_password", ""))}\n'
    else:
        wifi = "  ssid: !secret wifi_ssid\n  password: !secret wifi_password\n"
    out.append(f"""wifi:
{wifi}  ap:
    ssid: "PixelPanel Fallback"
    password: {yq(ap_pw)}

captive_portal:

time:
  - platform: homeassistant
    id: ha_time
    timezone: {tz}
  - platform: sntp
    id: net_time
    timezone: {tz}
""")

    lines = [f"""  - platform: template
    name: "Studio Version"
    id: studio_version
    entity_category: diagnostic
    update_interval: 1h
    lambda: 'return std::string("{VERSION}");'"""]
    for sid, ent, attr in cx.sensors:
        lines.append(f"  - platform: homeassistant\n    id: {sid}\n    entity_id: {ent}"
                     + (f"\n    attribute: {attr}" if attr else ""))
    out.append("text_sensor:\n" + "\n".join(lines) + "\n")

    # Schalter / Zahlen – live aus HA (und vom Studio) änderbar
    sw = [f"""  - platform: template
    name: {yq(HN["display"])}
    id: disp_on
    optimistic: true
    restore_mode: {"RESTORE_DEFAULT_ON" if active else "RESTORE_DEFAULT_OFF"}"""]
    if q["enabled"]:
        sw.append(f"""  - platform: template
    name: {yq(HN["quiet"])}
    id: quiet_on
    optimistic: true
    restore_mode: RESTORE_DEFAULT_ON
    icon: mdi:sleep""")
    sw.append(f"""  - platform: template
    name: {yq(HN["night"])}
    id: night_on
    optimistic: true
    restore_mode: RESTORE_DEFAULT_OFF
    icon: mdi:weather-night""")
    num = [f"""  - platform: template
    name: {yq(HN["bright"])}
    id: bright
    optimistic: true
    min_value: 1
    max_value: 255
    step: 1
    initial_value: {bright}
    restore_value: true""", f"""  - platform: template
    name: {yq(HN["psu"])}
    id: psu_a
    optimistic: true
    entity_category: config
    mode: box
    unit_of_measurement: A
    min_value: 0.5
    max_value: 60
    step: 0.1
    initial_value: {round(pw['amp'], 1)}
    restore_value: true"""]
    for n, p in enumerate(pages):
        pid, nm = pids[n], names[n]
        sw.append(f"""  - platform: template
    name: {cstr(nm["en"])}
    id: {pid}_en
    optimistic: true
    entity_category: config
    restore_mode: {"RESTORE_DEFAULT_ON" if p.get("enabled") else "RESTORE_DEFAULT_OFF"}""")
        num.append(f"""  - platform: template
    name: {cstr(nm["dur"])}
    id: {pid}_dur
    optimistic: true
    entity_category: config
    mode: box
    unit_of_measurement: s
    min_value: 1
    max_value: 3600
    step: 1
    initial_value: {max(1, int(p.get("duration", 10)))}
    restore_value: true""")
        c = cond_of(p)
        if c and cond_numeric(c) and is_num(c["value"]):
            num.append(f"""  - platform: template
    name: {cstr(nm["thr"])}
    id: {pid}_thr
    optimistic: true
    entity_category: config
    mode: box
    min_value: -1000000000
    max_value: 1000000000
    step: 0.01
    initial_value: {float(c["value"])}
    restore_value: true""")
    out.append("switch:\n" + "\n".join(sw) + "\n")
    out.append("number:\n" + "\n".join(num) + "\n")

    n = len(pages)
    out.append(f"""button:
  - platform: template
    name: {yq(HN["next"])}
    on_press:
      - lambda: 'id(page_elapsed) = 1000000;'

globals:
  - id: q_cap
    type: int
    initial_value: '255'
  - id: page_lead
    type: int
    initial_value: '-2'
  - id: page_elapsed
    type: int
    initial_value: '0'
  - id: vis_mask
    type: uint32_t
    initial_value: '0'
  - id: ota_st
    type: int
    initial_value: '0'
  - id: q_night
    type: bool
    initial_value: 'false'
""" + "".join(f"""  - id: {t}_rem
    type: int
    initial_value: '-1'
  - id: {t}_max
    type: int
    initial_value: '0'
  - id: {t}_done
    type: uint32_t
    initial_value: '0'
  - id: {t}_pz
    type: bool
    initial_value: 'false'
""" for t, _o, _s in cx.timers) + "".join(f"""  - id: {c}_a
    type: std::array<float, 48>
    restore_value: true
  - id: {c}_b
    type: int32_t
    restore_value: true
    initial_value: '0'
  - id: {c}_s
    type: float
    initial_value: '0'
  - id: {c}_n
    type: int
    initial_value: '0'
""" for c, _secs, _e in cx.charts))

    # ---- Rotation: Seiten, die nebeneinander passen, laufen zusammen; feste Seiten bleiben stehen
    sticky = ", ".join("false" for p in pages)
    def _intr(p):
        o = p.get("options") or {}
        if (cond_of(p) or {}).get("interrupt"):
            return True
        return p["type"] == "timer" and o.get("only_running", True) and o.get("interrupt", True)
    interrupts = ", ".join("true" if _intr(p) else "false" for p in pages)
    # Timer im Vordergrund: solange ein „exklusiver“ Timer läuft, nur Timer zeigen
    excl = [n for n, p in enumerate(pages) if p["type"] == "timer" and (p.get("options") or {}).get("exclusive")]
    focus_cpp = ""
    if excl:
        tm = s.get("timers") or {}
        every = max(5, min(60, int(tm.get("every", 10) or 10)))
        shortest = tm.get("mode", "shortest") != "alternate"
        rems = ", ".join(f"id({pids[n]}_t_rem)" for n in excl)
        idxs = ", ".join(str(n) for n in excl)
        focus_cpp = f"""// Timer im Vordergrund ({"kürzester" if shortest else f"abwechselnd alle {every} s"})
{{
static const int FX[] = {{{idxs}}};
const int FN = {len(excl)};
int fr[FN] = {{{rems}}};
int cand[FN], nc = 0;
for (int k = 0; k < FN; k++) if (ok[FX[k]]) cand[nc++] = k;
if (nc > 0) {{
int pick = cand[0];
{"for (int k = 1; k < nc; k++) { int a = fr[cand[k]], b = fr[pick]; if ((a > 0 && (b <= 0 || a < b))) pick = cand[k]; }" if shortest else f"pick = cand[(int) ((now / 1000u) / {every}u % (uint32_t) nc)];"}
for (int i = 0; i < N; i++) ok[i] = (i == FX[pick]);
}}
}}
"""
    quiet_win = ""
    if q["enabled"]:
        quiet_win = f"""if (id(quiet_on).state) {{
auto qt = id(ha_time).now();
if (qt.is_valid()) {{
int32_t W = ((qt.day_of_week + 5) % 7) * 86400 + qt.hour * 3600 + qt.minute * 60 + qt.second;
{quiet_eval_cpp(q)}}}
}}
"""
    quiet_cpp = f"""// Ruhezeit / Abenddimmung / Nachtmodus (läuft im ESP – auch ohne Home Assistant)
int qmode = 0, qcap = 255;
{quiet_win}// Schalter „Nachtmodus“ (Home Assistant): rot + gedimmt, die Seiten bleiben wie sie sind
bool qforce = false;
if (qmode == 0 && id(night_on).state) {{ qmode = 3; qforce = true; if ({q["dim_cap"]} < qcap) qcap = {q["dim_cap"]}; }}
static const bool DIMOK[] = {{{", ".join("true" if v else "false" for v in q["dim_ok"]) or "false"}}};
if (qmode == 1) for (int i = 0; i < N; i++) ok[i] = false;
if (qmode == 2 || (qmode == 3 && !qforce)) for (int i = 0; i < N; i++) ok[i] = ok[i] && DIMOK[i];
id(q_cap) = qcap;
id(q_night) = qmode == 3;
"""
    rot = IS_NUM_CPP + f"""
const int N = {n};
static uint32_t since[N] = {{0}};
static bool was_ok[N] = {{false}};
const int AX[] = {{{", ".join(str(a["x"]) for a in areas)}}};
const int AY[] = {{{", ".join(str(a["y"]) for a in areas)}}};
const int AW[] = {{{", ".join(str(a["w"]) for a in areas)}}};
const int AH[] = {{{", ".join(str(a["h"]) for a in areas)}}};
const bool sticky[] = {{{sticky}}};
const bool interrupt[] = {{{interrupts}}};
int durs[] = {{{", ".join(f"(int) id({pid}_dur).state" for pid in pids)}}};
bool ok[] = {{{", ".join(f"id({pid}_en).state" for pid in pids)}}};
uint32_t now = millis();
{timers_cpp}
{"".join(conds_cpp)}
{quiet_cpp}{focus_cpp}int lead = id(page_lead);
for (int i = 0; i < N; i++) {{
if (ok[i] && !was_ok[i] && interrupt[i] && i != lead) {{ lead = i; id(page_elapsed) = 0; break; }}
}}
for (int i = 0; i < N; i++) was_ok[i] = ok[i];
auto next_lead = [&](int from) -> int {{
for (int k = 1; k <= N; k++) {{ int j = ((from < 0 ? -1 : from) + k) % N; if (ok[j] && !sticky[j]) return j; }}
return -1;
}};
auto overlap = [&](int a, int b) -> bool {{
return AX[a] < AX[b] + AW[b] && AX[b] < AX[a] + AW[a] && AY[a] < AY[b] + AH[b] && AY[b] < AY[a] + AH[a];
}};
// Gruppe ab "lead": folgende sichtbare Seiten, solange sie in freie Bereiche passen
bool vis[N];
int last = -1, gdur = 1;
auto build = [&](int ld) {{
for (int i = 0; i < N; i++) vis[i] = false;
last = ld; gdur = 1;
if (ld < 0) return;
vis[ld] = true; gdur = std::max(1, durs[ld]);
for (int k = 1; k < N; k++) {{
int j = (ld + k) % N;
if (!ok[j] || sticky[j]) continue;
bool free = true;
for (int i = 0; i < N; i++) if (vis[i] && overlap(i, j)) {{ free = false; break; }}
if (!free) break;
vis[j] = true; last = j; gdur = std::max(gdur, std::max(1, durs[j]));
}}
}};
if (lead < 0 || lead >= N || !ok[lead] || sticky[lead]) {{
lead = next_lead(lead);
id(page_elapsed) = 0;
build(lead);
}} else {{
build(lead);
id(page_elapsed)++;
if (id(page_elapsed) >= gdur) {{ lead = next_lead(last); id(page_elapsed) = 0; build(lead); }}
}}
// feste Seiten füllen freie Bereiche
for (int i = 0; i < N; i++) {{
if (!sticky[i] || !ok[i]) continue;
bool free = true;
for (int j = 0; j < N; j++) if (vis[j] && overlap(i, j)) {{ free = false; break; }}
if (free) vis[i] = true;
}}
uint32_t m = 0;
for (int i = 0; i < N; i++) if (vis[i]) m |= (1u << i);
id(page_lead) = lead;
id(vis_mask) = m;
"""
    out.append(f"""interval:
  - interval: 1s
    then:
      - lambda: |-
{ind(rot, 10)}
""")

    # ---- Anzeige: alle sichtbaren Seiten zeichnen, dann Helligkeit nach Strombudget setzen
    an = anim_cfg(s)
    sc_on = any_scroll(pages)
    render = prelude_for(cx.lang) + f"GX0 = 0; GY0 = 0; GX1 = {g.W}; GY1 = {g.H};\n" + "\n".join(page_fns) + f"""
auto draw_mask = [&](uint32_t mask) {{
{chr(10).join(draws)}
}};
if (id(ota_st) != 0) {{
{ota_screen_cpp(g.W, g.H)}
}} else {{
{transition_cpp(an, g.W, g.H)}
}}
// Strombegrenzung: Farbsumme -> geschätzter Strom -> höchste sichere Helligkeit
const double I_PX = {pw['i_px']!r};
const double IDLE = {pw['idle']!r};
double need = ACC / 765.0 * I_PX;
double budget = (double) id(psu_a).state * {SAFETY!r} - {ESP_RESERVE!r} - IDLE;
if (budget < 0.05) budget = 0.05;
int cap = need <= 0.001 ? 255 : std::max(1, std::min(255, (int) (255.0 * budget / need)));
int qc = id(q_cap);
int want = (id(disp_on).state && qc > 0) ? std::max(1, std::min(std::min((int) id(bright).state, cap), qc)) : 0;
static int cur = -1, applied = -1;
if (cur < 0 || want < cur) cur = want; else if (want > cur) cur = std::min(want, cur + 8);
if (cur != applied) {{ applied = cur; id(matrix).set_brightness(cur); }}
"""
    bd = hwboards.BOARDS[hwboards.board_of(s)]
    if bd["preset"]:
        pin_yaml = f"    board: {bd['preset']}"
    else:
        pins = hwboards.pins_of(s)
        pin_yaml = "\n".join(
            f"    {k}_pin: GPIO{int(pins[k])}" for k in PIN_KEYS if str(pins.get(k, "")).strip() not in ("", "None")
        )
    multi = ""
    if g.rows * g.cols > 1:
        multi = f"    layout_rows: {g.rows}\n    layout_cols: {g.cols}\n    layout: {g.layout}\n"
    rot_yaml = f"    rotation: {g.rot}\n" if g.rot else ""
    total = g.PW * g.PH
    plan = hw_plan(bd["chip"], total, an["style"], len({(e, a_) for _sid, e, a_ in cx.sensors}))
    bits = "" if plan["bits"] >= 8 else f"    bit_depth: {plan['bits']}\n"
    smooth = an["style"] != "none"
    # Animationen: 30 Bilder/s (bei hoher Last weniger), zweiter Bildpuffer gegen Flackern, wo der Speicher reicht
    dbl = "    double_buffer: true\n" if plan["double"] else ""
    interval = plan["interval"] if smooth or not sc_on else min(plan["interval"], 50 if total <= 8192 else 66)
    out.append(f"""display:
  - platform: hub75
    id: matrix
    panel_width: {g.mw}
    panel_height: {g.mh}
{multi}{rot_yaml}{pin_yaml}
    shift_driver: {drv}
{bits}{dbl}    brightness: 0
    update_interval: {interval}ms
    lambda: |-
{ind(render, 6)}
""")
    out.append(ota_yaml(ota_pw, interval))
    return "\n".join(out)
