"""Panel-Geometrie: Module, Raster, fehlende Panels (L-Form), Kettenreihenfolge, Drehung, Bereiche.

Wird in static/renderer.js (PixelGeometry) 1:1 gespiegelt.
"""

MODULES = {"64x64": (64, 64), "64x32": (64, 32), "128x64": (128, 64), "32x32": (32, 32)}
PITCHES = [1.86, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0]
LAYOUTS = ["HORIZONTAL", "TOP_LEFT_DOWN", "TOP_RIGHT_DOWN", "BOTTOM_LEFT_UP", "BOTTOM_RIGHT_UP",
           "TOP_LEFT_DOWN_ZIGZAG", "TOP_RIGHT_DOWN_ZIGZAG", "BOTTOM_LEFT_UP_ZIGZAG", "BOTTOM_RIGHT_UP_ZIGZAG"]
BU = 32  # Raster für Bereiche (Pixel)

DEFAULT_PANEL = {"module": "64x64", "cols": 1, "rows": 1, "missing": [], "layout": "auto", "pitch": 3.0, "rotation": 0}
DEFAULT_POWER = {"volt": 5.0, "amp": 3.0, "module_amp": None}


def layout_allowed(layout, rows, cols):
    """Gleiche Regeln wie ESPHome hub75 (display.py)."""
    if rows == 1 and cols == 1:
        return layout == "HORIZONTAL"
    if layout == "HORIZONTAL":
        return rows == 1
    zig = "ZIGZAG" in layout
    if zig:
        return rows > 1 and cols > 1
    return rows > 1


def remap(x, y, layout, pw, ph, rows, cols):
    """Treiber-Formel (esp-hub75 panel_layout.h): virtuell -> DMA-Kette."""
    if layout == "HORIZONTAL":
        return x, y, False
    row = y // ph
    ly = y % ph
    vrx = cols * pw
    dmax = pw * rows * cols - 1
    inv = rows - 1 - row
    if layout == "TOP_LEFT_DOWN":
        if row % 2 == 0:
            return dmax - x - row * vrx, ph - 1 - ly, True
        return (rows - (row + 1)) * vrx + x, ly, False
    if layout == "TOP_RIGHT_DOWN":
        if row % 2 == 1:
            return dmax - x - row * vrx, ph - 1 - ly, True
        return (rows - (row + 1)) * vrx + x, ly, False
    if layout == "BOTTOM_LEFT_UP":
        if inv % 2 == 1:
            return (rows - (inv + 1)) * vrx + x, ly, False
        return dmax - inv * vrx - x, ph - 1 - ly, True
    if layout == "BOTTOM_RIGHT_UP":
        if inv % 2 == 0:
            return (rows - (inv + 1)) * vrx + x, ly, False
        return dmax - inv * vrx - x, ph - 1 - ly, True
    if layout in ("TOP_LEFT_DOWN_ZIGZAG", "TOP_RIGHT_DOWN_ZIGZAG"):
        return (rows - (row + 1)) * vrx + x, ly, False
    if layout in ("BOTTOM_LEFT_UP_ZIGZAG", "BOTTOM_RIGHT_UP_ZIGZAG"):
        return (rows - (inv + 1)) * vrx + x, ly, False
    return x, y, False


