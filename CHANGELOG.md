# Changelog

All notable changes to PixelPanel Studio. *Deutsch weiter unten.*

## 3.1 – first public release

### New
- **Home Assistant app** – runs in the HA sidebar via ingress, signs in to HA by itself (no token), builds via the ESPHome app
- **Calendar page** – iPhone-like list (today / tomorrow / date) or large view, up to 4 calendars or a helper sensor with up to 12 events, hide words, duplicates removed, multi-day events
- **Chart page** – line or bars, recorded by the panel itself (6 h – 7 days) or taken from a list attribute (e.g. electricity price forecast)
- **Scrolling text page** – fixed text or a value from HA (e.g. song title)
- **Text too long** per page and per stack field: scroll, shorten or hide – with speed and “endless” ticker mode
- **One text-size slider** incl. the tiny **Mini** font (3 × 5); secondary lines shrink and use short forms on their own
- **Umlauts, € and °** on the panel
- **Stay signed in (30 days)** on phone/tablet, device names, **list of signed-in devices** with sign-out per device
- **Live sync** between all open browsers (brightness and panel on/off act instantly)
- **Update notice** in the PC version when a new release is out
- Panel keeps the time without Home Assistant (SNTP)
- With English panel texts, numbers use English format (1,234.5) and the panel's entities in Home Assistant get English names
- `start.sh` for Mac/Linux

### Improved
- Entity names with umlauts are converted safely for ESPHome
- Stricter validation of entity ids, attributes, time zone and keys in the generated YAML

## 3.0 and earlier

Internal test versions (not published).

---

## Deutsch

### 3.1 – erste öffentliche Version

- **Home-Assistant-App** – läuft in der HA-Seitenleiste, meldet sich selbst an (kein Token), baut über die ESPHome-App
- **Kalender-Seite** – Liste wie im iPhone (Heute / Morgen / Datum) oder groß, bis zu 4 Kalender oder Helfer-Sensor mit bis zu 12 Terminen, Wörter ausblenden, doppelte Termine nur einmal, mehrtägige Termine
- **Verlauf-Seite** – Linie oder Balken, vom Panel selbst aufgezeichnet (6 h – 7 Tage) oder aus einer Liste (z. B. Strompreis-Prognose)
- **Laufschrift-Seite** – fester Text oder Wert aus HA (z. B. Songtitel)
- **Zu langer Text** pro Seite und Stapel-Feld: Laufschrift, Abkürzen oder Ausblenden – mit Geschwindigkeit und Endlos-Modus
- **Ein Regler für die Textgröße** inkl. **Mini-Schrift** (3 × 5); Nebenzeilen werden selbst kleiner und kürzer
- **Umlaute, € und °** auf dem Panel
- **Angemeldet bleiben (30 Tage)**, Gerätenamen, **Liste der angemeldeten Geräte** mit Abmelden pro Gerät
- **Live-Abgleich** zwischen allen geöffneten Browsern
- **Update-Hinweis** in der PC-Version
- Uhrzeit auch ohne Home Assistant (SNTP)
- Mit englischen Panel-Texten: Zahlen im englischen Format (1,234.5) und englische Namen der Panel-Entitäten in Home Assistant
- `start.sh` für Mac/Linux
