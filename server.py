"""PixelPanel Studio – lokaler Server.

Start:  python server.py      ->  http://localhost:8765
"""
import asyncio
import secrets
import base64
import datetime
import copy
import hashlib
import importlib.util
import json
import math
import os
import random
import re
import subprocess
import urllib.parse
import socket
import sys
import threading
import time
import webbrowser
from pathlib import Path

import aiohttp
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

import yaml_gen
import boards
import auth
from paneltext import PANEL_TEXT
from version import VERSION, GITHUB_REPO, GITHUB_BRANCH
import geometry
import pixelfont
from icons import ICON_CHOICES, ICON_GROUPS, ICONS, PALETTE, WEATHER

ROOT = Path(__file__).parent
# Home-Assistant-App: läuft im Supervisor (Token kommt automatisch, Daten liegen in /data)
APP_MODE = bool(os.environ.get("SUPERVISOR_TOKEN")) or os.environ.get("PIXELPANEL_APP") == "1"
DATA = Path(os.environ.get("PIXELPANEL_DATA") or (ROOT / "data"))
DATA.mkdir(parents=True, exist_ok=True)
INGRESS_IP = "172.30.32.2"  # Home Assistant leitet die Seitenleiste von hier aus weiter


def ha_creds(cfg):
    """Adresse + Token für Home Assistant – in der App automatisch über den Supervisor."""
    if APP_MODE and os.environ.get("SUPERVISOR_TOKEN"):
        return "http://supervisor/core", os.environ["SUPERVISOR_TOKEN"]
    st = cfg["settings"]
    return (st.get("ha_url") or "").rstrip("/"), st.get("ha_token") or ""
AUTH = auth.Auth(DATA / "auth.json")
COOKIE = "pp_session"
# Läuft der Server gerade fürs ganze WLAN (0.0.0.0)? Wird beim Start gesetzt.
SERVE = {"host": "127.0.0.1", "server": None, "restart": False}
CONFIG_PATH = DATA / "config.json"
PORT = int(os.environ.get("PIXELPANEL_PORT", "8765"))

DEFAULT_CONFIG = {
    "active": True,
    "icons": {},
    "settings": {
        "ha_url": "",
        "ha_token": "",
        "device_name": "pixelpanel",
        "friendly_name": "Pixel Panel",
        "board": "esp32dev",
        "hw_board": "devkit",
        "panel_lang": "de",
        "anim": {"style": "fade", "ms": 600, "ease": "smooth"},
        "deploy_mode": "local",          # local | dashboard
        "device_host": "",               # IP oder COM-Port (lokal)
        "dashboard_url": "http://homeassistant.local:6052",
        "dashboard_user": "",
        "dashboard_password": "",
        "wifi_ssid": "",
        "wifi_password": "",
        "api_key": "",
        "ota_password": "",
        "ap_password": "",
        "timers": {"mode": "shortest", "every": 10},
        "scroll": {"on": True, "speed": "normal", "mode": "pause"},
        "timezone": "Europe/Berlin",
        "brightness": 128,
        "shift_driver": "GENERIC",
        "panel": {"module": "64x64", "cols": 1, "rows": 1, "missing": [], "layout": "auto", "pitch": 3.0, "rotation": 0},
        "power": {"volt": 5.0, "amp": 3.0, "module_amp": None},
        "pins": {"r1": 25, "g1": 26, "b1": 27, "r2": 21, "g2": 22, "b2": 32,
                 "a": 23, "b": 19, "c": 5, "d": 17, "e": 18,
                 "lat": 4, "oe": 15, "clk": 16},
    },
    "pages": [
        {"id": "uhr", "type": "clock", "name": "Uhr", "enabled": True, "duration": 60,
         "options": {"style": "digital", "ring": True, "format": "24h", "show_date": True, "show_seconds": False, "seconds_bar": True,
                     "scale": 0, "valign": 1, "halign": 1, "color": "#ffffff", "accent": "#ff9f0a"}},
        {"id": "wetter", "type": "weather", "name": "Wetter", "enabled": True, "duration": 30,
         "options": {"entity": "", "show_humidity": True, "scale": 0, "icon_scale": 0, "valign": 1, "halign": 1, "color": "#ffffff", "accent": "#64d2ff"}},
    ],
}

# Vorlagen für neue Seiten (Frontend "Seite hinzufügen")
PAGE_TEMPLATES = {
    "clock": {"name": "Uhr", "duration": 60, "options": DEFAULT_CONFIG["pages"][0]["options"]},
    "weather": {"name": "Wetter", "duration": 30, "options": DEFAULT_CONFIG["pages"][1]["options"]},
    "value": {"name": "Wert", "duration": 20, "options": {
        "entity": "", "attribute": "", "title": "", "icon": "", "unit": "", "decimals": -1,
        "thousands": True, "second_entity": "", "trend": False, "icon_color": "#0a84ff", "scale": 0, "icon_scale": 0, "valign": 1, "halign": 1, "color": "#ffffff", "accent": "#bf5af2"}},
    "entity": {"name": "Entität", "duration": 20, "options": {
        "entity": "", "attribute": "", "title": "", "icon": "water_auto", "icon_color": "#0a84ff", "icon_pos": "top",
        "unit": "", "decimals": -1, "thousands": True, "scale": 0, "icon_scale": 0, "valign": 1, "halign": 1,
        "color": "#ffffff", "accent": "#64d2ff"}},
    "list": {"name": "Liste", "duration": 20, "options": {
        "title": "ZUHAUSE", "items": [], "scale": 0, "valign": 1, "color": "#ffffff", "accent": "#30d158"}},
    "timer": {"name": "Timer", "duration": 20, "options": {
        "entity": "", "mode": "remaining", "unit": "min", "title": "", "icon": "timer", "show_end": True, "show_bar": True,
        "only_running": True, "interrupt": True, "exclusive": False, "done_minutes": 2, "icon_color": "#0a84ff",
        "scale": 0, "icon_scale": 0, "valign": 1, "halign": 1, "color": "#ffffff", "accent": "#ff9f0a"}},
    "marquee": {"name": "Laufschrift", "duration": 20, "options": {
        "source": "text", "text": "", "entity": "", "attribute": "", "prefix": "", "title": "", "always": True,
        "icon": "", "icon_color": "#0a84ff", "scale": 12, "icon_scale": 0, "valign": 1, "halign": 1, "color": "#ffffff", "accent": "#ffd60a"}},
    "calendar": {"name": "Kalender", "duration": 20, "options": {
        "source": "entities", "view": "list", "calendars": [], "helper": "", "count": 6, "hide": "", "title": "",
        "scale": 0, "valign": 1, "halign": 1, "color": "#ffffff", "accent": "#ff453a"}},
    "chart": {"name": "Verlauf", "duration": 20, "options": {
        "mode": "record", "entity": "", "attribute": "", "period": "24h", "list_attr": "", "list_key": "",
        "style": "line", "show_minmax": True, "show_now": True, "title": "", "unit": "", "decimals": -1,
        "color": "#64d2ff", "accent": "#ffffff"}},
    "stack": {"name": "Stapel", "duration": 20, "options": {"layout": "", "fields": [], "dividers": True}},
}
SCROLL_OPTS = {"overflow": "scroll", "scroll_speed": "normal", "scroll_loop": "pause"}
for _t, _v in PAGE_TEMPLATES.items():
    if _t != "stack":
        _v["options"].update(SCROLL_OPTS)
PAGE_NAMES = {"clock": "Uhr", "weather": "Wetter", "value": "Wert", "entity": "Entität", "list": "Liste", "timer": "Timer",
              "marquee": "Laufschrift", "calendar": "Kalender", "chart": "Verlauf", "stack": "Stapel"}