def chain_info(layout, pw, ph, rows, cols):
    """Je Modul (r, c): Position in der Kette ab dem ESP (0 = am ESP) und ob es kopfsteht.
    Das Ende des DMA-Puffers ist das Modul direkt am ESP."""
    n = rows * cols
    info = {}
    for r in range(rows):
        for c in range(cols):
            dx, _, flip = remap(c * pw + pw // 2, r * ph + ph // 2, layout, pw, ph, rows, cols)
            info[(r, c)] = (n - 1 - dx // pw, flip)
    return info


def chain_ok(layout, rows, cols, missing, pw, ph):
    """Fehlende Module müssen am Ende der Kette sitzen – sonst kommt das Bild nicht an."""
    info = chain_info(layout, pw, ph, rows, cols)
    present = rows * cols - len(missing)
    return all(info[m][0] >= present for m in missing)


class Geom:
    def __init__(self, settings):
        pc = {**DEFAULT_PANEL, **(settings.get("panel") or {})}
        self.module = pc["module"] if pc["module"] in MODULES else "64x64"
        self.mw, self.mh = MODULES[self.module]
        self.cols = max(1, min(4, int(pc.get("cols") or 1)))
        self.rows = max(1, min(4, int(pc.get("rows") or 1)))
        miss = set()
        for m in pc.get("missing") or []:
            r, c = (int(v) for v in str(m).split(","))
            if 0 <= r < self.rows and 0 <= c < self.cols:
                miss.add((r, c))
        if len(miss) >= self.rows * self.cols:
            miss = set()
        self.missing = miss
        self.rot = int(pc.get("rotation") or 0) if int(pc.get("rotation") or 0) in (0, 90, 180, 270) else 0
        self.pitch = float(pc.get("pitch") or 3.0)
        self.PW, self.PH = self.mw * self.cols, self.mh * self.rows
        self.W, self.H = (self.PH, self.PW) if self.rot in (90, 270) else (self.PW, self.PH)
        self.modules = self.rows * self.cols - len(self.missing)
        self.layout_setting = pc.get("layout") or "auto"
        self.layout = self._resolve_layout()

    def _resolve_layout(self):
        L = self.layout_setting
        if L != "auto" and L in LAYOUTS and layout_allowed(L, self.rows, self.cols):
            return L
        prefs = ["HORIZONTAL", "TOP_LEFT_DOWN_ZIGZAG", "TOP_RIGHT_DOWN_ZIGZAG", "BOTTOM_LEFT_UP_ZIGZAG",
                 "BOTTOM_RIGHT_UP_ZIGZAG", "TOP_LEFT_DOWN", "TOP_RIGHT_DOWN", "BOTTOM_LEFT_UP", "BOTTOM_RIGHT_UP"]
        for cand in prefs:
            if layout_allowed(cand, self.rows, self.cols) and chain_ok(cand, self.rows, self.cols, self.missing, self.mw, self.mh):
                return cand
        for cand in prefs:
            if layout_allowed(cand, self.rows, self.cols):
                return cand
        return "HORIZONTAL"

    def chain_valid(self):
        return chain_ok(self.layout, self.rows, self.cols, self.missing, self.mw, self.mh)

    # Anzeige-Koordinate -> physisch (Treiber rotation.h)
    def to_phys(self, x, y):
        if self.rot == 90:
            return y, self.PH - 1 - x
        if self.rot == 180:
            return self.PW - 1 - x, self.PH - 1 - y
        if self.rot == 270:
            return self.PW - 1 - y, x
        return x, y

    def present(self, x, y):
        if x < 0 or y < 0 or x >= self.W or y >= self.H:
            return False
        px, py = self.to_phys(x, y)
        return (py // self.mh, px // self.mw) not in self.missing

    def block_present(self, bx, by):
        return self.present(bx * BU + BU // 2, by * BU + BU // 2)

    def area_ok(self, a):
        try:
            x, y, w, h = int(a["x"]), int(a["y"]), int(a["w"]), int(a["h"])
        except (TypeError, KeyError, ValueError):
            return False
        if any(v % BU for v in (x, y, w, h)) or w < BU or h < BU or x < 0 or y < 0 or x + w > self.W or y + h > self.H:
            return False
        return all(self.block_present(bx, by) for bx in range(x // BU, (x + w) // BU)
                   for by in range(y // BU, (y + h) // BU))

    def default_area(self):
        full = {"x": 0, "y": 0, "w": self.W, "h": self.H}
        if self.area_ok(full):
            return full
        best, best_a = None, -1
        bw, bh = self.W // BU, self.H // BU
        for y0 in range(bh):
            for x0 in range(bw):
                for y1 in range(y0 + 1, bh + 1):
                    for x1 in range(x0 + 1, bw + 1):
                        a = {"x": x0 * BU, "y": y0 * BU, "w": (x1 - x0) * BU, "h": (y1 - y0) * BU}
                        if a["w"] * a["h"] > best_a and self.area_ok(a):
                            best, best_a = a, a["w"] * a["h"]
        return best or {"x": 0, "y": 0, "w": self.W, "h": self.H}

    def full(self):
        return {"x": 0, "y": 0, "w": self.W, "h": self.H}

    def area_of(self, page):
        """Normale Seiten nutzen die größte freie Fläche, Stapel die ganze Fläche (Felder liegen darin)."""
        return self.full() if page.get("type") == "stack" else self.default_area()

    def module_rects(self):
        """Vorhandene Module als Rechtecke in Anzeige-Koordinaten (nach Drehung)."""
        out = []
        for r in range(self.rows):
            for c in range(self.cols):
                if (r, c) in self.missing:
                    continue
                pts = []
                for px, py in ((c * self.mw, r * self.mh), ((c + 1) * self.mw - 1, (r + 1) * self.mh - 1)):
                    if self.rot == 90:
                        pts.append((self.PH - 1 - py, px))
                    elif self.rot == 180:
                        pts.append((self.PW - 1 - px, self.PH - 1 - py))
                    elif self.rot == 270:
                        pts.append((py, self.PW - 1 - px))
                    else:
                        pts.append((px, py))
                x0, y0 = min(p[0] for p in pts), min(p[1] for p in pts)
                x1, y1 = max(p[0] for p in pts) + 1, max(p[1] for p in pts) + 1
                out.append({"x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0})
        out.sort(key=lambda a: (a["y"], a["x"]))
        return out

    def stack_presets(self):
        """Aufteilungen für Stapel-Seiten, die auf diese Fläche passen. -> [(key, name, [rects])]"""
        W, H = self.W, self.H
        R = lambda x, y, w, h: {"x": x, "y": y, "w": w, "h": h}  # noqa: E731
        cands = [
            ("h2", "2 nebeneinander", [R(0, 0, W // 2, H), R(W // 2, 0, W // 2, H)]),
            ("h3", "3 nebeneinander", [R(i * W // 3, 0, W // 3, H) for i in range(3)]),
            ("h4", "4 nebeneinander", [R(i * W // 4, 0, W // 4, H) for i in range(4)]),
            ("v2", "2 übereinander", [R(0, 0, W, H // 2), R(0, H // 2, W, H // 2)]),
            ("v3", "3 übereinander", [R(0, i * H // 3, W, H // 3) for i in range(3)]),
            ("g4", "2 × 2", [R(0, 0, W // 2, H // 2), R(W // 2, 0, W // 2, H // 2), R(0, H // 2, W // 2, H // 2), R(W // 2, H // 2, W // 2, H // 2)]),
            ("l1r2", "Groß links, 2 rechts", [R(0, 0, W // 2, H), R(W // 2, 0, W // 2, H // 2), R(W // 2, H // 2, W // 2, H // 2)]),
            ("l2r1", "2 links, groß rechts", [R(0, 0, W // 2, H // 2), R(0, H // 2, W // 2, H // 2), R(W // 2, 0, W // 2, H)]),
            ("t1b2", "Groß oben, 2 unten", [R(0, 0, W, H // 2), R(0, H // 2, W // 2, H // 2), R(W // 2, H // 2, W // 2, H // 2)]),
            ("t2b1", "2 oben, groß unten", [R(0, 0, W // 2, H // 2), R(W // 2, 0, W // 2, H // 2), R(0, H // 2, W, H // 2)]),
        ]
        if self.modules > 1:
            cands.append(("mod", "Je Panel ein Feld", self.module_rects()))
            big = self.default_area()
            if (big["w"], big["h"]) != (W, H):
                ov = lambda a, b: a["x"] < b["x"] + b["w"] and b["x"] < a["x"] + a["w"] and a["y"] < b["y"] + b["h"] and b["y"] < a["y"] + a["h"]  # noqa: E731
                rest = [m for m in self.module_rects() if not ov(m, big)]
                cands.append(("big", "Große Fläche + Rest", [big] + rest))
        out, seen = [], set()
        for key, name, rects in cands:
            if not all(self.area_ok(a) for a in rects):
                continue
            sig = tuple(sorted((a["x"], a["y"], a["w"], a["h"]) for a in rects))
            if sig in seen:
                continue
            seen.add(sig)
            out.append((key, name, rects))
        return out

    def stack_rects(self, key):
        for k, _, rects in self.stack_presets():
            if k == key:
                return rects
        return None


# ---------------------------------------------------------------- Strom
IDLE_PER_MODULE = 0.10   # A, Treiber-Grundlast je Modul (Schätzung)
ESP_RESERVE = 0.25       # A, ESP32 + WLAN
SAFETY = 0.9             # 10 % Reserve am Netzteil


def power_cfg(settings, geom):
    pw = {**DEFAULT_POWER, **(settings.get("power") or {})}
    module_amp = pw.get("module_amp")
    try:
        module_amp = float(module_amp)
    except (TypeError, ValueError):
        module_amp = None
    if not module_amp or module_amp <= 0:
        module_amp = round(geom.mw * geom.mh * 0.001, 2)  # ~1 mA pro Pixel bei Vollweiß
    amp = max(0.5, float(pw.get("amp") or 3.0))
    return {"volt": float(pw.get("volt") or 5.0), "amp": amp, "module_amp": module_amp,
            "i_px": module_amp / (geom.mw * geom.mh),
            "idle": IDLE_PER_MODULE * geom.modules}


def brightness_cap(acc, i_px, amp, idle):
    """Höchste sichere Helligkeit (0-255) für ein Bild mit Farbsumme acc."""
    need = acc / 765.0 * i_px
    budget = amp * SAFETY - ESP_RESERVE - idle
    if budget < 0.05:
        budget = 0.05
    if need <= 0.001:
        return 255
    return max(1, min(255, int(255.0 * budget / need)))


# ---------------------------------------------------------------- Leistung & Speicher (Schätzung)
# Grundlage: ESPHome esp-hub75 (64x64 bei 8 Bit ≈ 57 KB, doppelter Puffer ≈ 114 KB, wächst linear mit den Pixeln)
# und ESP32-HUB75-MatrixPanel-DMA (Bildspeicher muss im internen RAM liegen, ≈ 200 KB frei; über 128x64 drohen
# Speicherfehler). Abzüglich WLAN/ESPHome bleibt für den Bildspeicher etwa:
CHIPS = {
    "ESP32": {"ram_kb": 140, "px_rate": 9000},     # zwei Kerne, I2S-DMA
    "ESP32-S2": {"ram_kb": 120, "px_rate": 5000},  # ein Kern – WLAN und Zeichnen teilen sich die CPU
    "ESP32-S3": {"ram_kb": 250, "px_rate": 18000},  # mehr internes RAM, GDMA
}
# Wie viel Arbeit ein Übergang pro Bild macht (1 = ein normales Bild)
ANIM_COST = {
    "none": 1.0, "fade": 1.0, "slide_left": 1.0, "slide_up": 1.0, "wipe": 1.0, "curtain": 1.1, "slide_right": 1.0,
    "glide": 1.0, "rollo": 1.0, "blinds": 1.5, "box": 1.2, "tiles": 1.6, "scanner": 1.05, "bounce": 1.0, "drop": 1.1,
    "blink": 1.0, "stairs": 1.5, "split": 1.1, "cross": 1.3, "wave": 1.8, "zipper": 1.2,
}
BYTES_PER_PX_BIT = 1.75  # 57 KB / 4096 px / 8 Bit


def buffer_kb(px, bits, double=False):
    return px * BYTES_PER_PX_BIT * bits * (2 if double else 1) / 1024


ENT_KB = 0.75  # geschätzter Arbeitsspeicher je Home-Assistant-Wert im ESP


def hw_plan(chip, px, style, n_ent=0):
    """Farbtiefe, doppelter Puffer, Bildrate und Last – so, dass es stabil läuft.
    n_ent: Anzahl der Home-Assistant-Werte, die ebenfalls Arbeitsspeicher brauchen."""
    c = CHIPS.get(chip, CHIPS["ESP32"])
    extra = n_ent * ENT_KB
    bits = 8
    while bits > 4 and buffer_kb(px, bits) + extra > c["ram_kb"]:
        bits -= 1
    fits = buffer_kb(px, bits) <= c["ram_kb"]
    smooth = style != "none"
    dbl = smooth and buffer_kb(px, bits, True) + extra <= c["ram_kb"]
    load = px * ANIM_COST.get(style, 1.0) / c["px_rate"] if smooth else px / (c["px_rate"] * 6)
    level = "ok" if load <= 1.0 else ("warn" if load <= 1.6 else "bad")
    interval = 33 if load <= 1.0 else (50 if load <= 1.6 else 66)
    return {"bits": bits, "double": dbl, "fits": fits, "load": round(load, 2), "level": level,
            "interval": interval if smooth else 200, "mem_kb": round(buffer_kb(px, bits, dbl)), "ram_kb": c["ram_kb"]}
