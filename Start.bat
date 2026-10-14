@echo off
chcp 65001 >nul
title PixelPanel Studio
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo.
  echo  Erste Einrichtung – das dauert beim ersten Mal ein paar Minuten ...
  echo.
  py -3 -m venv .venv 2>nul || python -m venv .venv
  if not exist ".venv\Scripts\python.exe" (
    echo  Python wurde nicht gefunden. Bitte Python 3.11+ von python.org installieren
    echo  und beim Setup "Add python.exe to PATH" anhaken.
    pause
    exit /b 1
  )
  ".venv\Scripts\python.exe" -m pip install --upgrade pip
  ".venv\Scripts\python.exe" -m pip install -r requirements.txt
)

".venv\Scripts\python.exe" server.py
pause
