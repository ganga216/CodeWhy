@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18 or newer is required. Install Node.js, then run this file again.
  pause
  exit /b 1
)
start "CodeWhy server" /D "%~dp0" cmd /k node server.js
timeout /t 2 /nobreak >nul
start "" "http://localhost:8787"
endlocal
