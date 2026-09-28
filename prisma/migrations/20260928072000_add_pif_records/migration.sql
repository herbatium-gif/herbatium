-- Adaugă coloana "pifRecords" pe UserData (dosarele PIF, câte unul per
-- produs, cheie = id-ul produsului). Aditivă și idempotentă (IF NOT EXISTS)
-- — sigură atât pe o bază nouă, cât și pe producție, la fel ca migrarea de
-- reparare anterioară (20260927224800_repair_missing_columns_and_tables).
ALTER TABLE "UserData" ADD COLUMN IF NOT EXISTS "pifRecords" JSONB NOT NULL DEFAULT '{}';
