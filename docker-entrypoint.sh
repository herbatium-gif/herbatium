#!/bin/sh
# Rulează la fiecare pornire a containerului: aplică automat migrările
# Prisma pe baza de date (creează tabelele dacă nu există, sau aplică orice
# schimbare nouă de schemă), apoi pornește serverul. Așa nu trebuie să rulezi
# manual "npx prisma migrate deploy" — e integrat în "docker compose up".
set -e

echo "[herbatium] aplic migrările bazei de date..."
npx prisma migrate deploy

echo "[herbatium] verific contul de administrator..."
node src/seedAdmin.js

echo "[herbatium] pornesc serverul..."
exec "$@"
