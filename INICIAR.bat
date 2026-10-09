@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Execute npm install nesta pasta antes de iniciar.
  pause
  exit /b 1
)
node server.js
pause
