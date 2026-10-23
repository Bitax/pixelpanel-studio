# Changelog

## 3.4

- **Update screen:** the panel now only shows UPDATE while uploading over Wi-Fi (no progress bar – it stood still at 0 %)

## 3.3

- **Calendar:** all-day events are recognised on the panel again (no more “00:00” and cut-off titles)
- **Update screen:** while uploading over Wi-Fi the panel only shows UPDATE, a progress bar and the percentage – less load on the ESP32

## 3.2.1

- Works with the new **ESPHome Device Builder** (ESPHome 2026.6+)
- New upload method **ESPHome folder** (default): PixelPanel puts the configuration into the Device Builder, you click **Install** – no open port. Needs access to the Home Assistant configuration folder.
- Upload method **Automatic** for the new Device Builder, with **Test connection**

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

## 3.1

- First release as a Home Assistant app (sidebar, no token needed)
- Per-page overflow handling for long text: scroll, cut or hide – with speed and “run without stopping”
- One text-size slider per stack field incl. the new tiny **Mini** font
- Calendar page as an iPhone-like list (today / tomorrow / date), multi-day events
- Chart page (history of a sensor)
- Umlauts, € and ° are shown correctly on the panel
- “Stay signed in (30 days)” and a list of signed-in devices with sign-out per device
- Panel keeps the time even without Home Assistant (SNTP)
- English panel texts: English number format and English entity names in Home Assistant
- Settings stay in sync between several open browsers

---

## Deutsch

### 3.4

- **Update-Bildschirm:** Beim Übertragen per WLAN zeigt das Panel nur noch UPDATE (ohne Balken – der blieb bei 0 % stehen)

### 3.3

- **Kalender:** Ganztägige Termine werden auf dem Panel wieder erkannt (kein „00:00“ und kein abgeschnittener Titel mehr)
- **Update-Bildschirm:** Beim Übertragen per WLAN zeigt das Panel nur UPDATE, einen Fortschrittsbalken und die Prozentzahl – weniger Last für den ESP32

### 3.2 – animierte Icons

- **Animierte Icons** – „Icon animieren“ für Wert-, Entitäten- und Timer-Seiten: Die Glühbirne leuchtet mit Strahlen, wenn das Licht an ist (aus = grau), das Farblicht wechselt die Farben, die Trommel von Waschmaschine und Trockner dreht sich, die Spülmaschine sprüht, der Ventilator dreht sich und die Sanduhr rieselt, solange der Timer läuft
- Einstellbar, was als „an“ zählt: auf Wunsch eine eigene Entität (z. B. die Steckdose) und „Läuft ab“ für Leistungs-Sensoren (z. B. 5 W)
- **Timer-Seite: Rahmen blinkt, wenn fertig** – optional, Farbe wählbar (Standard Rot), solange „FERTIG“ angezeigt wird
- Neue Icons: **Trockner** und **Ventilator**
- Das Timer-Beispiel in der Vorschau kann jetzt auch „fertig“ zeigen
- Animiertes GIF oben in der README
- **Behoben:** Einstellungen → Panel & Hardware → Stromversorgung – Balken, Farbe und Satz aktualisieren sich jetzt sofort beim Eintippen der Ampere (vorher erst z. B. nach dem Wechsel des ESP)