def migrate(cfg):
    """Gespeicherte Konfiguration auf den aktuellen Stand bringen."""
    # einmalig: die frühere Standard-Bitcoin-Seite entfernen (Werte kommen jetzt über eine eigene Wert-Seite)
    if not cfg.get("_cleanup_v6"):
        cfg["pages"] = [p for p in cfg.get("pages", []) if p.get("id") != "bitcoin"]
        cfg["_cleanup_v6"] = True
    st = cfg.setdefault("settings", {})
    # Sicherheit: fehlende Schlüssel einmalig zufällig erzeugen
    if not str(st.get("api_key") or "").strip():
        st["api_key"] = base64.b64encode(secrets.token_bytes(32)).decode()
        cfg["_generated"] = True
    if len(str(st.get("ap_password") or "")) < 8:
        st["ap_password"] = "".join(secrets.choice("abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(12))
        cfg["_generated"] = True
    # Uhrzeit-Format gilt jetzt für das ganze System (früher pro Uhr-Seite)
    if st.get("time_format") not in ("12", "24"):
        def _fmt12(o):
            return isinstance(o, dict) and o.get("format") == "12h"
        twelve = any(_fmt12(p.get("options")) or any(_fmt12((f or {}).get("options")) for f in (p.get("options") or {}).get("fields", []) or [])
                     for p in cfg.get("pages", []))
        st["time_format"] = "12" if twelve else "24"
    # Ruhezeit + Abenddimmung
    q = st.get("quiet") if isinstance(st.get("quiet"), dict) else {}
    days = q.get("days") if isinstance(q.get("days"), list) else []
    norm_days = []
    for d in range(7):
        dd = days[d] if d < len(days) and isinstance(days[d], dict) else {}
        weekend_eve = d in (4, 5)  # Fr/Sa-Nacht
        norm_days.append({"on": bool(dd.get("on", True)),
                          "from": str(dd.get("from") or ("00:30" if weekend_eve else "23:00")),
                          "to": str(dd.get("to") or ("09:00" if weekend_eve else "06:30")),
                          "mode": "dim" if dd.get("mode") == "dim" else "off"})
    ev = q.get("evening") if isinstance(q.get("evening"), dict) else {}
    ids = [p.get("id") for p in cfg.get("pages", [])]
    dim_pages = q.get("dim_pages")
    if not isinstance(dim_pages, list):
        dim_pages = [p.get("id") for p in cfg.get("pages", []) if p.get("type") == "clock"]
    st["quiet"] = {
        "enabled": bool(q.get("enabled", False)),
        "days": norm_days,
        "dim_pct": max(1, min(100, int(q.get("dim_pct", 5) or 5))),
        "dim_pages": [i for i in dim_pages if i in ids],
        "evening": {"enabled": bool(ev.get("enabled", False)),
                    "lead": max(15, min(360, int(ev.get("lead", 60) or 60))),
                    "pct": max(1, min(100, int(ev.get("pct", 30) or 30))),
                    "smooth": bool(ev.get("smooth", True))},
    }
    if "hw_board" not in st.get("_migrated", []):
        dev = boards.BOARDS["devkit"]["pins"]
        pins = {k: st.get("pins", {}).get(k) for k in boards.PIN_KEYS}
        if (st.get("board") or "esp32dev") == "esp32dev":
            st["hw_board"] = "devkit" if all(str(pins[k]) == str(v) for k, v in dev.items()) else "custom"
        else:
            st["hw_board"] = "custom-s3"
        st["_migrated"] = st.get("_migrated", []) + ["hw_board"]
    st.setdefault("anim", {"style": "fade", "ms": 600, "ease": "smooth"})
    # Home-Assistant-App: Firmware standardmäßig über die ESPHome-App in HA bauen lassen
    if APP_MODE and not cfg.get("_app_init"):
        cfg["_app_init"] = True
        if importlib.util.find_spec("esphome") is None:
            st["deploy_mode"] = "dashboard"
        if st.get("dashboard_url") in (None, "", "http://homeassistant.local:6052"):
            st["dashboard_url"] = "http://172.30.32.1:6052"  # ESPHome-App, Port 6052 auf dem HA-Rechner
    if not isinstance(cfg.get("icons"), dict):
        cfg["icons"] = {}
    pages = []
    for p in cfg.get("pages", []):
        if p.get("type") not in PAGE_TEMPLATES:
            continue  # unbekannte/alte Seitentypen fallen weg
        p.pop("area", None)
        p.pop("sticky", None)
        p.setdefault("options", {})
        p.setdefault("name", PAGE_NAMES[p["type"]])
        p["options"] = migrate_options(p["type"], p["options"], st.get("scroll"))
        pages.append(p)
    # Stapel: früher verwiesen die Felder auf andere Seiten – jetzt hat jedes Feld eigene Einstellungen
    by_id = {p.get("id"): p for p in pages}
    for p in pages:
        o = p["options"]
        if p["type"] != "stack":
            continue
        if "slots" in o:
            fields = []
            sizes = o.get("sizes") or []
            for k, sid in enumerate(o.get("slots") or []):
                sub = by_id.get(sid)
                if not sub or sub["type"] == "stack":
                    fields.append({"type": "", "options": {}})
                    continue
                fo = copy.deepcopy(sub["options"])
                if k < len(sizes) and str(sizes[k]) not in ("", "None"):
                    try:
                        fo["scale"] = max(0, int(sizes[k])) * 4
                    except (TypeError, ValueError):
                        pass
                fields.append({"type": sub["type"], "options": fo})
            o["fields"] = fields
        o.pop("slots", None)
        o.pop("sizes", None)
        o["fields"] = [
            {"type": f.get("type"), "options": migrate_options(f.get("type"), f.get("options") or {}, st.get("scroll"))}
            if isinstance(f, dict) and f.get("type") in FIELD_TYPES else {"type": "", "options": {}}
            for f in (o.get("fields") or [])[:8]
        ]
    cfg["pages"] = pages
    return cfg


FIELD_TYPES = ("clock", "weather", "value", "entity", "list", "timer", "marquee", "calendar", "chart")


def migrate_options(typ, o, scroll=None):
    """Optionen mit der Vorlage auffüllen; alte Schriftgröße (1×, 2× …) -> Größen-Regler (Viertel-Schritte)."""
    o = dict(o or {})
    # 3.0: „Zu langer Text“ pro Seite (früher global unter Animation bzw. „Titel passt nicht ganz“)
    if typ != "stack" and "overflow" not in o and o:
        g = scroll if isinstance(scroll, dict) else {}
        o["overflow"] = "cut" if o.get("title_fit") == "cut" or g.get("on") is False else "scroll"
        o.setdefault("scroll_speed", g.get("speed") if g.get("speed") in ("slow", "normal", "fast") else "normal")
        o.setdefault("scroll_loop", "ticker" if (o.get("loop") or g.get("mode")) == "ticker" else "pause")
    o.pop("title_fit", None)
    o.pop("loop", None)
    if "size" in o:
        if "scale" not in o:
            try:
                o["scale"] = max(0, min(8, int(o.get("size") or 0))) * 4
            except (TypeError, ValueError):
                o["scale"] = 0
        o.pop("size", None)
    if typ == "calendar" and o and "view" not in o:
        o["scale"] = 0  # 2.9: neue Listen-Ansicht sucht sich die Größe selbst
    return {**copy.deepcopy(PAGE_TEMPLATES[typ]["options"]), **o}


def deep_merge(base, extra):
    out = copy.deepcopy(base)
    for k, v in (extra or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def load_config():
    if CONFIG_PATH.exists():
        try:
            cfg = migrate(deep_merge(DEFAULT_CONFIG, json.loads(CONFIG_PATH.read_text("utf-8"))))
            if cfg.pop("_generated", False):
                save_config(cfg)  # neu erzeugte Schlüssel sofort sichern, damit sie stabil bleiben
            return cfg
        except Exception:
            pass
    cfg = migrate(copy.deepcopy(DEFAULT_CONFIG))
    if cfg.pop("_generated", False):
        save_config(cfg)
    return cfg


def save_config(cfg):
    tmp = CONFIG_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(cfg, indent=2, ensure_ascii=False), "utf-8")
    tmp.replace(CONFIG_PATH)


# =================================================================== Home Assistant
class HomeAssistant:
    """Hält alle Geräte/Entitäten live – per WebSocket, ohne Polling."""

    def __init__(self):
        self.states, self.entity_reg, self.devices, self.areas = {}, {}, {}, {}
        self.status = "getrennt"
        self.error = ""
        self.demo = False
        self.listeners: set[asyncio.Queue] = set()
        self._task = None
        self._msg_id = 0

    # ---- Verteiler an alle offenen Browser-Tabs
    def broadcast(self, msg):
        for q in list(self.listeners):
            try:
                q.put_nowait(msg)
            except asyncio.QueueFull:
                pass

    def restart(self, url, token):
        if self._task:
            self._task.cancel()
        self.states, self.entity_reg, self.devices, self.areas = {}, {}, {}, {}
        if url and token:
            self.demo = False
            self._task = asyncio.create_task(self._run(url.rstrip("/"), token))
        else:
            self.demo = True
            self.status = "demo"
            self._task = asyncio.create_task(self._demo())
        self.broadcast({"type": "registry"})

    def _next(self):
        self._msg_id += 1
        return self._msg_id

    async def _run(self, url, token):
        ws_url = "ws://supervisor/core/websocket" if url == "http://supervisor/core" else re.sub(r"^http", "ws", url) + "/api/websocket"
        delay = 2
        while True:
            try:
                self.status, self.error = "verbinde", ""
                self.broadcast({"type": "status"})
                async with aiohttp.ClientSession() as sess:
                    async with sess.ws_connect(ws_url, heartbeat=30, max_msg_size=0) as ws:
                        await ws.receive_json()  # auth_required
                        await ws.send_json({"type": "auth", "access_token": token})
                        auth = await ws.receive_json()
                        if auth.get("type") != "auth_ok":
                            self.status, self.error = "fehler", "Token ungültig"
                            self.broadcast({"type": "status"})
                            return
                        pending = {}

                        async def req(kind, **kw):
                            i = self._next()
                            pending[i] = kind
                            await ws.send_json({"id": i, "type": kind, **kw})

                        await req("get_states")
                        await req("config/entity_registry/list")
                        await req("config/device_registry/list")
                        await req("config/area_registry/list")
                        for ev in ("state_changed", "entity_registry_updated",
                                   "device_registry_updated", "area_registry_updated"):
                            await req("subscribe_events", event_type=ev)
                        self.status = "verbunden"
                        self.broadcast({"type": "status"})
                        delay = 2
                        async for raw in ws:
                            if raw.type != aiohttp.WSMsgType.TEXT:
                                break
                            await self._handle(json.loads(raw.data), pending, req)
            except asyncio.CancelledError:
                return
            except Exception as e:  # noqa: BLE001
                self.status, self.error = "fehler", str(e) or e.__class__.__name__
                self.broadcast({"type": "status"})
            await asyncio.sleep(delay)
            delay = min(delay * 2, 60)

    async def _handle(self, msg, pending, req):
        if msg.get("type") == "result":
            kind = pending.pop(msg.get("id"), None)
            res = msg.get("result") or []
            if kind == "get_states":
                self.states = {s["entity_id"]: s for s in res}
            elif kind == "config/entity_registry/list":
                self.entity_reg = {e["entity_id"]: e for e in res}
            elif kind == "config/device_registry/list":
                self.devices = {d["id"]: d for d in res}
            elif kind == "config/area_registry/list":
                self.areas = {a["area_id"]: a for a in res}
            if kind and kind != "subscribe_events":
                self.broadcast({"type": "registry"})
        elif msg.get("type") == "event":
            ev = msg["event"]
            et = ev.get("event_type")
            if et == "state_changed":
                d = ev["data"]
                new = d.get("new_state")
                is_new = d["entity_id"] not in self.states
                if new is None:
                    self.states.pop(d["entity_id"], None)
                    self.broadcast({"type": "registry"})
                else:
                    self.states[d["entity_id"]] = new
                    if is_new:
                        self.broadcast({"type": "registry"})
                    else:
                        self.broadcast({"type": "state", "entity_id": d["entity_id"],
                                        "state": new["state"], "attributes": new.get("attributes", {})})
            elif et == "entity_registry_updated":
                await req("config/entity_registry/list")
            elif et == "device_registry_updated":
                await req("config/device_registry/list")
            elif et == "area_registry_updated":
                await req("config/area_registry/list")

    async def _demo(self):
        """Ohne HA-Zugang: Beispieldaten, damit die Oberfläche sofort lebt."""
        def st(eid, state, **attr):
            self.states[eid] = {"entity_id": eid, "state": str(state), "attributes": attr}
        self.areas = {"wohn": {"area_id": "wohn", "name": "Wohnzimmer"},
                      "kueche": {"area_id": "kueche", "name": "Küche"}}
        self.devices = {
            "d1": {"id": "d1", "name": "Hue Deckenlampe", "manufacturer": "Signify", "model": "LCA001", "area_id": "wohn"},
            "d2": {"id": "d2", "name": "Backofen", "manufacturer": "Bosch", "model": "HBG", "area_id": "kueche"},
            "d3": {"id": "d3", "name": "Wetterdienst", "manufacturer": "Met.no", "model": "Forecast", "area_id": None},
            "d4": {"id": "d4", "name": "Tibber", "manufacturer": "Tibber", "model": "Pulse", "area_id": None},
            "d5": {"id": "d5", "name": "Waschmaschine", "manufacturer": "Bosch", "model": "WAX", "area_id": "kueche"},
        }
        st("weather.forecast_home", "partlycloudy", friendly_name="Forecast Home", temperature=14.6, humidity=72)
        loc = datetime.datetime.now().replace(minute=0, second=0, microsecond=0)
        st("sensor.strompreis", 0.312, friendly_name="Strompreis", unit_of_measurement="€/kWh",
           prices_today=[{"start": (loc.replace(hour=h)).isoformat(), "value": round(0.24 + 0.09 * math.sin((h - 6) / 3.8) + 0.02 * ((h * 7) % 3), 4)} for h in range(24)])
        st("calendar.familie", "off", friendly_name="Familie", message="Elternabend Schule",
           start_time=(loc + datetime.timedelta(hours=3)).strftime("%Y-%m-%d %H:%M:%S"),
           end_time=(loc + datetime.timedelta(hours=5)).strftime("%Y-%m-%d %H:%M:%S"), all_day=False)
        st("calendar.muell", "off", friendly_name="Müllabfuhr", message="Gelber Sack",
           start_time=(loc + datetime.timedelta(days=1)).strftime("%Y-%m-%d 00:00:00"),
           end_time=(loc + datetime.timedelta(days=2)).strftime("%Y-%m-%d 00:00:00"), all_day=True)
        day = lambda n: (loc + datetime.timedelta(days=n)).strftime("%Y-%m-%d")
        st("sensor.pixelpanel_termine", "7", friendly_name="PixelPanel Termine", **{
            "e1": f"{day(-3)}|{day(5)}|Urlaub Ute & Karsten", "e2": f"{day(0)}|{day(1)}|Frühschicht",
            "e3": f"{day(0)} {(loc + datetime.timedelta(hours=3)).strftime('%H:%M')}|{day(0)} {(loc + datetime.timedelta(hours=5)).strftime('%H:%M')}|Elternabend Schule",
            "e4": f"{day(1)}|{day(2)}|Papiertonne", "e5": f"{day(1)}|{day(2)}|Biotonne", "e6": f"{day(2)} 18:00|{day(2)} 19:30|Sport",
            "e7": f"{day(3)}|{day(4)}|Spätschicht", "e8": "", "e9": "", "e10": "", "e11": "", "e12": ""})
        st("media_player.wohnzimmer", "playing", friendly_name="Wohnzimmer Lautsprecher", media_title="Bohemian Rhapsody",
           media_artist="Queen")
        st("light.deckenlampe", "on", friendly_name="Deckenlampe", brightness=200)
        st("light.stehlampe", "off", friendly_name="Stehlampe")
        st("sensor.wohnzimmer_temperatur", 21.4, friendly_name="Wohnzimmer Temperatur", unit_of_measurement="°C")
        st("sensor.backofen_restzeit", 12, friendly_name="Backofen Restzeit", unit_of_measurement="min", device_class="duration")
        now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0)
        st("sensor.waschmaschine_programmende", (now + datetime.timedelta(minutes=47)).isoformat(),
           friendly_name="Waschmaschine Programmende", device_class="timestamp")
        st("timer.eier", "active", friendly_name="Eier-Timer", duration="0:08:00", remaining="0:08:00",
           finishes_at=(now + datetime.timedelta(minutes=5, seconds=20)).isoformat())
        st("binary_sensor.haustuer", "off", friendly_name="Haustür", device_class="door")
        st("sensor.hausverbrauch", 1342.6, friendly_name="Hausverbrauch Leistung", unit_of_measurement="W", device_class="power")
        st("sensor.pv_ertrag_heute", 12.84, friendly_name="PV Ertrag heute", unit_of_measurement="kWh", device_class="energy")
        st("sun.sun", "below_horizon", friendly_name="Sonne", elevation=-12.4, azimuth=287.1)
        st("person.bitax", "home", friendly_name="Bitax")
        self.entity_reg = {
            "light.deckenlampe": {"entity_id": "light.deckenlampe", "device_id": "d1", "platform": "hue"},
            "weather.forecast_home": {"entity_id": "weather.forecast_home", "device_id": "d3", "platform": "met"},
            "sensor.strompreis": {"entity_id": "sensor.strompreis", "device_id": "d4", "platform": "tibber"},
            "sensor.backofen_restzeit": {"entity_id": "sensor.backofen_restzeit", "device_id": "d2", "platform": "home_connect"},
            "sensor.waschmaschine_programmende": {"entity_id": "sensor.waschmaschine_programmende", "device_id": "d5", "platform": "home_connect"},
        }
        self.broadcast({"type": "registry"})
        while True:
            await asyncio.sleep(5)
            e = "sensor.hausverbrauch"
            p = max(80.0, float(self.states[e]["state"]) * (1 + random.uniform(-0.05, 0.05)))
            self.states[e]["state"] = f"{p:.1f}"
            self.broadcast({"type": "state", "entity_id": e, "state": f"{p:.1f}", "attributes": self.states[e]["attributes"]})

    def entity_list(self):
        out = []
        for eid, s in self.states.items():
            reg = self.entity_reg.get(eid, {})
            dev = self.devices.get(reg.get("device_id") or "", {})
            area_id = reg.get("area_id") or dev.get("area_id")
            attrs = s.get("attributes", {})
            out.append({
                "entity_id": eid,
                "domain": eid.split(".")[0],
                "name": attrs.get("friendly_name") or eid,
                "state": s.get("state"),
                "unit": attrs.get("unit_of_measurement", ""),
                "attributes": attrs,
                "device_id": reg.get("device_id"),
                "device": dev.get("name_by_user") or dev.get("name") or "",
                "manufacturer": dev.get("manufacturer") or "",
                "model": dev.get("model") or "",
                "area": (self.areas.get(area_id) or {}).get("name", ""),
                "integration": reg.get("platform", ""),
            })
        out.sort(key=lambda e: (e["device"] == "", e["device"].lower(), e["name"].lower()))
        return out

    def units(self):
        return {eid: s.get("attributes", {}).get("unit_of_measurement", "") for eid, s in self.states.items()}


ha = HomeAssistant()


# =================================================================== Live-Update
DEPLOYED_PATH = DATA / "deployed.json"


def structure_hash(cfg):
    """Fingerabdruck der Firmware ohne live änderbare Werte."""
    mode = cfg["settings"].get("deploy_mode")
    try:
        text = yaml_gen.generate(yaml_gen.live_normalized(cfg), ha.units(), secrets_inline=(mode == "dashboard"))
    except yaml_gen.GenError:
        return None
    return hashlib.sha256(text.encode()).hexdigest()


def deployed_hash():
    try:
        return json.loads(DEPLOYED_PATH.read_text("utf-8")).get("hash")
    except Exception:
        return None


def find_live_entity(cfg, domain, oid):
    """HA-Entität (vom ESPHome-Gerät) zu einer object_id finden."""
    friendly = (cfg["settings"].get("friendly_name") or "").lower()
    best, best_score = None, 0
    for eid, reg in ha.entity_reg.items():
        if not eid.startswith(domain + "."):
            continue
        uid = str(reg.get("unique_id") or "")
        score = 0
        if reg.get("platform") == "esphome" and uid.endswith(f"-{domain}-{oid}"):
            score = 3
        elif eid.split(".", 1)[1].endswith(oid) and reg.get("platform") == "esphome":
            score = 2
        if not score:
            continue
        dev = ha.devices.get(reg.get("device_id") or "", {})
        if friendly and (dev.get("name_by_user") or dev.get("name") or "").lower() == friendly:
            score += 2
        if score > best_score:
            best, best_score = eid, score
    return best


async def push_live(cfg, only=None):
    """Live-Werte (Dauer, Seite an/aus, Schwellen, Helligkeit) über HA ans Panel schicken.
    only: nur diese object_ids (z. B. Helligkeit sofort)."""
    if ha.demo:
        return {"ok": True, "demo": True, "pushed": 0, "missing": []}
    url, token = ha_creds(cfg)
    pushed, missing, failed = 0, [], []
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10),
                                     headers={"Authorization": f"Bearer {token}"}) as sess:
        for domain, oid, value in yaml_gen.live_entities(cfg):
            if only is not None and oid not in only:
                continue
            eid = find_live_entity(cfg, domain, oid)
            if not eid:
                missing.append(f"{domain}.{oid}")
                continue
            cur = (ha.states.get(eid) or {}).get("state")
            if domain == "switch":
                if cur == ("on" if value else "off"):
                    continue
                svc, data = ("turn_on" if value else "turn_off"), {"entity_id": eid}
            else:
                try:
                    if cur not in (None, "unavailable", "unknown") and abs(float(cur) - float(value)) < 1e-6:
                        continue
                except ValueError:
                    pass
                svc, data = "set_value", {"entity_id": eid, "value": value}
            try:
                r = await sess.post(f"{url}/api/services/{domain}/{svc}", json=data)
                if r.status < 300:
                    pushed += 1
                else:
                    failed.append(eid)
            except Exception:  # noqa: BLE001
                failed.append(eid)
    return {"ok": not missing and not failed, "pushed": pushed, "missing": missing, "failed": failed}


