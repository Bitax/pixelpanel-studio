# Security

*Deutsch weiter unten.*

## How PixelPanel Studio protects you

- **PC version:** by default the Studio only listens on the local computer (`127.0.0.1`). Other devices can't reach it.
- **Phone access** (“Share on Wi-Fi”) requires a username and password. The password is stored only as a scrypt hash,
  sessions use secure cookies (HttpOnly, SameSite=Strict); after 5 failed attempts a growing delay applies.
  Without a password set, other devices are always locked out.
- Requests from other websites are rejected (host and origin checks), the Studio can't be embedded in foreign pages.
- **Home Assistant app:** only accepts connections through Home Assistant ingress; authentication is done by Home Assistant.
- The Studio sends nothing to the internet. It only *reads* from GitHub: the list of community icons
  (`community/icons.json`, hourly) and – PC version only – whether a new release exists (`api.github.com`, at most every
  6 hours). No personal data is sent. The feedback form opens GitHub in your browser; you submit it there.
  Passwords, tokens and keys are never included in feedback.

## Your responsibility

- The `data` folder contains your Home Assistant token, Wi-Fi password and API key in plain text – **never share or upload it**.
- **Never** forward the Studio's port to the internet. On the home network it runs without HTTPS – use a password you don't use anywhere else.

## Reporting a vulnerability

Please **don't** open a public issue for security problems. Use GitHub's
[private vulnerability reporting](https://github.com/Bitax/pixelpanel-studio/security/advisories/new) instead.
You'll get an answer as soon as possible.

Only the latest release receives security fixes.

---

## Deutsch

- **PC-Version:** standardmäßig nur auf diesem Computer erreichbar (`127.0.0.1`).
- **Handy-Zugriff** nur mit Benutzername und Passwort (scrypt-Hash, sichere Cookies, Wartezeit nach 5 Fehlversuchen).
- **Home-Assistant-App:** nur über Home Assistant (Ingress) erreichbar, die Anmeldung übernimmt Home Assistant.
- Das Studio schickt nichts ins Internet. Es liest nur von GitHub: die Community-Icons (stündlich) und – nur PC-Version – ob es eine neue Version gibt (höchstens alle 6 Stunden). Keine persönlichen Daten.
- Der Ordner `data` enthält Token, WLAN-Passwort und API-Schlüssel – **nie weitergeben oder hochladen**. Den Port **nie** im Router freigeben.

**Sicherheitslücke gefunden?** Bitte kein öffentliches Issue, sondern über
[private Meldung](https://github.com/Bitax/pixelpanel-studio/security/advisories/new).
