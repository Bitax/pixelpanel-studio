# Changelog

All notable changes to PixelPanel Studio. *Deutsch weiter unten.*

## 3.5 – night mode

### New
- **Night mode:** quiet hours now have a third choice per night besides “Off” and “Dimmed”: **Night** – the panel is dimmed and shows everything in **red** (clock, weather, icons), which dazzles much less at night. Every colour becomes red of the same brightness, so everything stays readable
- **Switch “Night mode” in Home Assistant:** red and dimmed regardless of the times – e.g. by automation when the bedroom light goes off. The pages keep running as usual
- **Preview night** (Settings → General → Night mode): shows in the preview how the panel looks at night
- Brightness for “Dimmed” and “Night” is shared; 5 % by default

## 3.4 – simpler update screen

### Changed
- **Update screen:** while uploading over Wi-Fi the panel now only shows **UPDATE** – no progress bar any more. While ESPHome receives the firmware the ESP32 doesn't redraw, so the bar stood still at 0 %

## 3.3 – calendar fix and update screen

### Fixed
- **Calendar: all-day events** are recognised on the panel again. Home Assistant sends “all day” to the panel as `on` (the preview sees `true`), so the panel showed a time like 00:00 and cut the title short – now panel and preview match again

### New
- **Update screen:** while a new version is uploaded over Wi-Fi, the panel only shows **UPDATE**, a progress bar and the percentage, redrawn once per second. This takes load off the ESP32 while it writes the firmware. If the upload fails, the panel returns to normal; afterwards it restarts as usual

## 3.2.1 – works with the new ESPHome Device Builder

### Fixed
- **Upload via Home Assistant** works again with the new **ESPHome Device Builder** (ESPHome 2026.6 and later), which replaced the old dashboard and its interface
- An empty dashboard address now really uses the default address (before: “not reachable: /edit”)

### New
- **Upload method “ESPHome folder”** (Home Assistant app, new default): the Studio puts the configuration straight into the ESPHome Device Builder – you just click **Install** there. No open port needed.
- **Upload method “Automatic”** for the new Device Builder: save, compile and upload with one click, live progress, cancel – with a step-by-step guide and **Test connection** in the settings
- Optional dashboard user for a password-protected Device Builder

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

### 3.5 – Nachtmodus

- **Neu: Nachtmodus** – bei der Ruhezeit gibt es pro Nacht neben „Aus“ und „Gedimmt“ jetzt **„Nacht“**: Das Panel ist gedimmt und zeigt alles in **Rot** (Uhr, Wetter, Icons) – blendet nachts viel weniger. Jede Farbe wird zu Rot in derselben Helligkeit, alles bleibt lesbar
- **Neu: Schalter „Nachtmodus“ in Home Assistant** – rot und gedimmt, unabhängig von den Uhrzeiten, z. B. per Automation, wenn im Schlafzimmer das Licht ausgeht. Die Seiten laufen dabei weiter wie gewohnt
- **Neu: Nacht ansehen** (Einstellungen → Allgemein → Nachtmodus) – zeigt in der Vorschau, wie das Panel nachts aussieht
- „Gedimmt“ und „Nacht“ teilen sich die Helligkeit, Standard 5 %

### 3.4 – einfacherer Update-Bildschirm

- **Geändert: Update-Bildschirm** – beim Übertragen per WLAN zeigt das Panel jetzt nur noch **UPDATE**, ohne Fortschrittsbalken. Während ESPHome die Firmware empfängt, zeichnet der ESP32 nichts neu, deshalb blieb der Balken bei 0 % stehen

### 3.3 – Kalender-Korrektur und Update-Bildschirm

- **Behoben: Kalender – ganztägige Termine** werden auf dem Panel wieder erkannt. Home Assistant schickt „ganztägig“ ans Panel als `on` (die Vorschau sieht `true`), deshalb stand auf dem Panel eine Uhrzeit wie 00:00 und der Titel wurde abgeschnitten – jetzt zeigen Panel und Vorschau wieder dasselbe
- **Neu: Update-Bildschirm** – während eine neue Version per WLAN übertragen wird, zeigt das Panel nur **UPDATE**, einen Fortschrittsbalken und die Prozentzahl, einmal pro Sekunde neu gezeichnet. Das entlastet den ESP32 beim Schreiben der Firmware. Klappt das Übertragen nicht, kehrt das Panel zur normalen Anzeige zurück; danach startet es wie gewohnt neu

### 3.2.1 – passt zum neuen ESPHome Device Builder

- **Übertragen über Home Assistant** funktioniert wieder mit dem neuen **ESPHome Device Builder** (ab ESPHome 2026.6)
- Leere Dashboard-Adresse nutzt jetzt wirklich die Standardadresse (vorher „nicht erreichbar: /edit“)
- **Neu: Methode „ESPHome-Ordner“** (Home-Assistant-App, neuer Standard): Das Studio legt die Konfiguration direkt in den Device Builder, dort nur noch **Installieren** klicken – kein offener Port
- **Neu: Methode „Automatisch“** für den neuen Device Builder – mit Anleitung und **Verbindung testen**

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