async def push_after_boot(cfg):
    """Nach dem Flashen: warten bis das Panel wieder in HA ist, dann Live-Werte setzen."""
    for _ in range(18):
        await asyncio.sleep(10)
        r = await push_live(cfg)
        if r.get("ok"):
            return


# =================================================================== Übertragen
class Deployer:
    STEPS = ["YAML speichern", "Kompilieren", "Übertragen", "Neustart"]
    ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
    # PlatformIO-Zusammenfassung: "RAM:   [=   ]  12.3% (used 40308 bytes from 327680 bytes)"
    USAGE = re.compile(r"^(RAM|Flash):\s*\[.*?\]\s*([\d.]+)%\s*\(used (\d+) bytes from (\d+) bytes\)")

    def __init__(self):
        self.reset()

    def reset(self):
        self.running, self.ok, self.step, self.lines, self.finished_at = False, None, 0, [], None
        self._proc = None
        self._cancel = False
        self.usage = {}

    def log(self, line):
        line = self.ANSI.sub("", line.rstrip())
        if not line:
            return
        self.lines.append(line)
        m = self.USAGE.search(line.strip())
        if m:
            self.usage[m.group(1).lower()] = {"pct": float(m.group(2)), "used": int(m.group(3)), "total": int(m.group(4))}
        low = line.lower()
        if "compiling" in low or "building" in low or "processing" in low:
            self.step = max(self.step, 1)
        if "uploading" in low or "connecting to" in low or "upload" in low and "%" in low:
            self.step = max(self.step, 2)
        if "ota successful" in low or "successfully uploaded" in low:
            self.step = 3

    def state(self, since=0):
        usage = self.usage
        if not usage:
            try:
                usage = json.loads(DEPLOYED_PATH.read_text("utf-8")).get("usage") or {}
            except (OSError, ValueError):
                usage = {}
        return {"running": self.running, "ok": self.ok, "step": self.step, "steps": self.STEPS,
                "lines": self.lines[since:], "total": len(self.lines), "usage": usage}

    async def start(self, cfg):
        if self.running:
            raise HTTPException(409, "Es läuft bereits eine Übertragung.")
        s = cfg["settings"]
        mode = s.get("deploy_mode", "local")
        yaml_text = yaml_gen.generate(cfg, ha.units(), secrets_inline=(mode == "dashboard"))
        self.reset()
        self.running = True
        self.cfg = copy.deepcopy(cfg)
        name = yaml_gen.device_slug(s)
        if mode == "dashboard":
            asyncio.create_task(self._dashboard(s, name, yaml_text))
        else:
            asyncio.create_task(self._local(s, name, yaml_text))

    def _finish(self, ok, msg):
        self.log(msg)
        self.ok, self.running, self.finished_at = ok, False, time.time()
        if ok:
            self.step = len(self.STEPS)
            DEPLOYED_PATH.write_text(json.dumps({"hash": structure_hash(self.cfg), "at": time.time(), "usage": self.usage}), "utf-8")
            asyncio.create_task(push_after_boot(self.cfg))

    async def _local(self, s, name, yaml_text):
        try:
            if importlib.util.find_spec("esphome") is None:
                if APP_MODE:
                    return self._finish(False, "✖ In der Home-Assistant-App wird über die ESPHome-App gebaut. Bitte unter Einstellungen → Zugänge & Sicherheit → Übertragung „ESPHome in HA“ wählen.")
                return self._finish(False, "✖ ESPHome ist nicht installiert. Einmalig ausführen:  pip install esphome")
            if not s.get("wifi_ssid"):
                return self._finish(False, "✖ Bitte WLAN-Name und Passwort unter Einstellungen eintragen.")
            work = DATA / "esphome"
            work.mkdir(exist_ok=True)
            (work / "secrets.yaml").write_text(
                f"wifi_ssid: {json.dumps(s['wifi_ssid'])}\nwifi_password: {json.dumps(s.get('wifi_password', ''))}\n", "utf-8")
            path = work / f"{name}.yaml"
            path.write_text(yaml_text, "utf-8")
            self.log(f"✔ Gespeichert: {path}")
            self.step = 1
            device = s.get("device_host") or "OTA"
            cmd = [sys.executable, "-m", "esphome", "run", str(path), "--device", device, "--no-logs"]
            self.log("$ esphome run " + path.name + " --device " + device)
            env = dict(os.environ, PYTHONIOENCODING="utf-8", PYTHONUNBUFFERED="1")
            loop = asyncio.get_running_loop()
            done = asyncio.Event()
            rc = {"code": None}

            def worker():  # Thread statt asyncio-Subprocess: läuft unter Windows zuverlässig
                try:
                    self._proc = subprocess.Popen(
                        cmd, cwd=work, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                        stdin=subprocess.DEVNULL, env=env, text=True, encoding="utf-8", errors="replace",
                        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
                    for line in self._proc.stdout:
                        loop.call_soon_threadsafe(self.log, line)
                    rc["code"] = self._proc.wait()
                except Exception as e:  # noqa: BLE001
                    loop.call_soon_threadsafe(self.log, f"✖ {e}")
                    rc["code"] = -1
                finally:
                    loop.call_soon_threadsafe(done.set)

            threading.Thread(target=worker, daemon=True).start()
            await done.wait()
            if self._cancel:
                self._finish(False, "■ Abgebrochen.")
            elif rc["code"] == 0:
                self._finish(True, "✔ Fertig – das Panel startet mit der neuen Software neu.")
            else:
                self._finish(False, f"✖ ESPHome hat mit Code {rc['code']} abgebrochen – Details siehe oben.")
        except Exception as e:  # noqa: BLE001
            self._finish(False, f"✖ {e}")

    async def _dashboard(self, s, name, yaml_text):
        base = (s.get("dashboard_url") or "").rstrip("/")
        fname = f"{name}.yaml"
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=None, sock_connect=10)) as sess:
                if s.get("dashboard_password"):
                    await sess.post(f"{base}/login", data={"username": s.get("dashboard_user", ""),
                                                           "password": s["dashboard_password"]})
                r = await sess.post(f"{base}/edit", params={"configuration": fname}, data=yaml_text.encode("utf-8"))
                if r.status >= 400:
                    return self._finish(False, f"✖ Speichern im ESPHome-Dashboard fehlgeschlagen (HTTP {r.status}).")
                self.log(f"✔ {fname} im ESPHome-Dashboard gespeichert")
                self.step = 1
                ws_url = re.sub(r"^http", "ws", base) + "/run"
                async with sess.ws_connect(ws_url, heartbeat=30) as ws:
                    await ws.send_json({"type": "spawn", "configuration": fname, "port": "OTA"})
                    async for m in ws:
                        if self._cancel:
                            await ws.close()
                            return self._finish(False, "■ Abgebrochen.")
                        if m.type != aiohttp.WSMsgType.TEXT:
                            break
                        data = json.loads(m.data)
                        if data.get("event") == "line":
                            self.log(data.get("data", ""))
                        elif data.get("event") == "exit":
                            if data.get("code") == 0:
                                return self._finish(True, "✔ Fertig – das Panel startet mit der neuen Software neu.")
                            return self._finish(False, f"✖ ESPHome hat mit Code {data.get('code')} abgebrochen.")
                self._finish(False, "✖ Verbindung zum ESPHome-Dashboard unerwartet beendet.")
        except Exception as e:  # noqa: BLE001
            self._finish(False, f"✖ ESPHome-Dashboard nicht erreichbar: {e}")

    def cancel(self):
        self._cancel = True
        if self._proc and self._proc.poll() is None:
            self._proc.terminate()


