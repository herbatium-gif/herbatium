@echo off
setlocal
cd /d "%~dp0"
title Herbatium - oprire

echo Opresc Herbatium...
docker compose down
echo.
echo Oprit. Datele raman salvate ^(le regasesti la urmatoarea pornire^).
echo.
pause
