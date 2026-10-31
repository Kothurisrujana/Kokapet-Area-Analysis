@echo off
title Kokapet Property Map - local server
cd /d "%~dp0public"
echo.
echo  Starting local server in: %cd%
echo  Keep THIS window open while testing. Close it to stop.
echo.
where py >nul 2>nul && (start "" http://localhost:8000 & py -m http.server 8000 & goto end)
where python >nul 2>nul && (start "" http://localhost:8000 & python -m http.server 8000 & goto end)
where npx >nul 2>nul && (start "" http://localhost:8000 & npx --yes serve -l 8000 & goto end)
echo  ERROR: Neither Python nor Node.js is installed.
echo  Install Python from https://www.python.org/downloads/  (tick "Add python.exe to PATH")
echo  then double-click this file again.
:end
pause
