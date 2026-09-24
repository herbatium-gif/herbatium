#!/bin/sh
# Regenerează instalatorul Windows (dist/Herbatium-Setup.exe) din codul curent
# al aplicației. Rulează asta după orice schimbare în src/, public/, prisma/
# etc., înainte să trimiți instalatorul mai departe — altfel el rămâne cu o
# copie veche a aplicației.
#
# Are nevoie de NSIS instalat (Linux: `apt-get install nsis`, Windows: NSIS
# de pe https://nsis.sourceforge.io/, sau rulează acest folder pe Linux/CI).

set -e
cd "$(dirname "$0")"
ROOT="$(cd .. && pwd)"

echo "[installer] pregătesc payload-ul din codul curent..."
rm -rf payload
mkdir -p payload
cp -r "$ROOT/Dockerfile" "$ROOT/docker-compose.yml" "$ROOT/docker-entrypoint.sh" \
      "$ROOT/package.json" "$ROOT/package-lock.json" "$ROOT/prisma" "$ROOT/src" \
      "$ROOT/public" "$ROOT/docs" "$ROOT/.env.example" "$ROOT/.dockerignore" \
      "$ROOT/README.md" payload/
cp start-herbatium.bat stop-herbatium.bat payload/

echo "[installer] compilez instalatorul..."
mkdir -p "$ROOT/dist"
makensis Herbatium.nsi

echo "[installer] gata: $ROOT/dist/Herbatium-Setup.exe"
