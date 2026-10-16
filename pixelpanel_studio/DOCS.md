# PixelPanel Studio

*Deutsch weiter unten.*

## Requirements

- Home Assistant **OS** or **Supervised** (apps are not available on Container/Docker or Core –
  use the PC version from the [GitHub releases](https://github.com/Bitax/pixelpanel-studio/releases) there)
- The **ESPHome Device Builder** app installed and started
- An ESP32 (or ESP32-S3) with a HUB75 LED panel – see the handbook for wiring

## First start

1. Start the app and enable **Show in sidebar**.
2. Open **PixelPanel** in the sidebar. The connection to Home Assistant is made
   automatically – you don't need a URL or a token.
3. Go to **Settings → Panel & hardware** and choose your board and panel size.
4. Enter your Wi-Fi name and password under **Settings → Access & security → Wi-Fi**.
5. Design your pages and press **Apply & upload to panel**.

## Transferring the firmware

Settings → Access & security → Upload offers two methods:

**ESPHome folder (default, safest)** – *Apply & upload to panel* puts the configuration straight into the
ESPHome Device Builder (`/config/esphome`). Open the device there and click **Install**. No port is opened.
This is why the app asks for access to the Home Assistant configuration folder; it only writes the panel's YAML file.

**Automatic** – one click in PixelPanel saves, compiles and uploads everything. The new ESPHome Device Builder
(ESPHome 2026.6+) only allows this when you turn on **“Disable external authentication”** and enter port **6052**
under Network in its configuration (then restart it). The Device Builder is then reachable on your network
**without a password** – only use this if you trust every device on your network. Use **Test connection** in PixelPanel to check.

The very **first** install on a brand-new ESP32 is done by USB cable: plug it into the Home Assistant machine and
choose **Install → “Plug into the computer running ESPHome Device Builder”** in the Device Builder. After that every
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

**Übertragung:** Standard ist **ESPHome-Ordner**: „Übernehmen & aufs Panel“ legt die Konfiguration direkt in den
ESPHome Device Builder, dort beim Gerät auf **Installieren** klicken – kein offener Port. Wer alles mit einem Klick will,
wählt **Automatisch** und schaltet im Device Builder „Disable external authentication“ ein und trägt bei Netzwerk `6052` ein
(dann ist ESPHome im WLAN ohne Passwort erreichbar). Die **allererste** Installation auf einem neuen ESP32 erfolgt per USB:
ESP32 an den Home-Assistant-Rechner stecken → im Device Builder **Installieren → „Plug into the computer running ESPHome
Device Builder“**. Danach geht jedes Update über WLAN.

**Daten:** Alle Einstellungen liegen im `/data`-Ordner der App und sind in jedem HA-Backup enthalten.

**Updates** erscheinen wie bei jeder anderen App unter **Einstellungen → Apps**.
