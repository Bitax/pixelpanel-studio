# Betreuung auf GitHub – Feedback & Community-Icons

Diese Anleitung ist für dich als Betreuer des Projekts. Nutzer brauchen sie nicht.

## Einmalig einrichten (ca. 10 Minuten)

1. **Repo anlegen** und den Inhalt dieses Ordners hochladen. `data/` und `.venv/` werden durch die
   `.gitignore` automatisch ausgelassen – darin stehen Tokens und Passwörter.
2. **Repo-Name eintragen:** In `version.py` → `GITHUB_REPO = "Bitax/pixelpanel-studio"` (ist schon eingetragen).
   Erst danach sind „Feedback senden“, „Icon für alle vorschlagen“ und der Community-Icon-Store im Studio aktiv.
3. **Labels anlegen:** Im Repo unter *Actions → Community-Icons → Run workflow* einmal starten.
   Das legt die Labels `icon-suggestion`, `icon-accepted`, `icon-rejected`, `idea` und `bug` an.
4. **Actions dürfen schreiben:** *Settings → Actions → General → Workflow permissions* →
   „Read and write permissions“ auswählen (damit der Bot Icons eintragen und kommentieren darf).
5. Optional: *Projects → New project → Board* mit Spalten „Neu / Prüfen / Geplant / Erledigt“ und unter
   *Workflows* „Item added → Neu“ für alle neuen Issues aktivieren – dann hast du alles auf einer Übersicht.

## So läuft es danach

**Feedback:** Nutzer klicken in den Einstellungen auf „Auf GitHub senden …“. Es öffnet sich ein
vorausgefülltes Issue (Label `idea` oder `bug`, optional mit Version, Board und Panel-Größe – nie mit
Passwörtern oder Tokens). Du bekommst eine Benachrichtigung per Mail bzw. in der GitHub-App.
Antworten, nachfragen, umsetzen – und das Issue im Commit mit „fixes #12“ automatisch schließen lassen.

**Icon-Vorschläge:**
1. Nutzer zeichnet ein Icon, setzt den Haken „Icon für alle vorschlagen“ und bestätigt die Rechte
   (selbst erstellt, keine Logos/Marken, CC0). Beim Sichern öffnet sich ein vorausgefülltes Issue.
2. Der Bot prüft das Icon automatisch und kommentiert mit einem **Vorschaubild**
   (liegt auf dem Branch `icon-previews`, damit `main` sauber bleibt). Ist etwas kaputt, sagt er es.
3. **Einmal im Monat** filterst du nach dem Label `icon-suggestion` und entscheidest:
   - Übernehmen → Label **`icon-accepted`** setzen. Der Bot trägt das Icon in `community/icons.json` ein,
     bedankt sich und schließt das Issue.
   - Ablehnen → Label `icon-rejected`, kurz begründen, schließen.
4. Das Studio lädt `community/icons.json` direkt von GitHub (stündlich neu). Angenommene Icons sind damit
   **sofort für alle** unter *Icon auswählen → Community-Icons* verfügbar – ganz ohne Update.

**Worauf du beim Prüfen achtest:** Keine Logos, Markenzeichen oder bekannten Figuren (auch wenn der Haken
gesetzt ist – Nutzer können Bilder laden). Nichts Anstößiges. Im Zweifel ablehnen.

## Sicherheit

- Das Studio sendet selbst nichts. Es öffnet nur GitHub im Browser; abgeschickt wird dort vom Nutzer.
- Der Bot liest den Issue-Text ausschließlich als Daten (über eine Umgebungsvariable) und prüft jedes
  Icon streng: höchstens 16 × 16 Pixel, nur gültige Farben und Zeichen. Es wird nie etwas daraus ausgeführt.
- Das Studio prüft den Katalog beim Laden noch einmal genauso – auch ein manipulierter Katalog kann
  nur Pixel enthalten.
- Workflows laufen immer mit dem Stand von `main`. Pull Requests von Fremden immer erst lesen, bevor du
  sie annimmst – besonders Änderungen in `.github/`.

## Rechtliches (kurz, keine Rechtsberatung)

Eingereichte Icons stehen unter **CC0** (siehe `community/LICENSE.md`): Jeder darf sie frei nutzen,
du darfst sie ohne Einschränkung in Updates aufnehmen. Ein komplettes „Abtreten aller Rechte“ gibt es
im deutschen Urheberrecht nicht – CC0 ist dafür der übliche Weg. Das Projekt selbst steht unter **GPL-3.0** (`LICENSE`).
Die Schrift Silkscreen steht unter der SIL OFL (`LICENSE-Silkscreen-OFL.txt`) und darf mit.

## Neue Version veröffentlichen

Bei jeder neuen Version (Beispiel 3.2) diese Stellen anpassen – **alle gleich**:

| Datei | Was |
|---|---|
| `version.py` | `VERSION = "3.2"` |
| `pixelpanel_studio/config.yaml` | `version: "3.2"` – daran erkennt Home Assistant das Update |
| `pixelpanel_studio/Dockerfile` | `ARG PIXELPANEL_VERSION=3.2` und `io.hass.version="3.2"` |
| `CHANGELOG.md` und `pixelpanel_studio/CHANGELOG.md` | neuer Abschnitt `## 3.2` oben (der App-Changelog erscheint in HA im Update-Dialog) |

Dann:
1. Änderungen auf `main` hochladen.
2. *Releases → Draft a new release* → Tag **`v3.2`** neu anlegen (genau so, mit „v“ – die App lädt genau diesen Tag),
   Titel „PixelPanel Studio 3.2“, Text aus dem Changelog.
3. Als Dateien anhängen: `PixelPanelStudio_3.2.zip` (ohne `data/`!), `PixelPanel_Handbuch_DE_3.2.pdf`, `PixelPanel_Manual_EN_3.2.pdf`.
4. **Publish release.** Ab jetzt sehen PC-Nutzer den Hinweis „Version 3.2 ist da“, und Home Assistant bietet das App-Update an.

Wichtig: Erst den Tag/Release anlegen, dann ist das App-Update installierbar – die App baut aus dem Tag.