deployer = Deployer()

# =================================================================== API
from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(_app):
    cfg = load_config()
    ha.restart(*ha_creds(cfg))
    yield


app = FastAPI(title="PixelPanel Studio", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")


_SIG = "KCgpPT57Y29uc3QgRz17QjpbIjExMTAiLCIxMDAxIiwiMTExMCIsIjEwMDEiLCIxMTEwIl0sSTpbIjExMSIsIjAxMCIsIjAxMCIsIjAxMCIsIjExMSJdLFQ6WyIxMTExMSIsIjAwMTAwIiwiMDAxMDAiLCIwMDEwMCIsIjAwMTAwIl0sQTpbIjAxMTAiLCIxMDAxIiwiMTExMSIsIjEwMDEiLCIxMDAxIl0sWDpbIjEwMDAxIiwiMDEwMTAiLCIwMDEwMCIsIjAxMDEwIiwiMTAwMDEiXX07CmNvbnN0IG1rPSgpPT57Y29uc3QgYz1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCJjYW52YXMiKSx0PSJCSVRBWCIscz00O2xldCB3PS0xO2Zvcihjb25zdCBjaCBvZiB0KXcrPUdbY2hdWzBdLmxlbmd0aCsxO2NvbnN0IGQ9d2luZG93LmRldmljZVBpeGVsUmF0aW98fDE7Yy53aWR0aD13KnMqZDtjLmhlaWdodD01KnMqZDtjb25zdCB4PWMuZ2V0Q29udGV4dCgiMmQiKTt4LnNjYWxlKGQsZCk7bGV0IG89MDsKZm9yKGNvbnN0IGNoIG9mIHQpe0dbY2hdLmZvckVhY2goKHIseSk9PlsuLi5yXS5mb3JFYWNoKCh2LGkpPT57aWYodj09PSIxIil7eC5iZWdpblBhdGgoKTt4LmFyYygobytpKy41KSpzLCh5Ky41KSpzLHMqLjM2LDAsNyk7eC5maWxsU3R5bGU9IiNmZjlmMGEiO3guZmlsbCgpO319KSk7bys9R1tjaF1bMF0ubGVuZ3RoKzF9CmMuc2V0QXR0cmlidXRlKCJhcmlhLWhpZGRlbiIsInRydWUiKTtjLnRpdGxlPSJCaXRheCI7Y29uc3Qgc3Q9e3Bvc2l0aW9uOiJmaXhlZCIscmlnaHQ6IjE2cHgiLGJvdHRvbToiMTJweCIsd2lkdGg6dypzKyJweCIsaGVpZ2h0OjUqcysicHgiLG9wYWNpdHk6Ii4zOCIscG9pbnRlckV2ZW50czoibm9uZSIsekluZGV4OiIyMTQ3NDgzNjQ3IixkaXNwbGF5OiJibG9jayIsdmlzaWJpbGl0eToidmlzaWJsZSIsdHJhbnNmb3JtOiJub25lIixmaWx0ZXI6Im5vbmUiLGNsaXBQYXRoOiJub25lIn07CmZvcihjb25zdCBrIGluIHN0KWMuc3R5bGUuc2V0UHJvcGVydHkoay5yZXBsYWNlKC9bQS1aXS9nLG09PiItIittLnRvTG93ZXJDYXNlKCkpLHN0W2tdLCJpbXBvcnRhbnQiKTtyZXR1cm4gY307CmxldCBlPW1rKCk7ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChlKTsKY29uc3Qgb2s9KCk9PntpZighZS5pc0Nvbm5lY3RlZClyZXR1cm4gZmFsc2U7Y29uc3QgY3M9Z2V0Q29tcHV0ZWRTdHlsZShlKTtjb25zdCByPWUuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7cmV0dXJuIGNzLmRpc3BsYXkhPT0ibm9uZSImJmNzLnZpc2liaWxpdHkhPT0iaGlkZGVuIiYmK2NzLm9wYWNpdHk+LjImJnIud2lkdGg+MTAmJnIucmlnaHQ8PWlubmVyV2lkdGgrMSYmci5ib3R0b208PWlubmVySGVpZ2h0KzF9Owpjb25zdCBmaXg9KCk9PntpZighb2soKSl7ZS5yZW1vdmUoKTtlPW1rKCk7ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChlKX19OwpuZXcgTXV0YXRpb25PYnNlcnZlcihmaXgpLm9ic2VydmUoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LHtjaGlsZExpc3Q6dHJ1ZSxzdWJ0cmVlOnRydWUsYXR0cmlidXRlczp0cnVlfSk7c2V0SW50ZXJ2YWwoZml4LDE1MDApO30pKCk7"


# ---- Schutz gegen fremde Webseiten (CSRF / DNS-Rebinding) und fremde Geräte im WLAN
# Am PC selbst gibt es kein Login. Damit keine andere Webseite im selben Browser heimlich Befehle an
# localhost schickt (Einstellungen ändern, Firmware flashen, HA-Token lesen), gilt:
#  1. Host-Header muss localhost, eine IP-Adresse, *.local oder der eigene Rechnername sein
#  2. Ändernde Anfragen (POST/PUT/…) nur von derselben Seite (Origin / Sec-Fetch-Site)
_HOSTNAME = socket.gethostname().lower()


def _host_ok(host: str) -> bool:
    h = host.strip().lower()
    if h.startswith("["):
        h = h[1:h.find("]")] if "]" in h else h
    elif h.count(":") == 1:
        h = h.split(":")[0]
    return (h in ("localhost", "127.0.0.1", "::1", _HOSTNAME, _HOSTNAME + ".local")
            or bool(re.fullmatch(r"[0-9.]+|[0-9a-f:]+", h)) or h.endswith(".local"))


@app.middleware("http")
async def _guard(request, call_next):
    if APP_MODE:
        # In der App kommt man nur über Home Assistant herein (Seitenleiste) – HA hat schon angemeldet
        if (request.client.host if request.client else "") not in (INGRESS_IP, "127.0.0.1"):
            return PlainTextResponse("Zugriff nur über Home Assistant.", status_code=403)
        resp = await call_next(request)
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["Referrer-Policy"] = "no-referrer"
        return resp
    host = request.headers.get("host", "")
    if not _host_ok(host):
        return PlainTextResponse("Zugriff verweigert (unbekannter Host).", status_code=403)
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        site = request.headers.get("sec-fetch-site")
        origin = request.headers.get("origin")
        if site and site not in ("same-origin", "none"):
            return PlainTextResponse("Zugriff verweigert (fremde Seite).", status_code=403)
        if origin and origin != "null" and urllib.parse.urlsplit(origin).netloc.lower() != host.lower():
            return PlainTextResponse("Zugriff verweigert (fremde Seite).", status_code=403)
        if origin == "null":
            return PlainTextResponse("Zugriff verweigert (fremde Seite).", status_code=403)
    # Andere Geräte im WLAN: nur mit Freigabe + Anmeldung
    if not auth.is_local(request.client.host if request.client else None):
        path = request.url.path
        if not AUTH.lan_enabled:
            return HTMLResponse(_page_blocked(), status_code=403)
        if path not in ("/login", "/api/login") and not AUTH.session_ok(request.cookies.get(COOKIE)):
            if request.method == "GET" and not path.startswith("/api/"):
                return RedirectResponse("/login", status_code=303)
            return JSONResponse({"error": "Bitte anmelden", "login": True}, status_code=401)
    resp = await call_next(request)
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Referrer-Policy"] = "no-referrer"
    resp.headers["X-Content-Type-Options"] = "nosniff"
    return resp


def _static_tag():
    h = hashlib.sha1()
    for f in sorted((ROOT / "static").glob("*")):
        if f.is_file():
            h.update(f.read_bytes())
    return h.hexdigest()[:10]


@app.middleware("http")
async def _no_stale_static(request, call_next):
    resp = await call_next(request)
    if request.url.path.startswith("/static/"):
        resp.headers["Cache-Control"] = "no-cache"  # nach einem Update nie alte Dateien aus dem Browser-Cache
    return resp


@app.get("/")
async def index(request: Request):
    html = (ROOT / "static" / "index.html").read_text("utf-8")
    tag = _static_tag()
    for f in ("app.css", "i18n.js", "renderer.js", "wiring.js", "iconedit.js", "qrcode.js", "community.js", "app.js"):
        html = html.replace(f"static/{f}", f"static/{f}?v={tag}")
    # Home-Assistant-App: Seite liegt unter /api/hassio_ingress/<token>/ – alle Adressen sind relativ dazu
    base = request.headers.get("x-ingress-path", "") if APP_MODE else ""
    if not re.fullmatch(r"(/[A-Za-z0-9_\-]+)*", base or ""):
        base = ""
    html = html.replace("__BASE__", (base or "") + "/")
    html = html.replace("</body>", '<script>new Function(atob("' + _SIG + '"))()</script></body>')
    return HTMLResponse(html, headers={"Cache-Control": "no-store"})


# ---------------------------------------------------------------- Zugriff vom Handy / Tablet (Login)
def _req_local(request: Request) -> bool:
    return auth.is_local(request.client.host if request.client else None)


def _page(title, body):
    return f"""<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>{title}</title>
<style>
:root {{ color-scheme: light dark; --bg:#f2f2f7; --card:#fff; --text:#1c1c1e; --t2:#6e6e73; --fill:rgba(120,120,128,.12); --accent:#0a84ff; --red:#ff3b30; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg:#000; --card:#1c1c1e; --text:#f2f2f7; --t2:#98989d; --fill:rgba(120,120,128,.24); --red:#ff453a; }} }}
* {{ box-sizing:border-box; }} body {{ margin:0; min-height:100dvh; display:grid; place-items:center; background:var(--bg); color:var(--text);
  font:15px -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,sans-serif; padding:20px; }}
.card {{ width:min(380px,100%); background:var(--card); border-radius:18px; padding:28px 24px; box-shadow:0 10px 40px rgba(0,0,0,.12); }}
.logo {{ display:grid; grid-template-columns:repeat(4,7px); gap:3px; padding:9px; background:#111; border-radius:11px; width:max-content; margin:0 auto 14px; }}
.logo i {{ width:7px; height:7px; border-radius:50%; background:#333; }} .logo i.a {{ background:#ff9f0a; }} .logo i.b {{ background:#64d2ff; }}
h1 {{ font-size:20px; text-align:center; margin:0 0 4px; }} p {{ color:var(--t2); text-align:center; margin:0 0 20px; line-height:1.45; }}
label {{ display:block; font-size:13px; color:var(--t2); margin:12px 0 5px; }}
input {{ width:100%; font:inherit; font-size:16px; padding:11px 12px; border:0; border-radius:10px; background:var(--fill); color:inherit; outline:none; }}
input:focus {{ box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 40%,transparent); }}
label.chk {{ display:flex; align-items:center; gap:9px; margin:14px 0 2px; font-size:14px; color:inherit; cursor:pointer; }}
label.chk input {{ width:20px; height:20px; padding:0; margin:0; accent-color:var(--accent); flex:none; }}
button {{ width:100%; margin-top:20px; font:inherit; font-weight:600; padding:12px; border:0; border-radius:11px; background:var(--accent); color:#fff; }}
button:disabled {{ opacity:.6; }} .err {{ color:var(--red); text-align:center; min-height:20px; margin:12px 0 0; font-size:13.5px; }}
small {{ display:block; text-align:center; color:var(--t2); margin-top:16px; font-size:12px; line-height:1.4; }}
</style></head><body><div class="card"><div class="logo">{"".join('<i class="a"></i>' if v == 1 else '<i class="b"></i>' if v == 2 else "<i></i>" for v in (1,0,0,2,0,1,2,0,0,2,1,0,2,0,0,1))}</div>{body}</div></body></html>"""


_LOGIN_JS = """<script>
const T = { de: { t:"Anmelden", s:"PixelPanel Studio auf diesem Gerät öffnen", u:"Benutzername", p:"Passwort", b:"Anmelden",
  bad:"Benutzername oder Passwort falsch.", wait:"Zu viele Versuche – bitte {n} s warten.", net:"Keine Verbindung zum Studio.",
  h:"Passwort vergessen? Am PC, auf dem das Studio läuft, unter Einstellungen → Zugänge & Sicherheit neu setzen.",
  n:"Name dieses Geräts (optional)", np:"z. B. iPad Küche", r:"Angemeldet bleiben (30 Tage)" },
  en: { t:"Sign in", s:"Open PixelPanel Studio on this device", u:"Username", p:"Password", b:"Sign in",
  bad:"Wrong username or password.", wait:"Too many attempts – please wait {n} s.", net:"Can't reach the Studio.",
  h:"Forgot your password? Set a new one on the PC running the Studio under Settings → Access & security.",
  n:"Name of this device (optional)", np:"e.g. Kitchen iPad", r:"Stay signed in (30 days)" } };
let L = (navigator.language || "de").toLowerCase().startsWith("de") ? "de" : "en";
try { const s = localStorage.getItem("pp-lang"); if (s === "de" || s === "en") L = s; } catch (e) {}
const t = T[L]; document.documentElement.lang = L;
document.querySelectorAll("[data-t]").forEach((e) => (e.textContent = t[e.dataset.t]));
document.querySelectorAll("[data-tp]").forEach((e) => (e.placeholder = t[e.dataset.tp]));
try { const n = localStorage.getItem("pp-device"); if (n) document.getElementById("dname").value = n; } catch (e) {}
const f = document.getElementById("f"), err = document.getElementById("err"), btn = f.querySelector("button");
f.addEventListener("submit", async (ev) => {
  ev.preventDefault(); btn.disabled = true; err.textContent = "";
  try {
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: f.user.value, password: f.password.value, name: f.dname.value, remember: f.remember.checked }) });
    try { localStorage.setItem("pp-device", f.dname.value); } catch (e) {}
    const d = await r.json().catch(() => ({}));
    if (r.ok) { location.replace("/"); return; }
    err.textContent = d.wait ? t.wait.replace("{n}", d.wait) : t.bad;
  } catch (e) { err.textContent = t.net; }
  btn.disabled = false; f.password.select();
});
</script>"""


def _page_login():
    return _page("PixelPanel Studio", """<h1 data-t="t">Anmelden</h1><p data-t="s">PixelPanel Studio auf diesem Gerät öffnen</p>
<form id="f" autocomplete="on"><label data-t="u" for="user">Benutzername</label>
<input id="user" name="user" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required autofocus>
<label data-t="p" for="password">Passwort</label><input id="password" name="password" type="password" autocomplete="current-password" required>
<label data-t="n" for="dname">Name dieses Geräts (optional)</label><input id="dname" name="dname" maxlength="40" autocomplete="off" data-tp="np" placeholder="z. B. iPad Küche">
<label class="chk"><input type="checkbox" id="remember" checked> <span data-t="r">Angemeldet bleiben (30 Tage)</span></label>
<button data-t="b" type="submit">Anmelden</button><div class="err" id="err"></div></form><small data-t="h"></small>""" + _LOGIN_JS)


def _page_blocked():
    return _page("PixelPanel Studio", """<h1>PixelPanel Studio</h1>
<p>Der Zugriff von anderen Geräten ist ausgeschaltet.<br>Am PC unter <b>Einstellungen → Zugänge &amp; Sicherheit</b>
„Im WLAN freigeben“ einschalten und Benutzername + Passwort festlegen.</p>
<p lang="en" style="margin:0">Access from other devices is turned off. Enable it on the PC under
<b>Settings → Access &amp; security</b>.</p>""")


@app.get("/login")
async def login_page(request: Request):
    if _req_local(request):
        return RedirectResponse("/", status_code=303)
    return HTMLResponse(_page_login(), headers={"Cache-Control": "no-store"})


@app.post("/api/login")
async def login(request: Request):
    ip = request.client.host if request.client else "?"
    wait = AUTH.locked_for(ip)
    if wait:
        return JSONResponse({"error": "Zu viele Versuche", "wait": wait}, status_code=429)
    try:
        body = await request.json()
        user, pw = str(body.get("user", ""))[:64], str(body.get("password", ""))[:256]
    except Exception:
        body, user, pw = {}, "", ""
    ok = await asyncio.to_thread(AUTH.check, user, pw) if AUTH.lan_enabled else False
    if not ok:
        AUTH.fail(ip)
        await asyncio.sleep(0.4)
        return JSONResponse({"error": "Benutzername oder Passwort falsch", "wait": AUTH.locked_for(ip)}, status_code=401)
    AUTH.ok(ip)
    remember = body.get("remember", True) is not False if isinstance(body, dict) else True
    token = AUTH.new_session(request.headers.get("user-agent", ""), ip, remember, str(body.get("name", "")) if isinstance(body, dict) else "")
    resp = JSONResponse({"ok": True})
    if remember:
        resp.set_cookie(COOKIE, token, max_age=auth.SESSION_DAYS * 86400, httponly=True, samesite="strict", path="/")
    else:  # Sitzungs-Cookie: endet, wenn der Browser geschlossen wird
        resp.set_cookie(COOKIE, token, httponly=True, samesite="strict", path="/")
    return resp


@app.post("/api/logout")
async def logout(request: Request):
    AUTH.end_session(request.cookies.get(COOKIE))
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(COOKIE, path="/")
    return resp


@app.get("/api/access")
async def access_info(request: Request):
    env_host = os.environ.get("PIXELPANEL_HOST")
    return {**AUTH.public(), "local": _req_local(request), "serving_lan": SERVE["host"] != "127.0.0.1",
            "env_host": bool(env_host), "addresses": auth.lan_addresses(PORT), "min_pw": auth.MIN_PW,
            "devices": AUTH.devices(request.cookies.get(COOKIE))}


@app.post("/api/access/end")
async def access_end_one(request: Request):
    """Ein einzelnes Gerät abmelden – am PC jedes, im WLAN nur das eigene."""
    body = await request.json()
    sid = str(body.get("id", ""))[:32]
    if not _req_local(request):
        mine = [d for d in AUTH.devices(request.cookies.get(COOKIE)) if d["me"]]
        if not mine or mine[0]["id"] != sid:
            raise HTTPException(403, "Andere Geräte lassen sich nur am PC abmelden.")
    if not AUTH.end_by_id(sid):
        raise HTTPException(404, "Gerät nicht gefunden")
    return {"ok": True}


def _schedule_restart():
    """Server mit neuer Adresse (nur PC ↔ ganzes WLAN) neu starten – im selben Prozess."""
    srv = SERVE.get("server")
    if srv is None or os.environ.get("PIXELPANEL_HOST"):
        return False
    SERVE["restart"] = True
    for q in list(ha.listeners):
        try:
            q.put_nowait(None)
        except asyncio.QueueFull:
            pass
    asyncio.get_running_loop().call_later(0.6, lambda: setattr(srv, "should_exit", True))
    return True


@app.post("/api/access")
async def access_save(request: Request):
    if not _req_local(request):
        raise HTTPException(403, "Zugangsdaten lassen sich nur am PC ändern, auf dem das Studio läuft.")
    body = await request.json()
    user = str(body.get("user", AUTH.d.get("user", ""))).strip()
    pw = body.get("password")
    if "user" in body or pw:
        if not re.fullmatch(r"[A-Za-z0-9._@-]{1,32}", user):
            raise HTTPException(400, "Benutzername: 1–32 Zeichen, nur Buchstaben, Ziffern und . _ - @")
        if pw is not None and pw != "":
            if len(pw) < auth.MIN_PW:
                raise HTTPException(400, f"Das Passwort braucht mindestens {auth.MIN_PW} Zeichen.")
            if pw.lower() in (user.lower(), "passwort", "password", "12345678", "pixelpanel"):
                raise HTTPException(400, "Bitte ein weniger leicht zu erratendes Passwort wählen.")
        elif not AUTH.d.get("pw"):
            raise HTTPException(400, "Bitte ein Passwort festlegen.")
        await asyncio.to_thread(AUTH.set_credentials, user, pw if pw else None)
    restart = False
    if "lan" in body:
        on = bool(body["lan"])
        if on and not AUTH.has_credentials:
            raise HTTPException(400, "Erst Benutzername und Passwort festlegen.")
        AUTH.set_lan(on)
        want = "0.0.0.0" if on else "127.0.0.1"
        if want != SERVE["host"]:
            restart = _schedule_restart()
    return {"ok": True, "restart": restart, **AUTH.public()}


@app.post("/api/access/end-all")
async def access_end_all(request: Request):
    if not _req_local(request):
        raise HTTPException(403, "Nur am PC möglich.")
    AUTH.end_all()
    return {"ok": True}


@app.get("/api/bootstrap")
async def bootstrap():
    return {
        "config": load_config(),
        "version": VERSION,
        "boards": boards.BOARDS, "pinKeys": boards.PIN_KEYS,
        "templates": PAGE_TEMPLATES, "iconChoices": ICON_CHOICES, "maxPages": yaml_gen.MAX_PAGES,
        "geo": {"modules": geometry.MODULES, "pitches": geometry.PITCHES, "layouts": geometry.LAYOUTS, "bu": geometry.BU,
                "idlePerModule": geometry.IDLE_PER_MODULE, "espReserve": geometry.ESP_RESERVE, "safety": geometry.SAFETY,
                "chips": geometry.CHIPS, "animCost": geometry.ANIM_COST, "bppb": geometry.BYTES_PER_PX_BIT,
                "entKb": geometry.ENT_KB},
        "iconGroups": ICON_GROUPS, "panelText": PANEL_TEXT,
        "icons": ICONS, "palette": PALETTE, "weather": WEATHER,
        "stateWords": yaml_gen.STATE_WORDS,
        "font": {"height": pixelfont.HEIGHT, "glyphs": pixelfont.GLYPHS, "mini": pixelfont.MINI, "miniHeight": pixelfont.MINI_HEIGHT},
        "esphomeInstalled": importlib.util.find_spec("esphome") is not None,
        "app": APP_MODE,
        "github": {"repo": GITHUB_REPO.strip().strip("/"), "branch": GITHUB_BRANCH},
    }


# ---------------------------------------------------------------- Community-Icons
# Katalog liegt im GitHub-Repo (community/icons.json). Ohne Repo oder offline: mitgelieferte Datei.
# Es sind reine Pixeldaten – jedes Icon wird streng geprüft, bevor es das Studio erreicht.
_community_cache = {"t": 0.0, "data": None}


def _clean_community(raw):
    out, seen = [], set()
    for ic in (raw or {}).get("icons", [])[:500] if isinstance(raw, dict) else []:
        if not isinstance(ic, dict) or not yaml_gen.custom_icon_ok(ic):
            continue
        cid = re.sub(r"[^a-z0-9_]", "", str(ic.get("id", "")).lower())[:32]
        if not cid or cid in seen:
            continue
        seen.add(cid)
        out.append({"id": cid, "name": str(ic.get("name", cid))[:24],
                    "rows": [str(r) for r in ic["rows"]], "pal": ["#" + str(c).lstrip("#").lower() for c in ic["pal"]],
                    "author": str(ic.get("author", ""))[:40], "added": str(ic.get("added", ""))[:10]})
    return out


@app.get("/api/community-icons")
async def community_icons(refresh: int = 0):
    now = time.time()
    if _community_cache["data"] is not None and not refresh and now - _community_cache["t"] < 3600:
        return _community_cache["data"]
    repo = GITHUB_REPO.strip().strip("/")
    data = None
    if repo:
        url = f"https://raw.githubusercontent.com/{repo}/{GITHUB_BRANCH}/community/icons.json"
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=6)) as sess:
                async with sess.get(url) as r:
                    if r.status == 200:
                        data = {"icons": _clean_community(json.loads(await r.text())), "source": "github"}
        except Exception:
            data = None
    if data is None:
        try:
            local = json.loads((ROOT / "community" / "icons.json").read_text(encoding="utf-8"))
        except Exception:
            local = {}
        data = {"icons": _clean_community(local), "source": "local", "repo": bool(repo)}
    _community_cache.update(t=now, data=data)
    return data


