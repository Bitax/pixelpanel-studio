#!/bin/sh
# PixelPanel Studio – Start für macOS / Linux (Windows: Start.bat)
cd "$(dirname "$0")" || exit 1
if [ ! -x .venv/bin/python ]; then
  echo "Erster Start: richte Python-Umgebung ein …"
  python3 -m venv .venv || { echo "Python 3.11 oder neuer wird benötigt (python.org)"; exit 1; }
  .venv/bin/pip install --upgrade pip >/dev/null
  .venv/bin/pip install -r requirements.txt || exit 1
fi
exec .venv/bin/python server.py "$@"
