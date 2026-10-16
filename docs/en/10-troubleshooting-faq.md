# 10. Troubleshooting & FAQ

## The panel

| What you see | What helps |
|---|---|
| Panel stays dark | Power at the panel? Check OE, LAT and CLK · set driver chip to **FM6126A** and upload again · quiet hours active? · *Panel on* on the overview? · does a page have a condition that isn't met right now? |
| Only the upper or lower half lights up | E line missing (mandatory for 64 px height) |
| Colours swapped | swap R/G/B wires or check the pins |
| Random pixels / flicker | connect GND · shorter jumper wires · capacitor · stronger power supply |
| Picture doubled / shifted | A/B/C/D swapped or change the chain layout under *Panel & hardware* |
| ESP restarts on bright images | power supply too weak – enter the real value under *Panel & hardware → Power supply* |
| Picture swapped/mirrored with several panels | try another chain layout · check rotation |
| Wrong time | time zone under *Settings → General* (e.g. `Europe/London`) |
| Values show “–” | entity unavailable in Home Assistant? · panel added in HA (*Settings → Devices & services → ESPHome*)? |
| Panel runs an old version | banner “The panel is still running version …” → **Apply & upload to panel** once |
| Animated icon doesn't move | “Animate icon” on? · Does **Right now** say “off”? → set **State from** to the right entity or adjust **Running above** (e.g. 5 W instead of empty) · after switching it on, **Apply & upload to panel** once |

## Uploading

**“ESPHome is not installed”** (PC version) – `Start.bat`/`start.sh` installs it on first start.
Otherwise run in the Studio folder: `.venv\Scripts\pip install esphome` (Windows) or `.venv/bin/pip install esphome`.

**The first flash fails.** A new ESP32 needs a USB **data** cable once. On Windows check in Device Manager under *Ports*
which COM port appears; install the USB driver (CP210x or CH340) if needed. Some boards need the **BOOT** button pressed while connecting.

**Wi-Fi upload can't find the panel.** Enter the panel's IP address under *Upload → Device*
(see your router or the device in Home Assistant).

**Automatic: “ESPHome Device Builder not reachable”.** The new Device Builder (ESPHome 2026.6 and later) only opens
port 6052 when **both** are set: “Disable external authentication” **and** network port `6052`. Then restart the
Device Builder and click **Test connection** in the Studio. Don't want that? Use the **ESPHome folder** method.

**Home Assistant app, very first install.** In the ESPHome Device Builder on the device: *Install* →
*Plug into the computer running ESPHome Device Builder* (ESP32 on the Home Assistant machine) – or *Plug into this computer*
(needs Chrome or Edge and Home Assistant via `https://`) – or *Manual download* and flash the file via
[web.esphome.io](https://web.esphome.io).

**The device doesn't show up in the ESPHome Device Builder (ESPHome folder).** Wait a few seconds and reload the page.
If that doesn't help, restart the PixelPanel app once – from version 3.2.1 it needs access to the configuration folder.

**Not enough memory.** The board check under *Panel & hardware* warns early. Fewer pages/entities, a simpler animation
or an ESP32-S3 help. After uploading, *Upload* shows the real usage (RAM/flash).

## Home Assistant

**HA asks for an encryption key.** It's under *Access & security → Security → API key*.

**The Studio says “demo mode”.** Enter address and token under *Access & security → Home Assistant* and *Test connection*.
In the Home Assistant app this happens automatically.

**Changed the panel language – entities show “unavailable” in Home Assistant.** The names of the panel's entities
(“Display”/“Anzeige” …) follow the language on the panel. After a change Home Assistant creates new ones; delete the old
ones under *Settings → Devices & services → ESPHome → device*. Update automations to the new entities if needed.

**New devices don't appear.** The Studio keeps a live connection and reconnects by itself; reloading the page helps if in doubt.

## General

**Does the Studio work without Home Assistant?** Yes, in demo mode with sample data. Full functionality (values, timers,
calendar, conditions, live changes, control) needs Home Assistant.

**Is there an app for Home Assistant Container (Docker) or Core?** No – there are no apps there.
Use the PC version and connect it with address and token.

**Does the PC have to keep running?** No. The panel works on its own with Home Assistant. You only need the PC for designing and uploading.

**Where are my settings?** PC version: in the `data` folder (it also contains token, Wi-Fi password and API key – **never
share or upload it**). App: in the app's storage, included in every HA backup.

**Updating the PC version.** When a new version is out, the overview shows *“Version X is available”* with
**What's new?** and **Download**:
1. Download and unpack the new ZIP.
2. Copy the `data` folder from the old version into it.
3. Run `Start.bat` or `start.sh`.
4. **Apply & upload to panel** once so the panel gets the new version too.

**Updating the app.** Shows up in Home Assistant under *Settings → Apps* like any other app.

**Why “apps” and not “add-ons”?** Home Assistant renamed add-ons to “apps” – it's the same thing.

**Licence?** GPL-3.0: use, modify and share; modified versions must stay open and under GPL-3.0 as well.

Didn't find what you need? → *Settings → Feedback* or an [issue on GitHub](https://github.com/Bitax/pixelpanel-studio/issues).