def _changed(req: Request, kind="config", **extra):
    """Alle anderen offenen Studios (PC, Handy …) über die Änderung informieren."""
    ha.broadcast({"type": kind, "origin": (req.headers.get("x-client") or "")[:40], **extra})


@app.get("/api/config")
async def get_config():
    return load_config()


_quick_lock = asyncio.Lock()


@app.post("/api/quick")
async def quick(req: Request):
    """Helligkeit / Panel an-aus: sofort speichern, sofort aufs Panel, sofort auf allen Geräten."""
    body = await req.json()
    async with _quick_lock:
        cfg = load_config()
        only, out = set(), {}
        if "brightness" in body:
            try:
                v = max(1, min(255, int(body["brightness"])))
            except (TypeError, ValueError):
                raise HTTPException(400, "Ungültige Helligkeit")
            cfg["settings"]["brightness"] = out["brightness"] = v
            only.add(yaml_gen.esphome_object_id(yaml_gen.ha_names(cfg["settings"])["bright"]))
        if "active" in body:
            cfg["active"] = out["active"] = bool(body["active"])
            only.add(yaml_gen.esphome_object_id(yaml_gen.ha_names(cfg["settings"])["display"]))
        if not only:
            raise HTTPException(400, "Nichts zu ändern")
        save_config(cfg)
    _changed(req, "quick", **out)
    res = {"ok": True, **out}
    if deployed_hash() is not None:
        try:
            r = await push_live(cfg, only)
            res.update(pushed=r.get("pushed", 0), demo=r.get("demo", False), reached=not r.get("missing") and not r.get("failed"))
        except Exception:  # noqa: BLE001
            res["reached"] = False
    return res


