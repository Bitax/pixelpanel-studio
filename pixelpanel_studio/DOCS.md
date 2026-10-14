# PixelPanel Studio

*Deutsch weiter unten.*

## Requirements

- Home Assistant **OS** or **Supervised** (apps are not available on Container/Docker or Core –
  use the PC version from the [GitHub releases](https://github.com/Bitax/pixelpanel-studio/releases) there)
- The **ESPHome app** (ESPHome Device Builder) installed and started
- An ESP32 (or ESP32-S3) with a HUB75 LED panel – see the handbook for wiring

## First start

1. Start the app and enable **Show in sidebar**.
2. Open **PixelPanel** in the sidebar. The connection to Home Assistant is made
   automatically – you don't need a URL or a token.
3. Go to **Settings → Panel & hardware** and choose your board and panel size.
4. Enter your Wi-Fi name and password under **Settings → Access & security → Wi-Fi**.
5. Design your pages and press **Apply & upload to panel**.

## Transferring the firmware

The app uses the upload method **“ESPHome in HA”** (Settings → Access & security → Upload): PixelPanel Studio creates the
device configuration in the ESPHome app and starts the build there.

- The ESPHome app must be reachable on port **6052**. In the ESPHome app open
  **Configuration → Network**, enter `6052` and restart it.
- The address preset in PixelPanel is `http://172.30.32.1:6052`.
- The very **first** install on a brand-new ESP32 has to be done by USB cable
  (ESPHome app → device → Install → “Plug into this computer”). After that every
  update goes over Wi-Fi.

Building directly inside this app (“local”) is not supported – the ESPHome compiler
would make the app very large.

## Data & backups

All settings live in the app's `/data` folder and are part of every Home Assistant backup.

## Updates

Updates appear in Home Assistant like for any other app (**Settings → Apps**).
The “What's new” text comes from the changelog.

## Help

Handbook (PDF, DE/EN) and FAQ: <https://github.com/Bitax/pixelpanel-studio>  
Ideas, bugs, icons: <https://github.com/Bitax/pixelpanel-studio/issues>

---

## Deutsch

**Voraussetzungen:** Home Assistant **OS** oder **Supervised** (auf Container/Docker und Core
gibt es keine Apps – dort die PC-Version aus den GitHub-Releases nutzen), die **ESPHome-App**
installiert und gestartet, ein ESP32 mit HUB75-Panel.

**Erster Start:** App starten, „In Seitenleiste anzeigen“ einschalten, **PixelPanel** in der
Seitenleiste öffnen. Die Verbindung zu Home Assistant entsteht automatisch – keine Adresse,
kein Token nötig. Danach unter **Einstellungen → Panel & Hardware** Board und Panel wählen, unter
**Zugänge & Sicherheit → WLAN** das WLAN eintragen, Seiten gestalten und **Übernehmen & aufs Panel** drücken.

**Übertragung:** Die App baut die Firmware über die ESPHome-App (Methode „ESPHome in HA“ unter Zugänge & Sicherheit → Übertragung).
In der ESPHome-App unter **Konfiguration → Netzwerk** den Port `6052` eintragen und neu starten.
Die **allererste** Installation auf einem neuen ESP32 muss per USB-Kabel erfolgen
(ESPHome-App → Gerät → Installieren). Danach geht jedes Update über WLAN.

**Daten:** Alle Einstellungen liegen im `/data`-Ordner der App und sind in jedem HA-Backup enthalten.

**Updates** erscheinen wie bei jeder anderen App unter **Einstellungen → Apps**.
