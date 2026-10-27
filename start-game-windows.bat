@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (echo Install Node.js 20+ from https://nodejs.org & pause & exit /b 1)
start "GreenRev Node Server" cmd /k "node server.js"
timeout /t 2 /nobreak >nul
start "" http://localhost:5173
echo If the browser does not load, check the GreenRev Node Server window for errors.
