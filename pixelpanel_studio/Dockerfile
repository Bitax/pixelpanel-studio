FROM ghcr.io/home-assistant/base:latest

ARG PIXELPANEL_VERSION=3.2.1

# Python + the small web-server dependencies (ESPHome itself is NOT installed:
# firmware is compiled by the ESPHome app in Home Assistant)
RUN apk add --no-cache python3 py3-pip \
 && python3 -m venv /opt/venv \
 && /opt/venv/bin/pip install --no-cache-dir "fastapi>=0.110" "uvicorn>=0.29" "aiohttp>=3.9"

# Program files of the matching release
ADD https://github.com/Bitax/pixelpanel-studio/archive/refs/tags/v${PIXELPANEL_VERSION}.tar.gz /tmp/src.tar.gz
RUN mkdir -p /app \
 && tar -xzf /tmp/src.tar.gz -C /app --strip-components=1 \
 && rm -rf /tmp/src.tar.gz /app/pixelpanel_studio /app/.github /app/docs

ENV PIXELPANEL_APP=1 \
    PIXELPANEL_DATA=/data \
    PIXELPANEL_PORT=8765 \
    PIXELPANEL_NO_UPDATE_CHECK=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
# Start Python directly (no s6 supervisor needed) – keeps SUPERVISOR_TOKEN etc. in the environment
ENTRYPOINT [ "/opt/venv/bin/python", "server.py", "--no-browser" ]
CMD [ ]

LABEL \
  io.hass.version="3.2.1" \
  io.hass.type="app" \
  io.hass.arch="aarch64|amd64"