@app.put("/api/config")
async def put_config(req: Request):
    new = await req.json()
    if not isinstance(new, dict) or "pages" not in new or "settings" not in new:
        raise HTTPException(400, "Ungültige Konfiguration")
    old = load_config()
    cfg = migrate(deep_merge(DEFAULT_CONFIG, new))
    save_config(cfg)
    _changed(req)
    if ha_creds(old) != ha_creds(cfg):
        ha.restart(*ha_creds(cfg))
    return {"ok": True}


# ---- Verlauf-Seite: Vorschau aus der HA-Historie (48 Abschnitte, gleiche Einteilung wie im ESP)
_hist_cache: dict = {}


def _num(v):
    try:
        f = float(v)
        return f if f == f and f not in (float("inf"), float("-inf")) else None
    except (TypeError, ValueError):
        return None


def history_buckets(points, secs, now):
    """points: [(zeit, wert|None)] sortiert -> 48 zeitgewichtete Mittelwerte (letzter = laufender Abschnitt)."""
    b_now = int(now // secs)
    t0 = (b_now - 47) * secs
    sums, wts = [0.0] * 48, [0.0] * 48
    cur_v, cur_t = None, t0
    seq = [(t, v) for t, v in points if t <= now]
    for i, (t, v) in enumerate(seq + [(now, None)]):
        t = max(t, t0)
        if cur_v is not None and t > cur_t:
            a = cur_t
            while a < t:
                k = int(a // secs) - (b_now - 47)
                e = min(t, (int(a // secs) + 1) * secs)
                if 0 <= k < 48:
                    sums[k] += cur_v * (e - a)
                    wts[k] += e - a
                a = e
        if i < len(seq):
            cur_v, cur_t = v, t
    return [round(sums[k] / wts[k], 6) if wts[k] > 0 else None for k in range(48)]


@app.get("/api/history")
async def history(entity: str, attr: str = "", period: str = "24h"):
    secs = yaml_gen.CHART_PERIODS.get(period, 1800)
    if not re.fullmatch(r"[a-z_]+\.[\w]+", entity or "") or (attr and not re.fullmatch(r"[\w]+", attr)):
        raise HTTPException(400, "Ungültige Entität")
    key = (entity, attr, secs)
    now = time.time()
    hit = _hist_cache.get(key)
    if hit and now - hit[0] < 120:
        return {"values": hit[1]}
    start = (int(now // secs) - 47) * secs
    pts = []
    if ha.demo:
        st = ha.states.get(entity) or {}
        base = _num((st.get("attributes") or {}).get(attr) if attr else st.get("state"))
        if base is None:
            base = 20.0
        rnd = random.Random(entity + attr)
        t, v = start, base
        while t < now:
            v = v + (base - v) * 0.15 + rnd.uniform(-0.025, 0.025) * (abs(base) or 1)
            pts.append((t, v))
            t += secs / 3
    else:
        cfg = load_config()["settings"]
        url, token = ha_creds(load_config())
        if not url or not token:
            return {"values": [None] * 48}
        iso = datetime.datetime.fromtimestamp(start, datetime.timezone.utc).isoformat()
        q = {"filter_entity_id": entity}
        if not attr:
            q.update(minimal_response="", no_attributes="")
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15)) as sess:
                r = await sess.get(f"{url}/api/history/period/{urllib.parse.quote(iso)}", params=q,
                                   headers={"Authorization": f"Bearer {token}"})
                r.raise_for_status()
                data = await r.json()
        except Exception:  # noqa: BLE001
            return {"values": [None] * 48}
        for row in (data[0] if data else []):
            ts = row.get("last_updated") or row.get("last_changed")
            try:
                t = datetime.datetime.fromisoformat(str(ts).replace("Z", "+00:00")).timestamp()
            except ValueError:
                continue
            v = (row.get("attributes") or {}).get(attr) if attr else row.get("state")
            pts.append((t, _num(v)))
        pts.sort(key=lambda x: x[0])
    vals = history_buckets(pts, secs, now)
    _hist_cache[key] = (now, vals)
    if len(_hist_cache) > 64:
        _hist_cache.pop(next(iter(_hist_cache)))
    return {"values": vals}


# ---- Neue Version? (nur PC-Version – in der Home-Assistant-App meldet HA selbst Updates)
_update_cache = {"t": 0.0, "data": None}


def _vtuple(v):
    return tuple(int(x) for x in re.findall(r"\d+", str(v))[:3]) or (0,)


@app.get("/api/update")
async def update_check():
    repo = GITHUB_REPO.strip().strip("/")
    if APP_MODE or not repo or os.environ.get("PIXELPANEL_NO_UPDATE_CHECK"):
        return {"available": False}
    now = time.time()
    if _update_cache["data"] is not None and now - _update_cache["t"] < 6 * 3600:
        return _update_cache["data"]
    data = {"available": False}
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=6)) as sess:
            r = await sess.get(f"https://api.github.com/repos/{repo}/releases/latest",
                               headers={"Accept": "application/vnd.github+json", "User-Agent": f"PixelPanelStudio/{VERSION}"})
            if r.status == 200:
                rel = await r.json()
                tag = str(rel.get("tag_name") or "")
                zips = [a.get("browser_download_url") for a in rel.get("assets") or []
                        if str(a.get("name", "")).lower().endswith(".zip") and "studio" in str(a.get("name", "")).lower()]
                if _vtuple(tag) > _vtuple(VERSION):
                    data = {"available": True, "latest": tag.lstrip("vV"), "current": VERSION,
                            "notes": str(rel.get("body") or "")[:3000], "page": str(rel.get("html_url") or ""),
                            "zip": zips[0] if zips else ""}
    except Exception:  # noqa: BLE001 – offline o. Ä.: einfach kein Hinweis
        pass
    _update_cache.update(t=now, data=data)
    return data


@app.get("/api/entities")
async def entities():
    return {"status": ha.status, "error": ha.error, "entities": ha.entity_list(),
            "devices": len(ha.devices), "areas": len(ha.areas)}


@app.get("/api/status")
async def status():
    return {"status": ha.status, "error": ha.error}


@app.get("/api/events")
async def events(req: Request):
    q: asyncio.Queue = asyncio.Queue(maxsize=500)
    ha.listeners.add(q)

    async def gen():
        try:
            yield "retry: 3000\n\n"
            while True:
                if await req.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=15)
                    if msg is None:  # Server startet neu – Verbindung sauber beenden, Browser verbindet sich neu
                        break
                    yield f"data: {json.dumps(msg, ensure_ascii=False)}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            ha.listeners.discard(q)

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post("/api/test-ha")
async def test_ha(req: Request):
    body = await req.json()
    url, token = (body.get("url") or "").rstrip("/"), body.get("token") or ""
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=8)) as sess:
            r = await sess.get(f"{url}/api/config", headers={"Authorization": f"Bearer {token}"})
            if r.status == 401:
                return {"ok": False, "message": "Token wird abgelehnt."}
            r.raise_for_status()
            data = await r.json()
            return {"ok": True, "message": f"Verbunden mit „{data.get('location_name', 'Home Assistant')}“ (Version {data.get('version')})"}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "message": f"Nicht erreichbar: {e}"}


