@echo off
title YOG-EDITZ (mode HP / WiFi)
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  node server.js --lan
) else (
  echo Node.js tidak ditemukan. Install dari https://nodejs.org lalu jalankan lagi.
  pause
)
