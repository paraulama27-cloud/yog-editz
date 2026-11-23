@echo off
title Unduh model AI - Teks otomatis
cd /d "%~dp0"
where node >nul 2>nul
if not %errorlevel%==0 (
  echo Node.js tidak ditemukan. Install dulu dari https://nodejs.org
  pause
  exit /b 1
)
echo Mengunduh model AI untuk fitur "Teks otomatis", "Teks ke suara", dan "Hapus latar"...
echo.
echo   [1] Cepat    ~77 MB
echo   [2] Akurat   ~250 MB  (disarankan)
echo   [3] Terbaik  ~620 MB  (paling akurat, lebih lambat)
echo   [4] Teks ke suara  ~110 MB  (suara AI bahasa Indonesia)
echo   [5] Hapus latar  ~25 MB  (hapus latar foto otomatis)
echo   [6] Semua
echo.
set /p PILIH=Ketik 1-6 lalu Enter (default 2):
if "%PILIH%"=="1" set M=base
if "%PILIH%"=="3" set M=turbo
if "%PILIH%"=="4" set M=tts
if "%PILIH%"=="5" set M=rmbg
if "%PILIH%"=="6" set M=all
if not defined M set M=small
node download-model.js %M%
pause
