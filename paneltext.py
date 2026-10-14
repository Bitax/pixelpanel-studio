"""Texte, die auf dem Panel selbst erscheinen – Deutsch und Englisch (Einstellungen → Panel → Sprache auf dem Panel)."""
from icons import WEATHER

PANEL_TEXT = {
    "de": {
        "wd": ["SO", "MO", "DI", "MI", "DO", "FR", "SA"],
        "months": None,  # Datum als 11.10.
        "done": "FERTIG", "end": "ENDE", "pause": "PAUSE",
        "dec": ",", "thou": ".",  # 1.234,5
        "ha": {"display": "Anzeige", "quiet": "Ruhezeit", "bright": "Helligkeit", "psu": "Netzteil Strom", "next": "Nächste Seite",
               "show": "{} anzeigen", "dur": "{} Dauer", "thr": "{} Schwelle", "page": "Seite {}"},
        "today": "HEUTE", "tomorrow": "MORGEN", "now": "JETZT", "noevents": "KEINE TERMINE", "until": "BIS", "nodata": "KEINE DATEN",
        "words": {
            "on": "AN", "off": "AUS", "open": "AUF", "closed": "ZU", "opening": "AUF..", "closing": "ZU..",
            "home": "DA", "not_home": "WEG", "locked": "ZU", "unlocked": "AUF",
            "playing": "PLAY", "paused": "PAUSE", "idle": "IDLE", "standby": "STBY",
            "heat": "HEIZEN", "cool": "KUEHLEN", "auto": "AUTO", "cleaning": "SAUGT", "docked": "DOCK",
            "above_horizon": "TAG", "below_horizon": "NACHT",
            "unavailable": "--", "unknown": "--",
        },
        "weather": {k: v[1] for k, v in WEATHER.items()},
        # Kurzformen, wenn der Text selbst in der Mini-Schrift nicht passt
        "weather_short": {"sunny": "Sonne", "cloudy": "Wolke", "pouring": "Regen",
                          "snowy-rainy": "Graup", "lightning": "Blitz", "lightning-rainy": "Blitz", "windy": "Wind", "windy-variant": "Wind",
                          "exceptional": "Warn"},
    },
    "en": {
        "wd": ["SU", "MO", "TU", "WE", "TH", "FR", "SA"],
        "months": ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],  # Datum als 11 OCT
        "done": "DONE", "end": "END", "pause": "PAUSE",
        "dec": ".", "thou": ",",  # 1,234.5
        "ha": {"display": "Display", "quiet": "Quiet hours", "bright": "Brightness", "psu": "Power supply current", "next": "Next page",
               "show": "{} visible", "dur": "{} duration", "thr": "{} threshold", "page": "Page {}"},
        "today": "TODAY", "tomorrow": "TMRW", "now": "NOW", "noevents": "NO EVENTS", "until": "TO", "nodata": "NO DATA",
        "words": {
            "on": "ON", "off": "OFF", "open": "OPEN", "closed": "CLOSED", "opening": "OPEN..", "closing": "CLOSE..",
            "home": "HOME", "not_home": "AWAY", "locked": "LOCKED", "unlocked": "OPEN",
            "playing": "PLAY", "paused": "PAUSE", "idle": "IDLE", "standby": "STBY",
            "heat": "HEAT", "cool": "COOL", "auto": "AUTO", "cleaning": "CLEAN", "docked": "DOCK",
            "above_horizon": "DAY", "below_horizon": "NIGHT",
            "unavailable": "--", "unknown": "--",
        },
        "weather": {
            "sunny": "Sunny", "clear-night": "Clear", "partlycloudy": "Fair", "cloudy": "Cloudy", "rainy": "Rain",
            "pouring": "Pouring", "snowy": "Snow", "snowy-rainy": "Sleet", "hail": "Hail", "lightning": "Storm",
            "lightning-rainy": "Storm", "fog": "Fog", "windy": "Windy", "windy-variant": "Windy", "exceptional": "Warning",
        },
        "weather_short": {"sunny": "Sun", "cloudy": "Cloud", "pouring": "Rain", "windy": "Wind", "windy-variant": "Wind", "exceptional": "Warn"},
    },
}


def lang_of(settings):
    return "en" if (settings or {}).get("panel_lang") == "en" else "de"
