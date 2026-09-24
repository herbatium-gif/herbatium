@echo off
setlocal
cd /d "%~dp0"
title Herbatium

echo ============================================
echo   Herbatium - pornire
echo ============================================
echo.

docker version >nul 2>&1
if errorlevel 1 (
  echo Docker Desktop nu ruleaza sau nu e instalat.
  echo.
  echo Deschide Docker Desktop, asteapta sa porneasca ^(iconita din bara
  echo de jos devine stabila^), apoi ruleaza din nou aceasta comanda rapida.
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  echo Nu exista fisierul .env - il creez din .env.example.
  copy /y ".env.example" ".env" >nul
  echo.
  echo IMPORTANT: se deschide acum .env in Notepad. Completeaza cel putin
  echo JWT_SECRET ^(orice sir lung, aleator^). Pentru plati reale, completeaza
  echo si sectiunea STRIPE_*. Salveaza si inchide Notepad ca sa continui.
  echo.
  pause
  notepad ".env"
)

echo.
echo Pornesc aplicatia si baza de date ^(prima pornire poate dura cateva
echo minute - se construieste imaginea^)...
echo.
docker compose up -d --build
if errorlevel 1 (
  echo.
  echo A aparut o eroare la pornire. Verifica mesajele de mai sus.
  pause
  exit /b 1
)

echo.
echo Astept ca serverul sa raspunda...
set /a tries=0
:waitloop
set /a tries+=1
curl -s -o nul -w "%%{http_code}" http://localhost:3000/healthz > "%TEMP%\herbatium_health.txt" 2>nul
set /p code=<"%TEMP%\herbatium_health.txt"
if "%code%"=="200" goto ready
if %tries% GEQ 60 goto timeout
timeout /t 2 /nobreak >nul
goto waitloop

:ready
echo.
echo Gata! Se deschide http://localhost:3000 in browser...
start "" "http://localhost:3000"
goto end

:timeout
echo.
echo Serverul nu a raspuns inca. Deschide manual http://localhost:3000
echo peste cateva minute, sau verifica jurnalul cu:
echo   docker compose logs -f app

:end
echo.
pause