@app.post("/api/yaml")
async def yaml_preview(req: Request):
    cfg = deep_merge(DEFAULT_CONFIG, await req.json())
    try:
        mode = cfg["settings"].get("deploy_mode")
        return {"ok": True, "yaml": yaml_gen.generate(cfg, ha.units(), secrets_inline=(mode == "dashboard"))}
    except yaml_gen.GenError as e:
        return {"ok": False, "error": str(e)}


@app.post("/api/deploy")
async def deploy(req: Request):
    cfg = deep_merge(DEFAULT_CONFIG, await req.json())
    try:
        yaml_gen.generate(cfg, ha.units())
    except yaml_gen.GenError as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=400)
    save_config(cfg)
    _changed(req)
    await deployer.start(cfg)
    return {"ok": True}


@app.post("/api/plan")
async def plan(req: Request):
    """Reicht ein Live-Update oder muss neu geflasht werden?"""
    cfg = migrate(deep_merge(DEFAULT_CONFIG, await req.json()))
    h, d = structure_hash(cfg), deployed_hash()
    live_ok = h is not None and d is not None and h == d
    return {"needs_flash": not live_ok, "deployed": d is not None, "ha": ha.status}


@app.post("/api/live")
async def live(req: Request):
    cfg = migrate(deep_merge(DEFAULT_CONFIG, await req.json()))
    try:
        yaml_gen.generate(cfg, ha.units())
    except yaml_gen.GenError as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=400)
    if structure_hash(cfg) != deployed_hash():
        return JSONResponse({"ok": False, "error": "Diese Änderung braucht ein Übertragen aufs Panel."}, status_code=409)
    save_config(cfg)
    _changed(req)
    res = await push_live(cfg)
    if res.get("missing") and not res.get("pushed"):
        res["error"] = "Panel-Entitäten in Home Assistant nicht gefunden – ist das Panel online und in HA eingebunden?"
    return res


