# Changelog

All notable changes to PixelPanel Studio. *Deutsch weiter unten.*

## 3.2 – animated icons

### New
- **Animated icons** – switch on “Animate icon” for value, entity and timer pages: the light bulb glows with rays when the light is on (grey when off), the colour light cycles its colours, the drum of the washing machine and dryer turns, the dishwasher sprays, the fan spins and the hourglass trickles while the timer runs
- Decide what counts as “on”: optionally a separate entity (e.g. the smart plug) and a threshold “Running above” for power sensors (e.g. 5 W)
- **Timer page: border flashes when done** – optional, in a colour of your choice (default red), as long as “DONE” is shown
- New icons: **dryer** and **fan**
- Timer example in the preview can now also show “finished”
- Animated GIF at the top of the README

### Fixed
- Settings → Panel & hardware → Power supply: the bar, its colour and the sentence now update immediately while you type the amps (before only after e.g. choosing another ESP)

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

### 3.2 – animierte Icons

- **Animierte Icons** – „Icon animieren“ für Wert-, Entitäten- und Timer-Seiten: Die Glühbirne leuchtet mit Strahlen, wenn das Licht an ist (aus = grau), das Farblicht wechselt die Farben, die Trommel von Waschmaschine und Trockner dreht sich, die Spülmaschine sprüht, der Ventilator dreht sich und die Sanduhr rieselt, solange der Timer läuft
- Einstellbar, was als „an“ zählt: auf Wunsch eine eigene Entität (z. B. die Steckdose) und „Läuft ab“ für Leistungs-Sensoren (z. B. 5 W)
- **Timer-Seite: Rahmen blinkt, wenn fertig** – optional, Farbe wählbar (Standard Rot), solange „FERTIG“ angezeigt wird
- Neue Icons: **Trockner** und **Ventilator**
- Das Timer-Beispiel in der Vorschau kann jetzt auch „fertig“ zeigen
- Animiertes GIF oben in der README
- **Behoben:** Einstellungen → Panel & Hardware → Stromversorgung – Balken, Farbe und Satz aktualisieren sich jetzt sofort beim Eintippen der Ampere (vorher erst z. B. nach dem Wechsel des ESP)

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
