"""ESP32-Boards für HUB75-Panels.

Die fertigen Boards (preset) entsprechen 1:1 den Board-Presets der ESPHome-hub75-Komponente
(esphome/components/hub75/boards/*.py) – ESPHome setzt die Pins dann selbst.
Die DevKit-Varianten bekommen die Pins hier explizit.
"""

PIN_KEYS = ["r1", "g1", "b1", "r2", "g2", "b2", "a", "b", "c", "d", "e", "lat", "oe", "clk"]


def _p(*v):
    return dict(zip(PIN_KEYS, v))


BOARDS = {
    "devkit": {
        "name": "ESP32 DevKit – ESPHome-Standard", "chip": "ESP32", "pio": "esp32dev", "preset": None,
        "pins": _p(25, 26, 27, 21, 22, 32, 23, 19, 5, 17, 18, 4, 15, 16),
        "note": "Belegung aus der ESPHome-Anleitung (bisheriger Standard im Studio).",
    },
    "devkit-dma": {
        "name": "ESP32 DevKit – MatrixPanel-DMA-Belegung", "chip": "ESP32", "pio": "esp32dev", "preset": None,
        "pins": _p(25, 26, 27, 14, 12, 13, 23, 19, 5, 17, 18, 4, 15, 16),
        "note": "Verbreitete Belegung der ESP32-HUB75-MatrixPanel-DMA-Bibliothek – viele Anleitungen und Adapterplatinen nutzen sie.",
    },
    "esp32-trinity": {
        "name": "ESP32 Trinity", "chip": "ESP32", "pio": "esp32dev", "preset": "esp32-trinity",
        "pins": _p(25, 26, 27, 14, 12, 13, 23, 19, 5, 17, 18, 4, 15, 16),
        "note": "Board von Brian Lough (esp32trinity.com), steckt direkt hinten aufs Panel.",
    },
    "adafruit-matrix-portal-s3": {
        "name": "Adafruit Matrix Portal S3", "chip": "ESP32-S3", "pio": "adafruit_matrixportal_esp32s3",
        "preset": "adafruit-matrix-portal-s3",
        "pins": _p(42, 41, 40, 38, 39, 37, 45, 36, 48, 35, 21, 47, 14, 2),
        "note": "Steckt direkt auf den HUB75-Eingang. ESP32-S3 – auch für große Flächen.",
    },
    "apollo-automation-m1-rev4": {
        "name": "Apollo Automation M1 (Rev. 4)", "chip": "ESP32-S3", "pio": "esp32-s3-devkitc-1",
        "preset": "apollo-automation-m1-rev4",
        "pins": _p(42, 41, 40, 38, 39, 37, 45, 36, 48, 35, 21, 47, 14, 2),
        "note": "HUB75-Controller von Apollo Automation, ältere Revision 4.",
    },
    "apollo-automation-m1-rev6": {
        "name": "Apollo Automation M1 (Rev. 6)", "chip": "ESP32-S3", "pio": "esp32-s3-devkitc-1",
        "preset": "apollo-automation-m1-rev6",
        "pins": _p(1, 5, 6, 7, 13, 9, 16, 48, 47, 21, 38, 8, 4, 18),
        "note": "HUB75-Controller von Apollo Automation, aktuelle Revision 6.",
    },
    "huidu-hd-wf1": {
        "name": "Huidu HD-WF1", "chip": "ESP32-S2", "pio": "esp32-s2-saola-1", "preset": "huidu-hd-wf1",
        "pins": _p(2, 6, 3, 4, 8, 5, 39, 38, 37, 36, 12, 33, 35, 34),
        "note": "Günstiger WLAN-Controller (ESP32-S2) aus vielen Panel-Sets. Erster Flash per USB im Boot-Modus.",
    },
    "huidu-hd-wf2": {
        "name": "Huidu HD-WF2", "chip": "ESP32-S3", "pio": "esp32-s3-devkitc-1", "preset": "huidu-hd-wf2",
        "pins": _p(2, 6, 10, 3, 7, 11, 39, 38, 37, 36, 21, 33, 35, 34),
        "note": "WLAN-Controller mit ESP32-S3, zwei HUB75-Ausgänge. Erster Flash per USB im Boot-Modus.",
    },
    "custom": {
        "name": "ESP32 DevKit – eigene Verkabelung", "chip": "ESP32", "pio": "esp32dev", "preset": None, "pins": None,
        "note": "Alle Pins selbst eintragen.",
    },
    "custom-s3": {
        "name": "ESP32-S3 DevKitC – eigene Verkabelung", "chip": "ESP32-S3", "pio": "esp32-s3-devkitc-1", "preset": None, "pins": None,
        "note": "Alle Pins selbst eintragen. ESP32-S3 – empfohlen für große Flächen.",
    },
}
DEFAULT = "devkit"


def board_of(settings):
    key = (settings or {}).get("hw_board")
    return key if key in BOARDS else DEFAULT


def pins_of(settings):
    """Pins, die tatsächlich verwendet werden."""
    b = BOARDS[board_of(settings)]
    return dict(b["pins"]) if b["pins"] else {k: (settings or {}).get("pins", {}).get(k) for k in PIN_KEYS}
