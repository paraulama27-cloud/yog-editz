@echo off
title YOG-EDITZ
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  node server.js
) else (
  echo Node.js tidak ditemukan. Membuka aplikasi langsung dari file...
  echo Tips: install Node.js dari https://nodejs.org agar aplikasi bisa di-install dan dipakai offline.
  start "" "%~dp0index.html"
  timeout /t 5 >nul
)