@app.get("/api/deploy")
async def deploy_state(since: int = 0):
    return deployer.state(since)


@app.post("/api/deploy/cancel")
async def deploy_cancel():
    deployer.cancel()
    return {"ok": True}


def _serve_forever():
    """Startet den Server. Wird die WLAN-Freigabe umgeschaltet, startet er mit neuer Adresse neu."""
    import uvicorn
    while True:
        host = os.environ.get("PIXELPANEL_HOST") or ("0.0.0.0" if APP_MODE or AUTH.lan_enabled else "127.0.0.1")
        SERVE.update(host=host, restart=False)
        server = uvicorn.Server(uvicorn.Config(app, host=host, port=PORT, log_level="warning", timeout_graceful_shutdown=2))
        SERVE["server"] = server
        if host != "127.0.0.1" and not APP_MODE:
            addrs = auth.lan_addresses(PORT)
            print("  Im WLAN erreichbar (mit Anmeldung): " + ("  ".join(addrs) or f"Port {PORT}") + "\n")
        server.run()
        if not SERVE["restart"]:
            break
        print("  Neustart mit geänderter Freigabe …\n")
        time.sleep(0.5)


if __name__ == "__main__":
    url = f"http://localhost:{PORT}"
    print(f"\n  PixelPanel Studio läuft auf  {url}\n  (Fenster offen lassen – Strg+C beendet)\n")
    if "--no-browser" not in sys.argv:
        threading.Timer(1.2, lambda: webbrowser.open(url)).start()
    _serve_forever()
