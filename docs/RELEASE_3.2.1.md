<!-- Text für das GitHub-Release v3.2.1 – Titel: PixelPanel Studio 3.2.1 -->

## PixelPanel Studio 3.2.1 – works with the new ESPHome Device Builder 🔧

**Fixed**
- **Uploading via Home Assistant** works again: ESPHome 2026.6 replaced the old dashboard with the new **ESPHome Device Builder** and a new interface. PixelPanel now speaks it.
- An empty dashboard address now really uses the default address (before: “not reachable: /edit”)

**New**
- **Upload method “ESPHome folder”** (Home Assistant app, new default): PixelPanel puts the configuration straight into the ESPHome Device Builder – you just click **Install** there. No open port, nothing to change in ESPHome.
- **Upload method “Automatic”**: one click saves, compiles and uploads – with a step-by-step guide and **Test connection**. Requires “Disable external authentication” and port 6052 in the Device Builder.

**Note for the Home Assistant app:** the app now has access to the Home Assistant configuration folder – it only writes the panel's file into `esphome/`.

**Download:** `PixelPanelStudio_3.2.1.zip` · Manual `PixelPanel_Manual_EN_3.2.1.pdf` · `PixelPanel_Handbuch_DE_3.2.1.pdf`

---

## Deutsch

**Behoben:** Übertragen über Home Assistant klappt wieder mit dem neuen **ESPHome Device Builder** (ab ESPHome 2026.6). Leere Dashboard-Adresse nutzt jetzt die Standardadresse.

**Neu:** Methode **„ESPHome-Ordner“** (Standard in der App): Konfiguration landet direkt im Device Builder, dort nur **Installieren** klicken – kein offener Port. Methode **„Automatisch“** mit Anleitung und **Verbindung testen**.

**Update (PC):** neue ZIP entpacken, den Ordner `data` aus der alten Version hineinkopieren, `Start.bat` starten, einmal „Übernehmen & aufs Panel“. **App:** Update unter *Einstellungen → Apps*.
