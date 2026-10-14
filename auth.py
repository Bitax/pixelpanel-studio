"""Zugriff vom Handy/Tablet: Benutzername + Passwort für Geräte im WLAN.

Regeln:
  * Am PC selbst (localhost) braucht man nie ein Passwort.
  * Andere Geräte kommen nur rein, wenn „Im WLAN freigeben“ an ist UND Benutzername + Passwort gesetzt sind.
  * Zugangsdaten und Freigabe lassen sich nur am PC selbst ändern – eine gestohlene Sitzung kann den
    Besitzer also nicht aussperren.

Gespeichert in data/auth.json (nie in config.json, nie an den Browser):
  Passwort als scrypt-Hash mit Salt, Sitzungen nur als SHA-256 des Tokens.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import socket
import threading
import time
from pathlib import Path

SESSION_DAYS = 30
SHORT_HOURS = 12  # ohne „Angemeldet bleiben“: endet mit dem Browser, spätestens nach 12 h
MIN_PW = 8
_SCRYPT = {"n": 2 ** 14, "r": 8, "p": 1}
_lock = threading.Lock()


class Auth:
    def __init__(self, path: Path):
        self.path = path
        self.d = {"lan": False, "user": "", "pw": None, "sessions": {}}
        self._fails = {}  # ip -> [anzahl, gesperrt_bis]
        self._load()

    # ---------------------------------------------------------------- Datei
    def _load(self):
        try:
            d = json.loads(self.path.read_text("utf-8"))
            if isinstance(d, dict):
                self.d.update({k: d[k] for k in ("lan", "user", "pw", "sessions") if k in d})
        except (OSError, ValueError):
            pass
        if not isinstance(self.d.get("sessions"), dict):
            self.d["sessions"] = {}

    def _save(self):
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.d, indent=1), "utf-8")
        os.replace(tmp, self.path)

    # ---------------------------------------------------------------- Zustand
    @property
    def has_credentials(self) -> bool:
        return bool(self.d.get("user") and self.d.get("pw"))

    @property
    def lan_enabled(self) -> bool:
        return bool(self.d.get("lan")) and self.has_credentials

    def public(self) -> dict:
        self._prune()
        return {"lan": bool(self.d.get("lan")), "user": self.d.get("user", ""), "has_password": bool(self.d.get("pw")),
                "sessions": len(self.d["sessions"])}

    # ---------------------------------------------------------------- Passwort
    @staticmethod
    def _hash(pw: str, salt: bytes, n: int, r: int, p: int) -> bytes:
        return hashlib.scrypt(pw.encode("utf-8"), salt=salt, n=n, r=r, p=p, maxmem=64 * 1024 * 1024, dklen=32)

    def set_credentials(self, user: str, pw: str | None):
        """pw=None lässt das Passwort unverändert (nur Name ändern)."""
        with _lock:
            self.d["user"] = user
            if pw is not None:
                salt = secrets.token_bytes(16)
                self.d["pw"] = {"salt": salt.hex(), "hash": self._hash(pw, salt, **_SCRYPT).hex(), **_SCRYPT}
            self.d["sessions"] = {}  # neue Zugangsdaten → alle Geräte neu anmelden
            self._save()

    def set_lan(self, on: bool):
        with _lock:
            self.d["lan"] = bool(on)
            self._save()

    def check(self, user: str, pw: str) -> bool:
        rec = self.d.get("pw") or {}
        try:
            salt = bytes.fromhex(rec["salt"])
            want = bytes.fromhex(rec["hash"])
            got = self._hash(pw, salt, rec.get("n", _SCRYPT["n"]), rec.get("r", 8), rec.get("p", 1))
        except (KeyError, ValueError, TypeError):
            self._hash(pw, b"0" * 16, **_SCRYPT)  # gleiche Rechenzeit, auch ohne Konto
            return False
        user_ok = hmac.compare_digest(user.strip().lower().encode(), str(self.d.get("user", "")).lower().encode())
        return hmac.compare_digest(got, want) and user_ok

    # ---------------------------------------------------------------- Fehlversuche bremsen
    def locked_for(self, ip: str) -> int:
        n, until = self._fails.get(ip, (0, 0))
        return max(0, int(until - time.time()))

    def fail(self, ip: str):
        n, _ = self._fails.get(ip, (0, 0))
        n += 1
        # ab dem 5. Fehlversuch: 30 s, 60 s, 120 s … bis 15 min Pause
        wait = 0 if n < 5 else min(900, 30 * 2 ** (n - 5))
        self._fails[ip] = (n, time.time() + wait)

    def ok(self, ip: str):
        self._fails.pop(ip, None)

    # ---------------------------------------------------------------- Sitzungen
    @staticmethod
    def _key(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    def _prune(self):
        now = time.time()
        dead = [k for k, s in self.d["sessions"].items() if s.get("exp", 0) < now]
        for k in dead:
            del self.d["sessions"][k]
        if dead:
            self._save()

    def new_session(self, ua: str, ip: str, remember: bool = True, name: str = "") -> str:
        token = secrets.token_urlsafe(32)
        now = time.time()
        with _lock:
            self._prune()
            self.d["sessions"][self._key(token)] = {"exp": now + (SESSION_DAYS * 86400 if remember else SHORT_HOURS * 3600),
                                                     "ua": ua[:200], "ip": ip, "created": int(now), "seen": int(now),
                                                     "name": clean_name(name), "remember": bool(remember)}
            # nicht unbegrenzt viele Geräte
            if len(self.d["sessions"]) > 30:
                oldest = sorted(self.d["sessions"].items(), key=lambda kv: kv[1].get("created", 0))
                for k, _ in oldest[:-30]:
                    del self.d["sessions"][k]
            self._save()
        return token

    def session_ok(self, token: str | None) -> bool:
        if not token or not self.lan_enabled:
            return False
        s = self.d["sessions"].get(self._key(token))
        now = time.time()
        if not s or s.get("exp", 0) <= now:
            return False
        if now - s.get("seen", 0) > 300:  # „zuletzt aktiv“ – höchstens alle 5 Minuten auf die Platte
            s["seen"] = int(now)
            with _lock:
                self._save()
        return True

    @staticmethod
    def sid(key: str) -> str:
        """Kurze Kennung einer Sitzung für die Geräteliste (aus dem Hash, nicht aus dem Token)."""
        return key[:16]

    def devices(self, my_token: str | None = None) -> list:
        """Angemeldete Geräte – neueste Aktivität zuerst."""
        self._prune()
        mine = self._key(my_token) if my_token else None
        out = []
        for k, s in self.d["sessions"].items():
            out.append({"id": self.sid(k), "name": s.get("name") or device_label(s.get("ua", "")),
                        "auto": not s.get("name"), "ua": device_label(s.get("ua", "")), "ip": s.get("ip", ""),
                        "created": s.get("created", 0), "seen": s.get("seen", s.get("created", 0)),
                        "remember": s.get("remember", True), "me": k == mine})
        out.sort(key=lambda d: -d["seen"])
        return out

    def end_by_id(self, sid: str) -> bool:
        with _lock:
            for k in list(self.d["sessions"]):
                if self.sid(k) == sid:
                    del self.d["sessions"][k]
                    self._save()
                    return True
        return False

    def end_session(self, token: str | None):
        if token and self.d["sessions"].pop(self._key(token), None) is not None:
            with _lock:
                self._save()

    def end_all(self):
        with _lock:
            self.d["sessions"] = {}
            self._save()


def clean_name(name: str) -> str:
    """Gerätename vom Nutzer: nur druckbare Zeichen, kurz."""
    return "".join(ch for ch in str(name or "") if ch.isprintable() and ch not in "<>\"'`")[:40].strip()


def device_label(ua: str) -> str:
    """„iPhone · Safari“ aus dem User-Agent raten (iPads melden sich in Safari oft als Mac)."""
    u = ua or ""
    dev = ("iPhone" if "iPhone" in u else "iPad" if "iPad" in u else "Android" if "Android" in u
           else "Mac" if "Macintosh" in u else "Windows-PC" if "Windows" in u else "Linux" if "Linux" in u else "Gerät")
    br = ("Edge" if "Edg/" in u else "Firefox" if ("Firefox" in u or "FxiOS" in u) else "Chrome" if ("Chrome" in u or "CriOS" in u)
          else "Safari" if "Safari" in u else "")
    if dev == "Mac" and "Mobile" in u:
        dev = "iPad"
    return f"{dev} · {br}" if br else dev


def is_local(client_host: str | None) -> bool:
    h = (client_host or "").lower()
    return h in ("127.0.0.1", "::1", "localhost") or h.startswith("::ffff:127.") or h.startswith("127.")


def lan_addresses(port: int) -> list[str]:
    """Adressen, unter denen das Handy das Studio erreicht (ohne Pakete zu senden)."""
    ips = []
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("192.168.1.1", 9))  # UDP-connect sendet nichts, liefert nur die eigene Adresse fürs LAN
        ips.append(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if ip not in ips and not ip.startswith("127."):
                ips.append(ip)
    except OSError:
        pass
    return [f"http://{ip}:{port}" for ip in ips if not ip.startswith("127.")][:4]
