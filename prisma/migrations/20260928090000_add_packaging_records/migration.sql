-- Adaugă coloana "packagingRecords" pe UserData (dosarele de ambalaj cerute
-- de Reg. (UE) 2025/40 — PPWR, câte unul per produs, cheie = id-ul
-- produsului). Aditivă și idempotentă (IF NOT EXISTS) — sigură atât pe o
-- bază nouă, cât și pe producție, la fel ca migrările anterioare similare
-- (20260928072000_add_pif_records, 20260927224800_repair_missing_columns_and_tables).
ALTER TABLE "UserData" ADD COLUMN IF NOT EXISTS "packagingRecords" JSONB NOT NULL DEFAULT '{}';
