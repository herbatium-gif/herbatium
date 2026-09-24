#!/bin/sh
# Pornește Herbatium cu o singură comandă: ./start.sh
# Are nevoie doar de Docker Desktop (sau Docker Engine) instalat — nimic altceva.

set -e
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "Nu găsesc Docker. Instalează Docker Desktop de pe https://www.docker.com/products/docker-desktop/ și repornește această comandă."
  exit 1
fi

if [ ! -f .env ]; then
  echo "Nu am găsit .env — îl creez din .env.example."
  cp .env.example .env
  echo "IMPORTANT: deschide fișierul .env și completează cel puțin JWT_SECRET"
  echo "(orice șir lung, aleator) înainte de a continua. Pentru plăți reale,"
  echo "completează și STRIPE_*  — fără ele, aplicația pornește, dar abonamentul"
  echo "nu va funcționa."
  echo
  read -p "Apasă Enter când ai terminat de completat .env, ca să continui... " _
fi

echo "Pornesc Herbatium (aplicație + bază de date)..."
docker compose up -d --build

echo
echo "Gata! Aplicația rulează la: http://localhost:$(grep -E '^APP_PORT=' .env | cut -d= -f2 | tr -d '"' | tr -d "'" || echo 3000)"
echo "Ca s-o oprești: docker compose down"
echo "Ca să vezi jurnalul serverului: docker compose logs -f app"
