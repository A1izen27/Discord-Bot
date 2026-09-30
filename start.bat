@echo off
rem Simple launcher for the local prefix (!) bot.
rem Root dir:   K:\website
rem Bot dir:    K:\website\bot
rem Token file: K:\website\bot\config.json
cd /d "%~dp0"
node index.js
echo.
echo Bot exited. Press any key to close.
pause >nul